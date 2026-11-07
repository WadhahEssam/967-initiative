import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DAILY_DURATION,PRACTICE_DURATIONS,roundDuration,millisecondsRemaining,secondsRemaining} from '../lib/gameClock.js';
import {buildMapChallenges,buildTimelineChallenges,buildPlaceChallenges,placeChallenges,timelineEvents,isTimelineCorrect,formatYear} from '../lib/arcadeChallenges.js';
import {yemenGovernorates} from '../lib/yemeniFigures.js';
import {historyPhotoLibrary} from '../lib/historyVisuals.js';
import {searchPages} from '../lib/searchPages.js';
import {pageIsVisible} from '../lib/pageVisibility.js';
import {buildSitemap,DEFAULT_SITE_ORIGIN} from '../lib/seo.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all games share only four selectable question durations, daily mode is permanently 7 seconds',()=>{
 assert.deepEqual(PRACTICE_DURATIONS,[10,15,20,30]);
 assert.equal(DAILY_DURATION,7);
 for(const duration of PRACTICE_DURATIONS){
  assert.equal(roundDuration('practice',duration),duration);
  assert.equal(roundDuration('daily',duration),7);
 }
 assert.equal(roundDuration('daily',999),7);
 assert.equal(roundDuration('practice',7),15);
 assert.equal(millisecondsRemaining(20000,15000),5000);
 assert.equal(millisecondsRemaining(20000,24000),0);
 assert.equal(secondsRemaining(20000,18001),2);
 const controls=read('components/games/TimeControls.jsx');
 assert.ok(controls.includes('mode===\'daily\''));
 assert.ok(controls.includes('DAILY_DURATION'));
 assert.ok(controls.includes('PRACTICE_DURATIONS'));
 assert.ok(controls.includes('aria-pressed'));
 const timer=read('components/games/useQuestionTimer.js');
 for(const expression of ['performance.now()','locked.current=true','deadline.current=null','expireCallback.current','claim()']){
  assert.ok(timer.includes(expression),expression);
 }
 assert.ok(timer.includes('clearInterval(interval)'));
 assert.ok(read('components/games/QuizGame.jsx').includes('timer.claim()'));
 assert.ok(read('components/games/QuizGame.jsx').includes('picked===-1'));
 assert.ok(read('components/games/ArcadeChallenge.jsx').includes('timer.claim()'));
});

test('guess the place uses 10 distinct real photos with source, credit and randomized options',()=>{
 assert.ok(placeChallenges.length>=10);
 for(const item of placeChallenges){
  assert.equal(item.options.length,4,item.id);
  assert.ok(item.options.includes(item.answer),item.id);
  assert.ok(item.photo.url.startsWith('https://commons.wikimedia.org/'),item.id);
  assert.ok(item.photo.page.startsWith('https://commons.wikimedia.org/wiki/File:'),item.id);
  assert.ok(item.photo.credit,item.id);
  assert.ok(item.hint.length>25,item.id);
 }
 const daily={mode:'daily',date:'2026-10-28'};
 const a=buildPlaceChallenges(daily),b=buildPlaceChallenges(daily),c=buildPlaceChallenges({...daily,date:'2026-10-29'});
 assert.equal(a.length,10);
 assert.deepEqual(a,b);
 assert.notDeepEqual(a.map(q=>q.id),c.map(q=>q.id));
 assert.equal(new Set(a.map(q=>q.id)).size,10);
 for(const q of a)assert.equal(q.options[q.correct],q.answer);
 assert.ok(read('components/games/ArcadeBoards.jsx').includes('onError'));
 assert.ok(read('components/games/ArcadeBoards.jsx').includes('onReady(true)'));
});

test('history ordering avoids ties, has distinct events, and is deterministic for all daily players',()=>{
 assert.ok(timelineEvents.length>=20);
 const daily={mode:'daily',date:'2026-10-28'};
 const a=buildTimelineChallenges(daily),b=buildTimelineChallenges(daily);
 assert.deepEqual(a,b);assert.equal(a.length,10);
 for(const task of a){
  assert.equal(task.events.length,3);
  assert.equal(new Set(task.events.map(e=>e.year)).size,3);
  assert.deepEqual([...task.events].sort((x,y)=>x.year-y.year).map(e=>e.id),task.correct);
  assert.ok(isTimelineCorrect(task.events,task.correct));
  assert.ok(!isTimelineCorrect(task.events,[...task.correct].reverse()));
  assert.ok(task.events.every(e=>e.source.startsWith('/yemen-history/')));
 }
 assert.ok(buildTimelineChallenges({mode:'practice',seed:'test'}).every(q=>q.events.length===4));
 assert.equal(formatYear(-500),'500 ق.م');
 assert.equal(formatYear(1962),'1962م');
});

test('Yemen map game uses all the existing governorate codes and real local atlas geometry',()=>{
 const map=JSON.parse(readFileSync(new URL('../public/data/yemen-map/yemen-boundaries.json',import.meta.url),'utf8'));
 assert.equal(map.governorates.length,22);
 const ids=new Set(map.governorates.map(g=>g.id));
 const tasks=buildMapChallenges({mode:'daily',date:'2026-10-28'});
 assert.equal(tasks.length,10);
 assert.deepEqual(tasks,buildMapChallenges({mode:'daily',date:'2026-10-28'}));
 for(const task of tasks){
  assert.ok(ids.has(task.regionId),task.regionId);
  assert.ok(yemenGovernorates.some(g=>g.id===task.regionId&&g.name===task.name));
 }
 const code=read('components/games/ArcadeBoards.jsx');
 assert.ok(code.includes('arcadeRegionPath(region.geometry,projection)'));
 assert.ok(code.includes('arcadeMapProjection(data.country.bounds'));
 assert.ok(code.includes('onKeyDown'));
 assert.ok(code.includes('aria-label='));
});

test('all three new pages are linked and indexed, hidden when games publication is disabled',()=>{
 const hub=read('app/games/page.jsx');
 const gameUI=read('components/games/ArcadeChallenge.jsx');
 const gameUrls=['place','timeline','map'];
 for(const name of gameUrls){
  const path='/games/'+name;
  assert.ok(hub.includes("href:'"+path+"'"));
  assert.ok(searchPages.some(p=>p.href===path));
  assert.equal(pageIsVisible(path,{games:false}),false);
  const page=read('app/games/'+name+'/page.jsx');
  assert.ok(page.includes('<ArcadeIntro'));
  assert.ok(page.includes('<ArcadeChallenge game="'+name+'"'));
  assert.ok(page.includes("sectionGate('games'"));
 }
 const urls=buildSitemap({},{VERCEL_ENV:'production'}).map(x=>x.url);
 for(const name of gameUrls)assert.ok(urls.includes(DEFAULT_SITE_ORIGIN+'/games/'+name));
 assert.ok(gameUI.includes('onExpire:()=>submitAnswer(null,true)'));
 assert.ok(gameUI.includes("setReady(game==='timeline'"));
 assert.ok(gameUI.includes('answerLocked.current=true'));
 assert.ok(gameUI.includes('setAnswer(record)'));
 assert.ok(gameUI.includes("mode==='daily'&&!verified"));
});
