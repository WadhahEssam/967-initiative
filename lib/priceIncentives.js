// «المُبلّغ المحلي», phase 5: what keeps people reporting. Pure functions shared by the server, the
// pages and the tests. A silently banned member sees their own page exactly as anyone else would;
// they are only left out of the public weekly board.

const HOUR = 3600e3, DAY = 24 * HOUR;

// Stable codes are stored in price_reporter_badges; changing a title never takes a badge away.
export const PRICE_BADGES = [
  {code: 'first_report', title: 'مبلّغ أول', description: 'أرسل أول بلاغ عن سعر في مدينته.', icon: 'flag', tier: 'bronze'},
  {code: 'city_eye', title: 'عين المدينة', description: '25 بلاغًا متوافقًا مع السعر الذي ثبت.', icon: 'eye', tier: 'silver', goal: 25},
  {code: 'trusted_source', title: 'مصدر موثوق', description: 'بلغت ثقة بلاغاته 80 من 100 أو أكثر.', icon: 'shield', tier: 'gold', goal: 80},
  {code: 'first_mover', title: 'السبّاق', description: 'أول من أبلغ عن قفزة في السعر ثبتت بعد ذلك.', icon: 'zap', tier: 'gold'},
];
export const PRICE_BADGE_CODES = PRICE_BADGES.map(badge => badge.code);

// The badges a reporter has reached. submitted: reports sent (confirmations aside), graded or not.
export function earnedPriceBadges(reporter = {}, submitted = 0) {
  const codes = [];
  if (submitted > 0 || reporter.reports_total > 0) codes.push('first_report');
  if ((reporter.reports_agreeing || 0) >= 25) codes.push('city_eye');
  if (Number(reporter.score) >= 80) codes.push('trusted_source');
  if ((reporter.jumps_first || 0) >= 1) codes.push('first_mover');
  return codes;
}

// The trust level a member sees on their own page. Everyone starts at 30, so «مبتدئ».
export function trustLevel(score) {
  const value = Number.isFinite(Number(score)) ? Number(score) : 30;
  if (value >= 80) return {id: 'source', label: 'مصدر موثوق', next: null};
  if (value >= 60) return {id: 'trusted', label: 'موثوق', next: 'مصدر موثوق'};
  if (value >= 40) return {id: 'active', label: 'نشِط', next: 'موثوق'};
  return {id: 'new', label: 'مبتدئ', next: 'نشِط'};
}

// The reporters' week: from Saturday 00:00 to the next Saturday, in Yemen time (UTC+3), the
// week people in Yemen count by.
export function reporterWeek(now = Date.now()) {
  const local = now + 3 * HOUR, midnight = Math.floor(local / DAY) * DAY;
  const weekday = new Date(midnight).getUTCDay(); // 6 = Saturday
  const start = midnight - ((weekday + 1) % 7) * DAY - 3 * HOUR;
  return {start, end: start + 7 * DAY};
}

/**
 * The weekly board of one city: members ranked by reports that agreed with the settled price this
 * week (not by points, which stay private, and not by how many they sent). Ties go to the member
 * with fewer reports in all (more careful), then to the one who reached the count first.
 * rows: graded reports of the week [{user_id, region, agreement, created_at}] (no confirmations).
 */
export function cityBoard(rows, region, {exclude = new Set()} = {}) {
  const people = new Map();
  for (const row of rows) {
    if (row.region !== region || !row.user_id || exclude.has(row.user_id)) continue;
    const entry = people.get(row.user_id) || {userId: row.user_id, agreeing: 0, total: 0, reachedAt: 0};
    entry.total++;
    if (row.agreement === 'very_close' || row.agreement === 'close') {
      entry.agreeing++;
      entry.reachedAt = Math.max(entry.reachedAt, Date.parse(row.created_at));
    }
    people.set(row.user_id, entry);
  }
  return [...people.values()].filter(entry => entry.agreeing > 0)
    .sort((a, b) => b.agreeing - a.agreeing || a.total - b.total || a.reachedAt - b.reachedAt || a.userId.localeCompare(b.userId))
    .map((entry, index) => ({...entry, rank: index + 1}));
}

// A member's own place in the city they reported from most this week. They are counted even if
// left out of the public board, so their page looks the same either way.
export function myCityRank(rows, userId, {exclude = new Set()} = {}) {
  const mine = rows.filter(row => row.user_id === userId);
  if (!mine.length) return null;
  const counts = new Map();
  for (const row of mine) counts.set(row.region, (counts.get(row.region) || 0) + 1);
  const region = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const others = new Set([...exclude].filter(id => id !== userId));
  const board = cityBoard(rows, region, {exclude: others});
  const me = board.find(entry => entry.userId === userId);
  return {region, rank: me?.rank ?? null, of: board.length, agreeing: me?.agreeing ?? 0};
}

// The last 7 days of one price, one point per Yemen day (the price at the end of that day), for the
// small chart on the price card. history: [{value, recorded_at}] oldest or newest first, any order.
export function weekSeries(history = [], current = null, now = Date.now()) {
  const changes = history.map(row => ({value: Number(row.value), at: Date.parse(row.recorded_at)})).filter(row => row.value > 0 && Number.isFinite(row.at)).sort((a, b) => a.at - b.at);
  const points = [];
  const today = Math.floor((now + 3 * HOUR) / DAY) * DAY - 3 * HOUR;
  for (let back = 6; back >= 0; back--) {
    const end = Math.min(today + (1 - back) * DAY, now + 1);
    let value = null;
    for (const change of changes) if (change.at < end) value = change.value;
    if (back === 0 && current > 0) value = current;
    if (value !== null) points.push({day: new Date(end - 1 + 3 * HOUR).toISOString().slice(0, 10), sell: value});
  }
  return points;
}
