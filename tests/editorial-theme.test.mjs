import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('editorial A has full home and correct route-scoped CSS',()=>{
 const home=read('app/page.jsx');
 const css=read('app/foundation/editorial.css');
 const layout=read('app/layout.jsx');
 const legacy=read('app/legacy-styles.js');
 for(const section of ['HomeSmartStart','TodayFeed','Shortcuts','SectionLauncher','GamesStrip','SchoolStrip','KnowledgeRail','NumbersRail','CommunityRows','InviteBanner'])assert.ok(home.includes(section),section);
 assert.ok(home.includes('settings.heroTitle'));
 assert.ok(home.includes("sectionIsVisible(id, settings.pageVisibility)"));
 assert.ok(css.includes('.ed-page'));
 assert.ok(layout.includes("import './foundation/tokens.css'"));
 assert.ok(layout.includes("import './foundation/shell.css'"));
 assert.ok(!layout.includes("import './globals.css'"));
 assert.ok(legacy.includes("import './knowledge-data.css'"));
 assert.ok(existsSync(new URL('../public/fonts/markazi-arabic-web.woff2',import.meta.url)));
});

test('light is default and the explicit dark theme covers every route',()=>{
 const tokens=read('app/foundation/tokens.css');
 const shell=read('app/foundation/shell.css');
 const unified=read('app/foundation/unified.css');
 assert.match(tokens,/:root\s*\{\s*color-scheme:\s*light;/);
 assert.ok(tokens.includes(':root[data-ed-theme="dark"] {'));
 assert.ok(tokens.includes('color-scheme: dark;'));
 assert.ok(!tokens.includes('@media (prefers-color-scheme: dark)'));
 assert.ok(shell.includes(':root[data-ed-theme="dark"] .ed-brand'));
 assert.ok(!shell.includes('@media (prefers-color-scheme: dark)'));
 assert.ok(unified.includes('--color-paper: var(--c-bg)'));
 assert.ok(unified.includes('.site-experience .page-intro'));
});

test('saved choice applies before paint, persists and survives browser storage restrictions',()=>{
 const layout=read('app/layout.jsx');
 const button=read('components/ThemeToggle.jsx');
 const header=read('components/Header.jsx');
 assert.ok(layout.includes('data-ed-theme="light" suppressHydrationWarning'));
 assert.ok(layout.includes('<script dangerouslySetInnerHTML='));
 assert.ok(layout.includes("967-editorial-theme"));
 assert.ok(layout.includes("document.documentElement.dataset.edTheme='dark'"));
 assert.ok(button.includes("const KEY='967-editorial-theme';"));
 assert.ok(button.includes('window.localStorage.setItem(KEY,next)'));
 assert.ok(button.includes("window.addEventListener('storage',onStorage)"));
 assert.ok(button.includes('document.documentElement.dataset.edTheme=next'));
 assert.ok(button.includes("aria-label={dark?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن'}"));
 assert.ok(button.includes('aria-pressed={dark}'));
 assert.ok(button.includes('try{window.localStorage.setItem'));
 assert.ok(header.includes("import ThemeToggle from './ThemeToggle';"));
 assert.ok(header.includes('<ThemeToggle/>'));
 assert.ok(!header.includes("path==='/yemen-in-numbers' ||"));
 assert.ok(layout.includes("import './foundation/unified.css'"));
 assert.ok(layout.includes('className="visual-foundation site-experience"'));
});

test('theme control remains accessible on small screens',()=>{
 const shell=read('app/foundation/shell.css');
 const header=read('components/Header.jsx');
 assert.ok(shell.includes('.ed-theme-toggle:focus-visible'));
 assert.ok(shell.includes('.ed-theme-toggle{min-width:44px;min-height:44px'));
 assert.ok(header.includes('<div className="ed-tools">'));
 assert.ok(header.includes('aria-label={open ?'));
});

test('dark contrast closure covers legacy light surfaces on every high-risk route',()=>{
 const unified=read('app/foundation/unified.css');
 const analytics=read('components/admin/AnalyticsDashboard.module.css');
 const contributions=read('components/admin/ContributionsDashboard.module.css');
 const tasks=read('components/tasks/TaskCenter.module.css');
 const required=[
  '.ymap-info-field',
  '.ymap-info-panel footer',
  '.yr-scope button[aria-pressed="true"]',
  '.yr-rank-number',
  '.yr-you',
  '.interior-page .pdf-toolbar',
  '.interior-page .pdf-paper-view',
  '.debate-guide-panel > header',
  '.debate-guide-number',
  '.institution-related-list > a',
  '.company-related-grid > a',
  '.professional-related-grid > a',
  '.company-website-link',
  '.arena-feed-toolbar',
  '.arena-composer .debate-login-note',
  '.arena-post-kind.question',
  '.institution-empty',
  '.arena-compose-form',
  '.global-search input',
  '.debate-auth',
  '.page-visibility-item',
  '.map-admin-panel',
  '.editor-actions .btn-primary'
 ];
 for(const selector of required)assert.ok(unified.includes(selector),selector);
 for(const undefinedToken of ['var(--c-muted)','var(--c-warm)'])assert.ok(!unified.includes(undefinedToken),undefinedToken);
 assert.ok(unified.includes('color: #071412 !important;'));
 assert.ok(unified.includes('color: #241700 !important;'));
 for(const moduleCss of [analytics,contributions,tasks]){
  assert.ok(moduleCss.includes(':global(:root[data-ed-theme="dark"])'));
  assert.ok(moduleCss.includes('var(--c-surface)'));
  assert.ok(moduleCss.includes('var(--c-ink)'));
 }
});

test('database backups, public media and security workflows remain present',()=>{
 for(const path of ['.github/workflows/daily-supabase-backup.yml','.github/workflows/daily-supabase-storage-backup.yml','.github/workflows/test-backup-restore.yml','docs/architecture/current-platform-architecture.md','lib/requestSecurity.js','app/api/analytics/event/route.js'])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
