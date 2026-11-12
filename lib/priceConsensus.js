// «المُبلّغ المحلي»: the price shown for each city comes from what members report, combined so that
// a wrong number or a deliberate push cannot move it on its own.
// Pure functions (no database), shared by the server and the tests.
//
// Each priced thing is an «instrument»: a city, a kind (rate or food), an item (USD, SAR, rice…)
// and a side (buy or sell for currencies, price for food).
//
// How a new price is decided (computeConsensus):
// 1. Editor entries (exchange_rates / food_prices batches) are anchors: a newer one sets the price
//    at once, as before, and so does hiding the latest one (the one before it applies again).
//    Only reports made after the entry can move the price.
// 2. Reports from the last 6 hours count, or from the last 24 when fewer than 3 people reported.
//    A silently banned member's reports carry no weight. Only a member's latest report counts.
// 3. Reports from the same device or the same connection within an hour are one voice, so ten
//    accounts on one phone count as one person.
// 4. A voice further than 7% (currencies) or 15% (food) from the current price is held.
// 5. Among the rest, outliers are dropped and the weighted median is the candidate. Weight grows
//    with reputation; verified anchors weigh double; a quick «السعر صحيح» weighs half. The current
//    price takes part with the weight of an anchor.
// 6. The price moves to the candidate only when 3 different people reported close to it.
// 7. Held voices become a real jump when at least 4 people agree on it and outweigh the current
//    price and those who kept reporting it after the jump started.

const HOUR = 3600e3, DAY = 24 * HOUR;

export const PRICE_KINDS = {
  rate: {tolerance: 0.02, holdBeyond: 0.07, staleMs: 24 * HOUR, expiredMs: 48 * HOUR},
  food: {tolerance: 0.05, holdBeyond: 0.15, staleMs: 15 * DAY, expiredMs: 21 * DAY},
};
export const SHORT_WINDOW_MS = 6 * HOUR;
export const LONG_WINDOW_MS = 24 * HOUR;
export const SAME_ORIGIN_MS = HOUR;
export const MIN_PEOPLE = 3;
export const JUMP_PEOPLE = 4;
export const TRUSTED_PEOPLE = 5;
export const DEFAULT_SCORE = 30;
export const PRIOR_WEIGHT = 2;

// A member's weight: 0.5 at no reputation, 0.8 for a new member (30 points), 1.5 at 100.
export function reporterWeight(reporter) {
  if (reporter?.banned) return 0;
  const score = Number.isFinite(Number(reporter?.score)) ? Math.min(100, Math.max(0, Number(reporter.score))) : DEFAULT_SCORE;
  return (0.5 + score / 100) * (reporter?.anchor ? 2 : 1);
}

// The value at which half the weight lies on each side (the lower one on an exact tie).
export function weightedMedian(items) {
  const list = items.filter(item => item.weight > 0 && Number.isFinite(item.value)).sort((a, b) => a.value - b.value);
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  let running = 0;
  for (const item of list) {
    running += item.weight;
    if (running >= total / 2) return item.value;
  }
  return list.at(-1).value;
}

const median = values => {
  const list = [...values].sort((a, b) => a - b), mid = list.length >> 1;
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};
const distance = (a, b) => Math.abs(a - b) / b;
const round2 = value => Math.round(value * 100) / 100;

// Groups reports that share a device or a connection within SAME_ORIGIN_MS into voices.
// Each voice counts as one person: its value is the median of its reports and its weight the
// smallest among them, so extra accounts can only lower a voice, never raise it.
export function groupVoices(reports) {
  const parent = reports.map((_, index) => index);
  const find = index => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  for (let a = 0; a < reports.length; a++) {
    for (let b = a + 1; b < reports.length; b++) {
      const first = reports[a], second = reports[b];
      if (Math.abs(first.at - second.at) > SAME_ORIGIN_MS) continue;
      const sameDevice = first.device && first.device === second.device;
      const sameConnection = first.connection && first.connection === second.connection;
      if (sameDevice || sameConnection) parent[find(a)] = find(b);
    }
  }
  const groups = new Map();
  reports.forEach((report, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(report);
  });
  return [...groups.values()].map(members => ({
    ids: members.map(member => member.id),
    value: median(members.map(member => member.value)),
    weight: Math.min(...members.map(member => member.weight)),
    at: Math.max(...members.map(member => member.at)),
    firstAt: Math.min(...members.map(member => member.at)),
    firstId: members.reduce((first, member) => (member.at < first.at ? member : first)).id,
    anchor: members.every(member => member.anchor),
  }));
}

/**
 * Decides the price of one instrument.
 * @param {object} input
 * @param {'rate'|'food'} input.kind
 * @param {object|null} input.current   stored state: {value, changedAt, officialAt, anchored, lastActivityAt}
 * @param {object|null} input.official  latest editor entry: {value, at}
 * @param {Array} input.reports         [{id, userId, value, at, confirmation, device, connection}]
 * @param {Map|object} input.reporters  userId → {score, anchor, banned}
 * @param {number} input.now
 * @returns the new state plus `changed`, `reason`, `statuses` (report id → counted|held|outlier|ignored) and `jump`.
 */
export function computeConsensus({kind, current = null, official = null, reports = [], reporters = new Map(), now = Date.now()}) {
  const rules = PRICE_KINDS[kind];
  if (!rules) throw new Error('unknown price kind');
  const reporterOf = id => (reporters instanceof Map ? reporters.get(id) : reporters?.[id]);
  const statuses = {};

  // 1. A newer editor entry sets the price.
  let base = current?.value > 0 ? {...current} : null, reason = null;
  // A different entry than the one the price started from also means the newer one was hidden.
  if (official?.value > 0 && (!base || official.at !== base.officialAt)) {
    base = {value: official.value, changedAt: official.at, officialAt: official.at, anchored: true, lastActivityAt: official.at};
    reason = 'official';
  }
  const since = base?.officialAt ?? -Infinity;

  // 2. Eligible reports: after the latest editor entry, not in the future, latest per member.
  const latestByUser = new Map();
  for (const report of reports) {
    if (!(report.value > 0) || !(report.at > since) || report.at > now) { statuses[report.id] = 'ignored'; continue; }
    const weight = reporterWeight(reporterOf(report.userId)) * (report.confirmation ? 0.5 : 1);
    if (!(weight > 0)) { statuses[report.id] = 'ignored'; continue; }
    const seen = latestByUser.get(report.userId);
    const entry = {...report, weight, anchor: Boolean(reporterOf(report.userId)?.anchor) && !report.confirmation};
    if (!seen || report.at > seen.at) {
      if (seen) statuses[seen.id] = 'ignored';
      latestByUser.set(report.userId, entry);
    } else statuses[report.id] = 'ignored';
  }
  const eligible = [...latestByUser.values()];
  const officialVoice = official?.value > 0 && official.at === base?.officialAt
    ? {ids: [], value: official.value, weight: 2, at: official.at, firstAt: official.at, firstId: null, anchor: true, official: true}
    : null;
  const voicesIn = windowMs => {
    const inWindow = eligible.filter(report => report.at >= now - windowMs);
    const voices = groupVoices(inWindow);
    if (officialVoice && officialVoice.at >= now - windowMs) voices.push(officialVoice);
    return {inWindow, voices};
  };
  let {inWindow, voices} = voicesIn(SHORT_WINDOW_MS);
  if (voices.length < MIN_PEOPLE) ({inWindow, voices} = voicesIn(LONG_WINDOW_MS));
  for (const report of eligible) if (!inWindow.includes(report)) statuses[report.id] = 'ignored';

  // 4. Held: too far from the current price.
  const reference = base?.value;
  const held = reference ? voices.filter(voice => distance(voice.value, reference) > rules.holdBeyond) : [];
  const inRange = voices.filter(voice => !held.includes(voice));

  // 5. The current price takes part like an anchor (unless the editor entry already does), so a few
  // early reports cannot pull it before anyone else has spoken. Outliers are measured from the
  // weighted median with it, then dropped, and the weighted median of the rest is the candidate.
  let value = base?.value ?? null, changedAt = base?.changedAt ?? null, anchored = base?.anchored ?? false, jump = null;
  const prior = value && !voices.some(voice => voice.official) ? [{value, weight: PRIOR_WEIGHT}] : [];
  let kept = inRange, outliers = [];
  if (inRange.length >= 3) {
    const center = weightedMedian([...inRange, ...prior]);
    const spread = 1.4826 * median(inRange.map(voice => Math.abs(voice.value - center)));
    const limit = Math.max(rules.tolerance * center, 3 * spread);
    kept = inRange.filter(voice => Math.abs(voice.value - center) <= limit);
    outliers = inRange.filter(voice => !kept.includes(voice));
  }
  const near = (list, target) => list.filter(voice => distance(voice.value, target) <= rules.tolerance);
  const candidate = weightedMedian([...kept, ...prior]);
  // 6. The price moves only when 3 different people reported close to the candidate.
  if (candidate !== null && candidate !== value && near(kept, candidate).length >= MIN_PEOPLE) {
    value = candidate; changedAt = now; anchored = false; reason = 'consensus';
  }

  // 7. A real jump: at least 4 people agreeing far from the current price, outweighing the current
  // price itself and those who still reported it after the jump started.
  if (held.length >= JUMP_PEOPLE) {
    let best = null;
    for (const voice of held) {
      const group = near(held, voice.value);
      const weight = group.reduce((sum, item) => sum + item.weight, 0);
      if (group.length >= JUMP_PEOPLE && (!best || weight > best.weight)) best = {group, weight};
    }
    if (best) {
      const startedAt = Math.min(...best.group.map(voice => voice.firstAt));
      const against = kept.filter(voice => voice.at >= startedAt).reduce((sum, voice) => sum + voice.weight, PRIOR_WEIGHT);
      if (best.weight > against) {
        value = weightedMedian(best.group); changedAt = now; anchored = false; reason = 'jump';
        const first = best.group.reduce((a, b) => (a.firstAt <= b.firstAt ? a : b));
        jump = {firstReportId: first.firstId, from: reference, to: value};
      }
    }
  }

  // The voices behind the price shown: close enough to it and not outliers.
  const pool = jump ? held : kept;
  const supporting = value ? pool.filter(voice => distance(voice.value, value) <= rules.holdBeyond) : [];
  if (supporting.some(voice => voice.anchor)) anchored = true;
  const supportIds = new Set(supporting.flatMap(voice => voice.ids));
  for (const voice of voices) {
    const status = outliers.includes(voice) ? 'outlier' : held.includes(voice) && !(jump && supporting.includes(voice)) ? 'held' : 'counted';
    for (const id of voice.ids) statuses[id] = status === 'counted' && !supportIds.has(id) ? 'held' : status;
  }
  const values = supporting.map(voice => voice.value);
  const lastActivityAt = Math.max(changedAt ?? -Infinity, base?.lastActivityAt ?? -Infinity, ...supporting.map(voice => voice.at));
  return {
    value: value === null ? null : round2(value),
    low: values.length ? round2(Math.min(...values)) : null,
    high: values.length ? round2(Math.max(...values)) : null,
    // Members' voices only: the editor entry is shown as «من فريق 967», not as a report.
    count: supporting.filter(voice => !voice.official).length,
    anchored,
    changedAt,
    officialAt: base?.officialAt ?? null,
    lastActivityAt: Number.isFinite(lastActivityAt) ? lastActivityAt : null,
    changed: value !== null && value !== (current?.value ?? null),
    reason: value !== null && value !== (current?.value ?? null) ? reason : null,
    statuses,
    jump,
  };
}

// Confidence shown to readers, worked out when the page is read (it depends on the time):
// stale when nothing confirmed the price for too long, trusted with 5 people or an anchor,
// estimated otherwise. Expired prices are not shown at all, as before.
export function consensusConfidence(state, kind, now = Date.now()) {
  const rules = PRICE_KINDS[kind];
  if (!state?.value || !rules) return 'none';
  const age = now - (state.lastActivityAt ?? state.changedAt ?? 0);
  if (age > rules.expiredMs) return 'expired';
  if (age > rules.staleMs) return 'stale';
  return state.anchored || state.count >= TRUSTED_PEOPLE ? 'trusted' : 'estimated';
}
