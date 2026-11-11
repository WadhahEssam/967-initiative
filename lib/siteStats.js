// «إحصاءات الموقع»: shared rules for the browser tracker, /api/analytics/collect and the dashboard.
// Privacy: only a random visitor id, a random visit id, a normalized path and categories are kept.
// No IP address, user agent, query string, referrer URL or account id leaves this module.

export const ID_PATTERN = /^[a-z0-9]{16,32}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VISIT_IDLE_MS = 30 * 60 * 1000;
export const PING_MS = 2 * 60 * 1000;
export const MAX_DURATION_MS = 30 * 60 * 1000;

// Never counted: the editors' tools and the API.
const EXCLUDED = /^\/(admin|api|auth|school\/studio)(\/|$)/;
// Private or personal pages: kept as one entry, without the id in the path.
const COLLAPSED = [
  [/^\/(account|messages|notifications|read-later)(\/|$)/, match => '/' + match[1]],
  [/^\/members\/[^/]+/, () => '/members/:id'],
  [/^\/market\/seller\/[^/]+/, () => '/market/seller/:id'],
  [/^\/market\/(mine|favourites|saved-searches|notices|rate)(\/|$)/, match => '/market/' + match[1]],
  [/^\/share\/[^/]+/, match => match[0]],
];

export function statsPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) return null;
  let path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (EXCLUDED.test(path)) return null;
  for (const [pattern, replace] of COLLAPSED) {
    const match = path.match(pattern);
    if (match) { path = replace(match); break; }
  }
  if (path.length > 200 || /[\s\u0000-\u001f]/.test(path)) return null;
  return path;
}

const SOURCE_HOSTS = [
  ['google', /(^|\.)google\.[a-z.]+$/],
  ['bing', /(^|\.)bing\.com$/],
  ['search', /(^|\.)(duckduckgo\.com|yahoo\.com|yandex\.[a-z.]+|baidu\.com|ecosia\.org|brave\.com|qwant\.com)$/],
  ['whatsapp', /(^|\.)(whatsapp\.com|whatsapp\.net|wa\.me)$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['x', /(^|\.)(x\.com|twitter\.com|t\.co)$/],
  ['telegram', /(^|\.)(t\.me|telegram\.org|telegram\.me)$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['linkedin', /(^|\.)(linkedin\.com|lnkd\.in)$/],
];
const UTM_SOURCES = {google: 'google', whatsapp: 'whatsapp', wa: 'whatsapp', facebook: 'facebook', fb: 'facebook', instagram: 'instagram', ig: 'instagram', x: 'x', twitter: 'x', telegram: 'telegram', tg: 'telegram', youtube: 'youtube', tiktok: 'tiktok', linkedin: 'linkedin', share: 'share'};
export const SOURCES = ['direct', 'google', 'bing', 'search', 'whatsapp', 'facebook', 'instagram', 'x', 'telegram', 'youtube', 'tiktok', 'linkedin', 'share', 'other'];

// Only the category is kept: the referrer host itself is not stored.
export function sourceCategory({host = '', utm = '', siteHost = '', shared = false} = {}) {
  const tag = String(utm || '').toLowerCase().trim();
  if (UTM_SOURCES[tag]) return UTM_SOURCES[tag];
  if (shared) return 'share';
  const clean = String(host || '').toLowerCase().trim().replace(/^www\./, '');
  if (!clean || (siteHost && clean === String(siteHost).toLowerCase().replace(/^www\./, ''))) return 'direct';
  // Android apps open links with an android-app:// referrer (for example com.whatsapp).
  if (/whatsapp/.test(clean)) return 'whatsapp';
  if (/(^|\.)com\.facebook|facebook/.test(clean)) return 'facebook';
  if (/telegram/.test(clean)) return 'telegram';
  if (/googlequicksearchbox|com\.google/.test(clean)) return 'google';
  for (const [id, pattern] of SOURCE_HOSTS) if (pattern.test(clean)) return id;
  return 'other';
}

// Read from the user agent on the server, which is then discarded.
export function deviceFromAgent(agent = '') {
  const ua = String(agent);
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'phone';
  return 'desktop';
}
export function osFromAgent(agent = '') {
  const ua = String(agent);
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux|CrOS/i.test(ua)) return 'linux';
  return 'other';
}
// Crawlers, link previews and automated browsers (our own checks included) are not visitors.
export function isAutomatedAgent(agent = '') {
  const ua = String(agent);
  return !ua || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp\/|python|curl|wget|node-fetch|undici|axios|playwright|puppeteer|phantom|monitor/i.test(ua);
}

const cleanTitle = value => typeof value === 'string' ? value.replace(/\s*\|\s*مبادرة 967\s*$/, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160) : '';

// Validates what the browser sends. Returns the call to make, or null to ignore the request.
export function collectEvent(body, {agent = '', siteHost = ''} = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || isAutomatedAgent(agent)) return null;
  const {t} = body;
  if (!ID_PATTERN.test(body.v || '')) return null;
  if (t === 'view') {
    const path = statsPath(body.p);
    const seq = Number(body.q);
    if (!path || !UUID_PATTERN.test(body.id || '') || !ID_PATTERN.test(body.s || '') || !Number.isInteger(seq) || seq < 1 || seq > 5000) return null;
    return {fn: 'analytics_record_view', args: {
      p_id: body.id, p_visitor: body.v, p_session: body.s, p_path: path, p_title: cleanTitle(body.ti), p_seq: seq,
      p_new: body.n === true, p_member: body.m === true,
      p_source: seq === 1 ? sourceCategory({host: body.r, utm: body.u, siteHost, shared: body.sh === true}) : 'direct',
      p_device: deviceFromAgent(agent), p_os: osFromAgent(agent), p_theme: ['dark', 'light'].includes(body.th) ? body.th : null,
    }};
  }
  if (t === 'time') {
    const ms = Math.round(Number(body.ms));
    if (!UUID_PATTERN.test(body.id || '') || !Number.isFinite(ms) || ms < 0) return null;
    return {fn: 'analytics_record_time', args: {p_id: body.id, p_visitor: body.v, p_duration_ms: Math.min(ms, MAX_DURATION_MS), p_title: cleanTitle(body.ti)}};
  }
  if (t === 'ping') {
    const path = statsPath(body.p);
    if (!path || !ID_PATTERN.test(body.s || '')) return null;
    return {fn: 'analytics_ping', args: {p_session: body.s, p_visitor: body.v, p_path: path, p_device: deviceFromAgent(agent)}};
  }
  return null;
}

// ---- Dashboard ranges (Yemen days) ----
export const RANGES = {today: 'اليوم', yesterday: 'أمس', '7d': 'آخر 7 أيام', '30d': 'آخر 30 يومًا', year: 'آخر سنة'};
export function yemenDay(now = new Date()) {
  return new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
const shift = (day, days) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
// The range and the one before it, of the same length (for the comparison).
export function statsRange(id, now = new Date()) {
  const today = yemenDay(now);
  const spans = {today: [0, 0], yesterday: [-1, -1], '7d': [-6, 0], '30d': [-29, 0], year: [-364, 0]};
  const span = spans[id];
  if (!span) return null;
  const from = shift(today, span[0]), to = shift(today, span[1]);
  const length = span[1] - span[0] + 1;
  return {id, from, to, previous: {from: shift(from, -length), to: shift(from, -1)}};
}
export function changePercent(current, previous) {
  const now = Number(current) || 0, before = Number(previous) || 0;
  if (!before) return null;
  return Math.round((now - before) / before * 100);
}
