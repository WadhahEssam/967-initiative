import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARUD_STAGES,arudProgress,arudStage} from '../lib/schoolArud.js';
import {makeArudQuestions,publicArudQuestions,gradeArudQuestions} from '../lib/schoolArudQuestions.js';
import {ARUD_METERS,ARUD_METER_GROUPS} from '../lib/schoolArudMeters.js';
import {pageIsVisible,sectionIsVisible} from '../lib/pageVisibility.js';
import {searchPages} from '../lib/searchPages.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const perfect=questions=>questions.map(q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):[...q.answer]}));

test('the prosody course keeps four introductory stages and adds two applied stages without touching Musnad',()=>{
 assert.equal(ARUD_STAGES.length,12);
 assert.deepEqual(ARUD_STAGES.map(stage=>stage.index),Array.from({length:12},(_,i)=>i));
 assert.equal(arudStage(12),null);
 assert.equal(arudStage('1'),null);
 assert.ok(ARUD_STAGES.every(stage=>stage.intro.length>90&&stage.tips.length===3&&stage.examples.length===3));
 assert.ok(ARUD_STAGES[1].examples.some(x=>x.label.includes('/0')));
 assert.ok(ARUD_STAGES[2].examples.some(x=>x.label.includes('ᴗ')));
 assert.ok(ARUD_STAGES[3].examples.some(x=>x.label.includes('فعولن')));
 const musnad=read('lib/schoolMusnad.js');
 assert.ok(musnad.includes("export const MUSNAD_STAGES="));
 assert.ok(!musnad.includes("ARUD_STAGES"));
});

test('progression requires passes in sequence; failures do not unlock higher stages',()=>{
 assert.deepEqual(arudProgress([]).completed,[]);
 assert.equal(arudProgress([]).unlocked,0);
 assert.equal(arudProgress([{stage_index:0,status:'failed'}]).unlocked,0);
 let state=arudProgress([{stage_index:0,status:'passed'},{stage_index:1,status:'failed'}]);
 assert.deepEqual(state.completed,[0]);
 assert.equal(state.unlocked,1);
 state=arudProgress([0,1].map(stage_index=>({stage_index,status:'passed'})));
 assert.equal(state.unlocked,2);
 state=arudProgress([0,1,2,3].map(stage_index=>({stage_index,status:'passed'})));
 assert.equal(state.finished,false);
 assert.equal(state.unlocked,4);
 state=arudProgress([0,1,2,3,4,5].map(stage_index=>({stage_index,status:'passed'})));
 assert.equal(state.finished,false);
 assert.equal(state.unlocked,6);
 state=arudProgress(Array.from({length:12},(_,stage_index)=>({stage_index,status:'passed'})));
 assert.equal(state.finished,true);
 assert.equal(state.unlocked,11);
});

test('every Arud station has six varied questions and API data never contains grading keys',()=>{
 for(let stage=0;stage<12;stage++){
  const a=makeArudQuestions(stage,1),b=makeArudQuestions(stage,2);
  assert.equal(a.length,6);
  assert.equal(new Set(a.map(q=>q.id)).size,6);
  assert.notDeepEqual(a.map(q=>q.id).sort(),b.map(q=>q.id).sort());
  const publicQuestions=publicArudQuestions(a);
  assert.equal(publicQuestions.length,6);
  assert.ok(publicQuestions.every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'explanation')));
  assert.ok(a.every(q=>q.options.length>=2));
  assert.ok(a.filter(q=>q.kind==='choice').every(q=>new Set(q.options).size===q.options.length));
 }
 assert.throws(()=>makeArudQuestions(12,1));
 assert.throws(()=>makeArudQuestions(-1,1));
 assert.throws(()=>makeArudQuestions(1,0));
});

test('every introductory theory question shows a concrete example without giving away the answer',()=>{
 const snapshot=makeArudQuestions(0,1);
 for(let attempt=1;attempt<=6;attempt++){
  for(const question of makeArudQuestions(0,attempt)){
   assert.equal(question.kind,'choice');
   assert.ok(typeof question.example==='string'&&question.example.length>=30);
   assert.ok(!question.example.includes(question.answer),'example must not directly repeat the correct choice');
   const output=publicArudQuestions([question]);
   assert.equal(output[0].example,question.example);
   assert.ok(!Object.hasOwn(output[0],'answer'));
   assert.ok(!Object.hasOwn(output[0],'explanation'));
  }
 }
 const allIds=Array.from({length:16},(_,i)=>'rule-'+i);
 const publicSource=read('lib/schoolArudQuestions.js');
 assert.ok(publicSource.includes('const FUNDAMENTAL_EXAMPLES='));
 assert.equal((publicSource.match(/'rule-'/g)||[]).length>=1,true);
 const legacy=allIds.map(id=>({...snapshot[0],id,example:undefined}));
 const recovered=publicArudQuestions(legacy);
 assert.ok(recovered.every(q=>typeof q.example==='string'&&q.example.length>=30),'older open attempts receive examples');
});

test('movement, rest and syllable exercises use interactive sequences, not answer-disclosing choices',()=>{
 for(const stage of [1,2]){
  const question=makeArudQuestions(stage,1);
  assert.ok(question.every(q=>q.kind==='sequence'));
  assert.ok(question.every(q=>q.answer.every(item=>q.options.includes(item))));
  assert.ok(question.every(q=>q.options.length===2));
 }
 const scan=makeArudQuestions(1,1);
 assert.ok(scan.every(q=>q.target!==q.answer.join('')));
 const patterns=makeArudQuestions(2,1);
 assert.ok(patterns.every(q=>q.answer.every(x=>x==='ᴗ'||x==='—')));
});

test('server grading requires 5 out of 6, handles incomplete attempts, and refuses forged tokens',()=>{
 for(let stage=0;stage<12;stage++){
  const snapshot=makeArudQuestions(stage,1),answers=perfect(snapshot);
  const full=gradeArudQuestions(snapshot,answers);
  assert.equal(full.score,6);
  assert.equal(full.passed,true);
  assert.equal(full.review.length,6);
  const wrong=answers.map((a,i)=>{
   if(i!==0)return a;
   const q=snapshot[i];
   return {...a,choice:q.kind==='choice'?(a.choice+1)%q.options.length:q.answer.map((v,j)=>j===0?(v===q.options[0]?q.options[1]:q.options[0]):v)};
  });
  assert.equal(gradeArudQuestions(snapshot,wrong).score,5);
  const twice=wrong.map((a,i)=>{
   if(i!==1)return a;
   const q=snapshot[i];
   return {...a,choice:q.kind==='choice'?(a.choice+1)%q.options.length:q.answer.map((v,j)=>j===0?(v===q.options[0]?q.options[1]:q.options[0]):v)};
  });
  assert.equal(gradeArudQuestions(snapshot,twice).passed,false);
  assert.throws(()=>gradeArudQuestions(snapshot,[]));
  assert.throws(()=>gradeArudQuestions(snapshot,answers.map((x,i)=>i===0?{...x,id:'forged'}:x)));
  if(stage===1||stage===2){
   const corrupted=[...answers];corrupted[0]={...answers[0],choice:['fake']};
   assert.throws(()=>gradeArudQuestions(snapshot,corrupted));
  }
 }
});

test('Arud API uses the same verified account and staff preview rules without mixing course records',()=>{
 // The Arud route is retired; card lessons of every course (Arud included) go through the shared custom route.
 const api=read('app/api/school/custom/route.js');
 const server=read('lib/schoolArudServer.js');
 const migration=read('supabase/migrations/20261029141931_school_arud_course_enable.sql');
 assert.ok(api.includes('schoolUser(request,db)'));
 assert.ok(api.includes('isSameOrigin(request)'));
 assert.ok(api.includes("readJsonObject(request,8500)"));
 assert.ok(server.includes("const COURSE='arud'"));
 assert.ok(server.includes(".eq('course_slug',COURSE)"));
 assert.ok(server.includes('schoolStaffPreview(db,user)'));
 assert.ok(server.includes('canOpen('));
 assert.ok(server.includes("result.passed?'passed':'failed'"));
 assert.ok(server.includes("gradeArudQuestions(row.questions,answers)"));
 assert.ok(!server.includes('user_metadata')&&!api.includes('body.role'));
 assert.ok(migration.includes("('musnad','arud')"));
 const existing=read('supabase/migrations/20261029122247_school_967_musnad_attempts.sql');
 assert.ok(existing.includes('enable row level security'));
 assert.ok(existing.includes('revoke all on table public.school_stage_attempts from public, anon, authenticated'));
 assert.ok(read('lib/schoolServer.js').includes("eq('course_slug','musnad')"));
});

test('Arud is independent, searchable, responsive, keyboard-accessible and respects school visibility',()=>{
 const catalog=read('app/school/writing/page.jsx');
 const course=read('app/school/writing/arud/page.jsx');
 const footer=read('components/Footer.jsx'); // footer-only school links stay in Footer.jsx extras
 assert.ok(catalog.includes("href:'/school/courses/arud'"));
 assert.ok(catalog.includes('<SchoolTrackTrail'));
 assert.ok(footer.includes("['/school/courses/arud', 'تعلم علم العروض']"));
 assert.ok(searchPages.some(p=>p.href==='/school/courses/arud'));
 // The old address redirects to the card course only after the school visibility gate.
 assert.ok(course.includes("if(!sectionGate('school',settings))notFound();"));
 assert.ok(course.indexOf("sectionGate('school'")<course.indexOf("permanentRedirect('/school/courses/arud')"));
 assert.equal(sectionIsVisible('school',{school:false}),false);
 assert.equal(pageIsVisible('/school/writing/arud/4',{school:false}),false);
 assert.equal(pageIsVisible('/school/courses/arud/4',{school:false}),false);
 assert.equal(pageIsVisible('/school/writing/musnad',{school:false}),false);
 assert.equal(pageIsVisible('/games',{school:false}),true);
 for(const text of [catalog,course])assert.equal(/[\u0660-\u0669\u06F0-\u06F9]/u.test(text),false);
});

test('authentic verse stages use server-graded complete feet and four correctly attributed meters',()=>{
 assert.equal(ARUD_STAGES[4].id,'real-hemistich');
 assert.equal(ARUD_STAGES[5].id,'poetry-meters');
 const allFeet=Array.from({length:8},(_,i)=>makeArudQuestions(4,i+1)).flat();
 const sequences=allFeet.filter(q=>q.kind==='sequence');
 assert.ok(sequences.length>0);
 assert.ok(sequences.every(q=>q.steps===4&&q.answer.length===4&&q.answer.every(f=>q.options.includes(f))));
 assert.ok(sequences.some(q=>q.answer.includes('فعولُ')),'contracted third foot is preserved');
 const focused=allFeet.filter(q=>q.id.startsWith('verse-focus-'));
 assert.equal(new Set(focused.map(q=>q.answer)).size,4,'focused questions span all four foot options');
 const publicFeet=publicArudQuestions(sequences);
 assert.ok(publicFeet.every(q=>q.steps===4&&q.attribution&&!Object.hasOwn(q,'answer')));
 const meters=Array.from({length:8},(_,i)=>makeArudQuestions(5,i+1)).flat();
 assert.deepEqual([...new Set(meters.map(q=>q.answer))].sort(),['البسيط','الطويل','المتقارب','الوافر'].sort());
 assert.ok(meters.every(q=>q.target?.length>15&&q.attribution&&q.kind==='choice'));
 assert.ok(publicArudQuestions(meters).every(q=>!Object.hasOwn(q,'answer')));
 const page=read('app/school/writing/arud/[stage]/page.jsx');
 assert.ok(page.includes('1[0-2]'),'the route includes the final three stations');
 assert.ok(page.includes("permanentRedirect('/school/courses/arud/'+raw)"),'old station addresses open the same card lesson');
 assert.ok(read('app/school/courses/[slug]/[stage]/page.jsx').includes('index=Number(raw)-1'),'numeric route is resolved to the zero-based stage');
 const migration=read('supabase/migrations/20261029124719_school_musnad_full_alphabet_stages.sql');
 assert.ok(migration.includes('stage_index between 0 and 11'),'current database constraint supports stages 0 through 5');
});

test('all sixteen classical and later meters appear exactly once in the course reference',()=>{
 assert.equal(ARUD_METERS.length,16);
 assert.equal(new Set(ARUD_METERS.map(m=>m.name)).size,16);
 assert.deepEqual(ARUD_METER_GROUPS.map(g=>g.length),[4,4,4]);
 assert.equal(new Set(ARUD_METERS.map(m=>m.pattern)).size,16);
 assert.ok(ARUD_METERS.every(m=>m.pattern===m.feet.join(' | ')));
 assert.equal(ARUD_METERS.find(m=>m.name==='المتدارك').pattern,'فاعلن | فاعلن | فاعلن | فاعلن');
});
test('full verses have eight or six server-graded feet, with a hands-on question in every attempt',()=>{
 for(let attempt=1;attempt<=25;attempt++){
  const questions=makeArudQuestions(6,attempt);
  assert.ok(questions.some(q=>q.kind==='sequence'));
  for(const q of questions.filter(q=>q.kind==='sequence')){
   assert.equal(q.steps,q.answer.length);
   assert.ok([3,4,6,8].includes(q.steps));
   assert.ok(q.target.includes('\n'));
   assert.equal(publicArudQuestions([q])[0].steps,q.steps);
   assert.equal(publicArudQuestions([q])[0].attribution.length>0,true);
   assert.throws(()=>gradeArudQuestions([q,q,q,q,q,q],[{id:q.id,choice:['invalid']},...Array.from({length:5},()=>({id:q.id,choice:q.answer}))]));
  }
 }
 const publicSource=read('lib/schoolArudQuestions.js');
 assert.ok(publicSource.includes("name:'امرؤ القيس'"));
 assert.ok(publicSource.includes("name:'المتنبي'"));
});
test('variation quizzes cover five common zihafs and three common illal with clear mechanics',()=>{
 const pool=Array.from({length:24},(_,i)=>makeArudQuestions(7,i+1)).flat();
 const names=new Set(pool.filter(q=>q.id.startsWith('variation-name-')).map(q=>q.answer));
 for(const name of ['القبض','الخبن','الطي','الإضمار','العصب','الحذف','القطع','القصر'])assert.ok(names.has(name));
 assert.ok(pool.some(q=>q.prompt.includes('التغيّر الصوتي')));
 assert.ok(pool.some(q=>q.answer==='زحاف'));
 assert.ok(pool.some(q=>q.answer==='علة'));
});
test('later stations cover all twelve remaining meter names and keep answer keys on the server',()=>{
 for(const group of [1,2,3]){
  const collection=Array.from({length:8},(_,i)=>makeArudQuestions(group+7,i+1)).flat();
  assert.ok(ARUD_METER_GROUPS[group-1].every(m=>collection.some(q=>q.answer===m.name)));
  assert.ok(collection.every(q=>!Object.hasOwn(publicArudQuestions([q])[0],'answer')));
 }
 const collection=Array.from({length:40},(_,i)=>makeArudQuestions(11,i+1)).flat();
 assert.ok(ARUD_METERS.every(m=>collection.some(q=>q.answer===m.name)));
});
