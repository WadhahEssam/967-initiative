import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {learningActivity,utcDay,SCHOOL_GOALS} from '../lib/schoolLearningHabits.js';
import {validateSchoolDraft,savedSchoolDraft} from '../lib/schoolDraft.js';
import {schoolMistakeReview} from '../lib/schoolReview.js';
import {makeSchoolQuestions} from '../lib/schoolMusnadQuestions.js';
import {makeArudQuestions} from '../lib/schoolArudQuestions.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('daily goals measure distinct graded stages in UTC, including unsuccessful effort',()=>{
 const x=(day,course_slug,stage_index,status='passed')=>({submitted_at:day,course_slug,stage_index,status});
 const records=[
  x('2026-10-29T10:00:00Z','musnad',0),x('2026-10-29T12:00:00Z','musnad',0,'failed'),
  x('2026-10-29T13:00:00Z','arud',1,'failed'),x('2026-10-28T22:00:00Z','arud',0),
  x('2026-10-27T23:59:00Z','musnad',1),x('2026-10-26T11:00:00Z','arud',1,'active')
 ];
 const habits=learningActivity(records,2,'2026-10-29T19:00:00Z');
 assert.equal(habits.todayCount,2);
 assert.equal(habits.todayProgress,100);
 assert.equal(habits.reachedGoal,true);
 assert.equal(habits.streak,3);
 assert.equal(habits.activeDays,3);
 assert.deepEqual(SCHOOL_GOALS,[1,2,3]);
 assert.equal(learningActivity([],3,'2026-10-29T11:00:00Z').streak,0);
 assert.equal(learningActivity(records,3,'2026-10-30T01:00:00Z').streak,3,'streak persists through next-day grace');
 assert.equal(learningActivity(records,1,'2026-11-02T01:00:00Z').streak,0);
 assert.equal(utcDay('2026-10-29T23:59:00Z'),'2026-10-29');
 assert.equal(utcDay('bad'),null);
});
test('saved drafts validate question IDs and opaque choices, never grade unfinished answers',()=>{
 for(const [questions,choice] of [[makeSchoolQuestions(0,1),null],[makeArudQuestions(3,1),null]]){
  assert.deepEqual(validateSchoolDraft(questions,{answers:[],selection:null}),{answers:[],selection:null});
  const first=questions[0];
  const sample=first.kind==='choice'?0:first.kind==='sequence'?[first.options[0]]:first.kind==='compose'?[0]:[0];
  assert.doesNotThrow(()=>validateSchoolDraft(questions,{answers:[],selection:sample}));
  assert.throws(()=>validateSchoolDraft(questions,{answers:[{id:'fake',choice:sample}],selection:null}));
  assert.throws(()=>validateSchoolDraft(questions,{answers:[],selection:99999}));
  assert.throws(()=>validateSchoolDraft(questions,{answers:[],selection:{answer:'leak'}}));
  assert.throws(()=>validateSchoolDraft(questions,{answers:Array.from({length:6},()=>({id:'bad',choice:0})),selection:null}));
 }
 assert.deepEqual(savedSchoolDraft({draft:null,draft_version:0}),{draft:{answers:[],selection:null},draftVersion:0});
});
test('review builds explanations only from finished graded submissions',()=>{
 const questions=makeArudQuestions(0,1);
 const answers=questions.map(q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):[...q.answer]}));
 const bad={...answers[0],choice:answers[0].choice===0?1:0};
 const record={course_slug:'arud',stage_index:0,status:'failed',questions,submission:[bad,...answers.slice(1)]};
 const review=schoolMistakeReview([{...record,status:'active'},record]);
 assert.equal(review.length,1);
 assert.equal(review[0].href,'/school/courses/arud/1');
 assert.ok(review[0].explanation.length>0);
 assert.ok(review[0].answer);
 assert.equal(schoolMistakeReview([{...record,status:'passed',submission:answers},record]).length,0,'later correction removes a mistake');
});
test('draft API is authenticated, restricted to active attempts, and protected against stale writes',()=>{
 // The Musnad and Arud routes are retired; drafts of every course are saved through the shared custom route.
 const custom=read('app/api/school/custom/route.js');
 const server=read('lib/schoolDraftServer.js');
 for(const source of [custom]){assert.ok(source.includes("body.action==='save'"));assert.ok(source.includes('isSameOrigin(request)'));assert.ok(source.includes('schoolUser(request,db)'));}
 assert.ok(server.includes(".eq('user_id',user.id)"));
 assert.ok(server.includes(".eq('status','active').lt('draft_version',revision)"));
 assert.ok(server.includes('validateSchoolDraft(row.questions,draft)'));
 assert.ok(!server.includes('gradeSchoolQuestions(')&&!server.includes('gradeArudQuestions('));
 const review=read('lib/schoolReview.js');
 assert.ok(review.includes("['passed','failed'].includes(row.status)"));
});
test('learning goals remain account-owned and backend-only',()=>{
 const dashboard=read('lib/schoolDashboardServer.js'),api=read('app/api/school/dashboard/route.js');
 const migration=read('supabase/migrations/20261029183746_school_learning_habits.sql');
 assert.ok(dashboard.includes(".eq('user_id',user.id)"));
 assert.ok(dashboard.includes("user_id:user.id,daily_goal:goal"));
 assert.ok(api.includes("body.action!=='goal'"));
 assert.ok(api.includes("readJsonObject(request,500)"));
 assert.ok(migration.includes('enable row level security'));
 assert.ok(migration.includes('revoke all on table public.school_learning_preferences from public,anon,authenticated,service_role'));
 assert.ok(migration.includes('grant select,insert,update on table public.school_learning_preferences to service_role'));
});
