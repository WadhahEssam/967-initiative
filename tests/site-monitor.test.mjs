import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// The hourly live check must keep covering what broke silently before (same-site POSTs refused
// behind the proxy on 2026-11-10) and must stay read-only.
test('the live site monitor covers health, pages, details routes and same-site POSTs', () => {
  const script = read('scripts/site-monitor.mjs');
  for (const path of ['/api/health', '/api/contact', '/api/analytics/event', '/api/telemetry', '/api/history/details', '/api/figures/details',
    '/api/numbers/details', '/api/directories/details?kind=universities', '/yemen-history', '/yemen-ranking', '/universities',
    '/market', '/services/exchange-rates', '/services/food-prices', '/transactions', '/transactions/passport'])
    assert.ok(script.includes(`'${path}'`), path);
  assert.ok(script.includes("body: '{}'"), 'POST probes send an empty body that validation rejects');
  assert.ok(script.includes('r.status === 400'), '400 is the healthy answer to an empty POST');
  assert.doesNotMatch(script, /method: '(PUT|PATCH|DELETE)'/);
});

test('the monitor runs every hour and raises one self-closing issue', () => {
  const workflow = read('.github/workflows/site-monitor.yml');
  assert.match(workflow, /cron: '7 \* \* \* \*'/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /gh issue create/);
  assert.match(workflow, /gh issue close/);
  assert.match(workflow, /problems:%s/, 'comments only when the problems change');
});
