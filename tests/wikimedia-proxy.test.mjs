import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canOptimizeImage,commonsFileAt,servedImageUrl} from '../lib/media.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Wikimedia is hard to reach from Yemen (2026-11-11): the reader's browser never loads a Commons
// file directly; our server fetches it (/_next/image, kept 7 days) and serves it from 967ye.com.
test('any Commons file becomes a sized Special:FilePath link, served from our own address',()=>{
 const svg='https://upload.wikimedia.org/wikipedia/commons/5/5c/Arabic_calligraphy_thuluth.svg';
 assert.equal(commonsFileAt(svg,800),'https://commons.wikimedia.org/wiki/Special:FilePath/Arabic_calligraphy_thuluth.svg?width=800');
 assert.equal(commonsFileAt('https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/A_b.jpg/960px-A_b.jpg',640),'https://commons.wikimedia.org/wiki/Special:FilePath/A_b.jpg?width=640');
 assert.equal(commonsFileAt('https://commons.wikimedia.org/wiki/Special:FilePath/Zuqar.jpg?width=960',480),'https://commons.wikimedia.org/wiki/Special:FilePath/Zuqar.jpg?width=480');
 assert.equal(commonsFileAt('https://example.com/a.jpg'),null);
 // An SVG at a width comes back from Commons as a PNG, which the optimizer accepts.
 assert.ok(canOptimizeImage(commonsFileAt(svg,800)));
 assert.equal(canOptimizeImage(svg),false);
 const served=servedImageUrl(svg,800);
 assert.ok(served.startsWith('/_next/image?url='+encodeURIComponent('https://commons.wikimedia.org/wiki/Special:FilePath/')));
 assert.match(served,/&w=828&q=75$/);
 assert.equal(servedImageUrl('/images/a.png'),'/images/a.png');
 assert.equal(servedImageUrl('https://example.com/a.jpg'),'https://example.com/a.jpg');
 assert.equal(servedImageUrl('javascript:alert(1)'),'');
});

test('no component loads Commons pictures straight from Wikimedia',()=>{
 assert.doesNotMatch(read('components/history/HistoryMedia.jsx'),/unoptimized/);
 assert.match(read('components/school/CalligraphyExample.jsx'),/src=\{servedImageUrl\(reference\.image,828\)\}/);
 assert.match(read('components/school/v2/CardVisual.jsx'),/src=\{servedImageUrl\(visual\.src,828\)\}/);
 assert.match(read('components/yemen-map/RegionInfoPanel.jsx'),/src=\{servedImageUrl\(profile\.image_url,480\)\}/);
 assert.match(read('components/YemeniProductDirectory.jsx'),/unoptimized=\{!canOptimizeImage\(company\.imageUrl\)\}/);
 assert.match(read('app/yemeni-products/[id]/page.jsx'),/unoptimized=\{!canOptimizeImage\(company\.imageUrl\)\}/);
 assert.match(read('components/front/SafeImage.jsx'),/const safe = commonsFileAt\(given, 1200\) \|\| given;/);
});
