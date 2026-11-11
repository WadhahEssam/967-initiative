import {serverDb} from '@/lib/supabase-server';
import {authorizeAudience} from '@/lib/debateApi';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {validateMessagingAction,safeMessagingQuery,messagingError,canReceiveSearchRequests,MESSAGE_PAGE_SIZE,MESSAGE_SEARCH_PAGE_SIZE,UUID_RE} from '@/lib/privateMessaging';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Robots-Tag':'noindex, nofollow'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const fail=(message,status)=>json({error:message},status);

async function authorized(request){
 const db=serverDb();
 const user=await authorizeAudience(request,db);
 if(!user.email_confirmed_at||user.banned_until&&Date.parse(user.banned_until)>Date.now())
  throw new RequestValidationError('يجب تأكيد البريد وألا يكون الحساب محظورًا للمراسلة.',403);
 const {data:profile,error}=await db.from('public_profiles')
  .select('suspended,deletion_requested_at').eq('user_id',user.id).maybeSingle();
 if(error)throw error;
 if(profile?.suspended||profile?.deletion_requested_at)
  throw new RequestValidationError('المراسلة غير متاحة لهذا الحساب.',403);
 return {db,user};
}
function check(result){
 if(result.error)throw messagingError(result.error)||result.error;
 return result.data;
}
// Only what the header needs: who, the last line, when, and whether it is unread.
function latestConversation(rows,actor){
 const row=rows.filter(c=>!c.blocked&&(c.status==='accepted'||c.status==='pending'&&c.requested_by!==actor))
  .sort((a,b)=>Date.parse(b.last_message_at||b.requested_at||b.updated_at||0)-Date.parse(a.last_message_at||a.requested_at||a.updated_at||0))[0];
 if(!row)return null;
 const request=row.status==='pending';
 return {id:row.id,name:row.partner_name||'مستخدم 967',avatar:row.avatar_url||null,request,
  excerpt:String(request?row.intro||'طلب محادثة جديد':row.last_excerpt||'').slice(0,120),
  at:row.last_message_at||row.requested_at||row.updated_at||null,unread:request?1:row.muted?0:Number(row.unread||0)};
}
async function inbox(db,id){
 return check(await db.rpc('private_messaging_inbox',{p_actor:id}))||[];
}

async function conversationForParticipant(db,actor,conversation){
 const {data:c,error}=await db.from('private_conversations')
  .select('id,user_low,user_high,status,requested_by,intro,requested_at,pinned_message_id,pinned_by,pinned_at')
  .eq('id',conversation).maybeSingle();
 if(error)throw error;
 if(!c||![c.user_low,c.user_high].includes(actor))
  throw new RequestValidationError('المحادثة غير موجودة.',404);
 return c;
}
// Messages up to this moment were cleared by this member and stay hidden for them only.
async function clearedAt(db,actor,conversation){
 const {data,error}=await db.from('private_conversation_states')
  .select('cleared_at').eq('conversation_id',conversation).eq('user_id',actor).maybeSingle();
 // Before the clear/mute migration is applied the column does not exist yet: nothing is cleared.
 if(error){if(error.code==='42703'||/cleared_at/.test(error.message||''))return null;throw error;}
 return data?.cleared_at||null;
}
const afterClear=(message,cleared)=>!cleared||Date.parse(message.created_at)>Date.parse(cleared);
async function pinnedMessage(db,conversation,cleared=null){
 if(!conversation?.pinned_message_id)return null;
 const {data:message,error}=await db.from('private_messages')
  .select('id,sender_id,body,created_at,deleted_at')
  .eq('conversation_id',conversation.id)
  .eq('id',conversation.pinned_message_id).maybeSingle();
 if(error)throw error;
 if(!message||message.deleted_at||!afterClear(message,cleared))return null;
 return {...message,pinned_by:conversation.pinned_by,pinned_at:conversation.pinned_at};
}
async function partnerReadAt(db,conversation,partnerId){
 const {data:state,error}=await db.from('private_conversation_states')
  .select('last_read_at').eq('conversation_id',conversation)
  .eq('user_id',partnerId).maybeSingle();
 if(error)throw error;
 return state?.last_read_at||null;
}
async function readReceipt(db,actor,conversation){
 const c=await conversationForParticipant(db,actor,conversation);
 const partner=c.user_low===actor?c.user_high:c.user_low;
 const cleared=await clearedAt(db,actor,conversation);
 const [partnerLastReadAt,pin]=await Promise.all([partnerReadAt(db,conversation,partner),pinnedMessage(db,c,cleared)]);
 return {partner_last_read_at:partnerLastReadAt,pinned_message:pin};
}
async function searchThread(db,actor,conversation,term,before){
 await conversationForParticipant(db,actor,conversation);
 const cleared=await clearedAt(db,actor,conversation);
 if(term.length<2)return {matches:[],hasMore:false,nextBefore:null};
 // Search the entire conversation, not only the messages loaded on screen.
 // Deleted messages are tombstones and must never be returned as searchable content.
 let query=db.from('private_messages')
  .select('id,sender_id,body,created_at')
  .eq('conversation_id',conversation).is('deleted_at',null)
  .ilike('body','%'+term+'%')
  .order('created_at',{ascending:false}).order('id',{ascending:false})
  .limit(MESSAGE_SEARCH_PAGE_SIZE+1);
 if(before)query=query.lt('created_at',before);
 if(cleared)query=query.gt('created_at',cleared);
 const {data,error}=await query;
 if(error)throw error;
 const hasMore=(data||[]).length>MESSAGE_SEARCH_PAGE_SIZE;
 const matches=(data||[]).slice(0,MESSAGE_SEARCH_PAGE_SIZE);
 return {matches,hasMore,nextBefore:hasMore?matches[matches.length-1]?.created_at:null};
}
// Snapshot the FIRST unread incoming message before the browser marks this
// conversation as read. Only participants can reach this server-only query.
async function firstUnreadMessage(db,actor,conversation){
 const {data:state,error:stateError}=await db.from('private_conversation_states')
  .select('last_read_at').eq('conversation_id',conversation)
  .eq('user_id',actor).maybeSingle();
 if(stateError)throw stateError;
 const cleared=await clearedAt(db,actor,conversation);
 const lastRead=[state?.last_read_at,cleared].filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||'1970-01-01T00:00:00.000Z';
 const {data:message,error}=await db.from('private_messages')
  .select('id,created_at')
  .eq('conversation_id',conversation).neq('sender_id',actor)
  .gt('created_at',lastRead)
  .order('created_at',{ascending:true}).order('id',{ascending:true})
  .limit(1).maybeSingle();
 if(error)throw error;
 return message?{id:message.id,created_at:message.created_at}:null;
}
async function getThread(db,id,conversation,before,around){
 const c=await conversationForParticipant(db,id,conversation);
 const cleared=await clearedAt(db,id,conversation);
 let quoteTarget=null;
 if(around){
  const lookup=await db.from('private_messages')
   .select('id,sender_id,body,created_at,edited_at,deleted_at,reply_to_message_id')
   .eq('conversation_id',conversation).eq('id',around).maybeSingle();
  if(lookup.error)throw lookup.error;
  if(!lookup.data||!afterClear(lookup.data,cleared))throw new RequestValidationError('الرسالة الأصلية غير موجودة.',404);
  quoteTarget=lookup.data;
 }
 let query=db.from('private_messages')
  .select('id,sender_id,body,created_at,edited_at,deleted_at,reply_to_message_id')
  .eq('conversation_id',conversation)
  .order('created_at',{ascending:false}).order('id',{ascending:false})
  .limit(MESSAGE_PAGE_SIZE+1);
 if(before)query=query.lt('created_at',before);
 if(quoteTarget)query=query.lt('created_at',quoteTarget.created_at);
 if(cleared)query=query.gt('created_at',cleared);
 const {data:messages,error:messageError}=await query;
 if(messageError)throw messageError;
 const hasMore=(messages||[]).length>MESSAGE_PAGE_SIZE;
 const page=(messages||[]).slice(0,MESSAGE_PAGE_SIZE).reverse();
 if(quoteTarget)page.push(quoteTarget);
 // Resolve the current quoted source body; never store duplicate private text.
 const quoteIds=[...new Set(page.map(m=>m.reply_to_message_id).filter(Boolean))];
 let quotes=new Map();
 if(quoteIds.length){
  const referenced=await db.from('private_messages')
   .select('id,sender_id,body,deleted_at,created_at')
   .eq('conversation_id',conversation).in('id',quoteIds);
  if(referenced.error)throw referenced.error;
  quotes=new Map((referenced.data||[]).filter(m=>afterClear(m,cleared)).map(m=>[m.id,m]));
 }
 const detailed=page.map(m=>({...m,reply:m.reply_to_message_id?quotes.get(m.reply_to_message_id)||null:null}));
 const partner=c.user_low===id?c.user_high:c.user_low;
 const {data:p,error:profileError}=await db.from('public_profiles')
  .select('display_name,avatar_url,show_avatar').eq('user_id',partner).maybeSingle();
 if(profileError)throw profileError;
 return {conversation:{id:c.id,status:c.status,requested_by:c.requested_by,intro:c.intro,requested_at:c.requested_at,partner_id:partner,partner_name:p?.display_name||'مستخدم 967',avatar_url:p?.show_avatar?p.avatar_url:null},
  messages:detailed,hasMore,nextBefore:hasMore?page[0]?.created_at:null,
  partner_last_read_at:await partnerReadAt(db,conversation,partner),
  pinned_message:await pinnedMessage(db,c,cleared),
  first_unread_message:before||around?null:await firstUnreadMessage(db,id,conversation)};
}
async function search(db,actor,q){
 if(q.length<2)return {users:[]};
 const {data:profiles,error}=await db.from('public_profiles')
  .select('user_id,display_name,avatar_url,show_avatar,suspended,deletion_requested_at')
  .ilike('display_name','%'+q+'%').limit(40);
 if(error)throw error;
 const candidates=(profiles||[]).filter(p=>p.user_id!==actor&&!p.suspended&&!p.deletion_requested_at);
 if(!candidates.length)return {users:[]};
 const ids=candidates.map(p=>p.user_id);
 const [settings,blocks]=await Promise.all([
  db.from('private_messaging_settings').select('user_id,discoverable,allow_requests').in('user_id',ids),
  db.from('private_user_blocks').select('blocker_id,blocked_id')
   .or('blocker_id.eq.'+actor+',blocked_id.eq.'+actor)
 ]);
 if(settings.error)throw settings.error;
 if(blocks.error)throw blocks.error;
 const prefs=new Map((settings.data||[]).map(s=>[s.user_id,s]));
 const forbidden=new Set((blocks.data||[]).map(b=>b.blocker_id===actor?b.blocked_id:b.blocker_id));
 return {users:candidates.filter(p=>canReceiveSearchRequests(prefs.get(p.user_id))&&!forbidden.has(p.user_id)).slice(0,15)
  .map(p=>({id:p.user_id,name:p.display_name,avatar_url:p.show_avatar?p.avatar_url:null}))};
}

// A management-only account-directory deep link. This does not grant a
// conversation or bypass the recipient's messaging privacy/blocks.
// Direct member-profile links are permitted for signed-in members.
// New requests still respect the recipient's settings and both users' blocks.
async function directContact(db,actor,targetId){
 if(actor===targetId)throw new RequestValidationError('لا يمكنك مراسلة نفسك.',400);
 const {data:userInfo,error:userError}=await db.auth.admin.getUserById(targetId);
 if(userError||!userInfo?.user)throw new RequestValidationError('المستخدم المطلوب غير موجود.',404);
 const target=userInfo.user;
 if(!target.email_confirmed_at||target.banned_until&&Date.parse(target.banned_until)>Date.now())
  throw new RequestValidationError('المستخدم غير متاح للمراسلة حاليًا.',409);
 const [profileResult,prefResult,blockResult]=await Promise.all([
  db.from('public_profiles').select('display_name,avatar_url,show_avatar,suspended,deletion_requested_at').eq('user_id',targetId).maybeSingle(),
  db.from('private_messaging_settings').select('allow_requests').eq('user_id',targetId).maybeSingle(),
  db.from('private_user_blocks').select('blocker_id,blocked_id')
   .or('and(blocker_id.eq.'+actor+',blocked_id.eq.'+targetId+'),and(blocker_id.eq.'+targetId+',blocked_id.eq.'+actor+')')
 ]);
 if(profileResult.error||prefResult.error||blockResult.error)
  throw profileResult.error||prefResult.error||blockResult.error;
 const p=profileResult.data;
 if(!p||p.suspended||p.deletion_requested_at)
  throw new RequestValidationError('المستخدم غير متاح للمراسلة حاليًا.',409);
 if(prefResult.data?.allow_requests===false||(blockResult.data||[]).length>0)
  throw new RequestValidationError('هذا المستخدم لا يستقبل طلبات محادثة حاليًا.',403);
 return {person:{id:targetId,name:p.display_name||'عضو 967',avatar_url:p.show_avatar?p.avatar_url:null}};
}

export async function GET(request){
 try{
  const {db,user}=await authorized(request);
  const {mode,id,q,before,around}=safeMessagingQuery(new URL(request.url).searchParams);
  if(mode==='inbox')return json({conversations:await inbox(db,user.id)});
  if(mode==='summary'){
   const rows=await inbox(db,user.id);
   const unreadRows=rows.filter(c=>c.status==='accepted'&&!c.muted&&Number(c.unread)>0);
   const [preferences,recent,market]=await Promise.all([
    db.from('private_messaging_settings').select('notify_messages').eq('user_id',user.id).maybeSingle(),
    unreadRows.length?db.from('private_messages').select('created_at')
     .in('conversation_id',unreadRows.map(c=>c.id)).neq('sender_id',user.id)
     .order('created_at',{ascending:false}).limit(1).maybeSingle()
     :Promise.resolve({data:null,error:null}),
    // «سوق 967» chats have their own tab and count; a failure there never hides the private ones.
    db.rpc('market_unread_summary',{p_user:user.id}).then(result=>result.error?null:result.data?.[0]||null,()=>null)
   ]);
   if(preferences.error||recent.error)throw preferences.error||recent.error;
   const latest=[recent.data?.created_at,market?.latest].filter(Boolean).sort().at(-1)||null;
   return json({requests:rows.filter(c=>c.status==='pending'&&c.requested_by!==user.id).length,
    unread:rows.reduce((n,c)=>n+(c.muted?0:Number(c.unread||0)),0),
    market:Number(market?.unread||0),
    notify_messages:preferences.data?.notify_messages!==false,
    latest_incoming_unread_at:latest,
    // The newest conversation (read or not), shown first in the header's notifications menu.
    latest:latestConversation(rows,user.id)});
  }
  if(mode==='thread')return json(await getThread(db,user.id,id,before,around));
  if(mode==='receipt')return json(await readReceipt(db,user.id,id));
  if(mode==='thread-search')return json(await searchThread(db,user.id,id,q,before));
  if(mode==='search')return json(await search(db,user.id,q));
  if(mode==='contact')return json(await directContact(db,user.id,id));
  const [setting,blocks]=await Promise.all([
   db.from('private_messaging_settings').select('discoverable,allow_requests,notify_messages').eq('user_id',user.id).maybeSingle(),
   db.from('private_user_blocks').select('blocked_id,created_at').eq('blocker_id',user.id).limit(100)
  ]);
  if(setting.error||blocks.error)throw setting.error||blocks.error;
  const blockedIds=(blocks.data||[]).map(b=>b.blocked_id);
  let profiles=[];
  if(blockedIds.length){
   const result=await db.from('public_profiles').select('user_id,display_name').in('user_id',blockedIds);
   if(result.error)throw result.error;
   profiles=result.data||[];
  }
  const names=new Map(profiles.map(p=>[p.user_id,p.display_name]));
  return json({settings:{discoverable:true,allow_requests:true,notify_messages:true,...setting.data},
   blocked:(blocks.data||[]).map(b=>({id:b.blocked_id,name:names.get(b.blocked_id)||'مستخدم 967'}))});
 }catch(error){
  if(!(error instanceof RequestValidationError))console.error('private messages GET failed',error?.code||error?.name||'unknown');
  return fail(error instanceof RequestValidationError?error.message:'تعذر تحميل الرسائل. حاول مجددًا.',error instanceof RequestValidationError?error.status:503);
 }
}
export async function POST(request){
 try{
  const {db,user}=await authorized(request);
  const body=await readJsonObject(request,6500);
  const params=validateMessagingAction(body);
  if(body.action==='pin'||body.action==='unpin'){
   const result=check(await db.rpc('private_messaging_set_pin',{
    p_actor:user.id,p_conversation:params.p_conversation,
    p_message:params.p_message,p_remove:body.action==='unpin'
   }));
   return json(result);
  }
  if(['clear','mute','unmute'].includes(body.action)){
   const result=check(await db.rpc('private_messaging_conversation_state',{
    p_actor:user.id,p_conversation:params.p_conversation,p_action:body.action
   }));
   return json(result);
  }
  if(body.action==='edit'||body.action==='delete'){
   const result=check(await db.rpc('private_messaging_message_mutate',{
    p_actor:user.id,p_action:params.p_action,
    p_conversation:params.p_conversation,p_message:params.p_message,p_text:params.p_text
   }));
   return json(result);
  }
  const result=check(await db.rpc('private_messaging_action',{p_actor:user.id,...params}));
  return json(result);
 }catch(error){
  if(!(error instanceof RequestValidationError))console.error('private messages POST failed',error?.code||error?.name||'unknown');
  return fail(error instanceof RequestValidationError?error.message:'تعذر تنفيذ الإجراء حاليًا.',error instanceof RequestValidationError?error.status:503);
 }
}
