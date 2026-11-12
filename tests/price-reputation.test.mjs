// «المُبلّغ المحلي», phase 3: reputation and the silent ban, following the owner's points table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {computeConsensus} from '../lib/priceConsensus.js';
import {applyScore, newReporter, scoreReport, SETTLE_MS, START_SCORE, yemenDay} from '../lib/priceReputation.js';

const HOUR = 3600e3, T0 = Date.parse('2026-11-12T06:00:00Z');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('the points table: under 2% +2, 2–5% +0.5, 5–15% −1, beyond or outlier −4, first of a held jump +5', () => {
  const grade = (value, extra = {}) => scoreReport({kind: 'rate', value, price: 500, ...extra});
  assert.deepEqual(grade(505), {delta: 2, agreement: 'very_close', jumpFirst: false});
  assert.deepEqual(grade(515), {delta: 0.5, agreement: 'close', jumpFirst: false});
  assert.deepEqual(grade(550), {delta: -1, agreement: 'far', jumpFirst: false});
  assert.deepEqual(grade(600), {delta: -4, agreement: 'very_far', jumpFirst: false});
  assert.deepEqual(grade(505, {status: 'outlier'}), {delta: -4, agreement: 'very_far', jumpFirst: false});
  assert.deepEqual(grade(505, {jump: {first: true, held: true}}), {delta: 7, agreement: 'very_close', jumpFirst: true});
  assert.equal(grade(505, {jump: {first: true, held: false}}).delta, 2);
  // A confirmation of a price that proved right: +0.5; of a wrong one: nothing.
  assert.equal(grade(505, {confirmation: true}).delta, 0.5);
  assert.equal(grade(560, {confirmation: true}).delta, 0);
  assert.equal(scoreReport({kind: 'rate', value: 500, price: null}), null);
});

test('everyone starts at 30; nobody gains more than 10 points a Yemen day', () => {
  let reporter = newReporter('u');
  assert.equal(reporter.score, START_SCORE);
  for (let index = 0; index < 8; index++) reporter = applyScore(reporter, {delta: 2, agreement: 'very_close'}, {at: T0 + index * HOUR}).reporter;
  assert.equal(reporter.score, 40);
  assert.equal(reporter.reports_agreeing, 8);
  // The next Yemen day (midnight in Aden is 21:00 UTC) starts a new allowance.
  const tomorrow = Date.parse('2026-11-12T21:30:00Z');
  assert.notEqual(yemenDay(tomorrow), yemenDay(T0));
  assert.equal(applyScore(reporter, {delta: 2, agreement: 'very_close'}, {at: tomorrow}).reporter.score, 42);
  // Losses are never capped.
  assert.equal(applyScore(reporter, {delta: -4, agreement: 'very_far'}, {at: T0}).reporter.score, 36);
});

test('silent ban: under 5 points after at least 10 reports; confirmations do not count as reports', () => {
  let reporter = newReporter('bad');
  for (let index = 0; index < 8; index++) reporter = applyScore(reporter, {delta: -4, agreement: 'very_far'}, {at: T0}).reporter;
  assert.equal(reporter.score, 0);
  assert.equal(reporter.silent_ban, false); // only 8 reports so far
  reporter = applyScore(reporter, {delta: 0, agreement: 'very_far'}, {at: T0, confirmation: true}).reporter;
  assert.equal(reporter.reports_total, 8);
  reporter = applyScore(reporter, {delta: -4, agreement: 'very_far'}, {at: T0}).reporter;
  reporter = applyScore(reporter, {delta: -4, agreement: 'very_far'}, {at: T0}).reporter;
  assert.equal(reporter.silent_ban, true);
  assert.equal(reporter.ban_reason, 'auto');
  // A ban stays even if the score later rises; only an editor lifts it.
  for (let index = 0; index < 5; index++) reporter = applyScore(reporter, {delta: 2, agreement: 'very_close'}, {at: T0 + 86400e3}).reporter;
  assert.equal(reporter.silent_ban, true);
});

test('a verified anchor very far three times in a row is flagged for the editors', () => {
  let reporter = {...newReporter('shop'), anchor: true}, flags = 0;
  for (const agreement of ['very_far', 'very_far', 'close', 'very_far', 'very_far', 'very_far']) {
    const result = applyScore(reporter, {delta: agreement === 'close' ? 0.5 : -4, agreement}, {at: T0});
    reporter = result.reporter; if (result.anchorAlert) flags++;
  }
  assert.equal(flags, 1);
  assert.equal(reporter.anchor_miss_streak, 3);
});

// Several days with the same people: honest members and a group pushing the dollar 6.5% up.
function simulate(seed, cheatShare) {
  let state = seed;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
  const truth = 533, people = [...Array(30)].map((_, i) => ({id: 'h' + i, cheat: false, last: -Infinity})).concat([...Array(8)].map((_, i) => ({id: 'c' + i, cheat: true, last: -Infinity})));
  const reporters = new Map(people.map(person => [person.id, newReporter(person.id)]));
  let price = {value: 533, changedAt: T0 - 30 * HOUR, officialAt: T0 - 30 * HOUR, anchored: true, lastActivityAt: T0 - 30 * HOUR};
  const reports = [], settled = new Set();
  let worstAfterFirstDay = 0, worst = 0, id = 0;
  for (let at = T0; at < T0 + 3 * 24 * HOUR; at += 24 * HOUR / 150) {
    const cheat = rand() < cheatShare, pool = people.filter(person => person.cheat === cheat && at - person.last >= 6 * HOUR);
    if (!pool.length) continue;
    const person = pool[Math.floor(rand() * pool.length)]; person.last = at;
    const value = Math.round((cheat ? truth * 1.065 : truth * (1 + (rand() - 0.5) * 0.01)) * 100) / 100;
    reports.push({id: id++, userId: person.id, value, at, device: 'd' + person.id, connection: 'n' + person.id});
    const weights = new Map([...reporters].map(([key, row]) => [key, {score: row.score, banned: row.silent_ban}]));
    price = computeConsensus({kind: 'rate', current: price, reports: reports.filter(item => item.at > at - 24 * HOUR), reporters: weights, now: at + 1});
    for (const item of reports) {
      if (settled.has(item.id) || at - item.at < SETTLE_MS.rate) continue;
      settled.add(item.id);
      reporters.set(item.userId, applyScore(reporters.get(item.userId), scoreReport({kind: 'rate', value: item.value, price: price.value}), {at}).reporter);
    }
    const gap = Math.abs(price.value - truth) / truth;
    worst = Math.max(worst, gap);
    if (at >= T0 + 24 * HOUR) worstAfterFirstDay = Math.max(worstAfterFirstDay, gap);
  }
  const average = prefix => { const rows = [...reporters.values()].filter(row => row.user_id[0] === prefix); return rows.reduce((sum, row) => sum + row.score, 0) / rows.length; };
  return {worst, worstAfterFirstDay, cheatScore: average('c'), honestScore: average('h'), honestBanned: [...reporters.values()].some(row => row.user_id[0] === 'h' && row.silent_ban)};
}

test('over several days, repeat manipulators lose weight: 20% stays within 2% throughout, 40% after the first day', () => {
  for (const seed of [1, 2, 3]) {
    const twenty = simulate(seed, 0.2);
    assert.ok(twenty.worst <= 0.02, 'seed ' + seed + ' at 20%: ' + twenty.worst);
    assert.ok(twenty.cheatScore < START_SCORE && twenty.honestScore > START_SCORE);
    assert.equal(twenty.honestBanned, false);
    const forty = simulate(seed, 0.4);
    assert.ok(forty.worstAfterFirstDay <= 0.02, 'seed ' + seed + ' at 40% after day 1: ' + forty.worstAfterFirstDay);
  }
});

test('grading runs on the server after each recomputation; scores, grades and bans never reach members', () => {
  const server = read('lib/priceConsensusServer.js');
  assert.ok(server.includes('await settleReports(db,kind,prices,now)'));
  const sql = read('supabase/migrations/20261112140000_price_reputation.sql');
  assert.match(sql, /add column if not exists scored_at timestamptz/);
  assert.match(sql, /ban_reason text check \(ban_reason is null or ban_reason in \('auto','editor'\)\)/);
  for (const file of ['lib/priceReportsServer.js', 'components/services/PriceReport.jsx', 'app/api/services/price-reports/route.js']) {
    assert.doesNotMatch(read(file), /score_delta|agreement|silent_ban|reputation|priceReputation/, file);
  }
});
