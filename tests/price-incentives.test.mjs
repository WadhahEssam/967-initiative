// «المُبلّغ المحلي», phase 5: badges, trust level, the weekly board per city, a member's own page,
// and the 7-day chart. A silently banned member must not notice anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cityBoard, earnedPriceBadges, myCityRank, PRICE_BADGES, reporterWeek, trustLevel, weekSeries} from '../lib/priceIncentives.js';
import {agreeingText, timesText} from '../lib/priceReports.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the four badges: first report, 25 agreeing reports, 80 points, first of a jump that held', () => {
  assert.deepEqual(PRICE_BADGES.map(badge => badge.code), ['first_report', 'city_eye', 'trusted_source', 'first_mover']);
  assert.deepEqual(earnedPriceBadges({score: 30, reports_total: 0}, 0), []);
  assert.deepEqual(earnedPriceBadges({score: 30, reports_total: 0}, 1), ['first_report']);
  assert.deepEqual(earnedPriceBadges({score: 79, reports_total: 30, reports_agreeing: 24}), ['first_report']);
  assert.deepEqual(earnedPriceBadges({score: 80, reports_total: 30, reports_agreeing: 25, jumps_first: 1}), ['first_report', 'city_eye', 'trusted_source', 'first_mover']);
  const sql = read('supabase/migrations/20261112160000_price_badges.sql');
  assert.match(sql, /code in \('first_report','city_eye','trusted_source','first_mover'\)/);
  // Earned once and kept: saving never replaces a badge already there.
  assert.ok(read('lib/priceConsensusServer.js').includes("upsert(rows,{onConflict:'user_id,code',ignoreDuplicates:true})"));
});

test('trust level shown to a member: a newcomer and a silently banned member both read «مبتدئ»', () => {
  assert.equal(trustLevel(30).label, 'مبتدئ');
  assert.equal(trustLevel(2).label, 'مبتدئ');
  assert.equal(trustLevel(45).label, 'نشِط');
  assert.equal(trustLevel(65).label, 'موثوق');
  assert.equal(trustLevel(85).label, 'مصدر موثوق');
  assert.equal(trustLevel(85).next, null);
});

test('the reporters’ week runs Saturday to Saturday in Yemen time', () => {
  // Friday 2026-11-13 23:30 in Aden (20:30 UTC) is still the week that began Saturday 2026-11-07.
  const friday = reporterWeek(Date.parse('2026-11-13T20:30:00Z'));
  assert.equal(new Date(friday.start).toISOString(), '2026-11-06T21:00:00.000Z');
  // Saturday 00:30 in Aden starts a new week.
  const saturday = reporterWeek(Date.parse('2026-11-13T21:30:00Z'));
  assert.equal(new Date(saturday.start).toISOString(), '2026-11-13T21:00:00.000Z');
  assert.equal(saturday.end - saturday.start, 7 * 864e5);
});

const rows = [
  ...['a', 'a', 'a', 'b', 'b', 'c'].map((user, index) => ({user_id: user, region: 'sanaa', agreement: 'very_close', created_at: '2026-11-12T0' + index + ':00:00Z'})),
  {user_id: 'b', region: 'sanaa', agreement: 'far', created_at: '2026-11-12T07:00:00Z'},
  {user_id: 'banned', region: 'sanaa', agreement: 'close', created_at: '2026-11-12T08:00:00Z'},
  {user_id: 'banned', region: 'sanaa', agreement: 'close', created_at: '2026-11-12T09:00:00Z'},
  {user_id: 'banned', region: 'sanaa', agreement: 'close', created_at: '2026-11-12T10:00:00Z'},
  {user_id: 'banned', region: 'sanaa', agreement: 'close', created_at: '2026-11-12T11:00:00Z'},
  {user_id: 'd', region: 'aden', agreement: 'close', created_at: '2026-11-12T08:00:00Z'},
];

test('the board ranks by agreeing reports, not by how many were sent; far reports do not count', () => {
  const board = cityBoard(rows, 'sanaa');
  assert.deepEqual(board.map(entry => [entry.userId, entry.agreeing]), [['banned', 4], ['a', 3], ['b', 2], ['c', 1]]);
  assert.deepEqual(cityBoard(rows, 'aden').map(entry => entry.userId), ['d']);
});

test('a silently banned member is left off the public board, but sees their own rank as usual', () => {
  const hidden = new Set(['banned']);
  assert.deepEqual(cityBoard(rows, 'sanaa', {exclude: hidden}).map(entry => entry.userId), ['a', 'b', 'c']);
  assert.deepEqual(myCityRank(rows, 'banned', {exclude: hidden}), {region: 'sanaa', rank: 1, of: 4, agreeing: 4});
  assert.deepEqual(myCityRank(rows, 'b', {exclude: hidden}), {region: 'sanaa', rank: 2, of: 3, agreeing: 2});
  assert.equal(myCityRank(rows, 'nobody'), null);
});

test('the 7-day chart: one point per Yemen day, carrying the price forward, ending at today’s price', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const history = [{value: 530, recorded_at: '2026-11-01T08:00:00Z'}, {value: 535, recorded_at: '2026-11-09T08:00:00Z'}, {value: 600, recorded_at: '2026-11-12T08:00:00Z'}];
  const points = weekSeries(history, 601, now);
  assert.equal(points.length, 7);
  assert.deepEqual(points.map(point => point.sell), [530, 530, 530, 535, 535, 535, 601]);
  assert.equal(points.at(-1).day, '2026-11-12');
  assert.deepEqual(weekSeries([], null, now), []);
});

test('nothing private reaches members: no score, grades, statuses or bans on their page or the board', () => {
  const server = read('lib/priceIncentivesServer.js');
  const mine = server.split('export async function readMyPrices')[1];
  const answer = mine.slice(mine.indexOf('return {'));
  assert.doesNotMatch(answer, /score:|silent_ban|status|agreement|score_delta/);
  const board = server.split('export function getReportersBoard')[1].split('export async function readMyPrices')[0];
  assert.ok(board.includes("top:city.top.map(entry=>({rank:entry.rank,name:names.get(entry.userId)||'عضو في 967',agreeing:entry.agreeing,badges:badges.get(entry.userId)||[]}))"));
  for (const file of ['components/services/MyPrices.jsx', 'app/services/reporters/page.jsx', 'components/services/PriceBadges.jsx']) {
    assert.doesNotMatch(read(file), /silent_ban|score|statuses|\.status|agreement|banned/, file);
  }
});

test('«مساهماتي» is for signed-in members, editors only while «الخدمات» is hidden, and private', () => {
  const route = read('app/api/account/prices/route.js');
  assert.ok(route.includes('const user=await authorizeAudience(request,db);'));
  assert.ok(route.includes("if(error||!['admin','management'].includes(data?.role))throw new RequestValidationError('هذه الصفحة غير متاحة حاليًا.',404);"));
  assert.ok(route.includes("'Cache-Control':'private, no-store'"));
  assert.match(read('app/account/prices/page.jsx'), /noindex:true,nofollow:true/);
  assert.ok(read('components/account/AccountWorkspace.jsx').includes("{servicesVisible&&<Link href=\"/account/prices\">"));
});

test('Arabic counts of times', () => {
  assert.deepEqual([1, 2, 3, 11].map(timesText), ['مرة واحدة', 'مرتين', '3 مرات', '11 مرة']);
  assert.deepEqual([1, 2, 3, 12].map(agreeingText), ['بلاغ واحد متوافق', 'بلاغين متوافقين', '3 بلاغات متوافقة', '12 بلاغًا متوافقًا']);
});
