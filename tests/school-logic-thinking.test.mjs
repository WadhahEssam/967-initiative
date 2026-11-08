import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolEditorial,publishedSchoolQuestion,chooseSchoolQuestions,gradeSchoolChoice,publicSchoolChoice,normalizeArabicAnswer} from '../lib/schoolContent.js';
import {validateSchoolDraft} from '../lib/schoolDraft.js';
import {encodeMorse,decodeMorse,MORSE_ALPHABET,evaluateGate,gateTruthTable,GATE_TYPES} from '../lib/schoolThinkingLabs.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const slugs=['logical-thinking','logical-fallacies','morse-code','logic-gates'];
const courses=slugs.map(slug=>JSON.parse(read('data/school/logic/'+slug+'.json')));
function questionRows(stage){
 return [
  ...stage.facts.map((q,i)=>({id:'choice-'+i,published:q})),
  {id:'order',published:{kind:'order',prompt:stage.order.prompt,target:'',tokens:[...stage.order.answer].reverse(),answer:stage.order.answer,explanation:'الترتيب المنطقي هو: '+stage.order.answer.join(' ← ')}},
  {id:'type',published:{kind:'type',prompt:stage.type.prompt,target:'',answer:stage.type.answer,explanation:stage.type.explanation}}
 ];
}
test('third department has exactly 4 original tracks, 48 published-ready stages and 288 questions',()=>{
 assert.deepEqual(courses.map(c=>c.slug),slugs);
 for(const course of courses){
  assert.equal(course.course.category,'المنطق والتفكير');
  assert.equal(course.stages.length,12,course.slug);
  assert.equal(new Set(course.stages.map(s=>s.title)).size,12);
  assert.doesNotThrow(()=>validateSchoolEditorial('course',course.course));
  for(const [index,stage] of course.stages.entries()){
   assert.equal(stage.index,index);
   assert.equal(stage.lessons.length,3);
   assert.ok(stage.lessons.every(l=>l.body.length>=80&&l.note.length>=12&&l.example.length>=2));
   assert.doesNotThrow(()=>validateSchoolEditorial('stage',stage),course.slug+' '+index);
   assert.equal(questionRows(stage).length,6);
   for(const q of questionRows(stage))assert.doesNotThrow(()=>validateSchoolEditorial('question',q.published),course.slug+' '+index);
   assert.ok(stage.lessons.map(l=>l.body).join(' ').includes(stage.type.answer));
   for(const item of stage.order.answer)assert.ok(stage.lessons.map(l=>l.body+' '+l.example).join(' ').includes(item));
  }
 }
});
test('each six-question quiz grades on the server and never reveals correct answers at start',()=>{
 for(const course of courses)for(const stage of course.stages){
  const rows=questionRows(stage);
  const batch=chooseSchoolQuestions(rows,1);
  assert.deepEqual(batch.map(q=>q.kind).sort(),['choice','choice','choice','choice','order','type']);
  const publiclyShown=publicSchoolChoice(batch);
  assert.ok(publiclyShown.every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'answerIndex')&&!Object.hasOwn(q,'explanation')));
  const submitted=batch.map(q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):
   q.kind==='order'?q.answer.map(token=>q.tokens.indexOf(token)):q.answer}));
  assert.equal(gradeSchoolChoice(batch,submitted).score,6,course.slug+' '+stage.index);
  assert.equal(gradeSchoolChoice(batch,submitted).passed,true);
  assert.deepEqual(validateSchoolDraft(batch,{answers:submitted.slice(0,5),selection:null}).answers,submitted.slice(0,5));
  assert.throws(()=>gradeSchoolChoice(batch,[...submitted.slice(0,5),{id:'mismatch',choice:'x'}]));
 }
});
test('international Morse examples and 0-9 are exact and reversible',()=>{
 assert.equal(encodeMorse('SOS'),'... --- ...');
 assert.equal(encodeMorse('HELP'),'.... . .-.. .--.');
 assert.equal(encodeMorse('sos help'),'... --- ... / .... . .-.. .--.');
 assert.equal(decodeMorse('... --- ... / .... . .-.. .--.'),'SOS HELP');
 assert.equal(Object.keys(MORSE_ALPHABET).length,36);
 assert.equal(encodeMorse('0123456789'),'----- .---- ..--- ...-- ....- ..... -.... --... ---.. ----.');
 assert.throws(()=>encodeMorse('مرحبا'));
 assert.throws(()=>encodeMorse('A'.repeat(31)));
 assert.throws(()=>decodeMorse('<script>'));
 for(const stage of courses[2].stages){
  assert.equal(stage.lab.kind,'morse');
  assert.doesNotThrow(()=>encodeMorse(stage.lab.sample));
 }
 assert.equal(normalizeArabicAnswer(' sos '),'SOS');
});
test('Boolean gate simulation matches standard truth tables and half-adder arithmetic',()=>{
 assert.deepEqual(GATE_TYPES,['BUFFER','AND','OR','NOT','NAND','NOR','XOR','XNOR','HALF_ADDER']);
 assert.deepEqual(gateTruthTable('AND').map(x=>x.out),[0,0,0,1]);
 assert.deepEqual(gateTruthTable('OR').map(x=>x.out),[0,1,1,1]);
 assert.deepEqual(gateTruthTable('NAND').map(x=>x.out),[1,1,1,0]);
 assert.deepEqual(gateTruthTable('NOR').map(x=>x.out),[1,0,0,0]);
 assert.deepEqual(gateTruthTable('XOR').map(x=>x.out),[0,1,1,0]);
 assert.deepEqual(gateTruthTable('XNOR').map(x=>x.out),[1,0,0,1]);
 assert.deepEqual(gateTruthTable('NOT').map(x=>x.out),[1,0]);
 assert.deepEqual(gateTruthTable('BUFFER').map(x=>x.out),[0,1]);
 assert.deepEqual(evaluateGate('HALF_ADDER',1,1),{out:0,carry:1});
 assert.deepEqual(evaluateGate('HALF_ADDER',1,0),{out:1,carry:0});
 assert.throws(()=>evaluateGate('AND',2,1));
 for(const stage of courses[3].stages)assert.doesNotThrow(()=>gateTruthTable(stage.lab.gate));
});
test('Morse and gates are practical labs played as card tasks',()=>{
 // The v1 guided lesson was retired; labs are card tasks whose proof the server verifies.
 const card=read('components/school/v2/CardInteractions.jsx');
 assert.ok(card.includes("{lab.kind === 'morse' && <MorseLab sample={lab.sample} onComplete={complete}/>}"));
 assert.ok(card.includes("{lab.kind === 'gates' && <LogicGatesLab gate={lab.gate} onComplete={complete}/>}"));
 const morse=read('components/school/MorseLab.jsx');
 assert.ok(morse.includes('AudioContext'));
 assert.ok(morse.includes('encodeMorse'));
 assert.ok(morse.includes('decodeMorse'));
 const gates=read('components/school/LogicGatesLab.jsx');
 assert.ok(gates.includes('gateTruthTable'));
 assert.ok(gates.includes("onClick={()=>toggle('a')}"));
 assert.ok(gates.includes("onClick={()=>toggle('b')}"));
 assert.ok(gates.includes('onComplete?.({kind:\'gates\',visited:next})'));
 assert.ok(read('lib/schoolGenericServer.js').includes('gradeSchoolChoice'));
});
test('new courses are discoverable in their own category, not misfiled in Writing',()=>{
 assert.ok(read('app/school/page.jsx').includes('<SchoolWorldMap/>'));
 assert.ok(read('components/school/SchoolWorldMap.jsx').includes("href:'/school/logic'"));
 assert.ok(read('app/school/logic/page.jsx').includes("course.category!=='المنطق والتفكير'"));
 assert.ok(read('app/school/writing/page.jsx').includes("c.category==='الكتابة والأدب'"));
 assert.ok(read('components/school/SchoolStudio.jsx').includes('المختبر التفاعلي للمحطة'));
 assert.ok(read('components/school/SchoolStudio.jsx').includes('GATE_TYPES'));
});
test('published seed uses private service-only tables and does not reset XP or lesson attempts',()=>{
 const sql=read('supabase/migrations/20261030031114_school_logic_thinking_courses.sql');
 for(const slug of slugs)assert.ok(sql.includes(slug));
 for(const table of ['school_editor_courses','school_editor_stages','school_editor_questions'])assert.ok(sql.includes('public.'+table));
 assert.ok(sql.includes('on conflict (slug) do nothing'));
 assert.ok(sql.includes('on conflict (course_slug,stage_index) do nothing'));
 assert.ok(sql.includes('on conflict (id) do nothing'));
 assert.ok(!/delete\s+from\s+public\.school_stage_attempts/i.test(sql));
 assert.ok(!/truncate/i.test(sql));
});
