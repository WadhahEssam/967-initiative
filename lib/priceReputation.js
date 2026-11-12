// «المُبلّغ المحلي»: each reporter's reputation (0–100, starting at 30). Pure functions shared by
// the server and the tests. Members never see their score, a report's grade, or a ban.
//
// A report is graded once, when it has «settled»: 3 hours after it was sent for currencies, a day
// for food (food reports are fewer and slower to confirm). It is compared with the price shown at
// that moment, after later reports had their say:
//   very close (under 2%)   +2      close (2% to 5%)   +0.5
//   far (5% to 15%)         −1      very far or an outlier   −4
//   first report of a jump that held   +5 more
//   a confirmation («السعر صحيح») of a price that proved right   +0.5
// Nobody gains more than 10 points a day, so a reputation cannot be built quickly and then used.
// Under 5 points after at least 10 reports, a member is silently banned: their reports are kept
// and they see everything as usual, but their reports carry no weight. An editor can also ban.
// A verified anchor whose reports are very far 3 times in a row is flagged for the editors.
import {PRICE_KINDS} from './priceConsensus.js';

const HOUR = 3600e3;
export const START_SCORE = 30;
export const DAILY_GAIN_CAP = 10;
export const BAN_BELOW = 5;
export const BAN_AFTER_REPORTS = 10;
export const ANCHOR_MISS_ALERT = 3;
export const SETTLE_MS = {rate: 3 * HOUR, food: 24 * HOUR};
export const POINTS = {very_close: 2, close: 0.5, far: -1, very_far: -4, jump_first: 5, confirmation: 0.5};
// Reports within 5% of the settled price «agree» (used for «نسبة المتوافق» and the badges).
export const AGREEING = new Set(['very_close', 'close']);

export function agreementOf(value, price) {
  const gap = Math.abs(value - price) / price;
  return gap < 0.02 ? 'very_close' : gap <= 0.05 ? 'close' : gap <= 0.15 ? 'far' : 'very_far';
}

/**
 * Grades one settled report against the price shown when it settled.
 * jump: {first: true, held: boolean} when this report was the first of a jump.
 * Returns {delta, agreement} or null when there is no price to compare with yet.
 */
export function scoreReport({kind, value, confirmation = false, status = null, price, jump = null}) {
  if (!(price > 0) || !(value > 0) || !PRICE_KINDS[kind]) return null;
  const agreement = status === 'outlier' ? 'very_far' : agreementOf(value, price);
  if (confirmation) {
    const right = Math.abs(value - price) / price <= PRICE_KINDS[kind].tolerance;
    return {delta: right ? POINTS.confirmation : 0, agreement};
  }
  const bonus = jump?.first && jump.held ? POINTS.jump_first : 0;
  return {delta: POINTS[agreement] + bonus, agreement, jumpFirst: bonus > 0};
}

// A Yemen calendar day (UTC+3), for the daily gain cap.
export const yemenDay = at => new Date(at + 3 * HOUR).toISOString().slice(0, 10);

export function newReporter(userId) {
  return {user_id: userId, score: START_SCORE, reports_total: 0, reports_agreeing: 0, silent_ban: false, ban_reason: null, banned_at: null, anchor: false, daily_gain: 0, gain_day: null, jumps_first: 0, anchor_miss_streak: 0};
}

/**
 * Applies one graded report to a reporter. Returns {reporter, applied, anchorAlert}: `applied` is
 * the change actually made (gains are capped per day), `anchorAlert` is true when a verified
 * anchor just reached 3 very far reports in a row.
 */
export function applyScore(reporter, graded, {confirmation = false, at = Date.now()} = {}) {
  const next = {...reporter};
  const day = yemenDay(at);
  if (next.gain_day !== day) { next.gain_day = day; next.daily_gain = 0; }
  let applied = graded.delta;
  if (applied > 0) {
    applied = Math.max(0, Math.min(applied, DAILY_GAIN_CAP - Number(next.daily_gain || 0)));
    next.daily_gain = Number(next.daily_gain || 0) + applied;
  }
  next.score = Math.round(Math.min(100, Math.max(0, Number(next.score) + applied)) * 100) / 100;
  let anchorAlert = false;
  if (!confirmation) {
    next.reports_total = (next.reports_total || 0) + 1;
    if (AGREEING.has(graded.agreement)) next.reports_agreeing = (next.reports_agreeing || 0) + 1;
    if (graded.jumpFirst) next.jumps_first = (next.jumps_first || 0) + 1;
    if (next.anchor) {
      next.anchor_miss_streak = graded.agreement === 'very_far' ? (next.anchor_miss_streak || 0) + 1 : 0;
      anchorAlert = next.anchor_miss_streak === ANCHOR_MISS_ALERT;
    }
  }
  if (!next.silent_ban && next.score < BAN_BELOW && next.reports_total >= BAN_AFTER_REPORTS) {
    next.silent_ban = true; next.ban_reason = 'auto'; next.banned_at = new Date(at).toISOString();
  }
  return {reporter: next, applied: Math.round(applied * 100) / 100, anchorAlert};
}
