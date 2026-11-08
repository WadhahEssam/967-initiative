import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolEditorial,publishedSchoolQuestion,chooseSchoolQuestions,gradeSchoolChoice,publicSchoolChoice,normalizeArabicAnswer} from '../lib/schoolContent.js';
import {validateSchoolDraft} from '../lib/schoolDraft.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const course=JSON.parse(read('data/school/arabic-calligraphy.json'));
function bank(stage){
 return stage.facts.map((item,i)=>{
  const values=item.slice(1,5),rot=(stage.index+i+1)%4,options=[...values.slice(rot),...values.slice(0,rot)];
  return {id:String(i+1),published:{kind:'choice',prompt:item[0],target:'',options,answerIndex:options.indexOf(values[0]),explanation:item[5]}};
 }).concat([
  {id:'order',published:{kind:'order',prompt:stage.order.prompt,target:'',tokens:[...stage.order.answer].reverse(),answer:stage.order.answer,
   explanation:'التسلسل الصحيح هو '+stage.order.answer.join(' ← ')}},
  {id:'type',published:{kind:'type',prompt:stage.type.prompt,target:'',answer:stage.type.answer,explanation:stage.type.explanation}}
 ]);
}
test('twelve independent lessons teach substantive calligraphy with real writing practice',()=>{
 assert.equal(course.slug,'arabic-calligraphy');
 assert.equal(course.stages.length,12);
 const titles=course.stages.map(x=>x.title);
 assert.equal(new Set(titles).size,12);
 for(const [index,stage] of course.stages.entries()){
  assert.equal(stage.index,index);
  assert.ok(stage.intro.length>=250,'instruction depth '+index);
  assert.ok(stage.tips.length>=3,'real tips '+index);
  assert.ok(stage.practice.model.length>=2,'meaningful written model '+index);
  assert.ok(stage.practice.instructions.length>=30,'practice instruction '+index);
  assert.equal(stage.facts.length,6,'six distinct knowledge prompts');
  const normalized=validateSchoolEditorial('stage',stage);
  assert.equal(normalized.practice.model,stage.practice.model);
  assert.equal(bank(stage).length,8);
 }
 assert.ok(course.stages[11].practice.model.includes('اليمن أرض الحضارة'));
 assert.ok(titles.some(t=>t.includes('النسخ'))&&titles.some(t=>t.includes('الرقعة'))&&titles.some(t=>t.includes('الكوفي')));
});
test('question bank includes 4 varied choices, order and typed recall every attempt',()=>{
 for(const stage of course.stages){
  for(const row of bank(stage))assert.doesNotThrow(()=>validateSchoolEditorial('question',row.published));
  for(const attempt of [1,2,3]){
   const snapshot=chooseSchoolQuestions(bank(stage),attempt);
   assert.equal(snapshot.length,6);
   assert.deepEqual(snapshot.map(x=>x.kind).sort(),['choice','choice','choice','choice','order','type']);
   const publicItems=publicSchoolChoice(snapshot);
   for(const q of publicItems){
    assert.equal(Object.hasOwn(q,'answer'),false);
    assert.equal(Object.hasOwn(q,'explanation'),false);
    assert.equal(Object.hasOwn(q,'answerIndex'),false);
   }
   const answers=snapshot.map(q=>{
    if(q.kind==='choice')return {id:q.id,choice:q.options.indexOf(q.answer)};
    if(q.kind==='order')return {id:q.id,choice:q.answer.map(token=>q.tokens.indexOf(token))};
    return {id:q.id,choice:q.answer};
   });
   assert.equal(gradeSchoolChoice(snapshot,answers).score,6);
   assert.equal(gradeSchoolChoice(snapshot,answers).passed,true);
   assert.deepEqual(validateSchoolDraft(snapshot,{answers:answers.slice(0,4),selection:null}).answers,answers.slice(0,4));
   assert.throws(()=>gradeSchoolChoice(snapshot,[{...answers[0],choice:'wrong'},...answers.slice(1)]),'invalid input must throw, not grade');
  }
 }
});
test('order responses cannot repeat tokens or claim full credit with missing pieces',()=>{
 const q=publishedSchoolQuestion({id:'order',published:bank(course.stages[7])[6].published});
 const fake=[{id:q.id,choice:[0,0,1]}];
 const snapshot=[q,...Array(5).fill(q).map((row,i)=>({...row,id:row.id+'-'+i}))];
 assert.throws(()=>validateSchoolDraft(snapshot,{answers:fake,selection:null}));
 assert.throws(()=>gradeSchoolChoice(snapshot,[...fake,...Array(5).fill({id:'wrong',choice:0})]));
});
test('typed Arabic is diacritic/whitespace tolerant but strict about the answer',()=>{
 assert.equal(normalizeArabicAnswer(' أَلْنَّسْخ  '),normalizeArabicAnswer('النسخ'));
 const row=publishedSchoolQuestion({id:'typed',published:bank(course.stages[2])[7].published});
 const questions=Array.from({length:6},(_,i)=>({...row,id:'typed-'+i}));
 const good=questions.map(q=>({id:q.id,choice:'  النسخ  '}));
 const bad=questions.map(q=>({id:q.id,choice:'غير صحيح'}));
 assert.equal(gradeSchoolChoice(questions,good).score,6);
 assert.equal(gradeSchoolChoice(questions,bad).score,0);
 assert.throws(()=>validateSchoolDraft(questions,{answers:[{id:'typed-0',choice:''}],selection:null}));
});
test('real hand-drawing pad is explicitly ungraded, accessible with touch and export',()=>{
 const ui=read('components/school/CalligraphyPracticePad.jsx');
 // The v1 lesson players were retired; the pad now appears as a card visual of the card player.
 assert.ok(ui.includes('onPointerDown={start}'));
 assert.ok(ui.includes('onPointerMove={move}'));
 assert.ok(ui.includes("output.toDataURL('image/png')"));
 assert.ok(ui.includes('لا تُحتسب جودة الرسم ضمن درجة الاختبار'));
 const visual=read('components/school/v2/CardVisual.jsx');
 assert.ok(visual.includes("import CalligraphyPracticePad from '../CalligraphyPracticePad';"));
 assert.ok(visual.includes("case 'pad': return")&&visual.includes('<CalligraphyPracticePad practice={{model: visual.model'));
 assert.ok(read('lib/schoolGenericServer.js').includes('gradeSchoolChoice(attempt.questions,answers)'));
});
test('migration seeds the full course in private published studio tables without editing historic progress',()=>{
 const sql=read('supabase/migrations/20261030013401_school_arabic_calligraphy.sql');
 assert.ok(sql.includes('school_editor_courses'));
 assert.ok(sql.includes('school_editor_stages'));
 assert.ok(sql.includes('school_editor_questions'));
 assert.ok(sql.includes('on conflict (slug) do nothing'));
 assert.ok(sql.includes('on conflict (course_slug,stage_index) do nothing'));
 assert.ok(sql.includes('on conflict (id) do nothing'));
 assert.ok(!sql.includes('delete from public.school_stage_attempts'));
 assert.ok(!sql.includes('truncate'));
 assert.ok(sql.includes('arabic-calligraphy'));
});
