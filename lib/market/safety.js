// «سوق 967» reports, blocks and moderation: the lists and rules from the spec, kept pure for the
// server, the browser and the tests.
import {cleanText} from './text.js';

// Spec: «أسباب البلاغ الجاهزة».
export const REPORT_REASONS=[
 {key:'fraud',label:'احتيال أو نصب'},
 {key:'prohibited',label:'منتج ممنوع'},
 {key:'duplicate',label:'إعلان مكرر'},
 {key:'misleading',label:'معلومات أو صور مضللة'},
 {key:'abuse',label:'إساءة أو إزعاج في المحادثة'},
 {key:'other',label:'أخرى'},
];
// Spec: «سبب الحظر إلزامي» (shown to the team only).
export const BLOCK_REASONS=[
 {key:'spam',label:'إزعاج'},
 {key:'rude',label:'أسلوب غير لائق'},
 {key:'fraud',label:'احتيال أو محاولة نصب'},
 {key:'not_serious',label:'عدم جدية'},
 {key:'other',label:'أخرى'},
];
// What a report is about. A rating report comes from the seller who received it.
export const REPORT_TARGETS=['listing','user','chat','rating'];
export const REPORT_TARGET_LABELS={listing:'إعلان',user:'مستخدم',chat:'محادثة',rating:'تقييم'};
// Spec: three different members blocking the same person puts the account in front of the team.
export const BLOCKS_ALERT=3;
export const NOTE_MAX=500;
export const ADMIN_MESSAGE_MAX=1000;
// Market bans: a few days, a month, or for good (null).
export const BAN_DAYS=[3,7,30,null];

export class SafetyError extends Error{
 constructor(message,field=null){super(message);this.name='SafetyError';this.field=field;}
}

const labelOf=(list,key)=>list.find(item=>item.key===key)?.label||null;
export const reportReasonLabel=key=>labelOf(REPORT_REASONS,key);
export const blockReasonLabel=key=>labelOf(BLOCK_REASONS,key);

// «أخرى» needs a few words; the other reasons take an optional note.
function reasonWithNote(list,input,what){
 const reason=String(input?.reason||'');
 if(!labelOf(list,reason))throw new SafetyError('اختر سبب '+what+'.','reason');
 const note=cleanText(input?.note,NOTE_MAX);
 if(reason==='other'&&note.length<5)throw new SafetyError('اكتب سبب '+what+' باختصار.','note');
 return {reason,note:note||null};
}

export function validateReport(input={}){
 const target=String(input.target||'');
 if(!REPORT_TARGETS.includes(target))throw new SafetyError('لا يمكن الإبلاغ عن هذا.','target');
 return {target,...reasonWithNote(REPORT_REASONS,input,'الإبلاغ')};
}
export const validateBlock=(input={})=>reasonWithNote(BLOCK_REASONS,input,'الحظر');

export function validateAdminMessage(value){
 const text=cleanText(value,ADMIN_MESSAGE_MAX);
 if(text.length<5)throw new SafetyError('اكتب نص الرسالة.','message');
 return text;
}

// A market ban for `days` days, or for good when days is null.
export function banUntil(days,now=Date.now()){
 if(days===null||days===undefined||days==='')return null;
 const value=Number(days);
 if(!BAN_DAYS.includes(value))throw new SafetyError('اختر مدة الإيقاف.','days');
 return new Date(now+value*86400000).toISOString();
}
export const banActive=(ban,now=Date.now())=>Boolean(ban)&&!ban.lifted_at&&(!ban.until||Date.parse(ban.until)>now);
export function banText(ban){
 if(!ban)return null;
 return ban.until?'أُوقف حسابك في السوق حتى '+new Intl.DateTimeFormat('ar',{dateStyle:'long'}).format(new Date(ban.until))+'.':'أُوقف حسابك في السوق.';
}

// The neutral line a blocked member sees (spec: «المحظور لا يُبلَّغ»).
export const BLOCKED_TEXT='لا يمكن مراسلة هذا المستخدم.';
