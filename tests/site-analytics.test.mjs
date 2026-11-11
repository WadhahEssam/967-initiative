import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pageViewBucket,usageEvent,usageOverview,schoolLearningOverview,ACTIVITY_SECTIONS,SEARCH_MISS_TYPES,analyticsOriginAllowed} from '../lib/siteAnalytics.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('only public content routes are included and detailed URLs are collapsed to a category',()=>{
 for(const [path,expected] of [['/','home'],['/school/courses/economics-basics/2','school'],['/games/map','games'],['/yemen-history/saba','history'],['/yemen-map/governorates/YE26','atlas'],['/search?q=private','search'],['/yemen-in-numbers/indicator/gdp','statistics']])
  assert.equal(pageViewBucket(path),expected,path);
 for(const path of ['/api/admin/analytics','/admin/analytics','/account','/login','/register','/privacy','/school/studio','/read-later','/admin/tasks','/unknown','https://evil.test/'])
  assert.equal(pageViewBucket(path),null,path);
});

test('analytics payload accepts only metric and an allowlisted section',()=>{
 assert.deepEqual(usageEvent({event:'page_view',section:'school'}),{event:'page_view',section:'school'});
 assert.deepEqual(usageEvent({event:'search_miss',section:'all'}),{event:'search_miss',section:'all'});
 for(const value of [{event:'page_view',section:'/school'},{event:'page_view',section:'admin'},{event:'search_miss',section:'strange'},{event:'download',section:'school'},null,[]])
  assert.equal(usageEvent(value),null);
 assert.ok(Object.keys(ACTIVITY_SECTIONS).length>=15);
 assert.ok(SEARCH_MISS_TYPES.includes('figures'));
});

test('UTC period aggregation excludes stale, future and unknown categories',()=>{
 const now=new Date('2026-10-31T12:00:00.000Z');
 const rows=[
  {day:'2026-10-31',metric:'page_view',section:'school',total:7},
  {day:'2026-10-30',metric:'page_view',section:'school',total:3},
  {day:'2026-10-31',metric:'page_view',section:'history',total:4},
  {day:'2026-10-31',metric:'search_miss',section:'all',total:2},
  {day:'2026-10-01',metric:'page_view',section:'home',total:200},
  {day:'2026-11-01',metric:'page_view',section:'home',total:400},
  {day:'2026-10-31',metric:'page_view',section:'admin',total:100},
  {day:'2026-10-31',metric:'page_view',section:'games',total:-1},
 ];
 const summary=usageOverview(rows,7,now);
 assert.equal(summary.pageViews,14);
 assert.equal(summary.searchMisses,2);
 assert.equal(summary.sections[0].id,'school');
 assert.equal(summary.sections[0].count,10);
 assert.equal(summary.timeline.length,7);
 assert.equal(summary.timeline.at(-1).views,11);
 assert.equal(summary.sections.some(x=>x.id==='admin'),false);
 assert.equal(usageOverview(rows,15,now).days,30);
});

test('school completion counts distinct people but exports no identifying data',()=>{
 const rows=[];
 for(let i=0;i<5;i++){
  const user='user-'+i;
  rows.push({user_id:user,course_slug:'musnad',stage_index:1,status:'failed'});
  rows.push({user_id:user,course_slug:'musnad',stage_index:1,status:i<3?'passed':'failed'});
 }
 const data=schoolLearningOverview(rows);
 assert.equal(data.sampleAttempts,10);
 assert.equal(data.stages.length,1);
 assert.deepEqual(data.stages[0],{course:'musnad',stage:1,learners:5,completed:3,completionRate:60,attempts:10,passRate:30});
 assert.ok(!JSON.stringify(data).includes('user-'));
 assert.equal(schoolLearningOverview(rows.slice(0,8)).stages.length,0);
});

test('tracking requires privacy controls and does not collect identifiers',()=>{
 const counters=read('components/analytics/SiteUsageTracker.jsx');
 const tracker=read('components/analytics/SiteStatsTracker.jsx');
 const privacy=read('components/analytics/AnalyticsPrivacyControls.jsx');
 const endpoint=read('app/api/analytics/event/route.js');
 const sql=read('supabase/migrations/20261031202332_site_usage_aggregate_analytics.sql');
 for(const token of ["doNotTrack","globalPrivacyControl","967-analytics-opt-out","credentials:'omit'"])assert.ok(counters.includes(token),token);
 for(const token of ["navigator.webdriver","doNotTrack","globalPrivacyControl","OPT_OUT_KEY","isTeamDevice()","credentials:'omit'"])assert.ok(tracker.includes(token),token);
 // Section page views now come from «إحصاءات الموقع»; the old counter keeps funnel and search misses.
 assert.ok(!counters.includes("'page_view'"));
 assert.ok(privacy.includes('إيقاف العدّ على هذا الجهاز'));
 assert.ok(privacy.includes('لا نحفظ عنوان IP'));
 assert.ok(privacy.includes("localStorage.removeItem('967-visitor')"));
 assert.ok(endpoint.includes("db.rpc('record_site_usage'"));
 assert.ok(endpoint.includes('analyticsOriginAllowed(request,isSameOrigin)'));
 assert.ok(endpoint.includes('usageEvent(body)'));
 for(const string of ['user_id uuid','ip_address','referrer','query_text','search_phrase'])
  assert.ok(!sql.includes(string),string);
 assert.ok(sql.includes('security invoker'));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all on function public.record_site_usage(text,text) from public,anon,authenticated'));
 assert.ok(sql.includes('grant execute on function public.record_site_usage(text,text) to service_role'));
});

test('private dashboard: management only, server side, small groups filtered and no raw student records returned',()=>{
 const api=read('app/api/admin/analytics/route.js');
 const ui=read('components/admin/AnalyticsDashboard.jsx');
 const nav=read('components/admin/AdminNavigation.jsx');
 const search=read('app/search/page.jsx');
 const layout=read('app/layout.jsx');
 assert.ok(api.indexOf('await authorizeEditorRequest')<api.indexOf("db.from('site_usage_daily')"));
 assert.ok(api.indexOf("actor.role!=='management'")<api.indexOf("rpc(db,'analytics_live')"));
 assert.ok(api.includes('schoolStudioAnalytics(rows,3000,5)'));
 assert.ok(read('lib/schoolStudioAnalytics.js').includes('.filter(x=>x.asked>=minAsked)'));
 assert.ok(api.includes('schoolLearningOverview(rows)'));
 assert.ok(api.includes("Cache-Control':'private, no-store'"));
 assert.ok(ui.includes('الأسئلة الأكثر خطأً'));
 assert.ok(ui.includes('إكمال المحطات'));
 assert.ok(ui.includes('counters.searches'));
 // The link is in the management-only part of the admin menu.
 assert.ok(nav.indexOf('{canManageUsers&&<><a href="/admin/analytics">')>0);
 assert.ok(!nav.includes('تحليلات الاستخدام'));
 assert.ok(layout.includes('<SiteStatsTracker/>'));
 assert.ok(search.includes('unavailable.length===0'));
 assert.ok(search.includes("<SearchMissTracker key={query"));
 assert.ok(!api.includes('return respond({records:'));
});

test('presentation is mobile responsive, keyboard navigable and explains what is counted',()=>{
 const css=read('components/admin/AnalyticsDashboard.module.css');
 const ui=read('components/admin/AnalyticsDashboard.jsx');
 assert.ok(css.includes('@media(max-width:650px)'));
 assert.ok(css.includes(':focus-visible'));
 assert.ok(ui.includes('فالزائر الواحد على جوال وكمبيوتر يُحسب زائرَين'));
 assert.ok(ui.includes('role="img"'));
 assert.ok(ui.includes('role="alert"'));
 assert.ok(ui.includes('aria-pressed={range===id}'));
 assert.ok(ui.includes('عرض الأرقام في جدول'));
});


test('anonymous analytics only trusts same-origin HTTPS tunnel requests for local upstream',()=>{
 const make=(origin,site='same-origin',host='public.trycloudflare.com',url='http://localhost:3000/api/analytics/event',proto='https')=>({
  url,headers:new Headers({'origin':origin,'sec-fetch-site':site,'host':host,'x-forwarded-proto':proto}),
 });
 const acceptDirect=()=>true;
 const rejectDirect=()=>false;
 const valid=make('https://public.trycloudflare.com');
 assert.equal(analyticsOriginAllowed(valid,rejectDirect),true);
 assert.equal(analyticsOriginAllowed(valid,acceptDirect),true);
 assert.equal(analyticsOriginAllowed(make('https://evil.test'),rejectDirect),false);
 assert.equal(analyticsOriginAllowed(make('https://public.trycloudflare.com','cross-site'),rejectDirect),false);
 assert.equal(analyticsOriginAllowed(make('https://public.trycloudflare.com','same-origin','public.trycloudflare.com','https://evil.test/api/analytics/event'),rejectDirect),false);
 assert.equal(analyticsOriginAllowed(make('https://public.trycloudflare.com','same-origin','public.trycloudflare.com','http://localhost:3000/api/analytics/event','http'),rejectDirect),false);
 assert.equal(analyticsOriginAllowed(make('https://public.trycloudflare.com/path'),rejectDirect),false);
 assert.equal(analyticsOriginAllowed(make('http://public.trycloudflare.com'),rejectDirect),false);
 const route=read('app/api/analytics/event/route.js');
 assert.ok(route.includes('analyticsOriginAllowed(request,isSameOrigin)'));
 assert.ok(!read('lib/requestSecurity.js').includes('analyticsOriginAllowed'),'do not broaden auth/admin origin validation');
});

test('conversion steps are anonymous counters accepted by both the API and the database',async()=>{
 const {FUNNEL_STEPS,funnelOverview}=await import('../lib/siteAnalytics.js');
 for(const step of Object.keys(FUNNEL_STEPS)){
  assert.deepEqual(usageEvent({event:'funnel',section:step}),{event:'funnel',section:step});
  assert.match(step,/^[a-z_]{2,40}$/);
 }
 for(const section of ['page_view','home','lesson_start',''])assert.equal(usageEvent({event:'funnel',section}),null,section);
 const sql=read('supabase/migrations/20261110060000_site_usage_funnel.sql');
 assert.ok(sql.includes("'page_view','search_miss','funnel'"));
 for(const step of Object.keys(FUNNEL_STEPS))assert.ok(sql.includes("'"+step+"'"),step);
 const overview=funnelOverview(new Map([['lesson_start_guest',10],['lesson_done_guest',4],['signup_prompt_shown',20]]));
 assert.equal(overview.rates.find(rate=>rate.id==='lesson_guest').value,40);
 assert.equal(overview.rates.find(rate=>rate.id==='prompt_click').value,0);
 assert.equal(overview.rates.find(rate=>rate.id==='game_guest').value,null,'no rate without a first step');
 const day=new Date().toISOString().slice(0,10);
 assert.equal(usageOverview([{day,metric:'funnel',section:'lesson_start_guest',total:3}]).funnel.steps.find(step=>step.id==='lesson_start_guest').count,3);
 const tracker=read('components/analytics/funnel.js');
 assert.ok(tracker.includes('sessionStorage'),'one count per step and item per tab session');
 assert.ok(!/userId|email|location\.href/.test(tracker),'no identifiers');
 for(const [file,token] of [['components/school/v2/CardLessonPlayer.jsx',"trackFunnel('lesson_start_"],['components/school/v2/CardLessonPlayer.jsx',"trackFunnel('lesson_done_"],['components/games/QuizGame.jsx',"useFunnelStep('game_done'"],['components/games/ArcadeChallenge.jsx',"useFunnelStep('game_start'"],['components/games/ExtraArcadeChallenge.jsx',"useFunnelStep('game_done'"],['components/debates/AudienceAuth.jsx',"trackFunnel('signup_done')"]])
  assert.ok(read(file).includes(token),file+' '+token);
});
