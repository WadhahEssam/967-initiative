import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navSections,resolveNavSections} from '../lib/navigation.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Editorial Calm redesign: the navigation vocabulary lives in lib/navigation.js
// and is rendered by the header, the footer and the home doors. These tests
// now check that shared data (behaviour) instead of Header.jsx markup strings.

test('Games 967 is a standalone global navigation section, never a Knowledge submenu',()=>{
 const ids=navSections.map(section=>section.id);
 const knowledge=navSections.find(section=>section.id==='knowledge');
 const games=navSections.find(section=>section.id==='games');
 assert.ok(knowledge.links.some(([href])=>href==='/yemen-history'));
 assert.ok(!knowledge.links.some(([href])=>href.startsWith('/games')));
 assert.equal(games.label,'ألعاب 967');
 assert.equal(games.standalone,true);
 assert.equal(games.links[0][0],'/games');
 assert.ok(ids.indexOf('knowledge')<ids.indexOf('games'));
 assert.ok(ids.indexOf('games')<ids.indexOf('directories'));
});

test('main desktop and mobile navigation retain exactly one games entry and active subpages',()=>{
 const header=read('components/Header.jsx');
 const css=read('app/foundation/shell.css');
 const sections=resolveNavSections();
 assert.equal(sections.filter(section=>section.links.some(([href])=>href==='/games')).length,1);
 assert.ok(header.includes('{section.standalone && <Link className="ed-nav-direct" href={section.links[0][0]}'));
 assert.ok(header.includes('aria-current={active(section.links[0][0]) || sectionActive(section) ?'));
 assert.ok(header.includes("section.links.filter(([href]) => isVisible(href))"));
 // Wide screens show the direct link; narrow screens show the same section as a disclosure.
 assert.ok(css.includes('.ed-nav-group[data-standalone] { display: none; }'));
 assert.ok(css.includes('@media (max-width: 1179px)'));
 assert.ok(css.includes('.ed-nav-direct { display: none; }'));
 assert.equal(resolveNavSections({visibility:{games:false}}).some(section=>section.id==='games'),false);
});

test('footer has a separate Games 967 heading with working destination routes',()=>{
 const footer=read('components/Footer.jsx');
 const css=read('app/foundation/shell.css');
 const ids=navSections.map(section=>section.id);
 const games=navSections.find(section=>section.id==='games');
 assert.ok(footer.includes('navSections.map'));
 assert.ok(footer.includes('<FooterGroup key={section.id} title={section.label}>'));
 assert.ok(ids.indexOf('knowledge')<ids.indexOf('games')&&ids.indexOf('games')<ids.indexOf('directories'));
 assert.deepEqual(games.links.map(([href])=>href),['/games','/games/leaderboard','/games/achievements']);
 assert.deepEqual(games.links.map(([,label])=>label),['جميع الألعاب','لوحة المتصدرين','الشارات والإنجازات']);
 assert.ok(css.includes('.ed-footer-groups { display: grid; grid-template-columns: repeat(var(--footer-groups, 6), minmax(0, 1fr))'));
 assert.ok(css.includes('@media (max-width: 700px)'));
});

test('homepage games showcase has its own name, today\'s UTC challenge and visibility control',()=>{
 const home=read('app/page.jsx');
 const blocks=read('components/home/HomeBlocks.jsx');
 assert.ok(home.includes("{visible('games')&&<section id=\"home-games\""));
 assert.ok(home.includes('const dailyGame = dailyGameForDate(today);'));
 assert.ok(home.includes('<GamesStrip dailyHref={dailyGameUrl(today)} dailyTitle={DAILY_GAME_TITLES[dailyGame]}/>'));
 assert.ok(home.includes('id="home-games-title"'));
 assert.ok(!/[٠-٩۰-۹]/u.test(home+blocks));
});
