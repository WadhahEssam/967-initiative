import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CIVIC_ACTIVITIES,civicNumbers,validateCivicActivity} from '../lib/schoolCivicActivities.js';
import {CIVIC_LABS,calculateCivicLab} from '../lib/schoolCivicModels.js';
import {SCIENCE_LABS,calculateScienceLab} from '../lib/schoolScienceModels.js';
import {encodeMorse,gateTruthTable,GATE_TYPES} from '../lib/schoolThinkingLabs.js';
import {checkCivicLabEvidence,checkScienceLabEvidence,checkGenericCivicEvidence,
 schoolRequiresLabEvidence,verifySchoolLabEvidence,labObservationChoices} from '../lib/schoolLabEvidence.js';
import {chooseSchoolQuestions,gradeSchoolChoice,publicSchoolChoice,validateSchoolEditorial} from '../lib/schoolContent.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const curriculum=JSON.parse(read('data/school/civic/phase1.json'));
const migration=read('supabase/migrations/20261031023441_school_phase2_contextual_labs_and_questions.sql');
const payload=JSON.parse(migration.match(/\$payload\$([\s\S]*?)\$payload\$/)[1]);
const possibilities=axis=>[axis.min,axis.max,axis.initial-axis.step,axis.initial+axis.step,axis.initial].filter(v=>v>=axis.min&&v<=axis.max);

test('48 fully editable civic labs have correct objective rules and two or more extra assessments',()=>{
 assert.equal(payload.length,48);
 assert.equal(payload.reduce((n,x)=>n+x.questions.length,0),113);
 let count=0;
 for(const course of curriculum)for(const stage of course.stages){
  const row=payload.find(x=>x.slug===course.slug&&x.index===stage.index);
  assert.ok(row,course.slug+'/'+stage.index);
  const activity=validateCivicActivity(row.activity);
  assert.deepEqual(activity,CIVIC_ACTIVITIES[course.slug][stage.index]);
  assert.equal(row.model,stage.stage.lab.model);
  assert.equal(row.title,stage.stage.title);
  assert.ok(row.newBody.length>row.oldBody.length);
  assert.ok(row.newBody.length<=1700);
  assert.ok(row.questions.length>=2);
  for(const question of row.questions){
   const validated=validateSchoolEditorial('question',question);
   assert.deepEqual(validated.options,question.options.map(option=>option.trim()));
   assert.equal(validated.answerIndex,question.answerIndex);
   assert.equal(validated.prompt,question.prompt);
  }
  const validated=validateSchoolEditorial('stage',{...stage.stage,lab:{...stage.stage.lab,activity}});
  assert.equal(validated.lab.activity.kind,activity.kind);
  count++;
 }
 assert.equal(count,48);
});
test('case labs accept only factually supported choice and paths require exploration of every perspective',()=>{
 let cases=0,paths=0,steps=0,numbers=0;
 for(const course of curriculum)for(const station of course.stages){
  const a=CIVIC_ACTIVITIES[course.slug][station.index];
  if(a.kind==='case'){
   cases++;
   assert.equal(checkCivicLabEvidence(a,{kind:'case',selection:a.correctIndex}),true);
   assert.equal(checkCivicLabEvidence(a,{kind:'case',selection:(a.correctIndex+1)%a.choices.length}),false);
  }else if(a.kind==='paths'){
   paths++;
   const indices=a.choices.map((_,i)=>i);
   assert.equal(checkCivicLabEvidence(a,{kind:'paths',visited:indices.slice(0,-1)}),false);
   assert.equal(checkCivicLabEvidence(a,{kind:'paths',visited:indices}),true);
   assert.equal(checkCivicLabEvidence(a,{kind:'paths',visited:indices.map(()=>0)}),false);
  }else if(a.kind==='steps'){
   steps++;
   const order=a.steps.map((_,i)=>i);
   assert.equal(checkCivicLabEvidence(a,{kind:'steps',order}),true);
   assert.equal(checkCivicLabEvidence(a,{kind:'steps',order:order.slice().reverse()}),false);
  }else if(a.kind==='numbers'){
   numbers++;
   const baseline={kind:'numbers',x:a.x.initial,y:a.y.initial,metricIndex:0,observed:0};
   assert.equal(checkCivicLabEvidence(a,baseline),false);
   let proof=null;
   const original=civicNumbers(a,a.x.initial,a.y.initial);
   outer:for(const x of possibilities(a.x))for(const y of possibilities(a.y)){
    const next=civicNumbers(a,x,y);if(next.error)continue;
    const i=next.metrics.findIndex((m,i)=>Number.isFinite(m[1])&&Math.abs(m[1]-original.metrics[i]?.[1])>0.000001);
    if(i>=0){proof={kind:'numbers',x,y,metricIndex:i,observed:next.metrics[i][1]};break outer;}
   }
   assert.ok(proof,a.title);
   assert.equal(checkCivicLabEvidence(a,proof),true,a.title);
   assert.equal(checkCivicLabEvidence(a,{...proof,observed:proof.observed+7}),false,a.title);
  }
 }
 assert.deepEqual({cases,paths,steps,numbers},{cases:12,paths:11,steps:6,numbers:19});
});
test('science labs require reading a real changed metric, not only touching a slider',()=>{
 for(const [model,config] of Object.entries(SCIENCE_LABS)){
  assert.equal(schoolRequiresLabEvidence({kind:'science',model}),true);
  const initial=calculateScienceLab(model,{x:config.x.initial,y:config.y?.initial});
  assert.equal(checkScienceLabEvidence(model,{kind:'science',x:config.x.initial,y:config.y?.initial,metricIndex:0,observed:initial.metrics[0]?.num}),false);
  let proof=null;
  const xCandidates=possibilities(config.x);
  const yCandidates=config.y?possibilities(config.y):[undefined];
  outer:for(const x of xCandidates)for(const y of yCandidates){
   const result=calculateScienceLab(model,{x,y});
   const i=result.metrics.findIndex((metric,i)=>Number.isFinite(metric.num)&&Number.isFinite(initial.metrics[i]?.num)&&Math.abs(metric.num-initial.metrics[i].num)>0.000001);
   if(i>=0){proof={kind:'science',x,y,metricIndex:i,observed:result.metrics[i].num};break outer;}
  }
  assert.ok(proof,model);
  assert.equal(checkScienceLabEvidence(model,proof),true,model);
  assert.equal(checkScienceLabEvidence(model,{...proof,observed:proof.observed+1}),false,model);
 }
});
test('fresh and edited stations are validated on the server, and legacy nonlab courses remain available',()=>{
 const activity=CIVIC_ACTIVITIES['how-state-works'][0];
 assert.equal(verifySchoolLabEvidence({kind:'civic',model:'institutions',activity},'how-state-works',0,null),false);
 assert.equal(verifySchoolLabEvidence({kind:'civic',model:'institutions',activity},'how-state-works',0,{kind:'case',selection:activity.correctIndex}),true);
 assert.equal(verifySchoolLabEvidence({kind:'civic',model:'institutions'},'how-state-works',0,{kind:'case',selection:activity.correctIndex}),true);
 assert.equal(verifySchoolLabEvidence({kind:'morse',sample:'SOS'},'morse-code',0,null),false);
 assert.equal(verifySchoolLabEvidence({kind:'morse',sample:'SOS'},'morse-code',0,{kind:'morse',signal:encodeMorse('SOS')}),true);
 assert.equal(verifySchoolLabEvidence({kind:'morse',sample:'SOS'},'morse-code',0,{kind:'morse',signal:encodeMorse('SO')}),false);
 for(const gate of GATE_TYPES){
  const visited=gateTruthTable(gate).map(r=>r.a+':'+r.b);
  assert.equal(verifySchoolLabEvidence({kind:'gates',gate},'logic-gates',0,{kind:'gates',visited}),true,gate);
  assert.equal(verifySchoolLabEvidence({kind:'gates',gate},'logic-gates',0,{kind:'gates',visited:visited.slice(1)}),false,gate);
 }
 const config=CIVIC_LABS.institutions;
 let found=null;
 for(const x of possibilities(config.x))for(const y of possibilities(config.y)){
  try{const first=calculateCivicLab('institutions',{x:config.x.initial,y:config.y.initial});
   const current=calculateCivicLab('institutions',{x,y});
   if(JSON.stringify(first.rows)!==JSON.stringify(current.rows)){found={kind:'model',x,y};break;}
  }catch{}
  if(found)break;
 }
 assert.ok(found);
 assert.equal(checkGenericCivicEvidence('institutions',found),true);
 assert.equal(checkGenericCivicEvidence('institutions',{kind:'model',x:config.x.initial,y:config.y.initial}),false);
 assert.deepEqual(labObservationChoices(10,12),[10,12,14]);
 assert.deepEqual(labObservationChoices(10,10),[]);
});
test('diversified attempts protect answer keys and keep historical scoring unchanged',()=>{
 const extra=payload.find(x=>x.slug==='how-state-works'&&x.index===0).questions;
 const old=curriculum[0].stages[0].questions;
 const rows=[...old,...extra].map((published,i)=>({id:String(i+1).padStart(8,'0')+'-0000-4000-a000-000000000001',published}));
 // Model a normal bank: six original published questions plus two new verified cases.
 const first=chooseSchoolQuestions(rows,1),second=chooseSchoolQuestions(rows,2);
 assert.equal(first.length,6);assert.equal(second.length,6);
 assert.equal(new Set(first.map(q=>q.id)).size,6);
 const originalQuestionIds=new Set(rows.map(r=>'studio-'+r.id));
 assert.ok(first.every(q=>originalQuestionIds.has(q.id)));
 assert.notDeepEqual(first.filter(q=>q.kind==='choice').map(q=>q.options),second.filter(q=>q.kind==='choice').map(q=>q.options));
 const grade=list=>gradeSchoolChoice(list,list.map(q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):
  q.kind==='order'?q.answer.map(token=>q.tokens.indexOf(token)):q.answer})));
 assert.equal(grade(first).score,6);
 assert.equal(grade(second).score,6);
 assert.ok(publicSchoolChoice(first).every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'answerIndex')));
 const source=read('lib/schoolGenericServer.js');
 assert.match(source,/verifySchoolLabEvidence\(activeStage.lab,slug,index,labProof\)/);
 assert.match(source,/if\(current\)/);
 assert.match(source,/schoolStaffPreview/);
 assert.match(read('app/api/school/custom/route.js'),/body\.labProof/);
 assert.doesNotMatch(migration,/delete from public\.school_stage_attempts|truncate|update public\.school_stage_attempts/i);
});
test('a station can display a single published activity and the editor can revise it',()=>{
 const civic=read('components/school/CivicLab.jsx');
 const science=read('components/school/ScienceLab.jsx');
 // The v1 guided lesson was retired; the card lab task hands the lab's proof to the server as its answer.
 const guide=read('components/school/v2/CardInteractions.jsx');
 const studio=read('components/school/SchoolStudio.jsx');
 assert.match(civic,/lab\?\.activity\|\|getCivicActivity/);
 assert.match(civic,/visited\.length===activity\.choices\.length/);
 assert.match(civic,/i===activity\.correctIndex/);
 assert.match(civic,/metricIndex,observed:after/);
 assert.match(science,/confirmObservation/);
 assert.match(guide,/const complete = proof => \{ if \(!locked\) onChange\(proof\); \};/);
 assert.match(guide,/CivicLab lab=\{lab\} slug="" index=\{-1\} onComplete=\{complete\}/);
 assert.match(guide,/MorseLab sample=\{lab\.sample\} onComplete=\{complete\}/);
 assert.match(guide,/LogicGatesLab gate=\{lab\.gate\} onComplete=\{complete\}/);
 assert.match(studio,/تخصيص النشاط العملي لهذه المحطة/);
 assert.match(studio,/correctIndex/);
});
