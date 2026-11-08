import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CIVIC_ACTIVITIES,civicNumbers} from '../lib/schoolCivicActivities.js';
import {validateSchoolEditorial} from '../lib/schoolContent.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('each new civic station teaches beginners through four distinct, validated chapters',()=>{
 const curriculum=JSON.parse(read('data/school/civic/phase1.json'));
 let count=0;
 for(const course of curriculum){
  for(const stage of course.stages){
   const lessons=validateSchoolEditorial('stage',stage.stage).lessons;
   assert.equal(lessons.length,4,course.slug+'/'+stage.index);
   assert.match(lessons[0].title,/المفهوم/);
   assert.match(lessons[1].title,/مثال/);
   assert.match(lessons[2].title,/خطوات/);
   assert.match(lessons[3].title,/الحدود/);
   assert.ok(lessons.every(l=>l.body.length>150));
   assert.ok(lessons[1].example.length>12);
   assert.ok(lessons[2].example.includes('←'));
   count++;
  }
 }
 assert.equal(count,48);
});
test('48 unique civic stations use content-specific scenes and multiple interaction types',()=>{
 const all=Object.values(CIVIC_ACTIVITIES).flat();
 assert.equal(all.length,48);
 assert.equal(new Set(all.map(x=>x.title)).size,48);
 assert.deepEqual([...new Set(all.map(a=>a.kind))].sort(),['case','numbers','paths','steps']);
 for(const a of all){
  assert.ok(a.story.length>25);
  assert.ok(a.explain.length>25);
  if(a.kind==='numbers'){
   const baseline=civicNumbers(a,a.x.initial,a.y.initial);
   assert.ok(!baseline.error&&baseline.metrics.length>0,a.title);
   assert.ok(baseline.metrics.every(row=>Number.isFinite(row[1])),a.title);
   assert.throws(()=>civicNumbers(a,a.x.max+100,a.y.initial));
  }else if(a.kind==='steps'){
   assert.equal(a.steps.length,3);
   assert.equal(new Set(a.steps).size,3);
  }else assert.ok(a.choices.length>=2);
 }
});
test('the global school example changes with material and all learners can practice without blind guesses',()=>{
 // The v1 guided lesson was retired; examples and labs now live in the card player.
 const visual=read('components/school/v2/CardVisual.jsx'),card=read('components/school/v2/CardInteractions.jsx');
 const science=read('components/school/ScienceLab.jsx');
 const civic=read('components/school/CivicLab.jsx');
 assert.ok(visual.includes('<CalligraphyExample text={visual.text} script={visual.script}'));
 assert.ok(card.includes('<CivicLab lab={lab} slug="" index={-1} onComplete={complete}/>'));
 assert.match(science,/كيف تستخدم المختبر/);
 assert.match(science,/onComplete\?\.\(\{kind:'science'/);
 assert.doesNotMatch(science,/يزداد.*ينخفض/);
 assert.doesNotMatch(civic,/يزداد.*ينخفض/);
 assert.match(civic,/CaseExercise/);
 assert.match(civic,/PathsExercise/);
 assert.match(civic,/StepsExercise/);
 assert.match(civic,/NumberExercise/);
});
test('the content-only migration avoids altering attempts, XP and question answer keys',()=>{
 const sql=read('supabase/migrations/20261030201328_school_civic_guided_lessons_v2.sql');
 assert.match(sql,/st\.published->'lessons'=c\.item->'old_lessons'/);
 assert.match(sql,/st\.draft->'lessons'=c\.item->'old_lessons'/);
 assert.match(sql,/st\.published_version=st\.version/);
 assert.doesNotMatch(sql,/delete from|truncate|update public\.school_editor_questions|school_stage_attempts/i);
});
