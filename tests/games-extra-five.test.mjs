import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extraGameTypes,extraGameBuilders,famousPeople} from '../lib/extraGames.js';
import {dailyGameForDate,DAILY_GAME_ORDER} from '../lib/dailyGame.js';
import {officialQuestionSnapshot,validateOfficialChoice,officialCorrect,officialPoints} from '../lib/dailyVerifiedScore.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ids=['who','bigger','connect','yemenword','object'];
const today='2026-11-01';

test('all five distinct Yemen arcade modes have consistent, deterministic ten-task rounds',()=>{
 assert.deepEqual(Object.keys(extraGameBuilders),ids);
 assert.deepEqual(Object.keys(extraGameTypes),ids);
 for(const id of ids){
  const build=extraGameBuilders[id];
  const a=build({mode:'daily',date:today});
  const b=build({mode:'daily',date:today});
  assert.deepEqual(a,b,id);
  assert.equal(a.length,10,id);
  assert.equal(new Set(a.map(x=>x.id)).size,10,id);
  assert.ok(a.every(x=>x.difficulty>=1&&x.difficulty<=3),id);
  assert.notDeepEqual(a.map(x=>x.id),build({mode:'daily',date:'2026-11-02'}).map(x=>x.id),id);
 }
});
test('Who am I exclusively selects well-known published figures and progressively reveals three hints',()=>{
 assert.ok(famousPeople.length>=15);
 assert.equal(new Set(famousPeople.map(p=>p.name)).size,famousPeople.length);
 assert.ok(famousPeople.every(p=>p.hints.length===3&&p.hints.every(t=>t.length>10)&&p.source.startsWith('https://')));
 for(const t of extraGameBuilders.who({mode:'practice',seed:'figure-test'})){
  assert.equal(t.options.length,4);
  assert.equal(t.options[t.correct],t.name);
 }
 const board=read('components/games/ExtraBoards.jsx');
 assert.ok(board.includes('remaining<=duration*'));
});
test('bigger compares grounded km2 and meter figures with no ambiguous ties',()=>{
 for(const t of extraGameBuilders.bigger({mode:'practice',seed:'comparison-test'})){
  assert.equal(t.options.length,2);
  assert.notEqual(t.options[0].value,t.options[1].value);
  assert.equal(t.options[t.correct].value,Math.max(...t.options.map(x=>x.value)));
  assert.ok(['كم²','متر'].includes(t.unit));
  assert.match(t.source,/^https:\/\//);
 }
});
test('matching submits precisely three stable target labels and word tiles preserve answer letters',()=>{
 for(const t of extraGameBuilders.connect({mode:'daily',date:today})){
  assert.equal(t.pairs.length,3);
  assert.equal(t.leftOrder.length,3);
  assert.equal(t.rightOrder.length,3);
  assert.deepEqual(t.correct,t.pairs.map(p=>p.right));
  assert.equal(new Set(t.correct).size,3);
  assert.equal(officialCorrect('connect',t.correct,t.correct),true);
  assert.equal(officialCorrect('connect',t.correct,[...t.correct].reverse()),false);
 }
 for(const t of extraGameBuilders.yemenword({mode:'daily',date:today})){
  assert.equal([...t.letters].map(x=>x.letter).sort().join(''),[...t.answer].sort().join(''));
  assert.equal(officialCorrect('yemenword',t.answer,t.answer),true);
  assert.ok(validateOfficialChoice('yemenword',t.answer));
 }
 assert.equal(validateOfficialChoice('connect',['one','two','three']),true);
 assert.equal(validateOfficialChoice('connect',['one','one','three']),false);
});
test('object images have file provenance and answer options, with fallback when remote media fails',()=>{
 for(const t of extraGameBuilders.object({mode:'practice',seed:'museum-test'})){
  assert.equal(t.options[t.correct],t.answer);
  assert.ok(t.photo.url.startsWith('https://commons.wikimedia.org/'));
  assert.ok(t.photo.page.includes('commons.wikimedia.org/wiki/File:'));
  assert.ok(t.photo.credit);
 }
 assert.ok(read('components/games/ExtraBoards.jsx').includes('onError'));
});
test('server snapshot verifies each mode, accepts no client scores, normalized all-correct round is 1000',async()=>{
 for(const id of ids){
  const tasks=extraGameBuilders[id]({mode:'daily',date:today});
  const snapshot=await officialQuestionSnapshot(null,id,today);
  assert.equal(snapshot.length,10,id);
  assert.deepEqual(snapshot.map(q=>q.id),tasks.map(t=>t.id));
  const answers=snapshot.map(q=>({correct:true}));
  assert.equal(officialPoints(snapshot,answers).score,1000,id);
  for(const [i,q] of snapshot.entries()){
   const correct=id==='who'||id==='bigger'||id==='object'?tasks[i].correct:
    id==='connect'?tasks[i].correct:tasks[i].answer;
   assert.deepEqual(q.key,correct);
   assert.equal(officialCorrect(id,q.key,correct),true);
   assert.ok(validateOfficialChoice(id,correct));
  }
 }
 const api=read('app/api/games/daily/round/route.js');
 assert.ok(api.includes('OFFICIAL_ANSWER_WINDOW_MS'));
 assert.ok(!api.includes('body.points'));
});
test('new routes participate in nine-game UTC daily rotation with a backward-compatible cutoff',()=>{
 assert.equal(DAILY_GAME_ORDER.length,9);
 assert.equal(dailyGameForDate('2026-10-30'),'who');
 assert.equal(dailyGameForDate('2026-11-03'),'object');
 const dates=Array.from({length:9},(_,i)=>new Date(Date.parse('2026-10-30T00:00:00Z')+i*86400000).toISOString().slice(0,10));
 assert.equal(new Set(dates.map(dailyGameForDate)).size,9);
 for(const id of ids){
  const route=read('app/games/'+id+'/page.jsx');
  assert.ok(route.includes('sectionGate'));
  assert.ok(route.includes('redirect(dailyGameUrl(date))'));
  assert.ok(read('app/games/page.jsx').includes("id:'"+id+"'"));
 }
});
