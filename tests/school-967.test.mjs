import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MUSNAD_STAGES,MUSNAD_ALPHABET,MUSNAD_CHAPTERS,musnadPublicProgress,musnadStage} from '../lib/schoolMusnad.js';
import {makeSchoolQuestions,publicSchoolQuestions,gradeSchoolQuestions} from '../lib/schoolMusnadQuestions.js';
import {pageIsVisible,sectionIsVisible,publicSections} from '../lib/pageVisibility.js';
import {searchPages} from '../lib/searchPages.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('School 967 has twelve learning stages and the complete 29-letter Musnad alphabet',()=>{
 assert.equal(MUSNAD_STAGES.length,12);
 assert.equal(MUSNAD_ALPHABET.length,29);
 assert.equal(new Set(MUSNAD_ALPHABET.map(a=>a.glyph)).size,29);
 assert.deepEqual(MUSNAD_CHAPTERS.map(c=>c.end),[2,7,11]);
 assert.ok(MUSNAD_ALPHABET.every(a=>a.glyph.codePointAt(0)>=0x10A60&&a.glyph.codePointAt(0)<=0x10A7C));
 assert.deepEqual(MUSNAD_STAGES.map(s=>s.index),Array.from({length:12},(_,i)=>i));
 assert.deepEqual(MUSNAD_STAGES.slice(0,3).map(s=>s.letters.length),[4,4,0]);
 assert.equal(MUSNAD_STAGES.slice(3,8).reduce((sum,s)=>sum+s.letters.length,0),21);
 assert.equal(MUSNAD_STAGES[0].letters[0].glyph,'𐩣');
 assert.equal(MUSNAD_STAGES[1].letters[1].glyph,'𐩤');
 assert.equal(musnadStage(12),null);
 assert.equal(musnadStage('1'),null);
 assert.ok(MUSNAD_STAGES.every(s=>s.intro.length>70&&s.tips.length===3));
});

test('learning progress unlocks stages sequentially and retains passes after a failed retry',()=>{
 let progress=musnadPublicProgress([]);
 assert.deepEqual(progress.completed,[]);
 assert.equal(progress.unlocked,0);
 progress=musnadPublicProgress([{stage_index:0,status:'failed'},{stage_index:0,status:'passed'}]);
 assert.deepEqual(progress.completed,[0]);
 assert.equal(progress.unlocked,1);
 progress=musnadPublicProgress([{stage_index:1,status:'passed'},{stage_index:0,status:'passed'}]);
 assert.equal(progress.unlocked,2);
 progress=musnadPublicProgress([0,1,2].map(stage_index=>({stage_index,status:'passed'})));
 assert.equal(progress.finished,false);
 assert.equal(progress.unlocked,3);
 progress=musnadPublicProgress(Array.from({length:12},(_,stage_index)=>({stage_index,status:'passed'})));
 assert.equal(progress.finished,true);
 assert.equal(progress.unlocked,11);
});

test('six questions are varied across adjacent attempts, without leaking answer keys',()=>{
 for(let stage=0;stage<MUSNAD_STAGES.length;stage++){
  const first=makeSchoolQuestions(stage,1),retry=makeSchoolQuestions(stage,2);
  assert.equal(first.length,6);assert.equal(retry.length,6);
  assert.equal(new Set(first.map(q=>q.id)).size,6);
  assert.notDeepEqual(first.map(q=>q.id).slice().sort(),retry.map(q=>q.id).slice().sort());
  const pub=publicSchoolQuestions(first);
  assert.equal(pub.length,6);
  assert.ok(pub.every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'explanation')));
 }
 const first=makeSchoolQuestions(0,1);
 assert.equal(new Set(first.map(q=>q.id.split('-')[1])).size,4,'all four initial letters are assessed');
 assert.throws(()=>makeSchoolQuestions(12,1));
 assert.throws(()=>makeSchoolQuestions(0,0));
});

test('server grading requires 5/6 and rejects malformed answers and mismatched question IDs',()=>{
 for(let stage=0;stage<MUSNAD_STAGES.length;stage++){
  const questions=makeSchoolQuestions(stage,1);
  const perfect=questions.map(q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):q.answer.map(id=>q.options.findIndex(o=>o.id===id))}));
  const success=gradeSchoolQuestions(questions,perfect);
  assert.equal(success.score,6);
  assert.equal(success.passed,true);
  assert.equal(success.review.length,6);
  const oneWrong=perfect.map((a,i)=>i===0?{...a,choice:questions[i].kind==='choice'?(a.choice+1)%4:[...a.choice].reverse()}:a);
  assert.equal(gradeSchoolQuestions(questions,oneWrong).passed,true);
  const twoWrong=perfect.map((a,i)=>i<2?{...a,choice:questions[i].kind==='choice'?(a.choice+1)%4:[...a.choice].reverse()}:a);
  assert.equal(gradeSchoolQuestions(questions,twoWrong).passed,false);
  assert.throws(()=>gradeSchoolQuestions(questions,[]));
  assert.throws(()=>gradeSchoolQuestions(questions,perfect.map((a,i)=>i===0?{...a,id:'forged'}:a)));
 }
});

test('composition questions show only Musnad glyphs and never leak names or semantic IDs during assessment',()=>{
 const view=read('components/school/v2/CardInteractions.jsx');
 const server=read('lib/schoolMusnadQuestions.js');
 const styles=read('app/school/school.module.css');
 let seen=0;
 for(const stage of [2,9,10,11]){
  const questions=makeSchoolQuestions(stage,1);
  const publicQuestions=publicSchoolQuestions(questions);
  for(let i=0;i<questions.length;i++){
   const q=questions[i],pub=publicQuestions[i];
   if(q.kind!=='compose')continue;
   seen++;
   assert.deepEqual(pub.options,q.options.map(({glyph})=>({glyph})));
   assert.ok(pub.options.every(o=>Object.keys(o).length===1&&typeof o.glyph==='string'));
   assert.ok(!pub.options.some(o=>Object.hasOwn(o,'name')||Object.hasOwn(o,'latin')||Object.hasOwn(o,'id')));
   assert.equal(pub.target,q.target,'the target may name letters; the answer tiles may not');
   const submitted=q.answer.map(id=>q.options.findIndex(o=>o.id===id));
   assert.ok(submitted.every(v=>v>=0));
   const other=questions.map(item=>({
    id:item.id,
    choice:item.kind==='choice'?item.options.indexOf(item.answer):item.answer.map(id=>item.options.findIndex(o=>o.id===id))
   }));
   other[i]={id:q.id,choice:submitted};
   assert.equal(gradeSchoolQuestions(questions,other).score,6);
  }
 }
 assert.ok(seen>6,'composition questions should be covered across different stages');
 // Card compose task: keys show glyphs only; names appear (also to screen readers) only when the card sets labels.
 assert.ok(view.includes("aria-label={task.labels || id === 'sep' ? 'أضف ' + MUSNAD_KEYS[id].name : 'الرمز ' + (i + 1)}"));
 assert.ok(view.includes("{(task.labels || id === 'sep') && <small>{MUSNAD_KEYS[id].name}</small>}"));
 assert.ok(view.includes("const said = task.labels ? line.map(id => MUSNAD_KEYS[id]?.name).join('، ') : line.length + ' رموز';"));
 assert.ok(server.includes("['compose','sentence'].includes(q.kind)?q.options.map(({glyph})=>({glyph})):q.options"));
 assert.ok(styles.includes('Composition tests show only Musnad symbols'));
});

test('composition grade rejects forged tile positions but accepts sessions opened before deployment',()=>{
 for(const stage of [2,10]){
  const snapshot=makeSchoolQuestions(stage,1);
  const compose=snapshot.find(q=>q.kind==='compose');
  const answers=snapshot.map(q=>({
   id:q.id,
   choice:q.kind==='choice'?q.options.indexOf(q.answer):q.answer.map(id=>q.options.findIndex(o=>o.id===id))
  }));
  const legacy=answers.map((answer,i)=>snapshot[i].kind==='compose'?{id:answer.id,choice:snapshot[i].answer}:answer);
  assert.equal(gradeSchoolQuestions(snapshot,legacy).score,6);
  const position=snapshot.indexOf(compose);
  const invalid=[...answers];invalid[position]={...answers[position],choice:[999,...answers[position].choice.slice(1)]};
  assert.throws(()=>gradeSchoolQuestions(snapshot,invalid));
  const forgedName=[...answers];forgedName[position]={...answers[position],choice:[compose.options[0].name,...answers[position].choice.slice(1)]};
  assert.throws(()=>gradeSchoolQuestions(snapshot,forgedName));
 }
});

test('the school API grades on the server and private tables deny browser access',()=>{
 // The Musnad route is retired; card lessons of every course go through the shared custom route.
 const api=read('app/api/school/custom/route.js');
 const server=read('lib/schoolServer.js');
 const sql=read('supabase/migrations/20261029122247_school_967_musnad_attempts.sql');
 const extension=read('supabase/migrations/20261029124719_school_musnad_full_alphabet_stages.sql');
 assert.ok(api.includes('schoolUser(request,db)'));
 assert.ok(api.includes('isSameOrigin(request)'));
 assert.ok(api.includes("readJsonObject(request,8500)"));
 assert.ok(api.includes('checkGenericCard(db,user,body.slug,body.attemptId,body.cardId,body.answer)'));
 assert.ok(server.includes('gradeSchoolQuestions(row.questions,answers)'));
 assert.ok(server.includes("eq('user_id',user.id)"));
 assert.ok(server.includes("eq('status','active')"));
 assert.ok(server.includes('schoolOverview(db,user)'));
 assert.ok(!api.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(extension.includes('stage_index between 0 and 11'));
 assert.ok(sql.includes('revoke all on table public.school_stage_attempts from public, anon, authenticated'));
 assert.ok(sql.includes('grant select,insert,update,delete on table public.school_stage_attempts to service_role'));
});

test('the advanced course offers verified museum inscriptions without presenting fabricated texts as originals',()=>{
 const sources=read('lib/schoolCourseTools.js'),course=read('app/school/courses/[slug]/page.jsx');
 assert.ok(sources.includes('https://www.britishmuseum.org/collection/object/W_1862-1028-9'));
 assert.ok(sources.includes('https://doi.org/10.82194/dasi-epi-1085'));
 assert.ok(sources.includes('تمارين الدروس مُنشأة للتعلّم وليست منقولة منها'));
 assert.ok(course.includes('sources=SCHOOL_COURSE_SOURCES[slug]'));
 assert.ok(course.includes('<p className={styles.courseToolsNote}>{sources.note}</p>'));
 assert.ok(course.includes('target="_blank" rel="noopener noreferrer"'));
 const quiz=read('lib/schoolMusnadQuestions.js');
 assert.ok(quiz.includes('تدريب مُنشأ وليس نقشًا أثريًا'));
});

test('School 967 is a distinct searchable, visible site section and responsive classroom',()=>{
 const header=read('lib/navigation.js'),footer=read('components/Footer.jsx');
 const home=read('app/page.jsx'),css=read('app/school/school.module.css');
 const course=read('app/school/courses/[slug]/page.jsx');
 assert.ok(publicSections.some(x=>x.id==='school'&&x.path==='/school'));
 assert.equal(sectionIsVisible('school',{school:false}),false);
 assert.equal(pageIsVisible('/school/writing/musnad',{school:false}),false);
 assert.equal(pageIsVisible('/school/courses/musnad',{school:false}),false);
 assert.equal(pageIsVisible('/games',{school:false}),true);
 assert.ok(header.includes("id: 'school', label: 'مدرسة 967'"));
 assert.ok(header.includes('standalone: true'));
 assert.ok(footer.includes('<FooterGroup key={section.id} title={section.label}>'));
 assert.ok(home.includes("{visible('school')&&<section"));
 assert.ok(searchPages.some(x=>x.href==='/school/courses/musnad'));
 assert.ok(css.includes('@media(max-width:760px)')&&css.includes('@media(max-width:550px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 // The course is a card course on the shared journey; old addresses redirect only after the visibility gate.
 assert.ok(course.includes("if(!sectionGate('school',settings)||!db)notFound();"));
 assert.ok(course.includes('<CourseJourney '));
 const oldCourse=read('app/school/writing/musnad/page.jsx'),oldStage=read('app/school/writing/musnad/[stage]/page.jsx');
 assert.ok(oldCourse.indexOf("if(!sectionGate('school',settings))notFound();")<oldCourse.indexOf("permanentRedirect('/school/courses/musnad')"));
 assert.ok(oldCourse.includes("if(!sectionGate('school',settings))notFound();"));
 assert.ok(oldStage.includes('/^(?:[1-9]|1[0-2])$/'));
 assert.ok(oldStage.indexOf("if(!sectionGate('school',settings))notFound();")>0&&oldStage.indexOf("if(!sectionGate('school',settings))notFound();")<oldStage.indexOf("permanentRedirect('/school/courses/musnad/'+raw)"));
 assert.ok(read('components/school/MusnadWritingStudio.jsx').includes('onPointerDown={down}'));
 assert.ok(read('app/school/writing/musnad/alphabet/page.jsx').includes('MUSNAD_ALPHABET.map'));
 assert.ok(searchPages.some(x=>x.href==='/school/writing/musnad/practice'));
 for(const content of [header,home,course])assert.equal(/[\u0660-\u0669\u06F0-\u06F9]/u.test(content),false);
});
