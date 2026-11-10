import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {convertAmount,dailySeries,latestRates,parseRateNumber,rateFreshness,transferEstimate,usableRates,validateRateEntry} from '../lib/exchangeRates.js';
import {publicSections,resolvePageVisibility} from '../lib/pageVisibility.js';
import {navSections,resolveNavSections} from '../lib/navigation.js';
import {buildSitemap} from '../lib/seo.js';
import {pageViewBucket,ACTIVITY_SECTIONS} from '../lib/siteAnalytics.js';
import {ADMIN_TAB_IDS} from '../lib/adminLists.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const H = 3600e3, now = Date.parse('2026-11-10T09:00:00Z');
const row = (region, currency, buy, sell, hoursAgo = 1, extra = {}) => ({region, currency, buy, sell, recorded_at: new Date(now - hoursAgo * H).toISOString(), ...extra});
const rates = {
  'sanaa:USD': row('sanaa', 'USD', 530, 535), 'sanaa:SAR': row('sanaa', 'SAR', 139, 140),
  'aden:USD': row('aden', 'USD', 1610, 1620), 'aden:SAR': row('aden', 'SAR', 425, 427),
};

test('numbers typed in Arabic or Latin digits are read; anything else is refused', () => {
  assert.equal(parseRateNumber('١٦٢٠'), 1620);
  assert.equal(parseRateNumber('1,620.5'), 1620.5);
  assert.equal(parseRateNumber('535٫25'), 535.25);
  assert.ok(Number.isNaN(parseRateNumber('12a')));
  assert.ok(Number.isNaN(parseRateNumber('')));
});

test('an entry is checked for typing mistakes before it is saved', () => {
  const entry = (rates, extra = {}) => ({rates, ...extra});
  assert.deepEqual(validateRateEntry(entry([{region: 'aden', currency: 'USD', buy: '1610', sell: '1620'}])).rates, [{region: 'aden', currency: 'USD', buy: 1610, sell: 1620}]);
  assert.throws(() => validateRateEntry(entry([{region: 'aden', currency: 'USD', buy: '1620', sell: '1610'}])), /أقل من سعر الشراء/);
  assert.throws(() => validateRateEntry(entry([{region: 'aden', currency: 'USD', buy: '1000', sell: '1620'}])), /كبير جدًا/);
  assert.throws(() => validateRateEntry(entry([{region: 'taiz', currency: 'USD', buy: '1', sell: '1'}])), /غير معروفة/);
  assert.throws(() => validateRateEntry(entry([{region: 'aden', currency: 'USD', buy: '', sell: ''}])), /سعرًا واحدًا على الأقل/);
  // The riyal must stay near 1/3.75 of the dollar in the same city.
  assert.throws(() => validateRateEntry(entry([{region: 'aden', currency: 'USD', buy: '1610', sell: '1620'}, {region: 'aden', currency: 'SAR', buy: '139', sell: '140'}])), /غير متناسبين/);
});

test('a move above 10% needs confirmation', () => {
  const input = {rates: [{region: 'aden', currency: 'USD', buy: '1900', sell: '1910'}, {region: 'aden', currency: 'SAR', buy: '505', sell: '507'}]};
  assert.throws(() => validateRateEntry(input, rates), error => error.status === 409 && error.moves.length === 2);
  assert.equal(validateRateEntry({...input, confirmLargeChange: true}, rates).rates.length, 2);
});

test('old rates warn after a day and disappear after two', () => {
  assert.equal(rateFreshness(new Date(now - 2 * H).toISOString(), now), 'fresh');
  assert.equal(rateFreshness(new Date(now - 30 * H).toISOString(), now), 'stale');
  assert.equal(rateFreshness(new Date(now - 50 * H).toISOString(), now), 'expired');
  assert.deepEqual(Object.keys(usableRates({a: row('aden', 'USD', 1, 1, 50), b: row('aden', 'SAR', 1, 1, 30)}, now)), ['b']);
});

test('the latest visible rate wins; a hidden entry falls back to the one before', () => {
  const latest = latestRates([row('aden', 'USD', 1600, 1610, 5), row('aden', 'USD', 1700, 1710, 1, {hidden: true}), row('aden', 'USD', 1605, 1615, 3)]);
  assert.equal(latest['aden:USD'].sell, 1615);
});

test('exchange uses the changer\'s buy price when selling and sell price when buying', () => {
  assert.equal(convertAmount({amount: '100', from: 'USD', to: 'YER', region: 'aden', rates}).result, 161000);
  assert.equal(Math.round(convertAmount({amount: '162000', from: 'YER', to: 'USD', region: 'aden', rates}).result), 100);
  const withFee = convertAmount({amount: '100', from: 'USD', to: 'YER', region: 'sanaa', rates, feePercent: 1});
  assert.equal(Math.round(withFee.result), 52470);
  assert.equal(convertAmount({amount: '0', from: 'USD', to: 'YER', region: 'aden', rates}), null);
  assert.equal(convertAmount({amount: '5', from: 'USD', to: 'USD', region: 'aden', rates}), null);
});

test('a transfer between the cities is estimated through the dollar', () => {
  const t = transferEstimate({amount: '162000', fromRegion: 'aden', toRegion: 'sanaa', rates});
  assert.equal(Math.round(t.dollars), 100);
  assert.equal(Math.round(t.result), 53000);
});

test('the chart keeps the last reading of each Yemen day', () => {
  const rows = [row('aden', 'USD', 1, 1600, 30), row('aden', 'USD', 1, 1605, 28), row('aden', 'USD', 1, 1620, 1), row('sanaa', 'USD', 1, 535, 1)];
  const series = dailySeries(rows, 'aden', 'USD', 30, now);
  assert.deepEqual(series.map(p => p.sell), [1605, 1620]);
});

test('«الخدمات» is a section that starts hidden and appears in navigation, sitemap and search once shown', () => {
  const section = publicSections.find(item => item.id === 'services');
  assert.equal(section.path, '/services');
  assert.equal(section.defaultHidden, true);
  assert.equal(resolvePageVisibility([]).services, false);
  const ids = navSections.map(item => item.id);
  assert.ok(ids.indexOf('directories') < ids.indexOf('services') && ids.indexOf('services') < ids.indexOf('initiative'));
  assert.ok(!resolveNavSections({visibility: {services: false}}).some(item => item.id === 'services'));
  assert.ok(resolveNavSections({visibility: {services: true}}).some(item => item.id === 'services'));
  const env = {NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://967ye.com'};
  const urls = visibility => buildSitemap({pageVisibility: visibility}, env).map(entry => entry.url);
  assert.ok(!urls({services: false}).some(url => url.includes('/services')));
  assert.ok(urls({services: true}).includes('https://967ye.com/services/exchange-rates'));
  assert.ok(read('lib/searchPages.js').includes("href:'/services/exchange-rates'"));
  assert.equal(pageViewBucket('/services/exchange-rates'), 'services');
  assert.ok(ACTIVITY_SECTIONS.services);
  assert.ok(read('supabase/migrations/20261110120000_exchange_rates.sql').includes("'professionals','services','search'"));
  for (const path of ['app/services/page.jsx', 'app/services/exchange-rates/page.jsx']) assert.ok(read(path).includes("sectionGate('services',settings)"), path);
});

test('rates are entered by editors or by reporters management added, never read raw by browsers', () => {
  const sql = read('supabase/migrations/20261110120000_exchange_rates.sql');
  assert.ok(sql.includes('revoke all on public.exchange_rates from public,anon,authenticated'));
  assert.ok(sql.includes('revoke all on public.exchange_rate_reporters from public,anon,authenticated'));
  const server = read('lib/exchangeRatesServer.js');
  assert.ok(server.includes("authorizeEditorRequest(request,db,{allowMember:true})") && server.includes("from('exchange_rate_reporters')"));
  assert.ok(read('app/api/admin/exchange-rate-reporters/route.js').includes("auth.role!=='management'"));
  // The entry page is not behind the section switch, so rates can be entered before launch.
  assert.ok(!read('app/services/exchange-rates/update/page.jsx').includes('sectionGate'));
  assert.ok(read('app/services/exchange-rates/update/page.jsx').includes('noindex:true'));
  assert.ok(ADMIN_TAB_IDS.includes('rates'));
  assert.ok(existsSync(new URL('../components/services/RatesAdminPanel.jsx', import.meta.url)));
});

test('the footer grid follows the number of visible groups', () => {
  assert.ok(read('app/foundation/shell.css').includes('grid-template-columns: repeat(var(--footer-groups, 6), minmax(0, 1fr))'));
  assert.ok(read('components/Footer.jsx').includes("'--footer-groups': Math.min(groups.length, 8)"));
});
