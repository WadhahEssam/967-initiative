import test from 'node:test';
import assert from 'node:assert/strict';
import {isSameOrigin, readJsonObject, createTimedFetch} from '../lib/requestSecurity.js';
import {checkRoleChange} from '../lib/adminAuthorization.js';
import {validateMediaUpload} from '../lib/uploads.js';
import {csvEscape} from '../lib/yemenNumbers.js';

const url = 'https://967-initiative.vercel.app/api/contact';
test('CSV export neutralizes label formulas, preserves negative measurements and quotes carriage returns', () => {
  assert.equal(csvEscape('=1+1'), "'=1+1");
  assert.equal(csvEscape(' @SUM(A1:A2)'), "' @SUM(A1:A2)");
  assert.equal(csvEscape('-12.5'), '-12.5');
  assert.equal(csvEscape(-12.5), '-12.5');
  assert.equal(csvEscape('first\rsecond'), '"first\rsecond"');
  assert.equal(csvEscape('a,"b"'), '"a,""b"""');
});
const request = (body, headers = {}) => new Request(url, {method: 'POST', headers: {'content-type': 'application/json', ...headers}, body});

test('origin validation rejects malformed, different scheme, credentials and cross-site requests', () => {
  assert.ok(isSameOrigin(request('{}', {origin: new URL(url).origin})));
  assert.ok(isSameOrigin(request('{}')));
  for (const origin of ['null', 'not-a-url', 'http://967-initiative.vercel.app', 'https://evil.test', 'https://user:password@967-initiative.vercel.app']) assert.equal(isSameOrigin(request('{}', {origin})), false, origin);
  assert.equal(isSameOrigin(request('{}', {'sec-fetch-site': 'cross-site'})), false);
});

test('JSON reader accepts Arabic but rejects malformed values and unsupported media types', async () => {
  assert.deepEqual(await readJsonObject(request('{"name":"اسم عربي"}')), {name: 'اسم عربي'});
  for (const body of ['null', '[]', 'true', '1', '"string"', '{']) await assert.rejects(readJsonObject(request(body)), error => error.status === 400);
  await assert.rejects(readJsonObject(request('{}', {'content-type': 'text/plain'})), error => error.status === 415);
});
test('the public site address is accepted behind the proxy, nothing else is',()=>{
 // On Coolify the app sees its internal address; the browser sends the public origin.
 const behindProxy=(origin,extra={})=>new Request('http://0.0.0.0:3000/api/contact',{method:'POST',headers:{origin,host:'967ye.com','x-forwarded-proto':'https','sec-fetch-site':'same-origin',...extra}});
 assert.ok(isSameOrigin(behindProxy('https://967ye.com')));
 for(const origin of ['http://967ye.com','https://967ye.com.evil.test','https://evil.test','https://www.967ye.com','https://967ye.com/','https://user@967ye.com','null'])
  assert.equal(isSameOrigin(behindProxy(origin)),false,origin);
 assert.equal(isSameOrigin(behindProxy('https://967ye.com',{'sec-fetch-site':'cross-site'})),false);
});
test('loopback aliases require the actual matching host, scheme and port',()=>{
 const local=(origin,host,extra={})=>new Request('http://localhost:3105/api/admin/pages',{headers:{origin,host,...extra}});
 assert.ok(isSameOrigin(local('http://127.0.0.1:3105','127.0.0.1:3105')));
 for(const [origin,host] of [['http://evil.test:3105','evil.test:3105'],['http://127.0.0.1:3106','127.0.0.1:3106'],['https://127.0.0.1:3105','127.0.0.1:3105'],['http://127.0.0.1:3105','localhost:3105'],['http://127.0.0.1:3105/path','127.0.0.1:3105']])assert.equal(isSameOrigin(local(origin,host)),false);
 assert.equal(isSameOrigin(local('http://127.0.0.1:3105','127.0.0.1:3105',{'sec-fetch-site':'cross-site'})),false);
 assert.equal(isSameOrigin(new Request(url,{headers:{origin:'https://evil.test',host:'evil.test'}})),false);
});

test('body byte limit works on chunked requests without content-length and cancels the stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode('{"x":"' + 'أ'.repeat(100) + '"}')); }, cancel() { cancelled = true; }});
  const req = new Request(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: stream, duplex: 'half'});
  await assert.rejects(readJsonObject(req, 150), error => error.status === 413);
  assert.ok(cancelled);
  await assert.rejects(readJsonObject(request('{}', {'content-length': '12001'})), error => error.status === 413);
});

test('bounded fetch preserves caller cancellation and times out hung upstreams', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_input, init) => new Promise((resolve, reject) => {
    if (init.signal.aborted) reject(init.signal.reason);
    else init.signal.addEventListener('abort', () => reject(init.signal.reason), {once: true});
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(createTimedFetch(10)('https://upstream.test'), {name: 'TimeoutError'});
    const controller = new AbortController(); controller.abort();
    await assert.rejects(createTimedFetch(1000)('https://upstream.test', {signal: controller.signal}), {name: 'AbortError'});
  } finally { clearTimeout(keepAlive); globalThis.fetch = original; }
});

const actor = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
function roleDb(role, count, countError = null) {
  return {from(table) { assert.equal(table, 'editors'); return {select(_fields, options) { return {eq() { return options ? Promise.resolve({count, error: countError}) : {maybeSingle: async () => ({data: role ? {role} : null, error: null})}; }}; }}; }};
}
test('all assignment routes can block self-demotion and preserve the last manager', async () => {
  for (const nextRole of ['admin', null]) {
    await assert.rejects(checkRoleChange(roleDb('management', 2), actor, nextRole, actor));
    await assert.rejects(checkRoleChange(roleDb('management', 1), target, nextRole, actor));
    await assert.rejects(checkRoleChange(roleDb('management', null, Error('offline')), target, nextRole, actor), /offline/);
    assert.deepEqual(await checkRoleChange(roleDb('management', 2), target, nextRole, actor), {role: 'management'});
  }
  assert.deepEqual(await checkRoleChange(roleDb('admin', 1), target, 'management', actor), {role: 'admin'});
  await assert.rejects(checkRoleChange(roleDb('admin', 1), 'invalid', 'admin', actor));
});

test('upload validation rejects renamed HTML/SVG and mismatched MIME while accepting supported signatures', async () => {
  await assert.rejects(validateMediaUpload(new File(['<script>alert(1)</script>'], 'fake.png', {type: 'image/png'})));
  await assert.rejects(validateMediaUpload(new File(['<svg></svg>'], 'image.svg', {type: 'image/svg+xml'})));
  await assert.rejects(validateMediaUpload(new File(['%PDF-1.7'], 'file.pdf', {type: 'text/html'}), 'pdf'));
  assert.deepEqual(await validateMediaUpload(new File(['%PDF-1.7'], 'file.pdf', {type: 'application/pdf'}), 'pdf'), {extension: 'pdf', contentType: 'application/pdf'});
  assert.equal((await validateMediaUpload(new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'image.png', {type: 'image/png'}))).contentType, 'image/png');
});
