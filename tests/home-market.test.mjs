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

// Phone LCP on the home page (2026-11-11, 12.3 s on slow 4G): the lead photo was a 185 KB WebP fetched at
// low priority while below-the-fold market thumbnails were preloaded at high priority.
test('the home lead photo loads first and light, the market row waits for the scroll',()=>{
 assert.match(read('next.config.mjs'),/formats: \['image\/avif', 'image\/webp'\]/);
 assert.ok(read('components/front/SafeImage.jsx').includes("fetchPriority={priority ? 'high' : undefined}"));
 assert.ok(read('app/page.jsx').includes('{listings.map(item => <ListingCard key={item.id} listing={item}/>)}'),'home cards use the default lazy index');
});
