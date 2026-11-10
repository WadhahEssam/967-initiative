import {RequestValidationError} from './requestSecurity.js';
import {safeExternalUrl} from './media.js';
import {readListState} from './listState.js';

export const DEBATE_CATEGORIES=['سياسية','اقتصادية','اجتماعية','ثقافية وتاريخية','تنموية'];
export const DEBATE_TYPES={external_live:'بث مباشر خارجي',prerecorded:'مسجلة مسبقاً'};
export const DEBATE_STAGES={announced:'معلنة',upcoming:'قادمة',live:'تُبث خارجياً الآن',ended:'انتهى البث',recording_available:'التسجيل متاح',postponed:'مؤجلة',cancelled:'ملغاة'};
export const PUBLICATION_STATUSES={draft:'مسودة',published:'منشورة',hidden:'مخفية',archived:'مؤرشفة'};
export const QUESTION_STATUSES={new:'بانتظار المراجعة',approved:'منشور',selected:'مختار للمناظرة',answered:'تمت الإجابة عنه',rejected:'مرفوض',hidden:'مخفي',deleted:'محذوف'};
export const COMMENT_STATUSES={pending:'بانتظار المراجعة',approved:'منشور',rejected:'مرفوض',hidden:'مخفي',deleted:'محذوف'};
export const SUGGESTION_STATUSES={pending:'قيد المراجعة',accepted:'مقبول',deferred:'مؤجل',rejected:'مرفوض'};
export const SUMMARY_FIELDS={introduction:'مقدمة',arguments:'أبرز حجج المشاركين',responses:'الردود المهمة',agreements:'نقاط الاتفاق',differences:'نقاط الاختلاف',open_questions:'أسئلة غير محسومة',conclusion:'خلاصة محايدة'};
export const DEBATE_DESCRIPTION='مساحة يمنية للحوار المنظم، نناقش فيها القضايا المختلفة، ونستمع إلى الآراء المتعارضة، ونمنح الجمهور فرصة السؤال والمشاركة.';
export const DEBATE_EMPTY='نستعد لإطلاق مناظرات 967. هنا سنناقش الأفكار المختلفة ونمنح الجميع مساحة للسؤال والحوار.';
export const COMMENT_RULES='نرحّب باختلاف المواقف بالتساوي. تُمنع التهديدات والتحريض وخطاب الكراهية والإساءة الشخصية ونشر بيانات الآخرين والرسائل المزعجة وانتحال الشخصية. تظهر التعليقات والأسئلة مباشرة بعد الإرسال. يمكن للإدارة إخفاء المشاركات المخالفة.';
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const RESERVED_DEBATE_SLUGS=['suggest','speakers'];
export const DEBATE_LIST_DEFAULTS={q:'',category:'',type:'',stage:'',sort:'newest',page:1};
export const DEBATE_STAGE_FILTERS={upcoming:'قادمة',live:'تُبث الآن',completed:'مكتملة أو تسجيل متاح',postponed:'مؤجلة',cancelled:'ملغاة'};
export function matchesDebateStage(debate,filter){return !filter||({upcoming:['announced','upcoming'],live:['live'],completed:['ended','recording_available'],postponed:['postponed'],cancelled:['cancelled']}[filter]||[]).includes(debate.stage);}
export function selectFeaturedDebate(debates,now=Date.now()){
 const eligible=debates.filter(d=>['announced','upcoming','live'].includes(d.stage));
 const rank=d=>d.stage==='live'?0:Number.isFinite(Date.parse(d.scheduled_at))?(Date.parse(d.scheduled_at)>now?1:3):2;
 return [...eligible].sort((a,b)=>rank(a)-rank(b)||(rank(a)===1?Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at):Date.parse(b.created_at||b.scheduled_at||0)-Date.parse(a.created_at||a.scheduled_at||0))||String(a.id).localeCompare(String(b.id)))[0]||null;
}
export function featuredDebateHeading(debate,now=Date.now()){return debate.stage==='live'?'تُبث خارجياً الآن':Number.isFinite(Date.parse(debate.scheduled_at))&&Date.parse(debate.scheduled_at)<=now?'بانتظار تحديث موعد المناظرة':'المناظرة القادمة';}
export function debateExplorerPage(filtered,featured,page=1,pageSize=9){
 const featuredVisible=Boolean(featured&&filtered.some(d=>d.id===featured.id));
 const list=filtered.filter(d=>!featuredVisible||d.id!==featured.id),pages=Math.max(1,Math.ceil(list.length/pageSize)),current=Math.max(1,Math.min(page,pages));
 return {featured:featuredVisible?featured:null,items:list.slice((current-1)*pageSize,current*pageSize),total:filtered.length,pages,current};
}
export function debateListState(search){
 const state=readListState(search,DEBATE_LIST_DEFAULTS);
 if(!DEBATE_CATEGORIES.includes(state.category))state.category='';
 if(!Object.hasOwn(DEBATE_TYPES,state.type))state.type='';
 if(!Object.hasOwn(DEBATE_STAGE_FILTERS,state.stage))state.stage='';
 if(!['newest','oldest','title'].includes(state.sort))state.sort='newest';
 return state;
}

// After signing in, return to the page the visitor came from (games, a shared result, a member,
// search…), keeping its query and action hash. Same-site paths only; never the editor panel,
// the API or the sign-in pages themselves.
export function safeAccountReturn(value,fallback='/account'){
 if(typeof value!=='string'||value.length>1000||/[\\\u0000-\u0020\u007f]/.test(value)||!value.startsWith('/')||value.startsWith('//'))return fallback;
 try{const u=new URL(value,'https://local.invalid');return u.origin==='https://local.invalid'&&!/^\/(admin|api|auth|_next|login|register|forgot-password|update-password)(?:\/|$)/.test(u.pathname)&&!u.pathname.includes('//')?u.pathname+u.search+u.hash:fallback;}catch{return fallback;}
}
export function httpsUrl(value){const url=safeExternalUrl(value);return url?.startsWith('https://')?url:null;}
export const QUESTIONS_AFTER_RECORDING_MESSAGE='انتهت فترة استقبال الأسئلة بعد نشر فيديو المناظرة. يمكنك الآن مشاركة رأيك أو مناقشة محتوى المناظرة من خلال التعليقات.';
export function recordingHasPublished(debate){return Boolean(debate.recording_published||debate.recording_first_published_at||debate.questions_closed_after_recording);}
export function currentPollPhase(debate){return recordingHasPublished(debate)?'after':'before';}
export function questionsAvailable(debate){return Boolean(!recordingHasPublished(debate)&&debate.questions_open&&debate.publication_status==='published'&&debate.stage!=='cancelled');}
export function pollOpen(poll,debate,now=Date.now()){
 return Boolean(poll?.phase===currentPollPhase(debate)&&poll.enabled&&!poll.is_closed&&debate.publication_status==='published'&&debate.stage!=='cancelled'&&(poll.phase!=='after'||debate.recording_published)&&(!poll.opens_at||Date.parse(poll.opens_at)<=now)&&(!poll.closes_at||Date.parse(poll.closes_at)>now));
}
export function debateDateLabel(debate){return debate.debate_type==='prerecorded'?'موعد نشر التسجيل':'موعد البث الخارجي';}
export const DEBATE_TIME_ZONE='Asia/Aden';
export function publicRecordingAvailable(debate){return Boolean(debate.recording_published&&httpsUrl(debate.recording_url)&&['published','archived'].includes(debate.publication_status));}
export const RECORDING_OVERDUE_MESSAGE='لم يُتح التسجيل في الموعد المخطط. سيُحدَّث موعد النشر عند توفر معلومات جديدة.';
export function recordingOverdue(debate,now=Date.now()){return debate.debate_type==='prerecorded'&&!recordingHasPublished(debate)&&!publicRecordingAvailable(debate)&&!['cancelled','postponed'].includes(debate.stage)&&debate.publication_status!=='archived'&&Number.isFinite(Date.parse(debate.scheduled_at))&&Date.parse(debate.scheduled_at)<=now;}
export function debateParticipationSummary(debate){
 if(debate.stage==='cancelled')return 'أُلغيت المناظرة. المشاركة متوقفة.';
 const stage=debate.stage==='postponed'?'المناظرة مؤجلة. ':debate.stage==='live'?'البث المباشر جارٍ على منصة خارجية. ':publicRecordingAvailable(debate)?'التسجيل متاح. ':'';
 return stage+(questionsAvailable(debate)?'الأسئلة مفتوحة قبل نشر التسجيل. ':recordingHasPublished(debate)?'انتهى استقبال الأسئلة بعد نشر التسجيل. ':'استقبال الأسئلة مغلق حالياً. ')+(debate.comments_open&&debate.publication_status==='published'?'يمكنك المشاركة بتعليق. ':'إضافة التعليقات مغلقة. ');
}
export function recordingPreviewState(debate){
 if(publicRecordingAvailable(debate))return 'available';
 if(debate.stage==='cancelled')return 'cancelled';
 if(debate.publication_status==='archived')return 'archived';
 if(recordingHasPublished(debate))return 'withdrawn';
 if(debate.stage==='postponed')return 'postponed';
 if(debate.debate_type==='external_live'&&debate.stage==='live')return 'live';
 if(debate.debate_type==='external_live'&&debate.stage==='ended')return 'ended';
 return 'pending';
}
export function formatDebateSchedule(value){
 if(!value||Number.isNaN(Date.parse(value)))return null;
 const date=new Date(value),options={timeZone:DEBATE_TIME_ZONE};
 return {iso:date.toISOString(),date:new Intl.DateTimeFormat('ar-YE-u-nu-latn',{...options,year:'numeric',month:'long',day:'numeric'}).format(date),time:new Intl.DateTimeFormat('ar-YE-u-nu-latn',{...options,hour:'numeric',minute:'2-digit',hour12:true}).format(date).replace(/ص\s*$/,'صباحاً').replace(/م\s*$/,'مساءً')};
}
export function formatDebateDateTime(value){
 if(!value||Number.isNaN(Date.parse(value)))return '';
 return new Intl.DateTimeFormat('ar-YE-u-nu-latn',{timeZone:DEBATE_TIME_ZONE,year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+' (توقيت اليمن)';
}
export function initialDebate(){return {slug:'',title:'',question:'',description:'',category:'اجتماعية',debate_type:'external_live',publication_status:'draft',stage:'announced',scheduled_at:null,cover_url:null,live_platform:'',live_url:null,recording_url:null,recording_published:false,duration_seconds:null,axes:[],summary:{},summary_published:false,questions_open:true,comments_open:true,seo_title:'',seo_description:'',participants:[],options:[],chapters:[],polls:['before','after'].map(phase=>({phase,enabled:false,opens_at:null,closes_at:null,is_closed:false,allow_change:false}))};}
export function validateDebateCommand(body,admin=false){
 const actions=admin?['save','speaker','moderate','convert','suspend','anonymize','delete','results_publish','results_visibility','tasks','media']:['profile','deletion_request','vote','question','comment','comment_edit','comment_delete','suggestion','report'];
 if(!actions.includes(body.action)||body.id!=null&&!UUID.test(body.id)||body.revision!=null&&(!Number.isSafeInteger(body.revision)||body.revision<1)||body.data!=null&&(typeof body.data!=='object'||Array.isArray(body.data)))throw new RequestValidationError('طلب غير صالح.');
 const data=body.data||{};
 for(const name of ['cover_url','live_url','recording_url','avatar_url','photo_url'])if(data[name]&&!httpsUrl(data[name]))throw new RequestValidationError('استخدم رابط HTTPS صالحاً.');
 if(body.action==='speaker'&&data.member_user_id!=null&&!UUID.test(data.member_user_id))throw new RequestValidationError('حساب العضو المحدد غير صالح.');
 if(body.action==='save'){
  if(RESERVED_DEBATE_SLUGS.includes(data.slug))throw new RequestValidationError('هذا الرابط محجوز لصفحات المنصة. اختر رابطاً آخر للمناظرة.');
  if(!data.title?.trim()||!data.question?.trim()||!/^[a-z0-9][a-z0-9-]{0,119}$/.test(data.slug||''))throw new RequestValidationError('أدخل العنوان والسؤال ورابطاً قصيراً بحروف لاتينية وأرقام وشرطات.');
  if(data.debate_type==='prerecorded'&&(data.stage==='live'||data.stage==='ended'||data.live_url||data.live_platform))throw new RequestValidationError('المناظرة المسجلة لا تتضمن بثاً مباشراً.');
  for(const [name,max] of [['participants',20],['options',12],['polls',2],['chapters',100],['axes',20]])if(data[name]&&(!Array.isArray(data[name])||data[name].length>max))throw new RequestValidationError('عدد العناصر يتجاوز الحد المسموح.');
 }
 return {...body,data};
}
