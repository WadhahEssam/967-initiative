import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolEditorial,chooseSchoolQuestions,gradeSchoolChoice,publicSchoolChoice} from '../lib/schoolContent.js';
import {schoolStudioAnalytics} from '../lib/schoolStudioAnalytics.js';
import {buildSchoolDashboard} from '../lib/schoolDashboard.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('course and stage drafts reject incomplete and oversized content',()=>{
 const course=validateSchoolEditorial('course',{title:'تاريخ اليمن',description:'مسار متخصص في تاريخ اليمن عبر محطات تفاعلية',category:'التاريخ'});
 assert.equal(course.title,'تاريخ اليمن');
 assert.throws(()=>validateSchoolEditorial('course',{title:'',description:'hi',category:'a'}));
 const stage=validateSchoolEditorial('stage',{title:'الممالك القديمة',subtitle:'المقدمة',intro:'تعرّف على جذور حضارة اليمن القديمة وأهم أحداثها.',tips:['اقرأ السؤال بتأنٍ']});
 assert.equal(stage.tips.length,1);
 assert.throws(()=>validateSchoolEditorial('stage',{title:'مقدمة',subtitle:'',intro:'قصير',tips:[]}));
});
test('question bank accepts only four distinct choices and server-owned answer keys',()=>{
 const base={prompt:'أي الممالك اليمنية عرفت في العصور القديمة؟',target:'اختر الإجابة المناسبة',
 options:['سبأ','روما','فرنسا','ألمانيا'],answerIndex:0,explanation:'مملكة سبأ من الممالك اليمنية القديمة.'};
 const q=validateSchoolEditorial('question',base);
 assert.equal(q.answerIndex,0);
 assert.throws(()=>validateSchoolEditorial('question',{...base,options:['سبأ','سبأ','فرنسا','ألمانيا']}));
 assert.throws(()=>validateSchoolEditorial('question',{...base,answerIndex:5}));
 const rows=Array.from({length:7},(_,i)=>({id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),published:{...q,prompt:q.prompt+' '+i}}));
 const snapshot=chooseSchoolQuestions(rows,1);
 const publicQuestions=publicSchoolChoice(snapshot);
 assert.equal(snapshot.length,6);
 assert.equal(snapshot[0].answer,'سبأ');
 assert.ok(publicQuestions.every(question=>!Object.hasOwn(question,'answer')&&!Object.hasOwn(question,'explanation')&&!Object.hasOwn(question,'answerIndex')));
 const answers=snapshot.map(item=>({id:item.id,choice:item.options.indexOf(item.answer)}));
 assert.deepEqual(gradeSchoolChoice(snapshot,answers).passed,true);
 assert.throws(()=>gradeSchoolChoice(snapshot,[...answers.slice(0,5),{id:'wrong',choice:0}]));
 const shifted=chooseSchoolQuestions(rows,2);
 assert.notEqual(shifted[0].id,snapshot[0].id);
});
test('analytics never returns raw user information or responses',()=>{
 const q=chooseSchoolQuestions(Array.from({length:6},(_,i)=>({id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),
  published:{prompt:'ما الإجابة المناسبة لهذا السؤال التعليمي؟',target:'',options:['صحيح','خطأ','آخر','بديل'],answerIndex:0,explanation:'شرح موثق للاختيار الصحيح.'}})),1);
 const data=schoolStudioAnalytics([
  {user_id:'PRIVATE',course_slug:'historical-yemen',stage_index:0,status:'passed',score:6,questions:q,submission:q.map(x=>({id:x.id,choice:x.options.indexOf(x.answer)}))},
  {user_id:'PRIVATE2',course_slug:'historical-yemen',stage_index:0,status:'failed',score:0,questions:q,submission:q.map(x=>({id:x.id,choice:(x.options.indexOf(x.answer)+1)%x.options.length}))}
 ]);
 assert.equal(data.stages[0].attempts,2);
 assert.equal(data.stages[0].passRate,50);
 assert.equal(data.stages[0].meanScore,3);
 assert.equal(data.questions[0].wrongRate,50);
 assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
 assert.equal(JSON.stringify(data).includes('submission'),false);
});
test('custom authored courses participate in School dashboard, XP, levels and station progress',()=>{
 const custom=[{slug:'historical-yemen',title:'تاريخ اليمن',description:'تعلم التاريخ',category:'المعرفة',
  stages:[{index:0,title:'البداية'},{index:1,title:'الدولة'}]}];
 const credits=[{course_slug:'historical-yemen',stage_index:0,xp_amount:100},{course_slug:'historical-yemen',stage_index:0,xp_amount:100}];
 const data=buildSchoolDashboard([{course_slug:'historical-yemen',stage_index:0,status:'passed',created_at:'2026-10-29T12:00:00Z'}],false,credits,custom);
 assert.equal(data.totals.courses,3);
 assert.equal(data.xp.total,100);
 assert.equal(data.courses[2].completed,1);
 assert.equal(data.courses[2].nextStage.index,1);
 assert.equal(data.resume.stage.href,'/school/courses/historical-yemen/2');
});
test('editor and student route enforce staff permissions, version control and server grading',()=>{
 const studio=read('lib/schoolContentServer.js');
 const api=read('app/api/school/studio/route.js');
 const generic=read('lib/schoolGenericServer.js');
 const customApi=read('app/api/school/custom/route.js');
 assert.ok(studio.includes('schoolStaffPreview(db,user)'));
 assert.ok(studio.includes("current.version!==version"));
 assert.ok(studio.includes('published:current.draft'));
 assert.ok(studio.includes("if(current.draft?.format!==2)error("),'only card lessons can be published');
 assert.ok(studio.includes("if(count<1)"));
 assert.ok(studio.includes("updated_by:user.id"));
 assert.ok(api.includes('schoolUser(request,db)'));
 assert.ok(api.includes('isSameOrigin(request)'));
 assert.ok(generic.includes(".eq('user_id',user.id)"));
 assert.ok(generic.includes('gradeSchoolChoice(attempt.questions,attempt.submission)'));
 assert.ok(generic.includes('gradeSchoolChoice(attempt.questions,answers)'));
 assert.ok(customApi.includes('saveSchoolDraft(db,user,body.slug'));
 assert.ok(!customApi.includes('user_metadata'));
});
test('migration keeps drafts private and records editorial changes with exact snapshots',()=>{
 const sql=read('supabase/migrations/20261029193259_school_content_studio.sql');
 for(const table of ['school_editor_courses','school_editor_stages','school_editor_questions','school_editor_audit'])
  assert.ok(sql.includes('public.'+table));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all on table public.school_editor_courses'));
 assert.ok(sql.includes('from public,anon,authenticated,service_role'));
 assert.ok(sql.includes('before_snapshot jsonb'));
 assert.ok(sql.includes('after_snapshot jsonb'));
 assert.ok(sql.includes('create trigger school_editor_course_audit'));
 assert.ok(sql.includes('create trigger school_editor_question_audit'));
 assert.ok(sql.includes('on conflict (user_id,course_slug,stage_index) do nothing'));
 assert.ok(!sql.includes('grant select on table public.school_editor_questions to authenticated'));
 const editor=read('components/school/SchoolStudio.jsx');
 assert.ok(editor.includes("save('save')"));
 assert.ok(editor.includes("save('publish')"));
 assert.ok(editor.includes('التحليلات'));
 assert.ok(editor.includes('سجل التغييرات'));
});
