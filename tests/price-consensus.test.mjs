// «المُبلّغ المحلي»: how members' reports become the price shown. These follow the owner's
// acceptance list (2026-11-12): an outlier is held, a real jump moves the price, one device is
// one voice, a silent ban changes nothing, 20% manipulation keeps the price within 2%.
import test from 'node:test';
import assert from 'node:assert/strict';
import {computeConsensus, consensusConfidence, groupVoices, reporterWeight, weightedMedian, PRICE_KINDS} from '../lib/priceConsensus.js';

const HOUR = 3600e3, NOW = Date.parse('2026-11-12T12:00:00Z');
let nextId = 1;
const report = (userId, value, minutesAgo = 10, extra = {}) => ({id: nextId++, userId, value, at: NOW - minutesAgo * 60e3, device: 'd-' + userId, connection: 'c-' + userId, ...extra});
const sanaaUsd = {value: 533, changedAt: NOW - 3 * HOUR, officialAt: NOW - 3 * HOUR, anchored: true, lastActivityAt: NOW - 3 * HOUR};
const official = {value: 533, at: NOW - 3 * HOUR};

test('one outlier (2000 for the dollar in Sanaa at 533) does not move the price and is held', () => {
  const outlier = report('u1', 2000);
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: [outlier], now: NOW});
  assert.equal(result.value, 533);
  assert.equal(result.changed, false);
  assert.equal(result.statuses[outlier.id], 'held');
});

test('four close reports from four people on a real jump move the price at once', () => {
  const reports = ['a', 'b', 'c', 'd'].map((user, index) => report(user, 600 + index, 5 + index));
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports, now: NOW});
  assert.equal(result.reason, 'jump');
  assert.ok(result.value >= 600 && result.value <= 603);
  assert.equal(result.jump.firstReportId, reports[3].id); // the earliest of the four
  for (const item of reports) assert.equal(result.statuses[item.id], 'counted');
});

test('three far reports are not enough for a jump', () => {
  const reports = ['a', 'b', 'c'].map(user => report(user, 600));
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports, now: NOW});
  assert.equal(result.value, 533);
  assert.equal(result.jump, null);
});

test('ten accounts on the same device count as one report', () => {
  const reports = Array.from({length: 10}, (_, index) => report('sock' + index, 600, 5 + index, {device: 'one-phone'}));
  assert.equal(groupVoices(reports.map(item => ({...item, weight: 1}))).length, 1);
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports, now: NOW});
  assert.equal(result.value, 533);
  for (const item of reports) assert.equal(result.statuses[item.id], 'held');
});

test('the same connection within an hour is one voice too; more than an hour apart it is not', () => {
  const close = [report('x', 540, 10, {connection: 'cafe'}), report('y', 540, 40, {connection: 'cafe'})];
  assert.equal(groupVoices(close.map(item => ({...item, weight: 1}))).length, 1);
  const apart = [report('x', 540, 10, {connection: 'cafe'}), report('y', 540, 200, {connection: 'cafe'})];
  assert.equal(groupVoices(apart.map(item => ({...item, weight: 1}))).length, 2);
});

test('the price moves only after three close reports from three different people', () => {
  const two = ['a', 'b'].map(user => report(user, 540));
  assert.equal(computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: two, now: NOW}).value, 533);
  const three = ['a', 'b', 'c'].map(user => report(user, 540));
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: three, now: NOW});
  assert.equal(result.value, 540);
  assert.equal(result.reason, 'consensus');
});

test('only the latest report of a member counts', () => {
  const reports = [report('a', 540, 30), report('a', 541, 20), report('a', 542, 10)];
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports, now: NOW});
  assert.equal(result.value, 533);
  assert.equal(result.statuses[reports[0].id], 'ignored');
  assert.equal(result.statuses[reports[2].id], 'counted');
});

test('a silently banned member changes nothing, and is not told so', () => {
  const honest = ['a', 'b', 'c'].map(user => report(user, 534));
  const reporters = new Map([['bad', {banned: true}]]);
  const without = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: honest, reporters, now: NOW});
  const banned = Array.from({length: 6}, (_, index) => report('bad', 560 + index, index, {device: 'bad-' + index, connection: 'bad-' + index}));
  const withBanned = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: [...honest, ...banned], reporters, now: NOW});
  assert.equal(withBanned.value, without.value);
  assert.equal(withBanned.count, without.count);
});

test('a newer editor entry sets the price, and older reports cannot move it back', () => {
  const before = ['a', 'b', 'c'].map(user => report(user, 520, 120));
  const entry = {value: 535, at: NOW - 30 * 60e3};
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official: entry, reports: before, now: NOW});
  assert.equal(result.value, 535);
  assert.equal(result.reason, 'official');
  assert.equal(result.anchored, true);
});

test('with no reports at all the price is the editor entry, as today', () => {
  const result = computeConsensus({kind: 'rate', current: null, official, reports: [], now: NOW});
  assert.equal(result.value, 533);
  assert.equal(consensusConfidence(result, 'rate', NOW), 'trusted');
  assert.equal(consensusConfidence(result, 'rate', NOW + 22 * HOUR), 'stale');
  assert.equal(consensusConfidence(result, 'rate', NOW + 46 * HOUR), 'expired');
});

test('without any editor entry, three people agreeing start a price; fewer do not', () => {
  assert.equal(computeConsensus({kind: 'food', reports: [report('a', 9000), report('b', 9100)], now: NOW}).value, null);
  const result = computeConsensus({kind: 'food', reports: [report('a', 9000), report('b', 9100), report('c', 9050)], now: NOW});
  assert.equal(result.value, 9050);
  assert.equal(consensusConfidence(result, 'food', NOW), 'estimated');
});

test('confidence: trusted at five people, estimated at three or four; food is stale after 15 days', () => {
  const current = {value: 9000, changedAt: NOW - 2 * HOUR, anchored: false, lastActivityAt: NOW - 2 * HOUR};
  const four = computeConsensus({kind: 'food', current, reports: ['a', 'b', 'c', 'd'].map(user => report(user, 9000)), now: NOW});
  assert.equal(consensusConfidence(four, 'food', NOW), 'estimated');
  const five = computeConsensus({kind: 'food', current, reports: ['a', 'b', 'c', 'd', 'e'].map(user => report(user, 9000)), now: NOW});
  assert.equal(consensusConfidence(five, 'food', NOW), 'trusted');
  assert.equal(consensusConfidence(five, 'food', NOW + 14 * 24 * HOUR), 'trusted');
  assert.equal(consensusConfidence(five, 'food', NOW + 16 * 24 * HOUR), 'stale');
  assert.equal(PRICE_KINDS.food.staleMs, 15 * 24 * HOUR);
});

test('a verified anchor weighs double and makes the price trusted; a confirmation weighs half', () => {
  assert.equal(reporterWeight({score: 30, anchor: true}), 2 * reporterWeight({score: 30}));
  assert.equal(reporterWeight({score: 3, banned: true}), 0);
  const current = {value: 533, changedAt: NOW - 30 * HOUR, anchored: false, lastActivityAt: NOW - 30 * HOUR};
  const reporters = new Map([['shop', {score: 60, anchor: true}]]);
  const result = computeConsensus({kind: 'rate', current, reports: [report('shop', 534), report('a', 534), report('b', 533)], reporters, now: NOW});
  assert.equal(consensusConfidence(result, 'rate', NOW), 'trusted');
});

test('the range and count describe the reports behind the price', () => {
  const reports = [report('a', 530), report('b', 533), report('c', 536), report('d', 534), report('e', 2000)];
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports, now: NOW});
  assert.equal(result.low, 530);
  assert.equal(result.high, 536);
  assert.equal(result.count, 5); // four members and the editor entry; the 2000 report is held
});

test('reports older than 6 hours count only while fewer than three people reported recently', () => {
  const old = ['a', 'b', 'c'].map(user => report(user, 540, 10 * 60));
  assert.equal(computeConsensus({kind: 'rate', current: {...sanaaUsd, officialAt: null}, reports: old, now: NOW}).value, 540);
  const recent = ['d', 'e', 'f'].map(user => report(user, 533));
  assert.equal(computeConsensus({kind: 'rate', current: {...sanaaUsd, officialAt: null}, reports: [...old, ...recent], now: NOW}).value, 533);
});

test('a jump is refused while more people keep confirming the old price', () => {
  const jumpers = ['a', 'b', 'c', 'd'].map(user => report(user, 600, 30));
  const stayers = ['e', 'f', 'g', 'h', 'i', 'j'].map(user => report(user, 533, 10, {confirmation: false}));
  const result = computeConsensus({kind: 'rate', current: sanaaUsd, official, reports: [...jumpers, ...stayers], now: NOW});
  assert.equal(result.value, 533);
});

test('weighted median', () => {
  assert.equal(weightedMedian([{value: 1, weight: 1}, {value: 2, weight: 1}, {value: 3, weight: 1}]), 2);
  assert.equal(weightedMedian([{value: 1, weight: 1}, {value: 10, weight: 5}]), 10);
  assert.equal(weightedMedian([]), null);
});

// A small seeded random generator, so the simulation gives the same result every run.
function random(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

for (const [name, attack] of [
  ['scattered nonsense', (rand, truth) => truth * (0.3 + rand() * 3)],
  ['a coordinated push just inside the limit', (rand, truth) => truth * 1.065],
  ['a coordinated push far above', (rand, truth) => truth * 1.3],
  ['a coordinated push below', (rand, truth) => truth * 0.94],
]) {
  test('200 reports with 20% manipulation (' + name + ') keep the price within 2% of the truth', () => {
    const rand = random(42 + name.length), truth = 533;
    let state = {value: 533, changedAt: NOW - 30 * HOUR, officialAt: NOW - 30 * HOUR, anchored: true, lastActivityAt: NOW - 30 * HOUR};
    const reports = [];
    // Reports arrive over 12 hours; the price is recomputed after each one, as the site will.
    for (let index = 0; index < 200; index++) {
      const at = NOW - 12 * HOUR + index * (12 * HOUR / 200);
      const cheat = rand() < 0.2;
      const value = Math.round((cheat ? attack(rand, truth) : truth * (1 + (rand() - 0.5) * 0.01)) * 100) / 100;
      reports.push({id: index, userId: (cheat ? 'cheat' : 'honest') + index, value, at, device: 'dev' + index, connection: 'con' + index});
      state = computeConsensus({kind: 'rate', current: state, reports, now: at + 1});
      assert.ok(Math.abs(state.value - truth) / truth <= 0.02, 'report ' + index + ': price ' + state.value);
    }
  });
}
