import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHOOL_COURSES,SCHOOL_COURSE_SLUGS} from '../lib/schoolCatalog.js';
import {buildSchoolDashboard} from '../lib/schoolDashboard.js';
import {XP_PER_STAGE,xpThreshold,levelFromXp,xpSummary} from '../lib/schoolXp.js';
import {sectionIsVisible,pageIsVisible} from '../lib/pageVisibility.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const record=(course_slug,stage_index,status,day=1)=>({
 course_slug,stage_index,status,created_at:'2026-10-'+String(day).padStart(2,'0')+'T12:00:00Z'
});
test('catalog shares two existing courses and 24 stages without rewriting their progress',()=>{
 assert.deepEqual(SCHOOL_COURSE_SLUGS,['musnad','arud']);
 assert.deepEqual(SCHOOL_COURSES.map(x=>x.stages.length),[12,12]);
 assert.equal(SCHOOL_COURSES.every(x=>x.href.startsWith('/school/writing/')),true);
 assert.ok(read('lib/schoolServer.js').includes("const TABLE='school_stage_attempts'"));
 assert.ok(read('lib/schoolArudServer.js').includes("const TABLE='school_stage_attempts'"));
});
test('empty learner has zero real progress and first available stage',()=>{
 const data=buildSchoolDashboard([]);
 assert.deepEqual(data.totals,{courses:2,finishedCourses:0,completedStages:0,stages:24,submittedAttempts:0});
 assert.equal(data.resume.slug,'musnad');
 assert.equal(data.resume.stage.index,0);
 assert.ok(data.courses.every(c=>c.completed===0&&c.percent===0&&c.attempts===0));
});
test('passes survive failed retries and progress stays isolated across courses',()=>{
 const data=buildSchoolDashboard([
  record('musnad',0,'passed',1),record('musnad',0,'failed',2),record('musnad',1,'passed',3),
  record('arud',0,'passed',4),record('arud',1,'active',5),record('other',0,'passed',6),
  record('arud',13,'passed',7)
 ],true);
 assert.equal(data.totals.completedStages,3);
 assert.equal(data.totals.submittedAttempts,4);
 assert.equal(data.courses[0].completed,2);
 assert.equal(data.courses[0].nextStage.index,2);
 assert.equal(data.courses[1].nextStage.index,1);
 assert.equal(data.resume.slug,'arud');
 assert.equal(data.resume.hasActiveAttempt,true);
 assert.equal(data.staffPreview,true);
 assert.equal(data.courses[1].completed,1,'management preview alone never adds completions');
});
test('completed course is skipped when choosing what to learn next',()=>{
 const musnadPasses=Array.from({length:12},(_,i)=>record('musnad',i,'passed',i+1));
 const data=buildSchoolDashboard([...musnadPasses,record('arud',0,'passed',24)]);
 assert.equal(data.courses[0].finished,true);
 assert.equal(data.totals.finishedCourses,1);
 assert.equal(data.resume.slug,'arud');
 assert.equal(data.resume.stage.index,1);
 const finished=buildSchoolDashboard([...musnadPasses,...Array.from({length:12},(_,i)=>record('arud',i,'passed',i+1))]);
 assert.equal(finished.resume,null);
 assert.equal(finished.totals.finishedCourses,2);
});
test('private API filters by verified account and never exposes raw attempts',()=>{
 const api=read('app/api/school/dashboard/route.js');
 const server=read('lib/schoolDashboardServer.js');
 const client=read('components/school/SchoolDashboard.jsx');
 const page=read('app/school/dashboard/page.jsx');
 assert.ok(api.includes('schoolUser(request,db)'));
 assert.ok(api.includes('private, no-store'));
 assert.ok(api.includes("'Vary':'Authorization'"));
 assert.ok(server.includes(".eq('user_id',user.id)"));
 assert.ok(server.includes(".in('course_slug',slugs)"));
 assert.ok(server.includes(".range(from,from+PAGE_SIZE-1)"));
 assert.ok(server.includes('schoolStaffPreview(db,user)'));
 assert.ok(!server.includes('user_metadata')&&!api.includes('user_metadata'));
 assert.ok(client.includes('auth.getSession()'));
 assert.ok(client.includes('role="progressbar"'));
 assert.ok(page.includes('noindex:true,nofollow:true'));
 assert.ok(page.includes("sectionGate('school'"));
 assert.equal(pageIsVisible('/school/dashboard',{school:false}),false);
 assert.equal(sectionIsVisible('school',{school:false}),false);
});
test('roadmap has five phases and explicitly excludes certificates',()=>{
 const roadmap=read('docs/school-967-shared-system-roadmap.md');
 assert.ok(roadmap.includes('مراحل التنفيذ الخمس'));
 assert.ok(roadmap.includes('لا شهادات إتمام في أي مرحلة'));
});

test('XP levels grow with increasing thresholds, never with a guessed client value',()=>{
 assert.equal(XP_PER_STAGE,100);
 assert.deepEqual([1,2,3,4,5].map(xpThreshold),[0,100,300,600,1000]);
 assert.deepEqual([0,99,100,299,300,600,2400].map(x=>levelFromXp(x).level),[1,1,2,2,3,4,7]);
 assert.equal(levelFromXp(150).neededToNext,150);
 assert.equal(levelFromXp(150).percent,25);
 assert.equal(levelFromXp(-5).total,0);
 assert.throws(()=>xpThreshold(0));
});
test('XP ignores duplicate credits, invalid course, fake amounts and out-of-range stages',()=>{
 const credits=[
  {course_slug:'musnad',stage_index:0,xp_amount:100},
  {course_slug:'musnad',stage_index:0,xp_amount:100},
  {course_slug:'arud',stage_index:0,xp_amount:100},
  {course_slug:'other',stage_index:0,xp_amount:100},
  {course_slug:'musnad',stage_index:2,xp_amount:999},
  {course_slug:'arud',stage_index:12,xp_amount:100}
 ];
 const result=xpSummary(credits);
 assert.equal(result.total,200);
 assert.deepEqual(result.byCourse,{musnad:100,arud:100});
 const snapshot=buildSchoolDashboard([record('musnad',0,'passed')],false,credits);
 assert.equal(snapshot.xp.total,200);
 assert.equal(snapshot.xp.level,2);
 assert.equal(snapshot.courses[0].xp,100);
 assert.equal(snapshot.courses[1].xp,100);
});
test('XP backend and private ledger SQL are secured, deduplicated and backfilled',()=>{
 const server=read('lib/schoolDashboardServer.js');
 const api=read('app/api/school/dashboard/route.js');
 const jsx=read('components/school/SchoolDashboard.jsx');
 const migration=read('supabase/migrations/20261029181659_school_967_xp_events.sql');
 assert.ok(server.includes("const XP_TABLE='school_xp_events'"));
 assert.ok(server.includes(".eq('user_id',user.id)"));
 assert.ok(server.includes("const [records,staffPreview,credits,goal,review]=await Promise.all("));
 assert.ok(api.includes('schoolUser(request,db)'));
 assert.ok(migration.includes('unique (user_id,course_slug,stage_index)'));
 assert.ok(migration.includes('on conflict (user_id,course_slug,stage_index) do nothing'));
 assert.ok(migration.includes('after update of status on public.school_stage_attempts'));
 assert.ok(migration.includes("NEW.status = 'passed'"));
 assert.ok(migration.includes("OLD.status = 'active'"));
 assert.ok(migration.includes('create table if not exists public.school_xp_events'));
 assert.ok(migration.includes('enable row level security'));
 assert.ok(migration.includes('revoke all on table public.school_xp_events from public, anon, authenticated, service_role'));
 assert.ok(migration.includes('grant select on table public.school_xp_events to service_role'));
 assert.ok(migration.includes('distinct on (user_id,course_slug,stage_index)'));
 assert.ok(jsx.includes('data.xp.level')&&jsx.includes('data.xp.total'));
 assert.ok(jsx.includes('role="progressbar"'));
 assert.ok(!migration.includes('grant insert on table public.school_xp_events to authenticated'));
});
