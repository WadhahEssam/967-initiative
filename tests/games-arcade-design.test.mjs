import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Games 967 has a standalone dark arcade design, not a copied Knowledge header',()=>{
 const hub=read('app/games/page.jsx');
 const quiz=read('app/games/quiz/page.jsx');
 const intro=read('components/games/ArcadeIntro.jsx');
 const css=read('app/games/games.module.css');
 for(const body of [hub,quiz]){
  assert.ok(body.includes('<ArcadeIntro'), 'arcade intro must be shared across games and quiz');
  assert.ok(!body.includes('KnowledgePageIntro'), 'games should not inherit editorial Knowledge banner');
  assert.ok(body.includes('className={styles.root}'));
 }
 assert.ok(intro.includes('<h1 className={styles.heroTitle}>'));
 assert.ok(intro.includes('aria-label="مسار الصفحة"'));
 assert.ok(intro.includes('aria-hidden="true"'));
 assert.ok(css.includes('--arc-bg:#080c1a'), 'dark tokens must be scoped to games');
 assert.ok(css.includes('background:radial-gradient'));
 assert.ok(css.includes('@keyframes arcSpin'));
 assert.ok(css.includes('@keyframes arcFloat'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('.heroCompact'));
});

test('all nine games share one consistently styled selection grid, with no separate old/new rows',()=>{
 const hub=read('app/games/page.jsx');
 const css=read('app/games/games.module.css');
 const ids=['quiz','place','timeline','map','who','bigger','connect','yemenword','object'];
 for(const name of ids){
  assert.ok(hub.includes("id:'"+name+"'"),name);
  assert.ok(hub.includes("href:'/games/"+name+"'"),name);
  assert.ok(css.includes('.tile_'+name+'{'),name);
 }
 assert.ok(hub.includes('className={styles.selectGrid}'));
 assert.ok(hub.includes('games.map(game=>'));
 assert.ok(hub.includes('<Link href={game.href}'));
 assert.ok(!hub.includes('const newGames='));
 assert.ok(!hub.includes('styles.moreGames'));
 assert.ok(!hub.includes('styles.featuredCard'));
 assert.ok(hub.includes('<GamesHomeStatus initialDate={date}/>'));
 assert.ok(hub.includes('href={todayGame}'));
 // Redesign v2: today's challenge and the player summary lead the hub, before the grid.
 assert.ok(hub.indexOf('<GamesHomeStatus initialDate={date}/>')<hub.indexOf('className={styles.selectGrid}'));
 assert.ok(hub.includes('className={styles.secondarySection}'));
 assert.ok(!hub.includes('className={styles.dailyStrip}'));
 assert.ok(hub.includes('href="/games/leaderboard"'));
 assert.ok(css.includes('.selectGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
 assert.ok(css.includes('@media(max-width:630px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});

test('Quiz play still uses scoring, explanation, sharing, persistence and mobile-ready motion settings',()=>{
 const code=read('components/games/QuizGame.jsx');
 const css=read('components/games/QuizGame.module.css');
 const route=read('app/games/quiz/page.jsx');
 for(const codeToken of ['buildQuizRound','daily.reserve()','scoreRound(round,answers)','localStorage.setItem','setResult(summary)','onClick={()=>choose(index)}','aria-pressed={selected}','current.source.url','navigator.share','questionTitleRef']){
  assert.ok(code.includes(codeToken),codeToken);
 }
 assert.ok(route.includes('<QuizGame'));
 assert.ok(route.includes("sectionGate('games'"));
 assert.ok(css.includes('.playScore'));
 assert.ok(css.includes('.option.right'));
 assert.ok(css.includes('.option.wrong'));
 assert.ok(css.includes('.finishSparks'));
 assert.ok(css.includes('@media(max-width:610px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
});
