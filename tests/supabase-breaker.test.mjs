// Circuit breaker for Supabase: while it is down, the server stops trying on every request,
// waits longer after each failed test, and lets a single request test it at a time.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCircuitBreaker, guardFetch, SupabaseUnavailableError, supabaseBreaker} from '../lib/supabaseBreaker.js';

const answer = status => async () => new Response('', {status});
const networkDown = async () => { throw new TypeError('fetch failed'); };

test('opens after three failures in a row and then fails at once without calling Supabase', async () => {
  let t = 0, calls = 0;
  const breaker = createCircuitBreaker({threshold: 3, baseMs: 10_000, now: () => t});
  const fetch = guardFetch(async () => { calls++; return new Response('', {status: 521}); }, breaker);
  for (let i = 0; i < 3; i++) assert.equal((await fetch('x')).status, 521);
  assert.equal(breaker.status().state, 'open');
  await assert.rejects(fetch('x'), SupabaseUnavailableError);
  t = 9_999; await assert.rejects(fetch('x'), SupabaseUnavailableError);
  assert.equal(calls, 3);
});

test('any reachable answer, 4xx included, resets the count', async () => {
  const breaker = createCircuitBreaker({threshold: 3});
  await guardFetch(networkDown, breaker)('x').catch(() => {});
  await guardFetch(networkDown, breaker)('x').catch(() => {});
  await guardFetch(answer(404), breaker)('x');
  await guardFetch(networkDown, breaker)('x').catch(() => {});
  await guardFetch(answer(500), breaker)('x');
  assert.equal(breaker.status().state, 'closed');
  assert.equal(breaker.status().failures, 0);
});

test('after the wait one request tests Supabase; a failure doubles the wait, up to the limit', async () => {
  let t = 0;
  const breaker = createCircuitBreaker({threshold: 1, baseMs: 10_000, maxMs: 30_000, now: () => t});
  const down = guardFetch(answer(503), breaker);
  await down('x');
  t = 10_000; await down('x');
  assert.equal(breaker.status().retryInMs, 20_000);
  t = 30_000; await down('x');
  assert.equal(breaker.status().retryInMs, 30_000);
  t = 60_000; await down('x');
  assert.equal(breaker.status().retryInMs, 30_000);
});

test('only one test request at a time; its success closes the breaker and resets the wait', async () => {
  let t = 0, release;
  const breaker = createCircuitBreaker({threshold: 1, baseMs: 1_000, now: () => t});
  await guardFetch(networkDown, breaker)('x').catch(() => {});
  t = 1_000;
  const slow = guardFetch(() => new Promise(resolve => { release = () => resolve(new Response('[]', {status: 200})); }), breaker)('x');
  await assert.rejects(guardFetch(answer(200), breaker)('x'), SupabaseUnavailableError);
  release(); await slow;
  assert.equal(breaker.status().state, 'closed');
  await guardFetch(networkDown, breaker)('x').catch(() => {});
  assert.equal(breaker.status().retryInMs, 1_000);
});

test('a request the caller cancelled is not counted as a failure', async () => {
  const breaker = createCircuitBreaker({threshold: 1});
  const aborted = async () => { throw new DOMException('left the page', 'AbortError'); };
  await assert.rejects(guardFetch(aborted, breaker)('x'));
  assert.equal(breaker.status().state, 'closed');
  const timedOut = async () => { throw new DOMException('too slow', 'TimeoutError'); };
  await assert.rejects(guardFetch(timedOut, breaker)('x'));
  assert.equal(breaker.status().state, 'open');
});

test('one shared breaker per process, and every Supabase client uses it without built-in retries', () => {
  assert.equal(supabaseBreaker(), supabaseBreaker());
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(read('lib/requestSecurity.js'), /const guarded = guardFetch\(/);
  assert.match(read('lib/supabase-server.js'), /db: \{retry: false\}/);
  assert.equal(read('lib/supabase.js').match(/db:\{retry:false\}/g)?.length, 2);
  assert.match(read('lib/taskServer.js'), /db:\{retry:false\}/);
});

test('createTimedFetch goes through the shared breaker', async () => {
  const {createTimedFetch} = await import('../lib/requestSecurity.js');
  const original = globalThis.fetch;
  const breaker = supabaseBreaker();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', {status: 521}); };
  try {
    const timed = createTimedFetch(1000);
    for (let i = 0; i < 3; i++) await timed('https://example.supabase.co/rest/v1/x');
    await assert.rejects(timed('https://example.supabase.co/rest/v1/x'), SupabaseUnavailableError);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = original;
    breaker.success({probe: true});
  }
});
