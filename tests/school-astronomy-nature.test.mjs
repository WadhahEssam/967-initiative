import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolEditorial,publishedSchoolQuestion,chooseSchoolQuestions,gradeSchoolChoice,publicSchoolChoice} from '../lib/schoolContent.js';
import {validateSchoolDraft} from '../lib/schoolDraft.js';
import {SCIENCE_LABS,SCIENCE_MODEL_IDS,calculateScienceLab} from '../lib/schoolScienceModels.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const slugs=['solar-system','weather-climate','earth-interior','universe-mysteries'];
const curriculum=slugs.map(slug=>JSON.parse(read('data/school/science/'+slug+'.json')));
const attemptBank=stage=>[
 ...stage.facts.map((q,i)=>({id:'f'+i,published:q})),
 {id:'order',published:{kind:'order',prompt:stage.order.prompt,target:'',tokens:[...stage.order.answer].reverse(),answer:stage.order.answer,explanation:'رتّب الخطوات هكذا: '+stage.order.answer.join(' ← ')+'.'}},
 {id:'type',published:{kind:'type',prompt:stage.type.prompt,target:'',answer:stage.type.answer,explanation:stage.type.explanation}}
];
test('four approved science tracks contain exactly 48 authored stations, with 144 explanatory screens and 288 questions',()=>{
 assert.deepEqual(curriculum.map(c=>c.slug),slugs);
 for(const course of curriculum){
  assert.equal(course.course.category,'الفلك والطبيعة');
  assert.equal(course.stages.length,12,course.slug);
  assert.equal(new Set(course.stages.map(s=>s.title)).size,12);
  assert.doesNotThrow(()=>validateSchoolEditorial('course',course.course));
  for(const [index,stage] of course.stages.entries()){
   assert.equal(stage.index,index);
   assert.equal(stage.lessons.length,3);
   assert.equal(stage.facts.length,4);
   assert.equal(attemptBank(stage).length,6);
   assert.ok(stage.lessons.every(l=>l.body.length>=80&&l.example.length>=2&&l.note.length>=12));
   const clean=validateSchoolEditorial('stage',stage);
   assert.equal(clean.lab.kind,'science');
   assert.ok(SCIENCE_MODEL_IDS.includes(clean.lab.model));
   assert.equal(clean.lab.scenario,stage.title);
   assert.ok(clean.source.url.startsWith('https://'));
   assert.equal(clean.source.url,stage.source.url);
   assert.ok(stage.lessons[1].example.includes(stage.order.answer[0]));
   assert.ok(stage.lessons[2].body.includes(stage.type.answer));
   for(const question of attemptBank(stage))assert.doesNotThrow(()=>validateSchoolEditorial('question',question.published));
  }
 }
});
test('science exercises are graded on the server, with no published solutions sent to browser during attempt',()=>{
 for(const course of curriculum)for(const stage of course.stages){
  const rows=attemptBank(stage),questions=chooseSchoolQuestions(rows,1);
  assert.deepEqual(questions.map(q=>q.kind).sort(),['choice','choice','choice','choice','order','type']);
  const publicItems=publicSchoolChoice(questions);
  assert.ok(publicItems.every(q=>!('answer' in q)&&!('answerIndex' in q)&&!('explanation' in q)));
  const submissions=questions.map(q=>({
   id:q.id,
   choice:q.kind==='choice'?q.options.indexOf(q.answer):
    q.kind==='order'?q.answer.map(token=>q.tokens.indexOf(token)):q.answer
  }));
  assert.equal(gradeSchoolChoice(questions,submissions).score,6);
  assert.equal(gradeSchoolChoice(questions,submissions).passed,true);
  assert.deepEqual(validateSchoolDraft(questions,{answers:submissions.slice(0,3),selection:null}).answers,submissions.slice(0,3));
 }
});
test('all science simulations produce finite values throughout their documented input bounds',()=>{
 assert.equal(SCIENCE_MODEL_IDS.length,22);
 for(const model of SCIENCE_MODEL_IDS){
  const item=SCIENCE_LABS[model];
  assert.ok(item.title.length>6&&item.caveat.length>20);
  for(const edge of [0,1]){
   const input={x:edge?item.x.max:item.x.min};
   if(item.y)input.y=edge?item.y.max:item.y.min;
   const res=calculateScienceLab(model,input);
   assert.ok(Number.isFinite(res.primary),'non-finite result '+model);
   assert.ok(res.ratio>=0&&res.ratio<=1);
   assert.ok(res.metrics.length>=2&&res.metrics.every(m=>Number.isFinite(m.num)));
   assert.ok(res.text.length>20);
  }
  assert.throws(()=>calculateScienceLab(model,{x:item.x.max+10000,y:item.y?.initial??0}));
 }
 assert.throws(()=>calculateScienceLab('invalid',{x:0}));
});
const near=(a,b,tol=.001)=>assert.ok(Math.abs(a-b)<=tol,'expected '+b+' got '+a);
test('solar, lunar and orbital calculations are consistent with teaching approximations',()=>{
 near(calculateScienceLab('solar-orbit',{x:4,y:0}).metrics[0].num,8);
 near(calculateScienceLab('solar-seasons',{x:0,y:172}).metrics[0].num,12);
 near(calculateScienceLab('solar-moon',{x:0,y:5}).metrics[0].num,0);
 near(calculateScienceLab('solar-moon',{x:180,y:5}).metrics[0].num,100);
 near(calculateScienceLab('solar-gravity',{x:60,y:2}).metrics[0].num,588.6);
 near(calculateScienceLab('solar-mission',{x:3,y:0}).metrics[0].num,259,5);
 near(calculateScienceLab('solar-sun',{x:3}).metrics[0].num,5800);
});
test('weather, geology and astronomy numerical effects behave as stated with full disclaimers',()=>{
 near(calculateScienceLab('weather-heat',{x:800,y:.25}).metrics[0].num,600);
 near(calculateScienceLab('weather-moisture',{x:25,y:100}).metrics[0].num,25);
 near(calculateScienceLab('earth-plates',{x:0,y:5}).metrics[0].num,50);
 near(calculateScienceLab('earth-seismic',{x:600,y:6}).metrics[0].num,100);
 near(calculateScienceLab('cosmos-stars',{x:1,y:5800}).metrics[0].num,10);
 near(calculateScienceLab('cosmos-blackhole',{x:10,y:30}).metrics[0].num,29.53);
 near(calculateScienceLab('cosmos-expansion',{x:100,y:70}).metrics[0].num,7000);
 const bigger=calculateScienceLab('cosmos-transit',{x:10,y:1}).metrics[0].num;
 const smaller=calculateScienceLab('cosmos-transit',{x:5,y:1}).metrics[0].num;
 near(bigger/smaller,4);
 assert.ok(calculateScienceLab('weather-map',{x:990,y:1020}).text.includes('منخفض'));
 assert.ok(calculateScienceLab('earth-volcano',{x:70,y:60}).caveat===undefined,'Caveat must remain in SCIENCE_LABS metadata');
});
test('scientific source links are allowlisted and arbitrary model identifiers are blocked',()=>{
 const stage=curriculum[0].stages[0];
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lab:{kind:'science',model:'non-existent',scenario:'تجربة مزيفة'}}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,source:{title:'رابط غير موثوق',url:'https://science.nasa.gov.evil.test/phishing'}}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,source:{title:'محاولة عرض جافاسكربت',url:'javascript:alert(1)'}}));
 assert.doesNotThrow(()=>validateSchoolEditorial('stage',stage));
});
test('science learning sequence mandates prediction and at least one real slider interaction before starting a fresh test',()=>{
 const lab=read('components/school/ScienceLab.jsx');
 // The v1 guided lesson was retired; the lab is a card task whose proof is the answer, verified on the server.
 const card=read('components/school/v2/CardInteractions.jsx');
 assert.ok(lab.includes('كيف تستخدم المختبر؟'));
 assert.ok(lab.includes('راقب الرسم والأرقام'));
 assert.ok(!lab.includes("['increase','يزداد']"));
 assert.ok(lab.includes("onComplete?.({kind:'science'"));
 assert.ok(lab.includes('SCIENCE_LABS'));
 assert.ok(card.includes("{lab.kind === 'science' && <ScienceLab lab={lab} source={lab.source} onComplete={complete}/>}"));
 assert.ok(card.includes("case 'lab': return Boolean(value && typeof value === 'object');"));
 assert.ok(read('lib/schoolCards.js').includes("case 'lab': return ['morse', 'gates', 'science', 'civic'].includes(key.lab?.kind) && verifySchoolLabEvidence(key.lab, '', -1, answer);"));
 assert.ok(read('components/school/SchoolStudio.jsx').includes('SCIENCE_MODEL_IDS'));
});
test('public section, protected progression and migration remain compatible with existing school courses',()=>{
 const landing=read('app/school/page.jsx');
 const section=read('app/school/nature/page.jsx');
 assert.ok(landing.includes('<SchoolWorldMap/>'));
 const worlds=read('components/school/SchoolWorldMap.jsx');
 assert.ok(worlds.includes("href:'/school/nature'"));
 assert.ok(landing.includes('180 محطة'));
 assert.ok(worlds.includes("href:'/school/civic'"));
 assert.ok(section.includes("course.category!=='الفلك والطبيعة'"));
 assert.ok(section.includes("publishedSchoolCatalog"));
 assert.ok(read('lib/schoolGenericServer.js').includes('schoolStaffPreview'));
 const sql=read('supabase/migrations/20261030164858_school_astronomy_nature_courses.sql');
 for(const slug of slugs)assert.ok(sql.includes(slug));
 for(const table of ['school_editor_courses','school_editor_stages','school_editor_questions'])assert.ok(sql.includes('public.'+table));
 for(const marker of ['on conflict (slug) do nothing','on conflict (course_slug,stage_index) do nothing','on conflict (id) do nothing'])assert.ok(sql.includes(marker));
 assert.ok(!/delete\s+from\s+public\.school_stage_attempts/i.test(sql));
 assert.ok(!/truncate/i.test(sql));
});
