import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('account: compact header with the three numbers, then a settings-style list', () => {
  const ui = read('components/account/AccountWorkspace.jsx');
  const css = read('components/account/AccountWorkspace.module.css');
  assert.ok(ui.includes('data-tab={tab}'));
  assert.ok(ui.includes('className={styles.heroStats}'));
  for (const to of ["to:'saved'", "to:'contributions'", "to:'notifications'"]) assert.ok(ui.includes(to), to);
  // Every row carries an icon and an arrow; messages stay one tap away.
  assert.ok(ui.includes('className={styles.navIcon}'));
  assert.ok(ui.includes('className={styles.navArrow}'));
  assert.ok(ui.includes('<Link href="/messages" className={styles.navItem}>'));
  // Phones: the list is the account home, and each section has a way back.
  assert.ok(ui.includes("onClick={()=>go('overview')}"));
  assert.ok(css.includes('.root:not([data-tab="overview"]) .sidebar{display:none}'));
  // The seven sections still live in ?tab=.
  assert.ok(ui.includes("'/account'+(id==='overview'?'':'?tab='+id)"));
});

test('messages and notifications: shorter tabs and one list of rows', () => {
  const messages = read('components/messages/PrivateMessaging.module.css');
  assert.ok(messages.includes('.tabs button{min-height:46px'));
  const notices = read('components/notifications/Notifications.module.css');
  assert.ok(notices.includes('.centerShell>.list{gap:0;padding:0}'));
  assert.ok(notices.includes('.pageActions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
});

test('admin: a scrollable section strip on phones and every section on desktop', () => {
  const nav = read('components/admin/AdminNavigation.jsx');
  const css = read('app/admin-workspace.css');
  assert.ok(nav.includes('className="admin-mobile-tabs"'));
  assert.ok(nav.includes("['المحتوى',['issues','works','pages','history','games']]"));
  assert.ok(nav.includes('protection.requestLeave(()=>onChange(id))'), 'unsaved-changes guard stays on every switch');
  assert.ok(css.includes('.admin-sidebar>.admin-mobile-tabs,.admin-mobile-links{display:flex;'));
  const dashboard = read('components/AdminDashboard.jsx');
  const ids = [...dashboard.matchAll(/\{id:'([a-zA-Z]+)',name:/g)].map(m => m[1]);
  const listed = [...nav.matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]);
  for (const id of ids) assert.ok(listed.includes(id), 'desktop sidebar lists ' + id);
});

test('CI smoke scripts follow the approved theme and header', () => {
  const theme = read('scripts/editorial-theme-smoke.mjs');
  // Dark is the default on every device (owner, 2026-11-11).
  assert.ok(theme.includes("should default to dark on a light device too"));
  assert.ok(theme.includes("'#f3efe8'"));
  const nav = read('scripts/phase5-browser-smoke.mjs');
  assert.ok(nav.includes("button.ed-menu-toggle:visible').count(),0"));
});
