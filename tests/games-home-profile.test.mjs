import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeOfficialAttempts} from '../lib/gamePlayerSummary.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const completed=(date,score=500,correct=5)=>({challenge_date:date,phase:'finished',score,correct_count:correct});
test('official arcade statistics include completed server-verified games only',()=>{
 const list=[completed('2026-10-28',960,10),completed('2026-10-27',780,8),completed('2026-10-26',0,0),
  {challenge_date:'2026-10-25',phase:'question',score:1000,correct_count:10}];
 const result=summarizeOfficialAttempts(list,'2026-10-28');
 assert.deepEqual(result,{played:3,bestScore:960,totalScore:1740,totalCorrect:18,streak:3});
});
test('active streak can continue from yesterday, but must expire after a gap',()=>{
 const played=[completed('2026-10-27'),completed('2026-10-26')];
 assert.equal(summarizeOfficialAttempts(played,'2026-10-28').streak,2);
 assert.equal(summarizeOfficialAttempts(played,'2026-10-29').streak,0);
 assert.equal(summarizeOfficialAttempts([], '2026-10-28').streak,0);
 assert.equal(summarizeOfficialAttempts([completed('2026-10-28',1200)],'2026-10-28').played,0);
});
test('personal games API authenticates every read and never takes userId from clients',()=>{
 const route=read('app/api/games/my-overview/route.js');
 assert.ok(route.includes("db.auth.getUser(token)"));
 assert.ok(route.includes(".eq('user_id',user.id)"));
 assert.ok(route.includes(".order('challenge_date'"));
 assert.ok(route.includes("summarizeOfficialAttempts(attempts,date)"));
 assert.ok(route.includes("'Cache-Control':'private, no-store'"));
 assert.ok(!route.includes("request.json()"));
 assert.ok(!route.includes("select('*')"));
 const selection=route.match(/\.select\('([^']+)'\)/)?.[1];
 assert.ok(selection,'the summary route explicitly limits the selected columns');
 assert.ok(!selection.includes('question_bank'));
 assert.ok(!selection.includes('answers'));
});
test('homepage shows player summary and has a completion-aware daily challenge',()=>{
 const home=read('app/games/page.jsx');
 const ui=read('components/games/GamesHomeStatus.jsx');
 const timer=read('components/games/DailyCountdown.jsx');
 const css=read('components/games/GamesHomeStatus.module.css');
 assert.ok(home.includes('<GamesHomeStatus initialDate={date}/>'));
 assert.ok(ui.includes("fetch('/api/games/my-overview'"));
 assert.ok(ui.includes("fetch('/api/games/leaderboard?period=all'"));
 assert.ok(ui.includes("db.auth.getSession()"));
 assert.ok(ui.includes("onAuthStateChange"));
 assert.ok(ui.includes("<LoginLink"));
 assert.ok(ui.includes('stats.bestScore'));
 assert.ok(ui.includes('stats.streak'));
 assert.ok(ui.includes('state.rank'));
 assert.ok(timer.includes('playerOverview?.date===currentDate'));
 assert.ok(timer.includes('playerOverview.daily.finished'));
 assert.ok(timer.includes('شاهد لوحة المتصدرين'));
 assert.ok(timer.includes('dailyGameUrl(currentDate)'));
 assert.ok(css.includes('@media(max-width:540px)'));
 assert.ok(home.indexOf('<GamesHomeStatus')<home.indexOf('className={styles.selectGrid}'));
 assert.ok(home.includes('className={styles.secondarySection}'));
});
