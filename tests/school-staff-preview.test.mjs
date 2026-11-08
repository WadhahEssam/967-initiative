import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleSchoolStaff,schoolStaffPreview,canStartSchoolStage,SCHOOL_PREVIEW_ROLES} from '../lib/schoolStageAccess.js';
import {MUSNAD_STAGES,musnadPublicProgress} from '../lib/schoolMusnad.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const confirmed={id:'6ebdc068-0eda-4ec4-b949-30dbd662dfe6',email_confirmed_at:'2026-01-01T00:00:00.000Z'};
function editorDb(role,error=null){
 const calls=[];
 const db={from(name){
  calls.push(['table',name]);
  return {select(cols){
   calls.push(['select',cols]);
   return {eq(key,value){
    calls.push(['filter',key,value]);
    return {async maybeSingle(){return {data:role?{role}:null,error};}};
   }};
  }};
 }};
 return {db,calls};
}

test('only confirmed, non-banned admins and management qualify for school preview',()=>{
 assert.deepEqual(SCHOOL_PREVIEW_ROLES,['admin','management']);
 for(const role of ['admin','management'])assert.equal(eligibleSchoolStaff(confirmed,role),true);
 for(const role of [null,'editor','authenticated','user','owner'])assert.equal(eligibleSchoolStaff(confirmed,role),false);
 assert.equal(eligibleSchoolStaff({...confirmed,email_confirmed_at:null},'admin'),false);
 assert.equal(eligibleSchoolStaff({...confirmed,banned_until:'2999-01-01T00:00:00Z'},'management'),false);
 assert.equal(eligibleSchoolStaff({...confirmed,user_metadata:{role:'management'}},'user'),false);
});

test('server-side preview queries the verified editors table, never client metadata',async()=>{
 for(const role of ['admin','management','user',null]){
  const {db,calls}=editorDb(role);
  assert.equal(await schoolStaffPreview(db,{...confirmed,user_metadata:{role:'admin'}}),['admin','management'].includes(role));
  assert.deepEqual(calls,[['table','editors'],['select','role'],['filter','user_id',confirmed.id]]);
 }
 const banned=editorDb('admin');
 assert.equal(await schoolStaffPreview(banned.db,{...confirmed,banned_until:'2999-01-01T00:00:00Z'}),false);
 assert.equal(banned.calls.length,0,'banned users cannot exercise privileged preview');
 const unconfirmed=editorDb('admin');
 assert.equal(await schoolStaffPreview(unconfirmed.db,{...confirmed,email_confirmed_at:null}),false);
 assert.equal(unconfirmed.calls.length,0);
 await assert.rejects(()=>schoolStaffPreview(editorDb('admin',{code:'PGRST500'}).db,confirmed),/lookup failed/);
});

test('staff can access any stage while a normal student can only access a passed sequence',()=>{
 const progress=musnadPublicProgress([{stage_index:0,status:'passed'},{stage_index:1,status:'failed'}]);
 assert.equal(progress.unlocked,1);
 for(let index=0;index<MUSNAD_STAGES.length;index++){
  assert.equal(canStartSchoolStage(index,progress.unlocked,true),true);
  assert.equal(canStartSchoolStage(index,progress.unlocked,false),index<=1);
 }
 for(const i of [-1,12,1.5,'3',null])assert.equal(canStartSchoolStage(i,progress.unlocked,true),false);
 const allPassed=musnadPublicProgress(MUSNAD_STAGES.map(({index:stage_index})=>({stage_index,status:'passed'})));
 assert.equal(allPassed.finished,true);
 assert.equal(canStartSchoolStage(11,allPassed.unlocked,false),true);
});

test('school GET and POST enforce the same server-derived staff role without counting preview as completion',()=>{
 // The Musnad route and its journey were retired; every course goes through the custom route and the card journey.
 const server=read('lib/schoolServer.js'),api=read('app/api/school/custom/route.js');
 const generic=read('lib/schoolGenericServer.js'),journey=read('components/school/v2/CourseJourney.jsx');
 assert.ok(server.includes('Promise.all([history(db,user),schoolStaffPreview(db,user)])'));
 assert.ok(server.includes('locked:!canStartSchoolStage(s.index,progress.unlocked,staffPreview)'));
 assert.ok(server.includes('if(!canStartSchoolStage(index,musnadPublicProgress(records).unlocked,staffPreview))'));
 assert.ok(server.includes('staffPreview,stages'));
 assert.ok(server.includes('completed:progress.completed.includes(s.index)'),'preview must not mark incomplete lessons done');
 assert.ok(!api.includes('body.role')&&!api.includes('body.staffPreview'),'untrusted roles must not be accepted from requests');
 assert.ok(generic.includes('const staff=await schoolStaffPreview(db,user);'));
 assert.ok(generic.includes('locked:!staff&&progress.next!==null&&item.index>progress.next'));
 assert.ok(generic.includes("if(!staff&&state.next!==null&&index>state.next)fail("));
 assert.ok(journey.includes('staff: Boolean(json.staffPreview)'));
});
