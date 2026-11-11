import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changePercent,collectEvent,deviceFromAgent,isAutomatedAgent,osFromAgent,sourceCategory,statsPath,statsRange,yemenDay} from '../lib/siteStats.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const phone='Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const windows='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const visitor='k3j9x0a1b2c3d4e5f6',session='q9w8e7r6t5y4u3i2o1',id='0b7c4c8e-3c1a-4d5e-9f00-123456789abc';

// «إحصاءات الموقع» (owner, 2026-11-11): first-party statistics, management only.
test('paths: no query strings, no admin/API, private pages without their ids',()=>{
 assert.equal(statsPath('/yemen-history/saba?from=%2Fyemen-history#top'),'/yemen-history/saba');
 assert.equal(statsPath('/'),'/');
 assert.equal(statsPath('/school/'),'/school');
 for(const hidden of ['/admin','/admin/analytics','/api/analytics/collect','/school/studio/x','/auth/callback','//evil.test','javascript:alert(1)',null])assert.equal(statsPath(hidden),null,String(hidden));
 assert.equal(statsPath('/messages/3f1c'),'/messages');
 assert.equal(statsPath('/account/settings'),'/account');
 assert.equal(statsPath('/members/0b7c4c8e-3c1a-4d5e-9f00-123456789abc'),'/members/:id');
 assert.equal(statsPath('/market/seller/0b7c4c8e'),'/market/seller/:id');
 assert.equal(statsPath('/market/mine'),'/market/mine');
 assert.equal(statsPath('/market/1042'),'/market/1042');
});

test('sources are categories; the referrer itself is not kept',()=>{
 assert.equal(sourceCategory({host:'www.google.com'}),'google');
 assert.equal(sourceCategory({host:'google.com.sa'}),'google');
 assert.equal(sourceCategory({host:'l.facebook.com'}),'facebook');
 assert.equal(sourceCategory({host:'lm.facebook.com'}),'facebook');
 assert.equal(sourceCategory({host:'t.co'}),'x');
 assert.equal(sourceCategory({host:'com.whatsapp'}),'whatsapp');
 assert.equal(sourceCategory({host:'org.telegram.messenger'}),'telegram');
 assert.equal(sourceCategory({host:'duckduckgo.com'}),'search');
 assert.equal(sourceCategory({host:'news.example.org'}),'other');
 assert.equal(sourceCategory({host:''}),'direct');
 assert.equal(sourceCategory({host:'967ye.com',siteHost:'967ye.com'}),'direct');
 assert.equal(sourceCategory({utm:'WhatsApp'}),'whatsapp');
 assert.equal(sourceCategory({shared:true}),'share');
});

test('device and system from the user agent, which is not stored; automated browsers are skipped',()=>{
 assert.equal(deviceFromAgent(phone),'phone');assert.equal(osFromAgent(phone),'android');
 assert.equal(deviceFromAgent(iphone),'phone');assert.equal(osFromAgent(iphone),'ios');
 assert.equal(deviceFromAgent(windows),'desktop');assert.equal(osFromAgent(windows),'windows');
 assert.equal(deviceFromAgent('Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X)'),'tablet');
 assert.equal(deviceFromAgent('Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'),'tablet');
 for(const bot of ['Googlebot/2.1','Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0','facebookexternalhit/1.1','WhatsApp/2.23','967-site-monitor (GitHub Actions)','curl/8.0',''])assert.ok(isAutomatedAgent(bot),bot);
 for(const human of [phone,iphone,windows,phone+' Telegram-Android/10.0'])assert.equal(isAutomatedAgent(human),false,human);
});

test('the collector accepts only well-formed events and keeps nothing personal',()=>{
 const view=collectEvent({t:'view',id,v:visitor,s:session,p:'/yemen-history/saba?q=secret',q:1,n:true,m:false,r:'www.google.com',th:'dark',ti:'مملكة سبأ | مبادرة 967'},{agent:phone,siteHost:'967ye.com'});
 assert.equal(view.fn,'analytics_record_view');
 assert.deepEqual(view.args,{p_id:id,p_visitor:visitor,p_session:session,p_path:'/yemen-history/saba',p_title:'مملكة سبأ',p_seq:1,p_new:true,p_member:false,p_source:'google',p_device:'phone',p_os:'android',p_theme:'dark'});
 assert.ok(!JSON.stringify(view).includes('secret'));
 // Only the first page of a visit has a source.
 assert.equal(collectEvent({t:'view',id,v:visitor,s:session,p:'/',q:2,r:'www.google.com'},{agent:phone}).args.p_source,'direct');
 assert.equal(collectEvent({t:'view',id,v:visitor,s:session,p:'/admin',q:1},{agent:phone}),null);
 assert.equal(collectEvent({t:'view',id,v:'Bad Id',s:session,p:'/',q:1},{agent:phone}),null);
 assert.equal(collectEvent({t:'view',id:'nope',v:visitor,s:session,p:'/',q:1},{agent:phone}),null);
 assert.equal(collectEvent({t:'view',id,v:visitor,s:session,p:'/',q:1},{agent:'Googlebot/2.1'}),null);
 const time=collectEvent({t:'time',id,v:visitor,ms:99999999,ti:'x'},{agent:phone});
 assert.equal(time.fn,'analytics_record_time');assert.equal(time.args.p_duration_ms,1800000);
 assert.equal(collectEvent({t:'time',id,v:visitor,ms:-5},{agent:phone}),null);
 assert.deepEqual(collectEvent({t:'ping',v:visitor,s:session,p:'/market'},{agent:windows}),{fn:'analytics_ping',args:{p_session:session,p_visitor:visitor,p_path:'/market',p_device:'desktop'}});
 assert.equal(collectEvent({t:'other',v:visitor},{agent:phone}),null);
});

test('ranges are Yemen days, each compared with the period before it',()=>{
 const now=new Date('2026-11-11T22:30:00Z');// 01:30 on 12 November in Yemen
 assert.equal(yemenDay(now),'2026-11-12');
 assert.deepEqual(statsRange('today',now),{id:'today',from:'2026-11-12',to:'2026-11-12',previous:{from:'2026-11-11',to:'2026-11-11'}});
 assert.deepEqual(statsRange('7d',now),{id:'7d',from:'2026-11-06',to:'2026-11-12',previous:{from:'2026-10-30',to:'2026-11-05'}});
 assert.equal(statsRange('year',now).from,'2025-11-13');
 assert.equal(statsRange('forever',now),null);
 assert.equal(changePercent(120,100),20);assert.equal(changePercent(5,0),null);assert.equal(changePercent(0,4),-100);
});

test('the database keeps no IP, user agent or account id, and only the server writes or reads it',()=>{
 const sql=read('supabase/migrations/20261111200000_site_stats.sql');
 for(const column of ['ip_address','user_agent','user_id','referrer text','query_text','search_text'])assert.ok(!sql.includes(column),column);
 for(const table of ['analytics_views','analytics_visitor_days','analytics_presence'])assert.ok(sql.includes('alter table public.'+table+' enable row level security'),table);
 assert.ok(sql.includes('revoke all on public.analytics_views, public.analytics_visitor_days, public.analytics_presence from public, anon, authenticated'));
 for(const fn of ['analytics_record_view','analytics_record_time','analytics_ping','analytics_live','analytics_report','analytics_accounts'])assert.ok(new RegExp('grant execute on function public\\.'+fn+'\\([^)]*\\) to service_role').test(sql),fn);
 assert.ok(sql.includes("now() at time zone 'Asia/Aden'"));
 const route=read('app/api/analytics/collect/route.js');
 assert.ok(route.includes('analyticsOriginAllowed(request,isSameOrigin)'));
 assert.ok(!route.includes('x-forwarded-for'));
 // Team devices: marked when an editor or manager signs in.
 assert.ok(read('components/editorFlag.js').includes('if (canEdit === true) markTeamDevice();'));
});

test('stage 2: pages, read time, sections and entry pages',async()=>{
 const {sectionName}=await import('../lib/siteStats.js');
 assert.equal(sectionName('yemen-history'),'تاريخ اليمن');assert.equal(sectionName('home'),'الرئيسية');assert.equal(sectionName('unknown'),'/unknown');
 const sql=read('supabase/migrations/20261111200000_site_stats.sql');
 for(const key of ["'pages'","'sections'","'entries'","\"avgMs\"",'sum(exits)'])assert.ok(sql.includes(key),key);
 const ui=read('components/admin/AnalyticsDashboard.jsx');
 for(const text of ['الصفحات الأكثر زيارة','متوسط القراءة','غادروا الموقع منها','من أين يبدأ الزوار زياراتهم'])assert.ok(ui.includes(text),text);
});

test('stage 3: sources, devices, market; details summed daily and deleted after two days',async()=>{
 const {usageEvent}=await import('../lib/siteAnalytics.js');
 assert.deepEqual(usageEvent({event:'funnel',section:'market_whatsapp'}),{event:'funnel',section:'market_whatsapp'});
 assert.deepEqual(usageEvent({event:'funnel',section:'market_message'}),{event:'funnel',section:'market_message'});
 const sql=read('supabase/migrations/20261111200000_site_stats.sql');
 assert.ok(sql.includes('delete from public.analytics_views where day < v_today - 2;'));
 assert.ok(sql.includes('delete from public.analytics_visitor_days where day < v_today - 400;'));
 assert.ok(sql.includes("'market_whatsapp','market_message'"));
 // The report reads the daily totals, never the detailed rows.
 const report=sql.slice(sql.indexOf('create or replace function public.analytics_report'),sql.indexOf('create or replace function public.analytics_accounts'));
 assert.ok(!report.includes('analytics_views'));
 assert.ok(sql.includes('grant execute on function public.analytics_refresh() to service_role;'));
 assert.ok(sql.includes('grant execute on function public.analytics_market(date,date) to service_role;'));
 const api=read('app/api/admin/analytics/route.js');
 assert.ok(api.indexOf("rpc(db,'analytics_refresh')")<api.indexOf("rpc(db,'analytics_report'"));
 const bar=read('components/market/ListingContactBar.jsx');
 assert.ok(bar.includes("trackFunnel('market_whatsapp',String(listingId))"));
 assert.ok(bar.includes("trackFunnel('market_message',String(listingId))"));
 const ui=read('components/admin/AnalyticsDashboard.jsx');
 for(const text of ['من أين جاءت الزيارات','الأجهزة','سوق 967','ضغطات واتساب'])assert.ok(ui.includes(text),text);
});
