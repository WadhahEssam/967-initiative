import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertSchoolUser} from '../lib/schoolUserGuard.js';
import {RequestValidationError} from '../lib/requestSecurity.js';

const NOW=Date.parse('2026-11-06T12:00:00Z');
const ok={id:'6ebdc068-0eda-4ec4-b949-30dbd662dfe6',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};
const rejects=(user,error,status)=>assert.throws(()=>assertSchoolUser(user,error,NOW),e=>e instanceof RequestValidationError&&e.status===status);

test('confirmed, active account passes',()=>{
 assert.equal(assertSchoolUser(ok,null,NOW),ok);
 assert.equal(assertSchoolUser({...ok,banned_until:'2026-11-01T00:00:00Z'},null,NOW).id,ok.id,'an expired ban no longer blocks');
 assert.equal(assertSchoolUser({...ok,banned_until:null},null,NOW).id,ok.id);
});

test('missing, anonymous or token-error users get 401',()=>{
 rejects(null,null,401);
 rejects(undefined,null,401);
 rejects({...ok,is_anonymous:true},null,401);
 rejects(ok,{message:'invalid JWT'},401);
});

test('unconfirmed email gets 403',()=>{
 rejects({...ok,email_confirmed_at:null},null,403);
 rejects({...ok,email_confirmed_at:undefined},null,403);
});

test('suspended account gets 403 until the ban expires',()=>{
 rejects({...ok,banned_until:'2026-11-07T00:00:00Z'},null,403);
 rejects({...ok,banned_until:'2999-01-01T00:00:00Z'},null,403);
});

test('every school API route authenticates through the shared guard',()=>{
 const server=readFileSync(new URL('../lib/schoolServer.js',import.meta.url),'utf8');
 assert.match(server,/return assertSchoolUser\(data\?\.user,error\);/);
 for(const route of ['custom','dashboard','leaderboard','pilot','review','studio']){
  const source=readFileSync(new URL('../app/api/school/'+route+'/route.js',import.meta.url),'utf8');
  assert.match(source,/schoolUser\(request, ?db\)/,route+' must call schoolUser');
 }
});
