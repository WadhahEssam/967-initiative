import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_CATEGORIES,STEP_KINDS,checklistMessage,guideIsStale,guideRegions,validateGuide} from '../lib/transactionGuides.js';
import {publicSections,resolvePageVisibility,pageIsVisible} from '../lib/pageVisibility.js';
import {resolveNavSections} from '../lib/navigation.js';
import {buildSitemap} from '../lib/seo.js';
import {pageViewBucket,ACTIVITY_SECTIONS} from '../lib/siteAnalytics.js';
import {ADMIN_TAB_IDS} from '../lib/adminLists.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = (extra = {}) => ({slug: 'passport', title: 'استخراج جواز السفر', category: 'travel', status: 'draft', variants: {sanaa: {documents: 'البطاقة\n\n- صور شخصية', steps: [{kind: 'visit', title: 'توجه إلى المكتب', text: ''}]}}, ...extra});

test('a guide is cleaned: lists from lines, unknown cities filled empty, bullets dropped', () => {
  const guide = validateGuide(base());
  assert.deepEqual(guide.variants.sanaa.documents, ['البطاقة', 'صور شخصية']);
  assert.deepEqual(guide.variants.aden.steps, []);
  assert.equal(guide.verifiedAt, null);
  assert.deepEqual(guideRegions(guide).map(region => region.id), ['sanaa']);
});

test('nothing unchecked is published: a date of verification and steps are required', () => {
  assert.throws(() => validateGuide(base({status: 'published'})), /قبل التحقق/);
  assert.throws(() => validateGuide(base({status: 'published', verifiedAt: '2026-11-01', variants: {}})), /خطوات/);
  assert.equal(validateGuide(base({status: 'published', verifiedAt: '2026-11-01'})).status, 'published');
  assert.throws(() => validateGuide(base({verifiedAt: '2999-01-01'})), /المستقبل/);
});

test('bad input is refused with a clear message', () => {
  assert.throws(() => validateGuide(base({slug: 'جواز'})), /الرابط المختصر/);
  assert.throws(() => validateGuide(base({category: 'x'})), /تصنيف/);
  assert.throws(() => validateGuide(base({variants: {sanaa: {steps: [{kind: 'teleport', title: 'x'}]}}})), /غير معروف/);
  assert.throws(() => validateGuide(base({variants: {sanaa: {steps: [{kind: 'visit', title: ''}]}}})), /عنوان الخطوة 1/);
  assert.throws(() => validateGuide(base({variants: {sanaa: {mapUrl: 'http://maps.example'}}})), /https/);
  assert.throws(() => validateGuide(base({variants: {sanaa: {mapUrl: 'javascript:alert(1)'}}})), /https|غير صالح/);
});

test('step kinds and categories each have an illustration icon the page imports', () => {
  const view = read('components/transactions/GuideView.jsx');
  const map = view.match(/const Icons=\{([^}]*)\}/)[1].split(',');
  for (const item of [...STEP_KINDS, ...GUIDE_CATEGORIES]) assert.ok(map.includes(item.icon), item.icon);
  // Not the whole icon set in the browser bundle.
  assert.ok(!view.includes("import * as"));
});

test('the checklist message and the staleness notice', () => {
  const guide = validateGuide(base({variants: {sanaa: {documents: 'البطاقة', fees: '10,000 ريال', steps: []}}}));
  assert.equal(checklistMessage(guide, 'sanaa', 'https://967ye.com/transactions/passport'), 'الأوراق المطلوبة لـ«استخراج جواز السفر» في صنعاء:\n- البطاقة\nالرسوم: 10,000 ريال\nالتفاصيل والخطوات: https://967ye.com/transactions/passport');
  assert.equal(guideIsStale('2026-11-01', Date.parse('2026-12-01')), false);
  assert.equal(guideIsStale('2026-01-01', Date.parse('2026-12-01')), true);
  assert.equal(guideIsStale(null), true);
});

test('«دليل المعاملات» starts hidden and joins navigation, search, sitemap and analytics once shown', () => {
  const section = publicSections.find(item => item.id === 'transactions');
  assert.equal(section.path, '/transactions');
  assert.equal(section.defaultHidden, true);
  assert.equal(resolvePageVisibility([]).transactions, false);
  assert.equal(pageIsVisible('/transactions/passport', {transactions: false}), false);
  const links = visibility => resolveNavSections({visibility}).find(item => item.id === 'directories')?.links.map(([href]) => href) || [];
  assert.ok(!links({transactions: false}).includes('/transactions'));
  assert.ok(links({transactions: true}).includes('/transactions'));
  const env = {NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://967ye.com'};
  const urls = visibility => buildSitemap({pageVisibility: visibility, guides: [{slug: 'passport'}, {slug: 'bad slug'}]}, env).map(entry => entry.url);
  assert.ok(!urls({transactions: false}).some(url => url.includes('/transactions')));
  assert.ok(urls({transactions: true}).includes('https://967ye.com/transactions/passport'));
  assert.ok(!urls({transactions: true}).some(url => url.includes('bad')));
  assert.ok(read('lib/searchPages.js').includes("href:'/transactions'"));
  assert.equal(pageViewBucket('/transactions/passport'), 'transactions');
  assert.ok(ACTIVITY_SECTIONS.transactions);
  assert.ok(read('supabase/migrations/20261110200000_transaction_guides.sql').includes("'professionals','services','transactions','search'"));
  for (const path of ['app/transactions/page.jsx', 'app/transactions/[slug]/page.jsx']) assert.ok(read(path).includes("sectionGate('transactions',settings)"), path);
});

test('guides are written by editors or guide editors, never read raw by browsers; nothing deleted', () => {
  const sql = read('supabase/migrations/20261110200000_transaction_guides.sql');
  assert.ok(sql.includes('revoke all on public.transaction_guides from public,anon,authenticated'));
  assert.ok(sql.includes('revoke all on public.transaction_guide_editors from public,anon,authenticated'));
  assert.ok(sql.includes("check (status<>'published' or verified_at is not null)"));
  const server = read('lib/transactionGuidesServer.js');
  assert.ok(server.includes("hasAccess(db,'transaction_guide_editors',auth.user.id)"));
  assert.ok(!server.includes('.delete('));
  // Visitors never see who checked or the editors' note.
  assert.ok(server.includes('const publicGuide=guide=>{const {editorNote:_note,verifiedBy:_by,...rest}=guide;return rest;}'));
  assert.ok(read('app/api/admin/transaction-guide-editors/route.js').includes("auth.role!=='management'"));
  const studio = read('app/transactions/studio/page.jsx');
  assert.ok(!studio.includes('sectionGate') && studio.includes('noindex:true'));
  assert.ok(ADMIN_TAB_IDS.includes('guides'));
  assert.ok(read('lib/accessLists.js').includes("new Set(['exchange_rate_reporters', 'transaction_guide_editors'])"));
});

test('questions, related guides and the «الأكثر طلبًا» flag are cleaned and limited', async () => {
  const {guideStats} = await import('../lib/transactionGuides.js');
  const guide = validateGuide(base({category: 'business', featured: true, related: ['tax-card', 'passport', 'tax-card', 'Bad Slug'], faqs: [{q: 'هل؟', a: 'نعم.'}, {q: '', a: ''}], variants: {sanaa: {delegate: 'نعم بتوكيل', steps: [{kind: 'visit', title: 'اذهب'}], documents: ['أ', 'ب']}}}));
  assert.deepEqual(guide.related, ['tax-card']);
  assert.deepEqual(guide.faqs, [{q: 'هل؟', a: 'نعم.'}]);
  assert.equal(guide.featured, true);
  assert.equal(guide.variants.sanaa.delegate, 'نعم بتوكيل');
  assert.deepEqual(guideStats(guide), {steps: 1, documents: 2, cities: ['صنعاء']});
  assert.throws(() => validateGuide(base({faqs: [{q: 'سؤال بلا جواب', a: ''}]})), /أكمل السؤال/);
  assert.throws(() => validateGuide(base({related: ['a', 'b', 'c', 'd', 'e', 'f', 'g']})), /الحد 6/);
  const sql = read('supabase/migrations/20261110220000_transaction_guides_extra.sql');
  assert.ok(sql.includes("'business'") && sql.includes('add column if not exists faqs jsonb'));
  // The page answers with FAQ structured data, and falls back to the first columns before the migration.
  assert.ok(read('app/transactions/[slug]/page.jsx').includes("'@type':'FAQPage'"));
  assert.ok(read('lib/transactionGuidesServer.js').includes('missingColumn(error)'));
});
