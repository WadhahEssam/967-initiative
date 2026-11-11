import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile bottom navigation is five jobs in order: today, explore, learn, play, you',()=>{
 const header=read('components/Header.jsx');
 const bar=header.slice(header.indexOf('{!immersive && <nav className="ed-tabbar"'));
 const ordered=['href="/"','href="/explore"','href="/school"','href="/games"','href={youHref}'];
 const locations=ordered.map(x=>bar.indexOf(x));
 assert.ok(locations.every(x=>x>=0),'missing expected mobile destination');
 assert.deepEqual([...locations].sort((a,b)=>a-b),locations,'mobile links must remain in the requested order');
 assert.doesNotMatch(bar,/<button[^>]*onClick=\{toggleMenu\}/);
 assert.match(bar,/<Gamepad2 size=\{21\}/);
 assert.match(bar,/isVisible\('\/games'\)/);
 assert.match(bar,/isVisible\('\/school'\)/);
 assert.match(header,/const youHref = signedIn \? '\/account' : loginHref;/);
 assert.ok(header.includes("'/login?next=' + encodeURIComponent(path)"),'signing in returns to the page');
 for(const label of ['اليوم','استكشف','تعلّم','العب','أنت'])assert.ok(bar.includes('<span>'+label+'</span>'),label);
});

test('mobile menu is before the logo and accessible without a tabbar',()=>{
 const header=read('components/Header.jsx');
 const css=read('app/foundation/shell.css');
 const menu=header.indexOf('ref={mobileToggle}');
 const brand=header.indexOf('<Link href="/" className="ed-brand"');
 assert.ok(menu>=0 && menu<brand,'menu trigger must precede the brand on RTL phones');
 assert.match(header,/aria-controls="main-navigation" aria-label=\{open \? 'إغلاق القائمة' : 'فتح القائمة'\} aria-expanded=\{open\} onClick=\{toggleMenu\}/);
 assert.match(header,/toggle\.current\?\.getAttribute\('aria-expanded'\) === 'true' \|\| mobileToggle\.current\?\.getAttribute\('aria-expanded'\) === 'true'/);
 assert.match(css,/\.ed-header-inner > \.ed-mobile-menu-toggle \{ display: inline-flex;/);
 assert.match(css,/\.ed-header \.ed-tools \.ed-menu-toggle, \.ed-header \.ed-top-search \{ display: none; \}/);
 assert.doesNotMatch(css,/\.ed-header\[data-tabbar\] \.ed-menu-toggle \{ display: none; \}/);
});

test('mobile top shows one icon for messages and notifications, search stays available below',()=>{
 const header=read('components/Header.jsx'),css=read('app/foundation/shell.css');
 const tools=header.slice(header.indexOf('<div className="ed-tools">'),header.indexOf('</div>\n    </div>\n    {/* Phones:'));
 assert.ok(!tools.includes('<ThemeToggle'),'the theme switch moved to the menu and footer');
 assert.ok(!tools.includes('href="/messages"'),'messages open from the notifications icon');
 assert.ok(tools.indexOf('<NotificationBell')>=0&&tools.indexOf('<NotificationBell')<tools.indexOf('href="/search"'));
 assert.match(tools,/className="ed-tool ed-tool-icon ed-top-search"/);
 // The 360px rule only hid the brand name, which the header no longer renders
 // (see header-brand-logo-only.test.mjs).
 assert.match(header,/!immersive && <nav className="ed-tabbar"/);
});
