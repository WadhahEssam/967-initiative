// Analytics deliberately measures anonymous *page views*, not unique visitors.
// Never persist URL, search text, cookies, IP, user-agent, referrer, or account ids.
export const ACTIVITY_SECTIONS={
 home:'الرئيسية',school:'مدرسة 967',games:'ألعاب 967',history:'تاريخ اليمن',
 figures:'شخصيات يمنية',atlas:'خريطة اليمن',statistics:'اليمن بالأرقام',
 rankings:'ترتيب اليمن',debates:'مناظرات 967',works:'الأعمال الإعلامية',
 magazine:'مجلة 967',universities:'الجامعات والمعاهد',medical:'المراكز الطبية',
 products:'المنتجات اليمنية',professionals:'المهنيون',services:'الخدمات',search:'البحث',
 contribute:'المساهمة',other:'صفحات عامة أخرى'
};
// Conversion steps, counted the same way: one anonymous counter per step and UTC day.
// guest/member comes from the browser's session hint, so it is approximate.
export const FUNNEL_STEPS={
 lesson_start_guest:'بدء درس (زائر)',lesson_start_member:'بدء درس (عضو)',
 lesson_done_guest:'إنهاء درس (زائر)',lesson_done_member:'إنهاء درس (عضو)',
 game_start_guest:'بدء لعبة (زائر)',game_start_member:'بدء لعبة (عضو)',
 game_done_guest:'إنهاء لعبة (زائر)',game_done_member:'إنهاء لعبة (عضو)',
 signup_prompt_shown:'ظهور دعوة التسجيل',signup_prompt_click:'الضغط على دعوة التسجيل',signup_done:'إنشاء حساب',
 share_click:'مشاركة نتيجة',share_arrival:'زيارة من رابط مشاركة',
};
export const SEARCH_MISS_TYPES=['all','works','debates','issues','indicators','figures','history','companies','professionals','places','domains'];
const paths=[
 ['school','/school'],['games','/games'],['history','/yemen-history'],
 ['figures','/yemeni-figures'],['atlas','/yemen-map'],
 ['statistics','/yemen-in-numbers'],['rankings','/yemen-ranking'],
 ['debates','/debates'],['works','/works'],['magazine','/magazine'],
 ['universities','/universities'],['medical','/medical-centers'],
 ['products','/yemeni-products'],['professionals','/professionals'],['services','/services'],
 ['search','/search'],['contribute','/contribute'],
];
export function pageViewBucket(pathname){
 if(typeof pathname!=='string'||pathname.length>500||!pathname.startsWith('/'))return null;
 const path=pathname.split(/[?#]/,1)[0].replace(/\/$/,'')||'/';
 if(path==='/')return 'home';
 if(/^\/(admin|api|account|login|register|forgot-password|update-password|privacy|privacy-requests|terms|read-later)(\/|$)/.test(path))return null;
 if(path==='/school/studio'||path.startsWith('/school/studio/'))return null;
 for(const [bucket,prefix] of paths)if(path===prefix||path.startsWith(prefix+'/'))return bucket;
 if(/^\/(about|help|pages)(\/|$)/.test(path))return 'other';
 return null;
}
export function usageEvent(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const {event,section}=body;
 if(event==='page_view'&&Object.hasOwn(ACTIVITY_SECTIONS,section))return {event,section};
 if(event==='search_miss'&&typeof section==='string'&&SEARCH_MISS_TYPES.includes(section))return {event,section};
 if(event==='funnel'&&typeof section==='string'&&Object.hasOwn(FUNNEL_STEPS,section))return {event,section};
 return null;
}
export function usageOverview(rows=[],days=30,now=new Date()){
 const daysNum=[7,30,90].includes(Number(days))?Number(days):30;
 const date=new Date(now);
 const end=date.toISOString().slice(0,10);
 const start=new Date(Date.parse(end+'T00:00:00.000Z')-(daysNum-1)*86400000).toISOString().slice(0,10);
 const bySection=new Map(),bySearch=new Map(),byDate=new Map(),byStep=new Map();
 let pageViews=0,searchMisses=0;
 for(const row of rows){
  if(!row||typeof row.day!=='string'||row.day<start||row.day>end)continue;
  const count=Number(row.total);
  if(!Number.isSafeInteger(count)||count<0)continue;
  if(row.metric==='page_view'&&Object.hasOwn(ACTIVITY_SECTIONS,row.section)){
   pageViews+=count;bySection.set(row.section,(bySection.get(row.section)||0)+count);
   byDate.set(row.day,(byDate.get(row.day)||0)+count);
  }
  if(row.metric==='funnel'&&Object.hasOwn(FUNNEL_STEPS,row.section))byStep.set(row.section,(byStep.get(row.section)||0)+count);
  if(row.metric==='search_miss'&&SEARCH_MISS_TYPES.includes(row.section)){
   searchMisses+=count;bySearch.set(row.section,(bySearch.get(row.section)||0)+count);
  }
 }
 const timeline=Array.from({length:daysNum},(_,i)=>{
  const day=new Date(Date.parse(start+'T00:00:00.000Z')+i*86400000).toISOString().slice(0,10);
  return {day,views:byDate.get(day)||0};
 });
 return {days:daysNum,start,end,pageViews,searchMisses,
  sections:[...bySection].map(([id,count])=>({id,title:ACTIVITY_SECTIONS[id],count})).sort((a,b)=>b.count-a.count),
  searches:[...bySearch].map(([id,count])=>({id,title:id==='all'?'جميع الأقسام':id,count})).sort((a,b)=>b.count-a.count),
  funnel:funnelOverview(byStep),
  timeline};
}
// Counts per step plus the rates that matter: who finishes what they start, and how many
// signup invitations turn into accounts. A rate is null until its first step has a count.
export function funnelOverview(byStep=new Map()){
 const count=step=>byStep.get(step)||0;
 const rate=(done,start)=>count(start)>0?Math.round(count(done)/count(start)*100):null;
 return {
  steps:Object.entries(FUNNEL_STEPS).map(([id,title])=>({id,title,count:count(id)})),
  rates:[
   {id:'lesson_guest',title:'الزوار الذين أنهوا الدرس الذي بدؤوه',value:rate('lesson_done_guest','lesson_start_guest')},
   {id:'lesson_member',title:'الأعضاء الذين أنهوا الدرس الذي بدؤوه',value:rate('lesson_done_member','lesson_start_member')},
   {id:'game_guest',title:'الزوار الذين أنهوا اللعبة',value:rate('game_done_guest','game_start_guest')},
   {id:'game_member',title:'الأعضاء الذين أنهوا اللعبة',value:rate('game_done_member','game_start_member')},
   {id:'prompt_click',title:'من رأى دعوة التسجيل وضغطها',value:rate('signup_prompt_click','signup_prompt_shown')},
   {id:'prompt_signup',title:'من ضغط الدعوة ثم أنشأ حسابًا (تقريبي)',value:rate('signup_done','signup_prompt_click')},
   {id:'share_return',title:'زيارات لكل مشاركة',value:rate('share_arrival','share_click')},
  ],
 };
}
export function schoolLearningOverview(rows=[],minGroup=5){
 const groups=new Map();
 // Account IDs remain only in server memory and never leave this function.
 for(const row of rows){
  if(!row||!['passed','failed'].includes(row.status)||!row.user_id||
    !/^[a-z][a-z0-9-]{2,39}$/.test(row.course_slug)||
    !Number.isInteger(row.stage_index)||row.stage_index<0||row.stage_index>11)continue;
  const key=row.course_slug+':'+row.stage_index;
  if(!groups.has(key))groups.set(key,{course:row.course_slug,stage:row.stage_index,attempts:0,passedAttempts:0,started:new Set(),completed:new Set()});
  const g=groups.get(key);
  g.attempts++;
  g.passedAttempts+=row.status==='passed'?1:0;
  g.started.add(row.user_id);
  if(row.status==='passed')g.completed.add(row.user_id);
 }
 const stages=[...groups.values()].filter(g=>g.started.size>=minGroup).map(g=>({
  course:g.course,stage:g.stage,learners:g.started.size,
  completed:g.completed.size,completionRate:Math.round(g.completed.size/g.started.size*100),
  attempts:g.attempts,passRate:Math.round(g.passedAttempts/g.attempts*100),
 })).sort((a,b)=>b.learners-a.learners||a.completionRate-b.completionRate);
 return {stages,sampleAttempts:rows.length,minimumGroup:minGroup,
  // An excerpt of the latest attempts; not a lifetime all-student completion rate.
  sampled:rows.length>=3000};
}

// Some local development tunnels send an HTTPS browser origin to a Next server
// whose request.url is still http://localhost. This exception is ONLY for
// anonymous aggregate analytics, never for authenticated or editor APIs.
// Require browser same-origin metadata, a local upstream and a matching public
// Host or forwarded host. Forged non-browser requests may still increment an
// aggregate counter; this is not an authentication control.
export function analyticsOriginAllowed(request,isSameOrigin){
 if(isSameOrigin(request))return true;
 if(request.headers.get('sec-fetch-site')!=='same-origin')return false;
 const rawOrigin=request.headers.get('origin');
 if(!rawOrigin)return false;
 try{
  const origin=new URL(rawOrigin);
  const upstream=new URL(request.url);
  if(origin.origin!==rawOrigin||origin.protocol!=='https:'||origin.username||origin.password||
     origin.pathname!=='/'||origin.search||origin.hash)return false;
  if(upstream.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(upstream.hostname.toLowerCase()))return false;
  const forwardedProto=request.headers.get('x-forwarded-proto');
  if(forwardedProto&&forwardedProto!=='https')return false;
  const host=request.headers.get('host')?.toLowerCase();
  const forwardedHost=request.headers.get('x-forwarded-host')?.toLowerCase();
  return origin.host.toLowerCase()===host||origin.host.toLowerCase()===forwardedHost;
 }catch{return false;}
}
