// «المُبلّغ المحلي», phase 1: the tables are closed to browsers, editor entries feed the
// computation, and nothing on the public pages reads the new tables yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const sql = read('supabase/migrations/20261112120000_price_reports.sql');

test('every new price table is closed to browsers and open to the server only', () => {
  for (const table of ['price_reports', 'price_reporters', 'price_consensus', 'price_consensus_history']) {
    assert.match(sql, new RegExp('alter table public\\.' + table + ' enable row level security;'));
    assert.match(sql, new RegExp('revoke all on public\\.' + table + ' from public,anon,authenticated;'));
    assert.match(sql, new RegExp('grant all on public\\.' + table + ' to service_role;'));
  }
  assert.doesNotMatch(sql, /grant [^;]* to (anon|authenticated)/);
});

test('reports keep no readable address: only 64-character keyed hashes', () => {
  assert.match(sql, /device_hash text check \(device_hash is null or device_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /connection_hash text check \(connection_hash is null or connection_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.doesNotMatch(sql, /\bip\b|inet/i);
});

test('reports are tied to a real instrument: currencies buy or sell, food items price', () => {
  assert.match(sql, /\(kind='rate' and item in \('USD','SAR'\) and side in \('buy','sell'\)\) or \(kind='food' and item ~ '\^\[a-z_\]\{2,40\}\$' and side='price'\)/);
  assert.match(sql, /region text not null check \(region in \('sanaa','aden'\)\)/);
});

test('saving an editor entry recomputes the prices; hiding one starts again from the entries', () => {
  for (const [file, kind] of [['lib/exchangeRatesServer.js', 'rate'], ['lib/foodPricesServer.js', 'food']]) {
    const source = read(file);
    assert.ok(source.includes("await recomputeAfterEntry(db,'" + kind + "');"), file);
    assert.ok(source.includes("await recomputeAfterEntry(db,'" + kind + "',{reset:true});"), file);
  }
  const server = read('lib/priceConsensusServer.js');
  assert.ok(server.includes("import 'server-only';"));
  // A failure there never fails the editor's save.
  assert.match(server, /export async function recomputeAfterEntry\(db,kind,\{reset=false\}=\{\}\)\{\n try\{return await recomputePrices\(db,kind,\{reset\}\);\}\n catch\{/);
  // Missing tables (code released before the migration) are not an error.
  assert.ok(server.includes('if(error instanceof MissingTables)return {changed:0,missing:true};'));
});

test('pages never read the price tables directly: only the public board (getPriceBoard)', () => {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(new URL('../' + dir, import.meta.url), {withFileTypes: true})) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(path);
    }
  };
  walk('app'); walk('components');
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /price_consensus|price_reports|price_reporters|recomputePrices|from '@\/lib\/priceConsensus'/, file);
    for (const [, names] of source.matchAll(/import \{([^}]*)\} from '@\/lib\/priceConsensusServer'/g)) for (const name of names.split(',')) assert.ok(['getPriceBoard', 'getPriceWeek'].includes(name.trim()), file + ': ' + name);
  }
});

test('every city and item has an instrument', async () => {
  const consensus = await import('../lib/priceConsensus.js');
  assert.equal(consensus.PRICE_KINDS.rate.holdBeyond, 0.07);
  assert.equal(consensus.PRICE_KINDS.food.holdBeyond, 0.15);
  const source = read('lib/priceConsensusServer.js');
  assert.ok(source.includes("RATE_REGIONS.flatMap(region=>RATE_CURRENCIES.flatMap(currency=>['buy','sell']"));
  assert.ok(source.includes("FOOD_REGIONS.flatMap(region=>FOOD_ITEMS.map(item=>({kind,region:region.id,item:item.id,side:'price'})))"));
});
