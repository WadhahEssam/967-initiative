// Supabase load reduction: versioned caches for settings and directory lists, and figure profiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVersionedMemo, settingsRowsVersion} from '../lib/serverMemo.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function harness(options = {}) {
  let t = 0, version = 'v1', loads = 0, checks = 0, failVersion = false, failLoad = false;
  const memo = createVersionedMemo({checkMs: 30, now: () => t, ...options});
  const source = {
    version: async () => { checks++; if (failVersion) throw new Error('version down'); return version; },
    load: async () => { loads++; if (failLoad) throw new Error('load down'); return {value: 'value-' + version, version}; },
  };
  return {
    get: () => memo(source), memo,
    tick: ms => { t += ms; }, setVersion: v => { version = v; },
    fail: (v, l) => { failVersion = v; failLoad = l; },
    counts: () => ({loads, checks}),
  };
}

test('versioned memo: loads once, checks the version after checkMs, reloads only on change', async () => {
  const h = harness();
  assert.equal(await h.get(), 'value-v1');
  assert.equal(await h.get(), 'value-v1');
  assert.deepEqual(h.counts(), {loads: 1, checks: 0});
  h.tick(31);
  assert.equal(await h.get(), 'value-v1');
  assert.deepEqual(h.counts(), {loads: 1, checks: 1}, 'unchanged version: no full read');
  h.tick(31); h.setVersion('v2');
  assert.equal(await h.get(), 'value-v2');
  assert.deepEqual(h.counts(), {loads: 2, checks: 2});
  h.memo.clear();
  assert.equal(await h.get(), 'value-v2');
  assert.deepEqual(h.counts(), {loads: 3, checks: 2}, 'clear forces a full read');
});

test('versioned memo: maxAgeMs forces a full read even when the version did not change', async () => {
  const h = harness({maxAgeMs: 100});
  await h.get();
  h.tick(50); await h.get();
  assert.equal(h.counts().loads, 1);
  h.tick(60); await h.get();
  assert.equal(h.counts().loads, 2);
});

test('versioned memo: concurrent callers share one read; failures use the stale copy only within staleMs', async () => {
  const h = harness({staleMs: 100});
  const [a, b] = await Promise.all([h.get(), h.get()]);
  assert.equal(a, b);
  assert.equal(h.counts().loads, 1);
  h.tick(31); h.fail(true, true);
  assert.equal(await h.get(), 'value-v1', 'stale copy served');
  h.tick(200);
  await assert.rejects(h.get(), /down/);
  const fresh = harness();
  fresh.fail(false, true);
  await assert.rejects(fresh.get(), /load down/, 'nothing cached yet: the error reaches the caller');
});

test('settings version changes when a row is saved, added or removed', () => {
  const rows = [{key: 'b', updated_at: '2026-11-01'}, {key: 'a', updated_at: '2026-11-02'}];
  const base = settingsRowsVersion(rows);
  assert.equal(settingsRowsVersion([...rows].reverse()), base, 'order does not matter');
  assert.notEqual(settingsRowsVersion([rows[0], {key: 'a', updated_at: '2026-11-03'}]), base);
  assert.notEqual(settingsRowsVersion(rows.slice(1)), base);
  assert.notEqual(settingsRowsVersion([...rows, {key: 'c', updated_at: '2026-11-01'}]), base);
  assert.equal(settingsRowsVersion(null), '');
});

test('figure profiles are cached by their immutable path, within a size budget, as copies', async () => {
  // The repository imports server-only helpers indirectly, so check its source and test the
  // cache with an injected reader.
  const source = read('lib/figureProfileRepository.js');
  assert.match(source, /export function createFigureProfileCache/);
  const {createFigureProfileCache} = await import('../lib/figureProfileRepository.js');
  let reads = 0;
  const record = n => ({id: '00000000-0000-4000-8000-00000000000' + n, updated_at: '2026-11-0' + n + 'T00:00:00Z'});
  const cacheRead = createFigureProfileCache({budget: 60, read: async (_db, r) => { reads++; return r.id.endsWith('9') ? null : {sections: [{t: 'x'.repeat(10) + r.id.slice(-1)}]}; }});
  const first = await cacheRead(null, record(1));
  first.sections[0].t = 'changed';
  const again = await cacheRead(null, record(1));
  assert.equal(reads, 1);
  assert.notEqual(again.sections[0].t, 'changed', 'callers cannot change the cached copy');
  assert.equal(await cacheRead(null, record(9)), null);
  assert.equal(await cacheRead(null, record(9)), null);
  assert.equal(reads, 2, 'a missing profile is cached too');
  await cacheRead(null, {...record(1), updated_at: '2026-11-05T00:00:00Z'});
  assert.equal(reads, 3, 'a saved edit has a new path');
  await cacheRead(null, record(2)); await cacheRead(null, record(3));
  await cacheRead(null, record(1));
  assert.equal(reads, 6, 'the oldest entries leave once the budget is used');
});

test('public readers use the caches and admin saves clear them', () => {
  const data = read('lib/data.js');
  assert.match(data, /const settingsMemo=createVersionedMemo\(\{checkMs:30\*1000,maxAgeMs:15\*60\*1000\}\);/);
  for (const [name, table] of [['getYemeniCompanies', 'yemeni_companies'], ['getUniversities', 'universities'], ['getMedicalCenters', 'medical_centers'], ['getYemeniFigures', 'yemeni_figures']])
    assert.match(data, new RegExp('export const ' + name + ' = publicList\\(\'\\w+\',cachedDirectoryList\\(\'' + table + '\''));
  assert.match(data, /return structuredClone\(rows\);/);
  assert.match(data, /profile:await readPublicFigureProfile\(db,data\)/);
  assert.match(read('app/api/admin/pages/route.js'), /invalidateSiteSettings\(\);/);
  assert.match(read('app/api/admin/page-visibility/route.js'), /invalidateSiteSettings\(\);/);
  assert.match(read('app/api/admin/figures/route.js'), /invalidateDirectoryLists\(\);[^]*invalidateDirectoryLists\(\);/);
  assert.match(read('app/api/admin/inline-quick/route.js'), /invalidateDirectoryLists\(\);\r?\n\s*return json\(\{ok:true,item:data\}\);/);
  const map = read('lib/mapProfileRepository.js');
  assert.match(map, /publicMapProfilesMemo\.clear\(\);\r?\n return \{\.\.\.current,item,revision:result\.revision\};/);
  assert.match(read('components/Header.jsx'), /const cached = readEditorFlag\(session\.user\.id\);/);
});

test('the home page latest indicators are cached and cleared with the statistics catalog', () => {
  const data = read('lib/data.js');
  assert.match(data, /export const getRecentIndicators=publicList\('statistics',cachedRecentIndicators\);/);
  assert.match(data, /if\(!memo\)\{memo=createMemo\(\{ttlMs:5\*60\*1000,staleMs:60\*60\*1000\}\);recentIndicatorsMemos\.set\(key,memo\);\}/);
  assert.match(data, /export function invalidateStatCatalog\(\)\{statIndicatorsMemo\.clear\(\);statSectionsMemo\.clear\(\);recentIndicatorsMemos\.clear\(\);\}/);
});
