import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHistoryCatalogCache,HISTORY_CATALOG_KEY} from '../lib/historyRepository.js';

// Fake Supabase client that records which columns each request asked for.
function fakeDb(state){
  const calls=[];
  return {calls,from(table){
    assert.equal(table,'site_settings');
    return {select(columns){return {eq(column,key){
      assert.equal(column,'key');assert.equal(key,HISTORY_CATALOG_KEY);
      return {maybeSingle:async()=>{
        calls.push(columns);
        if(state.fail)return {data:null,error:{message:'down'}};
        if(columns==='updated_at')return {data:{updated_at:state.revision},error:null};
        return {data:{key,updated_at:state.revision,value:{version:1,entries:[]}},error:null};
      }};
    }};}};
  }};
}

test('public history catalog: full fetch once, then only a tiny revision check per minute', async()=>{
  let clock=0;const state={revision:'2026-11-01T00:00:00.000Z'};const db=fakeDb(state);
  const read=createHistoryCatalogCache({checkMs:60_000,staleMs:3_600_000,now:()=>clock});
  const first=await read(db);
  assert.ok(first.entries.length>0);assert.equal(first.revision,state.revision);
  await Promise.all(Array.from({length:50},()=>read(db)));
  assert.deepEqual(db.calls,['key,value,updated_at'],'many visits inside a minute reuse one fetch');
  clock+=61_000;
  assert.equal(await read(db),first);
  assert.deepEqual(db.calls,['key,value,updated_at','updated_at'],'unchanged revision: no full fetch');
  state.revision='2026-11-02T00:00:00.000Z';clock+=61_000;
  assert.equal((await read(db)).revision,state.revision);
  assert.deepEqual(db.calls.slice(2),['updated_at','key,value,updated_at'],'changed revision: refetch once');
});

test('public history catalog: concurrent cold reads share one request, failures serve the last good copy', async()=>{
  let clock=0;const state={revision:'r1'};const db=fakeDb(state);
  const read=createHistoryCatalogCache({checkMs:60_000,staleMs:3_600_000,now:()=>clock});
  const results=await Promise.all([read(db),read(db),read(db)]);
  assert.equal(db.calls.length,1);assert.ok(results.every(x=>x===results[0]));
  state.fail=true;clock+=120_000;
  assert.equal(await read(db),results[0],'outage: stale copy');
  assert.equal(await read(db),results[0]);
  assert.equal(db.calls.length,2,'after a failed check, retry waits for the next minute');
  clock+=3_600_000;
  await assert.rejects(()=>read(db),'past staleMs the error surfaces');
});

test('clear() forces a full fetch; saving from the editor clears the public cache', async()=>{
  let clock=0;const db=fakeDb({revision:'r1'});
  const read=createHistoryCatalogCache({now:()=>clock});
  await read(db);read.clear();await read(db);
  assert.deepEqual(db.calls,['key,value,updated_at','key,value,updated_at']);
  const source=readFileSync(new URL('../lib/historyRepository.js',import.meta.url),'utf8');
  assert.match(source,/invalidatePublicHistoryCatalog\(\);\r?\n return \{entries:mergeHistoryCatalog/);
  for(const page of ['app/yemen-history/page.jsx','app/yemen-history/[slug]/page.jsx','app/yemeni-figures/[slug]/page.jsx','app/yemen-map/governorates/[id]/page.jsx','app/school/writing/musnad/page.jsx','app/sitemap.js','lib/searchData.js']){
    const text=readFileSync(new URL('../'+page,import.meta.url),'utf8');
    assert.ok(text.includes('readPublicHistoryCatalog')&&!/\breadHistoryCatalog\b/.test(text),page+' must use the cached public reader');
  }
});
