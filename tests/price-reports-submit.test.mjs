// «المُبلّغ المحلي», phase 2: what members send, what readers see, and that nothing tells a
// member whether their report counted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agoText, basisText, confirmTargets, mergeFood, mergeRates, rangeText, reportsText, validateReportInput, REPORT_THANKS} from '../lib/priceReports.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-12T12:00:00Z');

test('a report is checked for shape only; an unlikely price is accepted (and silently not counted)', () => {
  assert.deepEqual(validateReportInput({kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell', value: '٥٣٥', source: '  صرافة   النجم '}),
    {kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell', value: 535, source: 'صرافة النجم'});
  assert.equal(validateReportInput({kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell', value: '2000'}).value, 2000);
  assert.deepEqual(validateReportInput({kind: 'food', region: 'aden', item: 'rice', value: '9,500'}),
    {kind: 'food', region: 'aden', item: 'rice', side: 'price', value: 9500, source: null});
  for (const bad of [
    {kind: 'rate', region: 'taiz', item: 'USD', side: 'sell', value: '535'},
    {kind: 'rate', region: 'sanaa', item: 'EUR', side: 'sell', value: '535'},
    {kind: 'rate', region: 'sanaa', item: 'USD', side: 'both', value: '535'},
    {kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell', value: 'abc'},
    {kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell', value: '-5'},
    {kind: 'food', region: 'sanaa', item: 'caviar', value: '10'},
    {kind: 'gold', region: 'sanaa', item: 'x', value: '10'},
  ]) assert.throws(() => validateReportInput(bad), JSON.stringify(bad));
});

test('«السعر صحيح» confirms the dollar buy and sell of the city, or one food item; never a sent number', () => {
  assert.deepEqual(confirmTargets({kind: 'rate', region: 'aden'}), [
    {kind: 'rate', region: 'aden', item: 'USD', side: 'buy'}, {kind: 'rate', region: 'aden', item: 'USD', side: 'sell'}]);
  assert.deepEqual(confirmTargets({kind: 'food', region: 'sanaa', item: 'eggs', value: 1}), [{kind: 'food', region: 'sanaa', item: 'eggs', side: 'price'}]);
  const server = read('lib/priceReportsServer.js');
  assert.match(server, /entries=targets\.map\(target=>\(\{\.\.\.target,value:board\?\.\[instrumentKey\(target\)\]\?\.value\}\)\)/);
});

test('Arabic counts and times read naturally', () => {
  assert.deepEqual([1, 2, 3, 10, 11, 40].map(reportsText), ['بلاغ واحد', 'بلاغين', '3 بلاغات', '10 بلاغات', '11 بلاغًا', '40 بلاغًا']);
  assert.equal(agoText(NOW - 40 * 60e3, NOW), 'قبل 40 دقيقة');
  assert.equal(agoText(NOW - 2 * 3600e3, NOW), 'قبل ساعتين');
  assert.equal(agoText(NOW - 3 * 864e5, NOW), 'قبل 3 أيام');
  assert.equal(basisText({count: 12, lastActivityAt: NOW - 40 * 60e3}, NOW), 'بناءً على 12 بلاغًا · آخر تحديث قبل 40 دقيقة');
  assert.equal(basisText({count: 0, lastActivityAt: NOW - 60e3}, NOW), 'من فريق 967 · آخر تحديث قبل دقيقة');
  assert.equal(rangeText({low: 530, high: 536}), 'يتراوح بين 530 و536');
  assert.equal(rangeText({low: 533, high: 533}), '');
});

test('the pages show the computed price where there is one, and the editor price otherwise', () => {
  const editor = {'sanaa:USD': {region: 'sanaa', currency: 'USD', buy: 530, sell: 533, recorded_at: '2026-11-12T08:00:00Z', note: ''}, 'aden:USD': {region: 'aden', currency: 'USD', buy: 1600, sell: 1610, recorded_at: '2026-11-12T08:00:00Z'}};
  assert.deepEqual(mergeRates(editor, null), editor);
  const board = {
    'rate:sanaa:USD:buy': {value: 538, count: 6, low: 536, high: 540, lastActivityAt: NOW, confidence: 'trusted'},
    'rate:sanaa:USD:sell': {value: 540, count: 6, low: 538, high: 542, lastActivityAt: NOW, confidence: 'trusted'},
  };
  const merged = mergeRates(editor, board);
  assert.equal(merged['sanaa:USD'].sell, 540);
  assert.equal(merged['sanaa:USD'].community.count, 6);
  assert.equal(merged['aden:USD'].sell, 1610);
  assert.equal(merged['aden:USD'].community, undefined);
  const food = {'sanaa:rice': {latest: {price: 9000, recorded_at: '2026-11-10T08:00:00Z', note: 'السوق المركزي'}, previous: {price: 8800}}};
  const unchanged = mergeFood(food, {'food:sanaa:rice:price': {value: 9000, count: 0, lastActivityAt: NOW, confidence: 'trusted'}});
  assert.equal(unchanged['sanaa:rice'].previous.price, 8800);
  const moved = mergeFood(food, {'food:sanaa:rice:price': {value: 9500, count: 4, lastActivityAt: NOW, confidence: 'estimated'}});
  assert.equal(moved['sanaa:rice'].latest.price, 9500);
  assert.equal(moved['sanaa:rice'].previous.price, 9000);
  const expired = mergeFood(food, {'food:sanaa:rice:price': {value: 9500, count: 4, lastActivityAt: NOW, confidence: 'expired'}});
  assert.equal(expired['sanaa:rice'].latest.price, 9000);
});

test('the answer never tells whether a report counted, was held, or came from a banned member', () => {
  const server = read('lib/priceReportsServer.js');
  // One success answer for reports, the same whatever happens to the report.
  assert.match(server, /return \{status:200,body:\{ok:true,message:action==='confirm'\?CONFIRM_THANKS:REPORT_THANKS\}\};/);
  assert.equal(REPORT_THANKS, 'شكراً، سيظهر بلاغك بعد تأكيده من آخرين.');
  // The honeypot answers with the same thanks.
  assert.match(server, /if\(typeof body\?\.website==='string'&&body\.website\.trim\(\)\)return \{status:200,body:\{ok:true,message:REPORT_THANKS\}\};/);
  // No status, score, weight or ban is read into the answer, and the board has none of them.
  assert.doesNotMatch(server, /silent_ban|score|statuses/);
  const board = read('lib/priceConsensusServer.js').split('export function getPriceBoard')[1].split('\nexport ')[0];
  assert.doesNotMatch(board, /silent_ban|score|status|user_id|price_reports/);
  for (const file of ['components/services/PriceReport.jsx', 'components/services/FoodBoard.jsx', 'app/services/exchange-rates/page.jsx', 'app/services/food-prices/page.jsx']) {
    assert.doesNotMatch(read(file), /silent_ban|score|weight|statuses|held|outlier/, file);
  }
});

test('who may report: confirmed email, 3-day-old account, not suspended; editors only while hidden', () => {
  const server = read('lib/priceReportsServer.js');
  assert.ok(server.includes("if(!user.email_confirmed_at)throw new RequestValidationError("));
  assert.ok(server.includes("if(profile?.suspended||profile?.deletion_requested_at)throw new RequestValidationError("));
  assert.ok(server.includes("if(!editor&&!(age>=MIN_ACCOUNT_AGE_DAYS*864e5))throw new RequestValidationError("));
  assert.ok(server.includes("if(!editor)throw new RequestValidationError('الإبلاغ عن الأسعار غير متاح حاليًا.',404);"));
  // Turnstile on the form when the site has the keys; device and connection only as keyed hashes.
  assert.ok(server.includes("result.action!=='price_report'"));
  assert.ok(server.includes("hash('967-price-device:v1:'+deviceId)"));
  assert.ok(server.includes("hash('967-price-connection:v1:'+address)"));
});

test('the limits live in the database: one per thing every 6 hours, 20 a day, one member at a time', () => {
  const sql = read('supabase/migrations/20261112130000_price_report_limits.sql');
  assert.match(sql, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('price_report:' \|\| p_user::text, 0\)\)/);
  assert.match(sql, /if v_today \+ jsonb_array_length\(p_entries\) > 20 then/);
  assert.match(sql, /and created_at > pg_catalog\.now\(\) - interval '6 hours'/);
  assert.match(sql, /at time zone 'Asia\/Aden'/);
  assert.match(sql, /security definer\nset search_path = ''/);
  assert.match(sql, /revoke all on function public\.price_report_submit\(uuid, jsonb, boolean, text, text, text\) from public, anon, authenticated;/);
});

test('the reporting buttons appear only once the tables exist; the pages work as before without them', () => {
  for (const file of ['app/services/exchange-rates/page.jsx', 'app/services/food-prices/page.jsx']) {
    const page = read(file);
    assert.ok(page.includes('getPriceBoard(db).catch(()=>null)'), file);
  }
  assert.ok(read('app/services/exchange-rates/page.jsx').includes('{board&&<PriceActions kind="rate"'));
  assert.ok(read('app/services/food-prices/page.jsx').includes('reporting={Boolean(board)}'));
  assert.ok(read('lib/priceConsensusServer.js').includes('if(missingTable(error))return null;'));
});
