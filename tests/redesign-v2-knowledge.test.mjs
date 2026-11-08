import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('long knowledge pages get a pinned jump bar that only links to existing anchors', () => {
  const jump = read('components/knowledge/JumpNav.jsx');
  assert.ok(jump.includes('if (list.length < 2) return null;'));
  assert.ok(read('components/knowledge/JumpNav.module.css').includes('position: sticky; top: var(--header-h)'));
  const pages = {
    'app/yemen-in-numbers/indicator/[slug]/page.jsx': ['#series-title', '#factsheet-title', '#table-title', '#sources-title', 'id="indicator-reading"'],
    'app/yemen-history/[slug]/page.jsx': ['#history-reading', '#references-heading', 'id="history-facts"', '#history-related'],
    'app/yemeni-figures/[slug]/page.jsx': ['#figure-profile-content', '#figure-sources', 'id="figure-quick-facts"'],
    'app/yemen-map/governorates/[id]/page.jsx': ["'#'+item.key", '#districts', '#province-sources'],
  };
  for (const [file, tokens] of Object.entries(pages)) {
    const source = read(file);
    assert.ok(source.includes('<JumpNav'), file);
    for (const token of tokens) assert.ok(source.includes(token), file + ' ' + token);
  }
  // Jumps land below the app bar and the pinned chips.
  assert.ok(read('app/foundation/identity.css').includes(':root .site-experience [id] { scroll-margin-top: calc(var(--header-h) + 64px) !important; }'));
});

test('the page clips sideways overflow without breaking pinned bars', () => {
  const globals = read('app/globals.css');
  // overflow-x:hidden on html/body turns them into scroll containers and silently disables position:sticky.
  assert.ok(globals.includes('html,body{overflow-x:hidden;overflow-x:clip}'));
  assert.ok(globals.includes('overflow-x:hidden;overflow-x:clip}.ymap-hero,.ymap-section{direction:ltr}'));
});

test('history: explorer first, pinned eras, list mode is a vertical chronology with the same data', () => {
  const page = read('app/yemen-history/page.jsx');
  assert.ok(page.indexOf('<HistoryExplorer') < page.indexOf('<KnowledgeReadingGuide kind="history"/>'));
  const explorer = read('components/history/HistoryExplorer.jsx');
  for (const token of ['data-history-kind={entry.kind}', 'variant="thumbnail"', 'historyEntryPath(entry.slug)', 'historySourceCount(entry)', 'entry.location', 'entry.period', 'entry.summary', 'className={styles.cardThumb}', 'القائمة</button>'])
    assert.ok(explorer.includes(token), token);
  const css = read('components/history/HistoryExplorer.module.css');
  assert.ok(css.includes('.eras{position:sticky;top:var(--header-h,54px)'));
  assert.ok(css.includes('.cards:before{'));
  const axis = read('components/history/HistoryTimeline.module.css');
  assert.ok(axis.includes('.track,.stop{height:184px}'));
});

test('map: the map leads, the tour follows it, and a chosen place gets a peek bar on phones', () => {
  const discovery = read('components/yemen-map/YemenDiscovery.jsx');
  assert.ok(!discovery.includes('exploreChoices'));
  assert.ok(discovery.indexOf('<YemenMap') < discovery.indexOf('<ExplorationProgress'));
  const panel = read('components/yemen-map/RegionInfoPanel.jsx');
  assert.ok(panel.includes('new IntersectionObserver'));
  assert.ok(panel.includes('{region && panelBelow && <div className="ymap-peek"'));
  assert.ok(panel.includes("panelRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})"));
  assert.ok(panel.includes('aria-label="إلغاء اختيار المكان"'));
  const css = read('app/foundation/identity.css');
  assert.ok(css.includes('.ymap-peek { display: none; }'));
});

test('figures: rows keep portrait provenance, credit, save and every filter', () => {
  const page = read('app/yemeni-figures/page.jsx');
  assert.ok(page.indexOf('<YemeniFiguresExplorer') < page.indexOf('<KnowledgeReadingGuide kind="figures"/>'));
  const listing = read('components/yemen-map/YemeniFiguresDirectory.jsx');
  assert.ok(listing.includes('<span className="yfigure-era">{figure.era}</span><span>{figure.field}</span>'));
  assert.ok(listing.includes('الصورة: {figure.imageCredit||\'مصدر الصورة وحقوقها\'}'));
  assert.ok(listing.indexOf('className="yfigure-photo-credit"') > listing.indexOf('className="yfigure-content"'));
  for (const token of ['figureQ', 'withSocial', 'photo', 'century', 'birthFrom', 'birthTo', 'figureSort', 'SaveForLater', 'yfigures-more'])
    assert.ok(listing.includes(token), token);
  const css = read('app/foundation/knowledge.css');
  assert.ok(css.includes('.yemeni-figures-page .yfigure-card {'));
  assert.ok(read('app/layout.jsx').includes("import './foundation/knowledge.css';"));
});

test('ranking: on phones the rank card comes straight after the selectors', () => {
  const css = read('app/foundation/knowledge.css');
  assert.ok(css.includes(':root:root .yr-explorer .yr-result > .yr-rank-card { order: -1; }'));
  assert.ok(css.includes(':root:root .yr-explorer { grid-template-columns: minmax(0, 1fr) !important; }'));
});

test('home: guests see the shortcuts plus a sign-in line; members keep their resume panel', () => {
  const smart = read('components/home/HomeSmartStart.jsx');
  assert.ok(smart.includes('if(membersOnly&&!ready)return null;'));
  assert.ok(smart.includes('if(membersOnly&&!user)return <div className={styles.guestHint}>{signInHint}</div>;'));
  assert.ok(smart.includes("<Link href=\"/login\">تسجيل الدخول"));
  assert.ok(read('app/page.jsx').includes('<HomeSmartStart membersOnly initialDate={today}'));
});
