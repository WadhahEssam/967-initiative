import {authorizeAudience} from '@/lib/debateApi';
import {taskRequestDb} from '@/lib/taskServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {readingContentItem} from '@/lib/readingList';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization','X-Robots-Tag':'noindex, nofollow'}});
const ID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const defaults={bio:'',governorate:'',website:'',social_url:'',activity_tracking:false,notify_replies:true,notify_moderation:true};
const simple=(value,limit)=>typeof value==='string'&&value.trim().length<=limit?value.trim():null;
const safeHttps=value=>!value||(()=>{try{let u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&u.hostname.includes('.')}catch{return false}})();
function ensure(ok,message,status=400){if(!ok)throw new RequestValidationError(message,status)}
function failed(error,message='تعذّر حفظ تغييراتك. حاول مجدداً.'){
 if(error)throw new RequestValidationError(['23505','23503','23514'].includes(error.code)?'القيمة مكررة أو غير مسموحة. راجع البيانات.':message,['23505','23503'].includes(error.code)?409:503);
}
async function ownerRows(db,table,user,columns='*'){
 const {data,error}=await db.from(table).select(columns).eq('user_id',user).order('created_at',{ascending:false}).limit(101);
 failed(error,'تعذّر تحميل بيانات حسابك.');return data||[];
}
async function snapshot(db,id){
 const [prefs,collections,saved,notifications,unread,submissions]=await Promise.all([
  db.from('account_preferences').select('*').eq('user_id',id).maybeSingle(),
  ownerRows(db,'account_collections',id),
  ownerRows(db,'account_saved_items',id),
  // Message notices live in the messages inbox (as in /api/notifications), so they are neither listed nor counted here.
  db.from('account_notifications').select('*').eq('user_id',id).or('href.is.null,href.not.like./messages%').order('created_at',{ascending:false}).limit(50),
  db.from('account_notifications').select('id',{head:true,count:'exact'}).eq('user_id',id).is('read_at',null).or('href.is.null,href.not.like./messages%'),
  db.from('messages').select('id,type,message,status,created_at',{count:'exact'}).eq('user_id',id).order('created_at',{ascending:false}).limit(50)
 ]);
 failed(prefs.error);failed(notifications.error);failed(unread.error);failed(submissions.error);
 return {preferences:{...defaults,...prefs.data},collections:collections.slice(0,30),saved:saved.slice(0,100),notifications:notifications.data||[],unread:unread.count||0,submissions:submissions.data||[],submissionTotal:submissions.count||0};
}
async function perform(db,id,body){
 const action=body.action;
 if(action==='save'||action==='import'){
  const input=action==='import'?body.items:[body.item];
  ensure(Array.isArray(input)&&input.length>=1&&input.length<=100,'قائمة الحفظ غير صالحة.');
  const distinct=new Map();
  for(const raw of input){const item=readingContentItem(raw);ensure(item,'تعذّر اعتماد أحد روابط الحفظ.');distinct.set(item.href,item);}
  const collection=body.collection_id;
  if(collection){ensure(ID.test(collection),'معرّف المجموعة غير صالح.');
   const {data,error}=await db.from('account_collections').select('id').eq('user_id',id).eq('id',collection).maybeSingle();failed(error);ensure(data,'هذه المجموعة غير موجودة.',404);}
  const existing=await ownerRows(db,'account_saved_items',id,'href');ensure(new Set([...existing.map(x=>x.href),...distinct.keys()]).size<=100,'الحد الأقصى 100 مادة محفوظة.',409);
  const rows=[...distinct.values()].map(item=>({...item,user_id:id,...(action==='save'&&collection?{collection_id:collection}:{})}));
  const {error}=await db.from('account_saved_items').upsert(rows,{onConflict:'user_id,href',ignoreDuplicates:true});failed(error);
  return {success:true,count:rows.length};
 }
 if(action==='remove'){
  ensure(typeof body.href==='string'&&readingContentItem({href:body.href,kind:body.kind,title:body.title||'مادة'})!==null,'رابط الحفظ غير صالح.');
  const {error}=await db.from('account_saved_items').delete().eq('user_id',id).eq('href',body.href);failed(error);return {success:true};
 }
 if(action==='collection_create'||action==='collection_rename'){
  const name=simple(body.name,80);ensure(name&&name.length>=2,'اسم المجموعة يجب أن يتكون من حرفين على الأقل.');
  if(action==='collection_create'){
   const current=await ownerRows(db,'account_collections',id,'id');ensure(current.length<20,'الحد الأقصى 20 مجموعة.');
   const {error}=await db.from('account_collections').insert({user_id:id,name});failed(error);
  }else{
   ensure(ID.test(body.id),'معرّف المجموعة غير صالح.');
   const {data,error}=await db.from('account_collections').update({name}).eq('user_id',id).eq('id',body.id).select('id').maybeSingle();
   failed(error);ensure(data,'المجموعة غير موجودة.',404);
  }return {success:true};
 }
 if(action==='collection_delete'){
  ensure(ID.test(body.id),'معرّف المجموعة غير صالح.');
  const {error}=await db.from('account_collections').delete().eq('user_id',id).eq('id',body.id);failed(error);return {success:true};
 }
 if(action==='move'){
  ensure(typeof body.href==='string'&&body.href.length<=3000,'رابط غير صالح.');
  let group=body.collection_id||null;
  if(group){ensure(ID.test(group),'معرّف المجموعة غير صالح.');const {data,error}=await db.from('account_collections').select('id').eq('user_id',id).eq('id',group).maybeSingle();failed(error);ensure(data,'المجموعة غير موجودة.',404);}
  const {data,error}=await db.from('account_saved_items').update({collection_id:group}).eq('user_id',id).eq('href',body.href).select('id').maybeSingle();
  failed(error);ensure(data,'المادة غير موجودة.',404);return {success:true};
 }
 if(action==='preferences'){
  let out={user_id:id,updated_at:new Date().toISOString()};
  for(const [key,max] of [['bio',600],['governorate',100],['website',300],['social_url',300]]){
   const value=simple(body[key],max);ensure(value!==null,'تحقق من حقل '+key);if(key.endsWith('url')||key==='website')ensure(safeHttps(value),'استخدم روابط HTTPS صحيحة.');out[key]=value;
  }
  for(const key of ['notify_replies','notify_moderation','activity_tracking']){ensure(typeof body[key]==='boolean','إعداد غير صالح.');out[key]=body[key];}
  const {error}=await db.from('account_preferences').upsert(out,{onConflict:'user_id',defaultToNull:false});failed(error);return {success:true};
 }
 if(action==='notification_read'){
  if(body.id!==null)ensure(ID.test(body.id),'معرّف الإشعار غير صالح.');
  let q=db.from('account_notifications').update({read_at:new Date().toISOString()}).eq('user_id',id).is('read_at',null);
  if(body.id)q=q.eq('id',body.id);
  const {error}=await q;failed(error);return {success:true};
 }
 throw new RequestValidationError('الإجراء غير مدعوم.');
}
async function handler(request){
 try{
  const db=taskRequestDb(request),user=await authorizeAudience(request,db);
  if(request.method==='GET'){
   if(new URL(request.url).searchParams.get('export')==='1'){
    // Only the authenticated owner can access this private export.
    const workspace=await snapshot(db,user.id);
    const tables=['debate_comments','debate_questions','debate_suggestions','debate_votes'];
    const entries=await Promise.all(tables.map(table=>ownerRows(db,table,user.id)));
    const {data:profile,error}=await db.from('public_profiles').select('display_name,avatar_url,show_avatar,created_at,updated_at').eq('user_id',user.id).maybeSingle();failed(error);
    return json({exported_at:new Date().toISOString(),email:user.email,profile,workspace,debates:Object.fromEntries(tables.map((t,i)=>[t,entries[i]])),note:'تُعرض حتى 100 مشاركة من كل نوع في هذا التصدير؛ تواصل معنا لطلب تصدير كامل عند تجاوز العدد.'});
   }
   return json(await snapshot(db,user.id));
  }
  ensure(request.method==='POST','طريقة الطلب غير متاحة.',405);
  const body=await readJsonObject(request,400000);
  return json(await perform(db,user.id,body));
 }catch(error){return json({error:error instanceof RequestValidationError?error.message:'تعذّر تنفيذ الطلب. حاول لاحقاً.'},error instanceof RequestValidationError?error.status:503);}
}
export const GET=handler,POST=handler;
