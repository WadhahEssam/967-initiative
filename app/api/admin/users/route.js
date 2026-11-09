import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {serverDb} from '@/lib/supabase-server';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {accountRow,accountSummary,filterAccountRows,validateManagementAction} from '@/lib/managementUsers';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const fail=(message,status=400)=>json({error:message},status);

async function management(request){
 const db=serverDb();
 const actor=await authorizeEditorRequest(request,db);
 if(actor.role!=='management')throw new RequestValidationError('صفحة المستخدمين متاحة لحسابات الإدارة فقط، وليس أدمن التحرير.',403);
 return {db,actor:actor.user};
}

async function allAccounts(db){
 // Auth's admin API supports paging, but not search across email and user
 // metadata. Filter on the server; never send an unfiltered user directory to
 // the browser. Do not silently truncate beyond the safety limit.
 const accounts=[];
 for(let page=1;page<=20;page++){
  const {data,error}=await db.auth.admin.listUsers({page,perPage:500});
  if(error)throw error;
  const batch=data?.users||[];
  accounts.push(...batch);
  if(batch.length<500)return accounts;
 }
 throw Error('User listing exceeded 10000 account safety limit');
}

function handleFailure(error){
 if(error instanceof RequestValidationError)return fail(error.message,error.status);
 console.error('management user directory request failed',error?.code||error?.name||'unknown');
 return fail('تعذر تنفيذ طلب إدارة المستخدمين. حاول مجددًا.',503);
}

export async function GET(request){
 try{
  const {db}=await management(request);
  const params=new URL(request.url).searchParams;
  const filters={q:(params.get('q')||'').slice(0,120),status:params.get('status')||'all',role:params.get('role')||'all',sort:params.get('sort')||'created_desc',page:params.get('page')||'1'};
  const [accounts,editorResult]=await Promise.all([
   allAccounts(db),db.from('editors').select('user_id,role')
  ]);
  if(editorResult.error)throw editorResult.error;
  const editorRoles=new Map((editorResult.data||[]).map(item=>[item.user_id,item.role]));
  // Keep the management directory consistent with public member pages, chat and search.
  // Batch the IDs to respect PostgREST query limits as the account list grows.
  const profileNames=new Map();
  for(let offset=0;offset<accounts.length;offset+=200){
   const ids=accounts.slice(offset,offset+200).map(user=>user.id);
   const {data,error}=await db.from('public_profiles').select('user_id,display_name').in('user_id',ids);
   if(error)throw error;
   for(const p of data||[])profileNames.set(p.user_id,p.display_name);
  }
  const now=Date.now();
  const rows=accounts.map(user=>accountRow(user,editorRoles.get(user.id),now,profileNames.get(user.id)));
  return json({...filterAccountRows(rows,filters),summary:accountSummary(rows)});
 }catch(error){return handleFailure(error);}
}

async function findTarget(db,id){
 const {data,error}=await db.auth.admin.getUserById(id);
 if(error||!data?.user)throw new RequestValidationError('لم يتم العثور على الحساب المطلوب.',404);
 return data.user;
}

// Last step of a member's deletion request, after «إخفاء الهوية» in the debates audience panel.
// Editors must lose their permissions first. Rows that would block the auth delete (tasks,
// comments, lesson edits) are detached by public.release_deleted_account: tasks assigned to the
// user go to the manager doing the deletion, and authorship becomes «عضو سابق».
async function deleteAccount(db,actor,target,editor){
 if(editor)throw new RequestValidationError('هذا الحساب لديه صلاحيات تحرير. أزل صلاحياته من إدارة المحررين أولًا.',403);
 const profile=await db.from('public_profiles').select('display_name,deletion_requested_at').eq('user_id',target.id).maybeSingle();
 if(profile.error)throw profile.error;
 if(!profile.data?.deletion_requested_at)throw new RequestValidationError('لا يوجد طلب حذف من صاحب هذا الحساب.',409);
 if(profile.data.display_name!=='حساب محذوف')throw new RequestValidationError('نفّذ «معالجة طلب الحذف وإخفاء الهوية» أولًا.',409);
 const released=await db.rpc('release_deleted_account',{p_user:target.id,p_successor:actor.id});
 if(released.error)throw released.error;
 const {error}=await db.auth.admin.deleteUser(target.id);
 if(error)throw error;
 const moved=released.data?.reassigned||0;
 console.info('management_account_deleted',{reassigned:moved});
 return json({ok:true,message:'حُذف الحساب نهائيًا.'+(moved?' نُقلت '+moved+' مهام كانت مسندة إليه إلى حسابك.':'')});
}

export async function POST(request){
 try{
  const {db,actor}=await management(request);
  const body=await readJsonObject(request,10000);
  const invalid=validateManagementAction(body);
  if(invalid)throw new RequestValidationError(invalid,400);
  if(actor.id===body.user_id)throw new RequestValidationError(body.action==='delete'?'لا يمكنك حذف حسابك الحالي من هنا.':'لا يمكنك تغيير حالة حظر حسابك الحالي من هنا.',403);
  const target=await findTarget(db,body.user_id);
  const editor=await db.from('editors').select('role').eq('user_id',target.id).maybeSingle();
  if(editor.error)throw editor.error;
  if(body.action==='delete')return await deleteAccount(db,actor,target,editor.data);

  // Prevent all staff lockouts, not merely self-bans: changes to staff
  // privileges must first be made explicitly in the editors management UI.
  if(editor.data?.role==='admin'||editor.data?.role==='management'){
   throw new RequestValidationError('لا يمكن حظر حساب إداري أو حساب أدمن من هنا. راجع إدارة الصلاحيات أولًا.',403);
  }
  const currentlyBanned=Boolean(target.banned_until&&Date.parse(target.banned_until)>Date.now());
  if(body.action==='ban'&&currentlyBanned)throw new RequestValidationError('هذا الحساب محظور بالفعل.',409);
  if(body.action==='unban'&&!currentlyBanned)throw new RequestValidationError('هذا الحساب ليس محظورًا.',409);
  const ban_duration=body.action==='unban'?'none':body.duration;
  const {error}=await db.auth.admin.updateUserById(target.id,{ban_duration});
  if(error)throw error;
  // Supabase bans block new sign-ins / refreshes. Previously issued JWTs
  // can remain usable until their natural expiry; do not claim instant revocation.
  console.info('management_account_status_changed',{action:body.action});
  return json({ok:true,message:body.action==='ban'?'تم تسجيل الحظر. قد تبقى جلسات صادرة سابقة صالحة حتى انتهاء رمزها.':'تم رفع الحظر.'});
 }catch(error){return handleFailure(error);}
}
