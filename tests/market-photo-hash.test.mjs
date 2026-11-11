import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {dhashFromPixels,hashDistance,photoMatchReason} from '../lib/market/photoHash.js';
import {photoHash,processListingImage} from '../lib/market/images.js';
import {CATEGORIES,categoriesInOrder,orderCategories} from '../lib/market/catalog.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// A synthetic photo: diagonal stripes and a dark square, so the hash has plenty of bits.
async function picture(width,height,{shift=0}={}){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d9c7a3"/>`
  +Array.from({length:12},(_,i)=>`<rect x="${(i*width/12+shift)%width}" y="0" width="${width/30}" height="${height}" fill="#5a3e2b" transform="rotate(12 ${width/2} ${height/2})"/>`).join('')
  +`<rect x="${width*.55}" y="${height*.2}" width="${width*.3}" height="${height*.35}" fill="#1f2a44"/><circle cx="${width*.25}" cy="${height*.7}" r="${height*.15}" fill="#f4efe6"/></svg>`;
 return sharp(Buffer.from(svg)).jpeg({quality:90}).toBuffer();
}

// As in the market: every upload goes through processListingImage, and the hash is taken from its
// thumbnail. Another seller re-uploading the listing photo (or a smaller JPEG copy of it) matches.
test('the same photo uploaded again, or as a smaller copy, keeps nearly the same hash; another photo does not',async()=>{
 const first=await processListingImage(await picture(1600,1200));
 const again=await processListingImage(first.full);
 const smaller=await processListingImage(await sharp(first.full).resize(700).jpeg({quality:60}).toBuffer());
 const other=await processListingImage(await sharp(await picture(1600,1200,{shift:300})).flop().toBuffer());
 assert.match(first.phash,/^[0-9a-f]{16}$/);
 assert.ok(hashDistance(first.phash,again.phash)<=5,'re-upload: '+hashDistance(first.phash,again.phash));
 assert.ok(hashDistance(first.phash,smaller.phash)<=5,'smaller copy: '+hashDistance(first.phash,smaller.phash));
 assert.ok(hashDistance(first.phash,other.phash)>10,'other photo: '+hashDistance(first.phash,other.phash));
});

test('flat pictures are not hashed (they would all match each other)',async()=>{
 const white=await sharp({create:{width:800,height:600,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
 assert.equal(await photoHash(white),null);
 assert.equal(dhashFromPixels(new Uint8Array(72)),null);
 assert.equal(dhashFromPixels([1,2,3]),null);
 assert.equal(hashDistance('zz','00'),null);
 assert.equal(hashDistance('ffffffffffffffff','0000000000000000'),64);
});

test('a listing using another seller\'s photo goes to review, never straight live',()=>{
 const server=read('lib/market/listingsServer.js');
 assert.match(server,/db\.rpc\('market_photo_matches',\{p_seller:sellerId,p_uploads:uploadIds\}\)/);
 assert.match(server,/if\(copies\.length\)\{base\.status='pending_review';/);
 assert.match(server,/changed\.includes\('photos'\)\?await photoMatches/);
 assert.equal(photoMatchReason([12,40]),'صورة مطابقة لصورة في إعلان بائع آخر (#12، #40)');
 const sql=read('supabase/migrations/20261111150000_market_categories_photo_hash.sql');
 assert.match(sql,/l\.seller_id <> p_seller/,'the seller\'s own photos never match');
 assert.match(sql,/grant execute on function public\.market_photo_matches\(uuid, uuid\[\], integer\) to service_role/);
 assert.match(read('app/api/market/images/route.js'),/phash:image\.phash/);
});

test('categories with more live listings come first; ties keep the catalog order',()=>{
 const keys=list=>list.map(category=>category.key);
 assert.deepEqual(keys(orderCategories({})),keys(CATEGORIES));
 const ordered=keys(orderCategories({solar:9,animals:3,[CATEGORIES[0].key]:3}));
 assert.equal(ordered[0],'solar');
 assert.deepEqual(ordered.slice(1,3),[CATEGORIES[0].key,'animals']);
 assert.equal(ordered.length,CATEGORIES.length);
 assert.deepEqual(keys(categoriesInOrder(ordered)),ordered);
 assert.deepEqual(keys(categoriesInOrder()),keys(CATEGORIES));
 assert.match(read('app/market/page.jsx'),/orderCategories\(counts\)\.map/);
 assert.match(read('components/market/PostListingWizard.jsx'),/categoriesInOrder\(defaults\?\.categoryOrder\)\.map/);
});
