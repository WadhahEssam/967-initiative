// Normalize existing notifications from separate sources without copying them
// into a second table. Private messages are grouped per conversation.
export const NOTIFICATION_PAGE_SIZE=20;
export const NOTIFICATION_CATEGORIES=['all','messages','market','tasks','debates','account'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validNotificationId=(source,id)=>
 source==='task'?/^[1-9][0-9]{0,15}$/.test(String(id))&&Number.isSafeInteger(Number(id)):
 source==='account'||source==='market'?uuid.test(String(id)):false;

export function safeNoticeHref(value){
 return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&
  !value.includes('\\')&&!/[\r\n\u0000-\u001f]/.test(value)&&value.length<=500?value:'/notifications';
}
export const isDuplicatedMessageNotice=row=>
 /^\/messages(?:[/?#]|$)/.test(row?.href||'');

export function accountNotice(row){
 if(isDuplicatedMessageNotice(row))return null;
 const category=['reply','moderation','debate'].includes(row.kind)?'debates':'account';
 return {id:'account:'+row.id,source:'account',source_id:row.id,category,
  kind:row.kind,reply_parent:row.reply_parent||null,title:row.title||'تحديث جديد',description:row.description||'',
  href:safeNoticeHref(row.href),created_at:row.created_at,unread:!row.read_at,read_at:row.read_at||null};
}
export function taskNotice(row,title){
 const labels={assignment:'أُسندت إليك مهمة',due_soon:'اقترب موعد تسليم مهمة',overdue:'مهمة متأخرة',
  review:'مهمة تنتظر المراجعة',reopened:'أعيد فتح مهمة',comment:'تعليق جديد على مهمة',
  mention:'ذُكرت في مناقشة مهمة'};
 const href='/admin/tasks?task='+encodeURIComponent(row.task_id)+
  (row.comment_id?'&comment='+encodeURIComponent(row.comment_id):'');
 return {id:'task:'+row.id,source:'task',source_id:String(row.id),category:'tasks',
  kind:row.kind,task_id:row.task_id,title:labels[row.kind]||'تحديث مهمة',description:title||'افتح المهمة للاطلاع على التفاصيل.',
  href,created_at:row.created_at,unread:!row.read_at,read_at:row.read_at||null};
}
export function conversationNotice(row,actorId){
 if(!row||row.blocked)return null;
 const requests=row.status==='pending'&&row.requested_by!==actorId;
 const unread=Math.max(0,Math.min(100000,Number(row.unread)||0));
 if(!requests&&!unread)return null;
 const title=requests?'طلب محادثة جديد':'رسائل جديدة';
 const name=row.partner_name||'مستخدم 967';
 return {id:'message:'+row.id,source:'message',source_id:row.id,category:'messages',
  title,description:requests?'طلب محادثة من '+name:
   unread===1?'رسالة غير مقروءة من '+name:unread+' رسائل غير مقروءة من '+name,
  href:'/messages?conversation='+encodeURIComponent(row.id),
  created_at:requests?row.requested_at:row.last_message_at||row.updated_at,
  unread:true,read_at:null};
}
export function orderNotices(notices){
 return [...notices].filter(Boolean).sort((a,b)=>
  Date.parse(b.created_at||0)-Date.parse(a.created_at||0)||
  String(a.id).localeCompare(String(b.id)));
}
export const noticeCategoryLabel={all:'الكل',messages:'الرسائل',market:'السوق',tasks:'المهام',debates:'المناظرات',account:'الحساب'};
export function noticeCountLabel(value){
 const n=Math.max(0,Number(value)||0);return n>99?'99+':String(Math.floor(n));
}

/* The center reuses the site's current settings. Essential system notices
   remain visible; they are never hidden by a user preference. */
export const DEFAULT_NOTIFICATION_PREFERENCES=Object.freeze({
 messages:true,tasks:true,replies:true,debates:true,new_debates:false,
});
export const NOTIFICATION_PREFERENCE_KEYS=Object.keys(DEFAULT_NOTIFICATION_PREFERENCES);
export function normalizeNotificationPreferences(account,privateSettings){
 return {
  messages:privateSettings?.notify_messages!==false,
  tasks:account?.notify_tasks!==false,
  replies:account?.notify_replies!==false,
  debates:account?.notify_moderation!==false,
  new_debates:Boolean(account?.notify_new_debates_since),
 };
}
export const isNotificationEnabled=(notice,prefs=DEFAULT_NOTIFICATION_PREFERENCES)=>{
 if(!notice)return false;
 if(notice.source==='message')return prefs.messages!==false;
 if(notice.source==='task')return prefs.tasks!==false;
 if(notice.source==='account'){
  if(notice.kind==='reply')return prefs.replies!==false;
  if(notice.kind==='moderation')return prefs.debates!==false;
  return true; // system/security updates cannot be disabled here.
 }
 return true;
};
// Aggregate related events in a UTC date bucket. Preserve the underlying IDs
// so one "mark read" action marks every notification in the group.
export function similarNoticeKey(notice){
 if(!notice||!notice.created_at)return null;
 const day=String(notice.created_at).slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 if(notice.source==='task'&&['comment','reply'].includes(notice.kind)&&notice.task_id)
  return 'task:'+notice.task_id+':discussion:'+day;
 if(notice.source==='account'&&notice.kind==='reply'){
  // Existing reply links contain the child ID, not the original thread.
  // Group only when the server resolved the actual parent ID safely.
  return notice.reply_parent?'debate-parent:'+notice.reply_parent+':replies:'+day:null;
 }
 return null;
}
export function groupSimilarNotices(notices=[]){
 const grouped=new Map(),ordered=[];
 for(const notice of orderNotices(notices)){
  const key=similarNoticeKey(notice);
  if(!key){ordered.push({...notice,source_ids:[String(notice.source_id)],group_count:1});continue;}
  const identity=notice.source+':'+key;
  if(!grouped.has(identity)){
   const first={...notice,source_ids:[String(notice.source_id)],group_count:1};
   grouped.set(identity,first);ordered.push(first);
  }else{
   const first=grouped.get(identity);
   if(!first.source_ids.includes(String(notice.source_id)))first.source_ids.push(String(notice.source_id));
   first.group_count=first.source_ids.length;
   first.unread=first.unread||notice.unread;
  }
 }
 for(const notice of ordered){
  if(notice.group_count<=1)continue;
  if(notice.source==='account'){
   notice.title=notice.group_count+' ردود على تعليقك';
   notice.description='ردود متعددة على التعليق نفسه. افتح أحدث رد للاطلاع عليها.';
  }else if(notice.source==='task'){
   notice.title=notice.group_count+' تحديثات في نقاش مهمة';
   notice.description='تعليقات أو ردود مرتبطة بالمهمة: '+notice.description;
  }
 }
 return ordered;
}
export function validNotificationIds(source,ids){
 return Array.isArray(ids)&&ids.length>0&&ids.length<=501&&
  new Set(ids.map(String)).size===ids.length&&ids.every(id=>validNotificationId(source,id));
}
