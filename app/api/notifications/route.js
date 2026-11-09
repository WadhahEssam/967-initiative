import {taskRequestDb} from '@/lib/taskServer';
import {serverDb} from '@/lib/supabase-server';
import {authorizeAudience} from '@/lib/debateApi';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {
 accountNotice,conversationNotice,taskNotice,groupSimilarNotices,
 NOTIFICATION_PAGE_SIZE,NOTIFICATION_CATEGORIES,validNotificationIds,
 NOTIFICATION_PREFERENCE_KEYS,normalizeNotificationPreferences,isNotificationEnabled
} from '@/lib/unifiedNotifications';
import {marketChatNotice,marketNotice} from '@/lib/market/notices';
import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Robots-Tag':'noindex, nofollow'};
const response=(body,status=200)=>Response.json(body,{status,headers});
const categoryAllowed=new Set(NOTIFICATION_CATEGORIES);
// Use bounded reads and a normalized view; no duplicate notification table.
const SOURCE_LIMIT=501;

async function sources(request){
 const db=taskRequestDb(request);
 const user=await authorizeAudience(request,db);
 return {db,user};
}
function dbError(error){
 if(error)throw new RequestValidationError('تعذر تحميل الإشعارات. حاول مجددًا.',503);
}
async function preferences(db,user){
 const service=serverDb();
 const [account,messaging]=await Promise.all([
  db.from('account_preferences').select('notify_replies,notify_moderation,notify_tasks,notify_new_debates_since')
   .eq('user_id',user.id).maybeSingle(),
  service?service.from('private_messaging_settings').select('notify_messages')
   .eq('user_id',user.id).maybeSingle():Promise.resolve({data:null,error:null}),
 ]);
 dbError(account.error);dbError(messaging.error);
 return normalizeNotificationPreferences(account.data,messaging.data);
}
function accountQuery(db,id,category,limit,prefs){
 if(category==='messages'||category==='tasks')return null;
 const kinds=(category==='account'?['system']:category==='debates'?['reply','moderation','debate']:['system','reply','moderation','debate'])
  .filter(kind=>kind==='system'||kind==='debate'||(kind==='reply'?prefs.replies:prefs.debates));
 if(!kinds.length)return null;
 return db.from('account_notifications')
  .select('id,kind,title,description,href,created_at,read_at',{count:'exact'})
  .eq('user_id',id).in('kind',kinds)
  .or('href.is.null,href.not.like./messages%')
  .order('created_at',{ascending:false}).limit(limit);
}
function taskQuery(db,id,category,limit,prefs){
 if(!prefs.tasks||!['all','tasks'].includes(category))return null;
 return db.from('task_notifications')
  .select('id,task_id,comment_id,kind,created_at,read_at',{count:'exact'})
  .eq('user_id',id).order('created_at',{ascending:false}).limit(limit);
}
async function messageNotices(user,category,prefs){
 if(!prefs.messages||!['all','messages'].includes(category)||!user.email_confirmed_at||
  user.banned_until&&Date.parse(user.banned_until)>Date.now())return [];
 const service=serverDb();
 if(!service)return [];
 const {data:profile,error:profileError}=await service.from('public_profiles')
  .select('suspended,deletion_requested_at').eq('user_id',user.id).maybeSingle();
 dbError(profileError);
 if(profile?.suspended||profile?.deletion_requested_at)return [];
 const {data,error}=await service.rpc('private_messaging_inbox',{p_actor:user.id});
 dbError(error);
 return (data||[]).map(row=>conversationNotice(row,user.id)).filter(Boolean);
}
// Resolve the ORIGINAL comment for reply alerts. Notifications belong to the
// verified user already. Only parent IDs are read with service permissions;
// no comment bodies or third-party accounts leave this endpoint.
async function replyParents(accountRows){
 const idPattern=/^\/debates\/[^?#]+#comment-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
 const ids=[...new Set(accountRows.filter(row=>row.kind==='reply').map(row=>
  String(row.href||'').match(idPattern)?.[1]).filter(Boolean))];
 const service=serverDb(),found=new Map();
 if(!service||!ids.length)return found;
 for(let offset=0;offset<ids.length;offset+=100){
  const batch=ids.slice(offset,offset+100);
  const {data,error}=await service.from('debate_comments').select('id,parent_id').in('id',batch);
  dbError(error);
  for(const row of data||[])if(row.parent_id)found.set(row.id,row.parent_id);
 }
 return found;
}
// «سوق 967»: stored market events and chats with unread messages (read with the server's key for
// the verified member only). A market failure never hides the other notifications.
async function marketNotices(user,prefs){
 const service=serverDb();
 if(!service)return {items:[],enabled:false};
 const settled=promise=>Promise.resolve(promise).then(result=>result?.error?{data:[]}:result,()=>({data:[]}));
 const [stored,chats,settings]=await Promise.all([
  settled(service.from('market_notifications').select('id,kind,subject,detail,count,href,created_at,read_at')
   .eq('user_id',user.id).order('created_at',{ascending:false}).limit(SOURCE_LIMIT)),
  prefs.messages?settled(service.from('market_chats').select('id,listing_id,buyer_id,seller_id,buyer_unread,seller_unread,last_preview,last_message_at')
   .or('and(buyer_id.eq.'+user.id+',buyer_unread.gt.0),and(seller_id.eq.'+user.id+',seller_unread.gt.0)').limit(200)):{data:[]},
  getSiteSettings().catch(()=>null),
 ]);
 const chatRows=chats.data||[];
 let titles=new Map();
 if(chatRows.length){
  const listings=await settled(service.from('market_listings').select('id,title').in('id',[...new Set(chatRows.map(row=>row.listing_id))]));
  titles=new Map((listings.data||[]).map(row=>[row.id,row.title]));
 }
 const items=[
  ...(stored.data||[]).map(marketNotice),
  ...chatRows.map(row=>marketChatNotice({...row,unread:row.buyer_id===user.id?row.buyer_unread:row.seller_unread},titles.get(row.listing_id))),
 ].filter(Boolean);
 // The «السوق» filter shows once the market is open, or for members who already have market news.
 return {items,enabled:sectionStatus('market',settings)==='visible'||items.length>0};
}
async function readCenter(db,user,{mode,category,page}){
 const prefs=await preferences(db,user);
 const [accounts,tasks,messages]=await Promise.all([
  accountQuery(db,user.id,category,SOURCE_LIMIT,prefs),
  taskQuery(db,user.id,category,SOURCE_LIMIT,prefs),
  messageNotices(user,category,prefs),
 ].map(value=>value||Promise.resolve({data:[],count:0,error:null})));
 const market=await marketNotices(user,prefs);
 dbError(accounts.error);dbError(tasks.error);
 const rows=tasks.data||[];
 let titles=new Map();
 if(rows.length){
  const ids=[...new Set(rows.map(row=>row.task_id).filter(Boolean))];
  const {data,error}=await db.from('tasks').select('id,title').in('id',ids).limit(SOURCE_LIMIT);
  dbError(error);
  titles=new Map((data||[]).map(row=>[row.id,row.title]));
 }
 const accountRows=accounts.data||[];
 const parents=await replyParents(accountRows);
 const entries=groupSimilarNotices([
  ...accountRows.map(row=>{
   const replyId=String(row.href||'').match(/#comment-([0-9a-f-]{36})$/i)?.[1];
   return accountNotice({...row,reply_parent:replyId?parents.get(replyId):null});
  }),
  ...rows.map(row=>taskNotice(row,titles.get(row.task_id))),
  ...messages,
  ...(['all','market'].includes(category)?market.items:[])
 ].filter(notice=>isNotificationEnabled(notice,prefs)));
 const count=entries.filter(notice=>notice.unread).length;
 const markableCount=entries.filter(notice=>notice.unread&&notice.source!=='message').length;
 const offset=(page-1)*NOTIFICATION_PAGE_SIZE;
 return {
  count,total:entries.length,markable_count:markableCount,preferences:prefs,market_enabled:market.enabled,
  items:mode==='summary'?entries.slice(0,5):entries.slice(offset,offset+NOTIFICATION_PAGE_SIZE),
  hasMore:mode==='summary'?false:entries.length>offset+NOTIFICATION_PAGE_SIZE,
  // Source limits are conservative. Badge values 99+ may be approximate
  // when an account has more than 500 notifications in one source.
  limited:(accounts.count||0)>SOURCE_LIMIT||(tasks.count||0)>SOURCE_LIMIT,
 };
}
export async function GET(request){
 try{
  const {db,user}=await sources(request);
  const params=new URL(request.url).searchParams;
  const mode=params.get('mode')||'summary',category=params.get('category')||'all';
  const raw=params.get('page')||'1';
  if(!['summary','list'].includes(mode)||!categoryAllowed.has(category)||!/^[1-9][0-9]?$/.test(raw)||
   Number(raw)>10)throw new RequestValidationError('معايير عرض الإشعارات غير صالحة.');
  return response(await readCenter(db,user,{mode,category:mode==='summary'?'all':category,page:Number(raw)}));
 }catch(error){
  return response({error:error instanceof RequestValidationError?error.message:'تعذر تحميل الإشعارات.'},
   error instanceof RequestValidationError?error.status:503);
 }
}
async function setPreference(db,user,key,enabled){
 if(!NOTIFICATION_PREFERENCE_KEYS.includes(key)||typeof enabled!=='boolean')
  throw new RequestValidationError('إعداد الإشعارات غير صالح.');
 if(key==='messages'){
  // This is the SAME setting used by private messaging for alerts/sound.
  // The service role is server-only, and the user ID is from getUser(token),
  // never from the request body.
  const service=serverDb();
  if(!service)throw new RequestValidationError('خدمة الإشعارات غير متاحة.',503);
  const {error}=await service.from('private_messaging_settings')
   .upsert({user_id:user.id,notify_messages:enabled},{onConflict:'user_id',defaultToNull:false});
  dbError(error);
  return;
 }
 if(key==='new_debates'){
  const {error}=await db.from('account_preferences')
   .upsert({user_id:user.id,notify_new_debates_since:enabled?new Date().toISOString():null},
    {onConflict:'user_id',defaultToNull:false});
  dbError(error);
  return;
 }
 const column={tasks:'notify_tasks',replies:'notify_replies',debates:'notify_moderation'}[key];
 const {error}=await db.from('account_preferences')
  .upsert({user_id:user.id,[column]:enabled},{onConflict:'user_id',defaultToNull:false});
 dbError(error);
}
export async function POST(request){
 try{
  const {db,user}=await sources(request);
  const body=await readJsonObject(request,30000);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestValidationError('طلب غير صالح.');
  const time=new Date().toISOString();
  if(body.action==='preference'){
   await setPreference(db,user,body.key,body.enabled);
  }else if(body.action==='read'){
   const ids=body.ids??[body.id];
   if(!validNotificationIds(body.source,ids))throw new RequestValidationError('معرّف الإشعار غير صالح.');
   if(body.source==='market'){
    // Market notifications are private to the server; the verified member's own rows only.
    const service=serverDb();
    if(!service)throw new RequestValidationError('خدمة الإشعارات غير متاحة.',503);
    const {error}=await service.from('market_notifications').update({read_at:time}).eq('user_id',user.id).in('id',ids).is('read_at',null);
    dbError(error);
   }else{
    const table=body.source==='account'?'account_notifications':'task_notifications';
    // A grouped alert can be marked read without touching unrelated records.
    const {error}=await db.from(table).update({read_at:time})
     .eq('user_id',user.id).in('id',ids).is('read_at',null);
    dbError(error);
   }
  }else if(body.action==='read_all'){
   // Mark only persisted notices; private-message read receipts remain
   // untouched until the owner opens the actual conversation.
   const results=await Promise.all(['account_notifications','task_notifications'].map(table=>{
    let query=db.from(table).update({read_at:time}).eq('user_id',user.id).is('read_at',null);
    if(table==='account_notifications')query=query.or('href.is.null,href.not.like./messages%');
    return query;
   }));
   for(const result of results)dbError(result.error);
   const service=serverDb();
   if(service){
    const market=await service.from('market_notifications').update({read_at:time}).eq('user_id',user.id).is('read_at',null);
    // Before the market tables exist there is nothing to mark.
    if(market.error&&market.error.code!=='42P01')dbError(market.error);
   }
  }else throw new RequestValidationError('الإجراء غير مدعوم.');
  return response({ok:true});
 }catch(error){
  return response({error:error instanceof RequestValidationError?error.message:'تعذر حفظ الإشعار.'},
   error instanceof RequestValidationError?error.status:503);
 }
}
