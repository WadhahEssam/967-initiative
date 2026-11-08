import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolEditorial} from '../lib/schoolContent.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const course=JSON.parse(read('data/school/arabic-calligraphy.json'));

test('all 12 calligraphy stations teach four complete lessons with worked examples BEFORE quiz',()=>{
 assert.equal(course.stages.length,12);
 assert.equal(course.stages.reduce((sum,s)=>sum+s.lessons.length,0),48);
 for(const stage of course.stages){
  assert.equal(stage.lessons.length,4,'station '+stage.index);
  const sanitized=validateSchoolEditorial('stage',stage);
  assert.equal(sanitized.lessons.length,4);
  assert.ok(stage.lessons.every(x=>x.title.length>=5&&x.body.length>=100&&x.example.length>=2&&x.note.length>=12));
  assert.ok(stage.practice?.instructions.length>=20);
  assert.equal(stage.facts.length,6);
  const phrases=stage.lessons.map(x=>x.body+' '+x.example+' '+x.note).join(' ');
  assert.ok(phrases.length>=600,'substantive teaching before questions in '+stage.index);
 }
});
test('worked instruction includes applied examples before ordering and typed questions',()=>{
 for(const stage of course.stages){
  const combined=stage.lessons.map(x=>x.body+' '+x.example+' '+x.note).join(' ');
  const typed=stage.type.answer;
  assert.ok(combined.includes(typed)||combined.includes(typed.replace(/^ال/,'')),'typed answer taught in stage '+stage.index);
  const ordering=stage.order.answer;
  assert.ok(ordering.every(x=>combined.includes(x)),'order tokens explained in stage '+stage.index);
 }
});
test('bad instructional content is rejected in School Studio rather than silently published',()=>{
 const stage=course.stages[0];
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lessons:[]}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lessons:[stage.lessons[0]]}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lessons:stage.lessons.map((x,i)=>i===0?{...x,body:'قصير'}:x)}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lessons:stage.lessons.map((x,i)=>i===0?{...x,example:''}:x)}));
 assert.doesNotThrow(()=>validateSchoolEditorial('stage',{title:'المحطة الأولى',subtitle:'',intro:'مقدمة تعليمية واضحة في مجال آخر.',tips:[]}));
});
test('published lessons are versioned atomically and do not alter learner progress',()=>{
 const migration=read('supabase/migrations/20261030020711_school_calligraphy_teaching_before_quiz.sql');
 assert.ok(migration.includes('s.version=1 and s.published_version=1'));
 assert.ok(migration.includes('s.draft=s.published'));
 assert.ok(migration.includes("not (s.published ? 'lessons')"));
 assert.ok(migration.includes('changed<>12'));
 assert.ok(migration.includes("published=jsonb_set(s.published,'{lessons}'"));
 assert.ok(!migration.toLowerCase().includes('school_stage_attempts'));
 assert.ok(!migration.toLowerCase().includes('school_xp_events'));
});
test('editor may update lessons as draft while leaving published copy unchanged',()=>{
 const editor=read('components/school/SchoolStudio.jsx');
 const server=read('lib/schoolContentServer.js');
 assert.ok(editor.includes('الشرح المتدرّج قبل الاختبار'));
 assert.ok(editor.includes('صفحة الشرح'));
 assert.ok(editor.includes('lessons:v.lessons.map'));
 assert.ok(server.includes('published:current.draft'));
 assert.ok(server.includes('current.version!==version'));
});
