#!/usr/bin/env node
// Hourly check of the live site (.github/workflows/site-monitor.yml). Read-only: same-site POSTs
// carry an empty body that every endpoint rejects with 400 before saving anything.
//
//   node scripts/site-monitor.mjs                    checks https://967ye.com
//   node scripts/site-monitor.mjs --base=http://localhost:3080
//   node scripts/site-monitor.mjs --report=report.json   also writes the results as JSON
//
// Exit code 1 when any check still fails after one retry. Why each check exists:
// - pages: each public section answers 200 with the site shell, in reasonable time;
// - same-site POSTs: on 2026-11-10 every one was refused with 403 behind the proxy for days
//   (contact form, analytics, telemetry), and nothing showed it;
// - details routes: the light list pages fetch their summaries from these after load;
// - fonts: a missing font file silently changes every page.
import {writeFileSync} from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const BASE = (args.base || 'https://967ye.com').replace(/\/$/, '');
const SLOW_MS = 15000;
const TIMEOUT_MS = 30000;
const RETRY_AFTER_MS = 20000;
const userAgent = '967-site-monitor (GitHub Actions)';

const pages = ['/', '/yemen-history', '/yemeni-figures', '/universities', '/medical-centers', '/yemen-in-numbers',
  '/yemen-in-numbers/timeline', '/yemen-ranking', '/yemen-map', '/games', '/school', '/debates', '/search', '/contribute', '/about'];
const detailRoutes = ['/api/history/details', '/api/figures/details', '/api/numbers/details',
  '/api/directories/details?kind=universities', '/api/directories/details?kind=medical-centers'];
const sameSitePosts = ['/api/contact', '/api/analytics/event', '/api/telemetry'];

async function request(path, init = {}) {
  const started = Date.now();
  const response = await fetch(BASE + path, {redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init,
    headers: {'user-agent': userAgent, ...(init.headers || {})}});
  const body = await response.text();
  return {status: response.status, body, ms: Date.now() - started, type: response.headers.get('content-type') || ''};
}

const checks = [
  {name: 'health', run: async () => {
    const r = await request('/api/health');
    return r.status === 200 && /"ok":true/.test(r.body) ? null : `status ${r.status}: ${r.body.slice(0, 80)}`;
  }},
  ...pages.map(path => ({name: 'page ' + path, run: async () => {
    const r = await request(path);
    if (r.status !== 200) return `status ${r.status}`;
    if (!r.body.includes('<html') || !r.body.includes('/_next/static/')) return 'the page did not return the site shell';
    if (r.ms > SLOW_MS) return `slow: ${(r.ms / 1000).toFixed(1)} s`;
    return null;
  }})),
  ...detailRoutes.map(path => ({name: 'details ' + path, run: async () => {
    const r = await request(path);
    if (r.status !== 200) return `status ${r.status}`;
    try { return Object.keys(JSON.parse(r.body).details || {}).length > 0 ? null : 'empty details'; }
    catch { return 'not JSON'; }
  }})),
  ...sameSitePosts.map(path => ({name: 'same-site POST ' + path, run: async () => {
    const r = await request(path, {method: 'POST', body: '{}', headers: {
      'content-type': 'application/json', origin: BASE, 'sec-fetch-site': 'same-origin'}});
    // 400 means the request reached validation; 403 means the site refuses its own pages.
    return r.status === 400 ? null : `expected 400 (validation), got ${r.status}`;
  }})),
  {name: 'fonts', run: async () => {
    const home = await request('/');
    const fonts = [...new Set(home.body.match(/\/fonts\/[\w-]+\.woff2/g) || [])];
    if (!fonts.length) return 'no preloaded font found on the home page';
    for (const font of fonts) {
      const r = await request(font);
      if (r.status !== 200) return `${font}: status ${r.status}`;
    }
    return null;
  }},
];

async function runCheck(check) {
  try { return await check.run(); } catch (error) { return error.name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000} s` : String(error.message || error); }
}

const results = [];
for (const check of checks) results.push({name: check.name, problem: await runCheck(check)});
const failing = results.filter(result => result.problem);
if (failing.length) {
  // One retry for everything that failed, so a deploy switching over is not reported.
  await new Promise(resolve => setTimeout(resolve, RETRY_AFTER_MS));
  for (const result of failing) result.problem = await runCheck(checks.find(check => check.name === result.name));
}
const problems = results.filter(result => result.problem);
for (const result of results) console.log((result.problem ? 'FAIL ' : 'ok   ') + result.name + (result.problem ? ' — ' + result.problem : ''));
console.log(problems.length ? `\n${problems.length} of ${results.length} checks failed on ${BASE}` : `\nAll ${results.length} checks passed on ${BASE}`);
if (args.report) writeFileSync(args.report, JSON.stringify({base: BASE, checkedAt: new Date().toISOString(), results, problems}, null, 1));
process.exitCode = problems.length ? 1 : 0;
