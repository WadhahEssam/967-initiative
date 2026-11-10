import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile tabs represent route groups and non-primary sections',()=>{
 const header=read('components/Header.jsx');
 const shell=read('app/foundation/shell.css');
 // The Explore tab covers every content section and the search page.
 assert.ok(header.includes("const exploreActive = path === '/explore' || path === '/search' || ['media', 'knowledge', 'directories', 'services', 'initiative'].some(id => mobileSectionActive(id));"));
 assert.ok(header.includes("aria-current={exploreActive ? 'page' : undefined}"));
 // The phone menu opener moved from the tab bar to the top bar (commit 1276571).
 assert.ok(header.includes('<button ref={mobileToggle} type="button" className="ed-tool ed-menu-toggle ed-mobile-menu-toggle" aria-controls="main-navigation"'));
 assert.ok(!/<nav className="ed-tabbar"[\s\S]*?aria-controls="main-navigation"[\s\S]*?<\/nav>/.test(header));
 // It still names the current section for sections that have no tab of their own.
 assert.ok(header.includes("const mobileMenuSection = sections.find(section => !['media','knowledge'].includes(section.id) && sectionActive(section));"));
 assert.ok(header.includes("mobileMenuSection ? 'فتح القائمة، القسم الحالي: '+mobileMenuSection.label : 'فتح القائمة'"));
 assert.ok(shell.includes('.ed-tabbar button[data-current]'));
});

test('reported accessibility violations have explicit fixes',()=>{
 const smart=read('components/home/HomeSmartStart.jsx');
 const games=read('app/games/page.jsx');
 const history=read('components/history/HistoryMedia.module.css');
 const numbers=read('app/yemen-in-numbers/numbers.css');
 assert.ok(smart.includes('role="status" aria-busy="true"'));
 assert.ok(!smart.includes('aria-busy="true" aria-label='));
 assert.ok(!games.includes("aria-label={'العب '+game.title}"));
 assert.ok(history.includes('text-decoration:underline'));
 assert.ok(numbers.includes('[class*="CrossSectionPaths_content"] small { color: var(--c-accent-strong); }'));
 assert.ok(numbers.includes('min-height: var(--target)'));
});

test('mobile discovery is compact without hiding desktop content or horizontal filters',()=>{
 const blocks=read('components/home/HomeBlocks.module.css');
 const knowledge=read('components/knowledge/KnowledgeNavigation.module.css');
 const search=read('app/platform-refinements.css');
 // Home rails and shortcuts swipe horizontally instead of stacking long sections.
 assert.ok(blocks.includes('.rail { display: flex;'));
 assert.ok(blocks.includes('scroll-snap-type: x proximity'));
 assert.ok(knowledge.includes('scroll-snap-type:x proximity'));
 assert.ok(search.includes('.search-filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
});
