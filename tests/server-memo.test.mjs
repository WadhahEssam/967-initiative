// الذاكرة المؤقتة لقراءات Supabase الثقيلة: قراءة واحدة لكل فترة، ومشاركة الطلبات المتزامنة، والاحتفاظ بآخر قيمة عند الفشل.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMemo} from '../lib/serverMemo.js';

test('reads once per ttl and shares concurrent loads', async () => {
  let t = 0, calls = 0;
  const memo = createMemo({ttlMs: 1000, now: () => t});
  const load = async () => { calls++; return ['a']; };
  const [a, b] = await Promise.all([memo(load), memo(load)]);
  assert.deepEqual(a, ['a']); assert.equal(b, a); assert.equal(calls, 1);
  t = 999; await memo(load); assert.equal(calls, 1);
  t = 1000; await memo(load); assert.equal(calls, 2);
});

test('keeps the last good value while within the stale window, then fails', async () => {
  let t = 0, fail = false;
  const memo = createMemo({ttlMs: 10, staleMs: 100, now: () => t});
  const load = async () => { if (fail) throw new Error('down'); return 'good'; };
  assert.equal(await memo(load), 'good');
  fail = true; t = 50; assert.equal(await memo(load), 'good');
  t = 200; await assert.rejects(memo(load), /down/);
});

test('heavy public catalogs and settings are memoized in lib/data.js', () => {
  const data = readFileSync(new URL('../lib/data.js', import.meta.url), 'utf8');
  assert.match(data, /const statIndicatorsMemo=createMemo\(\{ttlMs:5\*60\*1000,staleMs:60\*60\*1000\}\);/);
  assert.match(data, /export const getStatIndicators = publicList\('statistics',async\(\)=>copyList\(await statIndicatorsMemo\(loadStatIndicators\)\)\);/);
  assert.match(data, /const data=await settingsMemo\(\{\r?\n\s*version:async\(\)=>settingsRowsVersion\(await readSiteSettingsRows\(db,'key,updated_at'\)\),/);
  assert.match(readFileSync(new URL('../app/api/admin/inline-quick/route.js', import.meta.url), 'utf8'), /invalidateStatCatalog\(\);/);
});
