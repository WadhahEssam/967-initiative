import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatPrice,listingPath,normalizeYemeniMobile,timeAgo,whatsappLink} from '../lib/market/format.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('prices use western digits, grouping and the short currency name',()=>{
 assert.equal(formatPrice(8500,'USD'),'8,500 $');
 assert.equal(formatPrice('1200000','YER_OLD'),'1,200,000 ر.ي');
 assert.equal(formatPrice(null,'USD'),'');
 assert.equal(listingPath(42),'/market/42');
});

test('time since publishing reads naturally in Arabic',()=>{
 const now=Date.parse('2026-11-09T12:00:00Z'),ago=ms=>new Date(now-ms).toISOString();
 assert.equal(timeAgo(ago(20000),now),'الآن');
 assert.equal(timeAgo(ago(2*60000),now),'منذ دقيقتين');
 assert.equal(timeAgo(ago(5*60000),now),'منذ 5 دقائق');
 assert.equal(timeAgo(ago(3600000),now),'منذ ساعة');
 assert.equal(timeAgo(ago(3*86400000),now),'منذ 3 أيام');
 assert.equal(timeAgo(ago(15*86400000),now),'منذ 15 يومًا');
 assert.equal(timeAgo('not a date',now),'');
});

test('Yemeni mobile numbers are stored as 9 digits without the country code',()=>{
 for(const value of ['771234567','0771234567','+967 771 234 567','00967771234567','٧٧١٢٣٤٥٦٧','733-123-456'])assert.match(normalizeYemeniMobile(value)||'',/^7[0-9]{8}$/,value);
 for(const value of ['','12345','751234567','7712345678','+966501234567','01234567'])assert.equal(normalizeYemeniMobile(value),null,value);
 assert.equal(whatsappLink('771234567','مرحبًا'),'https://wa.me/967771234567?text='+encodeURIComponent('مرحبًا'));
});

test('the phone number and terms acceptances are private to the server',()=>{
 const sql=read('supabase/migrations/20261109150000_market_posting.sql');
 assert.match(sql,/market_seller_contacts[\s\S]*enable row level security/);
 assert.match(sql,/revoke all on public\.market_seller_contacts,public\.market_terms_acceptances from anon,authenticated/);
 assert.match(sql,/revoke all on function public\.market_count_view\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.market_count_view\(uuid\) to service_role/);
 assert.match(sql,/phone ~ '\^7\[01378\]\[0-9\]\{7\}\$'/);
});

test('publishing checks terms, phone, daily limits and duplicates, and attaches photos first',()=>{
 const source=read('lib/market/listingsServer.js');
 const body=source.slice(source.indexOf('export async function publishListing'),source.indexOf('export async function getOwnDraft'));
 const order=['TERMS_REQUIRED','PHONE_REQUIRED','DAILY_LIMIT','CONFIRM_GENUINE','DUPLICATE','reviewReason','promoteUploads','market_listings\').insert','linkUploads'].map(word=>body.indexOf(word));
 for(const at of order)assert.ok(at>0);
 assert.deepEqual([...order].sort((a,b)=>a-b),order,'checks run in the expected order');
 assert.match(body,/complete:true/);
 assert.match(source,/DAILY_LISTINGS=\{base:5,confirmed:10\}/);
});

test('the market API only serves members while the market is hidden',()=>{
 const route=read('app/api/market/listings/route.js');
 assert.match(route,/marketMember\(request\)/);
 assert.doesNotMatch(route,/export const (?!dynamic|runtime)/);
 const layout=read('app/market/layout.jsx');
 assert.match(layout,/sectionGate\('market',/);
 assert.match(layout,/notFound\(\)/);
});

test('the listing page never shows hidden sellers or contact details',()=>{
 const source=read('lib/market/listingsServer.js');
 const body=source.slice(source.indexOf('export async function getPublicListing'),source.indexOf('export async function similarListings'));
 assert.match(body,/suspended\|\|profile\.data\?\.deletion_requested_at\)return null/);
 assert.match(body,/row\.show_whatsapp\?contact\.data\?\.phone\|\|null:null/);
 const page=read('app/market/[number]/page.jsx');
 assert.match(page,/isBotAgent/);
 assert.match(page,/market_count_view/);
});
