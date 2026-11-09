// Pure helpers for the management-only accounts directory.
// No auth user record or service-role credential may be cached in the browser.
export const USER_LIST_SIZE=25;
const roles=new Set(['management','admin']);
const methods=new Set(['created_desc','created_asc','login_desc','name_asc']);

export function isAccountBanned(until,now=Date.now()){
 const time=Date.parse(until||'');
 return Number.isFinite(time)&&time>now;
}

export function accountRow(user,editorRole=null,now=Date.now(),publicDisplayName=null){
 const meta=user.user_metadata||{};
 const email=typeof user.email==='string'?user.email:'';
 // The public profile is the canonical name shown across search and chat.
 const rawName=[publicDisplayName,meta.display_name,meta.full_name,meta.name].find(value=>typeof value==='string'&&value.trim());
 const name=String(rawName||email.split('@')[0]||'مستخدم دون اسم').trim().slice(0,120);
 const role=roles.has(editorRole)?editorRole:'user';
 const banned=isAccountBanned(user.banned_until,now);
 return {
  id:user.id,name,email,
  role,
  provider:String(user.app_metadata?.provider||'email').slice(0,40),
  created_at:user.created_at||null,
  last_sign_in_at:user.last_sign_in_at||null,
  email_confirmed:Boolean(user.email_confirmed_at),
  banned_until:banned?user.banned_until:null,
  status:banned?'banned':!user.email_confirmed_at&&email?'unverified':'active'
 };
}

export function filterAccountRows(rows,filters={}){
 const q=String(filters.q||'').trim().toLocaleLowerCase().slice(0,120);
 const status=String(filters.status||'all');
 const role=String(filters.role||'all');
 const sort=methods.has(filters.sort)?filters.sort:'created_desc';
 const filtered=rows.filter(row=>
  (!q||[row.id,row.name,row.email].some(value=>String(value||'').toLocaleLowerCase().includes(q)))&&
  (status==='all'||row.status===status)&&
  (role==='all'||row.role===role)
 );
 filtered.sort((a,b)=>{
  if(sort==='name_asc')return a.name.localeCompare(b.name,'ar')||a.id.localeCompare(b.id);
  const key=sort==='login_desc'?'last_sign_in_at':'created_at';
  const aTime=Date.parse(a[key]||'')||0,bTime=Date.parse(b[key]||'')||0;
  return (sort==='created_asc'?aTime-bTime:bTime-aTime)||a.id.localeCompare(b.id);
 });
 const requested=Number(filters.page);
 const pageInput=Number.isSafeInteger(requested)?Math.max(1,Math.min(100000,requested)):1;
 const pages=Math.max(1,Math.ceil(filtered.length/USER_LIST_SIZE));
 const page=Math.min(pageInput,pages);
 return {users:filtered.slice((page-1)*USER_LIST_SIZE,page*USER_LIST_SIZE),total:filtered.length,page,pages,perPage:USER_LIST_SIZE};
}

export function accountSummary(rows){
 return {total:rows.length,active:rows.filter(r=>r.status==='active').length,banned:rows.filter(r=>r.status==='banned').length,unverified:rows.filter(r=>r.status==='unverified').length};
}

export function validateAccountId(value){
 return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateManagementAction(body){
 if(!validateAccountId(body.user_id))return 'معرّف المستخدم غير صالح.';
 if(!['ban','unban','delete'].includes(body.action))return 'الإجراء غير مدعوم.';
 if(body.action==='ban'&&!['24h','168h','720h','876000h'].includes(body.duration))return 'مدة الحظر غير صحيحة.';
 return null;
}
