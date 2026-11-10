// Shareable result links: /share/result?k=game&g=quiz&s=8&t=10[&m=daily] or
// /share/result?k=lesson&c=<course>&l=<lesson number>&st=<stars>.
// The numbers come from the person sharing and are not verified, so the page and its image only
// show them as a challenge ("can you beat it?"); names are looked up on the server, never taken
// from the address.
export const RESULT_GAMES = ['quiz', 'place', 'timeline', 'map', 'bigger', 'connect', 'object', 'who', 'yemenword'];
const SLUG = /^[a-z][a-z0-9-]{2,39}$/;
const int = (value, min, max) => {
  const number = Number(value);
  return /^\d{1,3}$/.test(String(value ?? '')) && number >= min && number <= max ? number : null;
};

export function parseResultShare(params) {
  const get = key => (typeof params?.get === 'function' ? params.get(key) : params?.[key]);
  const one = key => { const value = get(key); return Array.isArray(value) ? value[0] : value; };
  if (one('k') === 'game') {
    const game = one('g'), score = int(one('s'), 0, 100), total = int(one('t'), 1, 100);
    if (!RESULT_GAMES.includes(game) || score === null || total === null || score > total) return null;
    return {kind: 'game', game, score, total, daily: one('m') === 'daily'};
  }
  if (one('k') === 'lesson') {
    const course = one('c'), lesson = int(one('l'), 1, 12), stars = int(one('st'), 1, 3);
    if (!SLUG.test(course || '') || lesson === null || stars === null) return null;
    return {kind: 'lesson', course, lesson, stars};
  }
  return null;
}

export function resultShareQuery(result) {
  const params = result.kind === 'game'
    ? {k: 'game', g: result.game, s: result.score, t: result.total, ...(result.daily ? {m: 'daily'} : {})}
    : {k: 'lesson', c: result.course, l: result.lesson, st: result.stars};
  return new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
}
export const resultSharePath = result => parseResultShare(Object.fromEntries(new URLSearchParams(resultShareQuery(result)))) ? '/share/result?' + resultShareQuery(result) : null;
export const resultShareImagePath = result => '/share/result/image?' + resultShareQuery(result);
