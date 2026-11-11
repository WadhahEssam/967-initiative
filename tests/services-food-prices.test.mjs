import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOOD_GROUPS,FOOD_ITEMS,FOOD_REGIONS,foodFreshness,inDollars,latestFoodPrices,parsePrice,priceChange,unitPrice,validateFoodEntry} from '../lib/foodPrices.js';
import {publicSections,resolvePageVisibility,sectionIsVisible,pageIsVisible} from '../lib/pageVisibility.js';
import {resolveNavSections} from '../lib/navigation.js';
import {buildSitemap} from '../lib/seo.js';
import {pageViewBucket} from '../lib/siteAnalytics.js';
import {countOf} from '../lib/arabicCount.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const DAY = 864e5, now = Date.parse('2026-11-10T09:00:00Z');
const row = (region, item, price, daysAgo = 1, extra = {}) => ({region, item, price, batch_id: 'b' + daysAgo, recorded_at: new Date(now - daysAgo * DAY).toISOString(), ...extra});

test('the item list covers the agreed staples in their agreed units, every item in a known group', () => {
  const units = Object.fromEntries(FOOD_ITEMS.map(item => [item.id, item.unit]));
  assert.equal(units.wheat_flour, 'كيس 50 كيلو');
  assert.equal(units.rice, 'كيس 10 كيلو');
  assert.equal(units.sugar, 'كيس 50 كيلو');
  assert.equal(units.cooking_oil, 'دبة 20 لتر');
  assert.equal(units.red_beans, 'علبة');
  assert.equal(units.lentils, 'كيلو');
  assert.equal(units.eggs, 'طبق 30 بيضة');
  assert.equal(units.cooking_gas, 'أسطوانة');
  assert.ok(FOOD_ITEMS.length >= 20);
  assert.equal(new Set(FOOD_ITEMS.map(item => item.id)).size, FOOD_ITEMS.length);
  for (const item of FOOD_ITEMS) {
    assert.ok(FOOD_GROUPS.some(group => group.id === item.group), item.id);
    assert.match(item.id, /^[a-z_]{2,40}$/); // the database check
  }
  assert.deepEqual(FOOD_REGIONS.map(region => region.id), ['sanaa', 'aden']);
});

test('prices are read from Arabic or Latin digits, and an entry is checked before saving', () => {
  assert.equal(parsePrice('٣٨٬٥٠٠'.replace('٬', ',')), 38500);
  assert.equal(parsePrice('1,250,000'), 1250000);
  assert.ok(Number.isNaN(parsePrice('12a')));
  const ok = validateFoodEntry({prices: [{region: 'aden', item: 'rice', price: '18000'}, {region: 'sanaa', item: 'rice', price: ''}], note: ' سوق الشيخ عثمان '});
  assert.deepEqual(ok, {prices: [{region: 'aden', item: 'rice', price: 18000}], note: 'سوق الشيخ عثمان'});
  assert.throws(() => validateFoodEntry({prices: [{region: 'taiz', item: 'rice', price: '1'}]}), /غير معروفة/);
  assert.throws(() => validateFoodEntry({prices: [{region: 'aden', item: 'caviar', price: '1'}]}), /غير معروفة/);
  assert.throws(() => validateFoodEntry({prices: [{region: 'aden', item: 'rice', price: '0'}]}), /برقم صحيح/);
  assert.throws(() => validateFoodEntry({prices: [{region: 'aden', item: 'rice', price: ''}]}), /سعرًا واحدًا على الأقل/);
  assert.throws(() => validateFoodEntry({prices: [{region: 'aden', item: 'rice', price: '1'}, {region: 'aden', item: 'rice', price: '2'}]}), /تكرر/);
});

test('a price that moved more than 25% asks for confirmation first', () => {
  const previous = {'aden:sugar': {price: 40000}, 'sanaa:sugar': {price: 15000}};
  const input = {prices: [{region: 'aden', item: 'sugar', price: '52000'}, {region: 'sanaa', item: 'sugar', price: '15500'}]};
  assert.throws(() => validateFoodEntry(input, previous), error => error.status === 409 && error.moves.length === 1 && error.moves[0].item === 'sugar' && /\+30%/.test(error.message));
  assert.equal(validateFoodEntry({...input, confirmLargeChange: true}, previous).prices.length, 2);
});

test('the latest price of each item is paired with the one from the entry before', () => {
  const rows = [row('aden', 'rice', 18000, 1), row('aden', 'rice', 17000, 8), row('aden', 'rice', 16000, 15), row('aden', 'sugar', 40000, 8, {hidden: true}), row('aden', 'sugar', 39000, 15)];
  const pairs = latestFoodPrices(rows);
  assert.equal(pairs['aden:rice'].latest.price, 18000);
  assert.equal(pairs['aden:rice'].previous.price, 17000);
  assert.equal(pairs['aden:sugar'].latest.price, 39000); // hidden entry skipped
  assert.equal(pairs['aden:sugar'].previous, null);
  assert.ok(Math.abs(priceChange(pairs['aden:rice']) - 1000 / 17000) < 1e-9);
  assert.equal(priceChange(pairs['aden:sugar']), null);
});

test('weekly prices warn after 8 days and disappear after 21; per-kilo and dollar figures', () => {
  assert.equal(foodFreshness(new Date(now - 3 * DAY).toISOString(), now), 'fresh');
  assert.equal(foodFreshness(new Date(now - 9 * DAY).toISOString(), now), 'stale');
  assert.equal(foodFreshness(new Date(now - 22 * DAY).toISOString(), now), 'expired');
  assert.deepEqual(unitPrice('wheat_flour', 50000), {value: 1000, unit: 'الكيلو'});
  assert.deepEqual(unitPrice('cooking_oil', 30000), {value: 1500, unit: 'اللتر'});
  assert.equal(unitPrice('eggs', 3000), null);
  assert.equal(inDollars('sanaa', 5350, {'sanaa:USD': {sell: 535}}), 10);
  assert.equal(inDollars('aden', 5350, {}), null);
  assert.equal(countOf(2, 'price'), 'سعران');
  assert.equal(countOf(22, 'price'), '22 سعرًا');
});

test('the staple prices page has its own switch inside «الخدمات», hidden until enabled', () => {
  const section = publicSections.find(item => item.id === 'foodPrices');
  assert.equal(section.path, '/services/food-prices');
  assert.equal(section.parent, 'services');
  assert.equal(section.defaultHidden, true);
  assert.equal(resolvePageVisibility([]).foodPrices, false);
  assert.equal(sectionIsVisible('foodPrices', {services: true, foodPrices: true}), true);
  assert.equal(sectionIsVisible('foodPrices', {services: false, foodPrices: true}), false);
  assert.equal(pageIsVisible('/services/food-prices', {services: true, foodPrices: false}), false);
  assert.equal(pageIsVisible('/services/exchange-rates', {services: true, foodPrices: false}), true);
  const links = visibility => resolveNavSections({visibility}).find(item => item.id === 'services')?.links.map(([href]) => href) || [];
  assert.ok(!links({services: true, foodPrices: false}).includes('/services/food-prices'));
  assert.ok(links({services: true, foodPrices: true}).includes('/services/food-prices'));
  const env = {NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://967ye.com'};
  const urls = visibility => buildSitemap({pageVisibility: visibility}, env).map(entry => entry.url);
  assert.ok(!urls({services: true, foodPrices: false}).includes('https://967ye.com/services/food-prices'));
  assert.ok(urls({services: true, foodPrices: true}).includes('https://967ye.com/services/food-prices'));
  assert.ok(read('lib/searchPages.js').includes("href:'/services/food-prices'"));
  assert.equal(pageViewBucket('/services/food-prices'), 'services');
  assert.ok(read('app/services/food-prices/page.jsx').includes("sectionAccess('foodPrices',settings)"));
  // The hidden-parent message names the parent instead of always saying «الأطلس».
  assert.ok(!read('components/PageVisibilityPanel.jsx').includes('مخفي لأن الأطلس مخفي'));
});

test('prices are entered by the same people as exchange rates, never read raw by browsers', () => {
  const sql = read('supabase/migrations/20261110180000_food_prices.sql');
  assert.ok(sql.includes('revoke all on public.food_prices from public,anon,authenticated'));
  assert.ok(sql.includes('enable row level security'));
  assert.ok(read('app/api/services/food-prices/entry/route.js').includes('authorizeRatesRequest(request,db)'));
  const update = read('app/services/food-prices/update/page.jsx');
  assert.ok(!update.includes('sectionGate') && update.includes('noindex:true'));
  assert.ok(read('components/services/RatesAdminPanel.jsx').includes('<FoodEntry/>'));
  // Nothing is deleted: a wrong entry is hidden.
  assert.ok(!read('lib/foodPricesServer.js').includes('.delete('));
});
