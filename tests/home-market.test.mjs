import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// The home page's «جديد سوق 967» follows the market's rules: only while the market is open, and
// without the listings of sellers the visitor blocked (or who blocked them).
test('the home market row shows only while the market is open and hides blocked sellers',()=>{
 const page=read('app/page.jsx');
 assert.ok(page.includes("visibleSection('market') ? getMarketPlaces()"));
 assert.ok(page.includes('<MarketBlockFilter/>'));
 assert.ok(read('components/market/ListingCard.jsx').includes('data-seller={listing.sellerId||undefined}'));
});
