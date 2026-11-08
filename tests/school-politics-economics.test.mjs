import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CIVIC_LABS,calculateCivicLab,allocateDhondt} from '../lib/schoolCivicModels.js';
import {CIVIC_ACTIVITIES,getCivicActivity,civicNumbers} from '../lib/schoolCivicActivities.js';
import {validateSchoolEditorial,chooseSchoolQuestions,publicSchoolChoice,gradeSchoolChoice} from '../lib/schoolContent.js';
const data=JSON.parse(readFileSync(new URL('../data/school/civic/phase1.json',import.meta.url),'utf8'));

test('four authored political-economic courses have 48 distinct stations and 288 protected assessments',()=>{
 assert.equal(data.length,4);
 assert.equal(new Set(data.map(c=>c.slug)).size,4);
 let lessons=0,questions=0;
 for(const course of data){
  assert.deepEqual(validateSchoolEditorial('course',course.course),course.course);
  assert.equal(course.course.category,'السياسة والاقتصاد');
  assert.equal(course.stages.length,12);
  for(const [index,station] of course.stages.entries()){
   assert.equal(station.index,index);
   const valid=validateSchoolEditorial('stage',station.stage);
   assert.equal(valid.lessons.length,4);
   assert.ok(Object.hasOwn(CIVIC_LABS,valid.lab.model));
   const activity=getCivicActivity(course.slug,index);
   assert.ok(activity,'station should have a contextual exercise');
   assert.ok(activity.story?.length>20);
   assert.equal(activity.title.length>5,true);
   assert.notEqual(activity.kind,'generic');
   assert.match(valid.source.url,/^https:\/\//);
   assert.equal(station.questions.length,6);
   const q=station.questions.map(item=>validateSchoolEditorial('question',item));
   assert.equal(q.filter(item=>item.kind==='choice').length,4);
   assert.equal(q.filter(item=>item.kind==='order').length,1);
   assert.equal(q.filter(item=>item.kind==='type').length,1);
   const rows=q.map((published,i)=>({id:(String(i+1).padStart(8,'0')+'-0000-4000-a000-'+String(index*6+i+1).padStart(12,'0')),published}));
   const selected=chooseSchoolQuestions(rows,1);
   assert.equal(selected.length,6);
   const publicQuestions=publicSchoolChoice(selected);
   for(const item of publicQuestions){
    assert.equal(Object.hasOwn(item,'answer'),false);
    assert.equal(Object.hasOwn(item,'answerIndex'),false);
    assert.equal(Object.hasOwn(item,'explanation'),false);
   }
   const correct=selected.map(item=>({id:item.id,choice:item.kind==='choice'?item.options.indexOf(item.answer):
    item.kind==='order'?item.answer.map(v=>item.tokens.indexOf(v)):item.answer}));
   const grade=gradeSchoolChoice(selected,correct);
   assert.equal(grade.score,6);
   assert.equal(grade.passed,true);
   lessons++;questions+=station.questions.length;
  }
 }
 assert.equal(lessons,48);
 assert.equal(questions,288);
 assert.equal(Object.values(CIVIC_ACTIVITIES).flat().length,48);
 assert.equal(new Set(Object.values(CIVIC_ACTIVITIES).flat().map(a=>a.title)).size,48);
 assert.ok(Object.values(CIVIC_ACTIVITIES).flat().some(a=>a.kind==='paths'));
 assert.ok(Object.values(CIVIC_ACTIVITIES).flat().some(a=>a.kind==='steps'));
 assert.ok(Object.values(CIVIC_ACTIVITIES).flat().some(a=>a.kind==='numbers'));
 assert.equal(civicNumbers(getCivicActivity('money-banks-inflation',2),5,5).metrics[0][1]>180,true);
 assert.equal(civicNumbers(getCivicActivity('economics-basics',9),500,50).metrics[0][1],10);
 assert.equal(civicNumbers(getCivicActivity('political-systems',7),60,30).metrics.slice(0,3).reduce((n,m)=>n+m[1],0),10);
});

test('political and economic decision labs remain bounded, mathematical and non-predictive',()=>{
 assert.deepEqual(allocateDhondt([60,30,10],10).reduce((a,v)=>a+v,0),10);
 assert.equal(calculateCivicLab('institutions',{x:40,y:35}).rows[2][1],'25%');
 assert.equal(calculateCivicLab('budget',{x:25,y:25}).rows[2][1],'50%');
 assert.equal(calculateCivicLab('elections',{x:45,y:35}).rows.length,3);
 const m=calculateCivicLab('market',{x:0,y:0});
 assert.ok(Math.abs(m.primary-100/6)<1e-9);
 assert.ok(calculateCivicLab('market',{x:20,y:0}).primary>m.primary);
 assert.ok(calculateCivicLab('market',{x:0,y:20}).primary<m.primary);
 assert.ok(Math.abs(calculateCivicLab('monetary',{x:0,y:5}).primary-10000/60)<1e-9);
 assert.ok(calculateCivicLab('monetary',{x:10,y:5}).primary>calculateCivicLab('monetary',{x:0,y:5}).primary);
 assert.throws(()=>calculateCivicLab('budget',{x:60,y:60}));
 assert.throws(()=>calculateCivicLab('market',{x:1000,y:0}));
 for(const config of Object.values(CIVIC_LABS))assert.ok(config.note.length>55);
});

test('department pages, editor and migration link to the existing learning system',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const index=read('app/school/page.jsx');
 const department=read('app/school/civic/page.jsx');
 const guide=read('components/school/v2/CardInteractions.jsx'); // the card lab task replaced the v1 guided lesson
 const editor=read('components/school/SchoolStudio.jsx');
 const migration=read('supabase/migrations/20261030193358_school_politics_economics_phase1.sql');
 assert.ok(index.includes('<SchoolWorldMap/>'));
 assert.ok(read('components/school/SchoolWorldMap.jsx').includes("href:'/school/civic'"));
 assert.match(department,/publishedSchoolCatalog/);
 assert.match(department,/publishedSchoolStages/);
 assert.match(guide,/CivicLab/);
 assert.match(editor,/CIVIC_LABS/);
 assert.match(migration,/on conflict \(slug\) do nothing/i);
 assert.match(migration,/on conflict \(course_slug,stage_index\) do nothing/i);
 assert.match(migration,/on conflict \(id\) do nothing/i);
 assert.doesNotMatch(migration,/truncate|delete from public\.school_/i);
});
