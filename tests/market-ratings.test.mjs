import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RATING_CRITERIA,RatingError,ratingBlocker,ratingOverall,ratingSummary,responseText,starsText,validateRating} from '../lib/market/ratings.js';
import {marketNotice} from '../lib/market/notices.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const now=Date.parse('2026-11-09T12:00:00Z');
const day=86400000;
const eligible={role:'buyer',listingStatus:'active',chatCreatedAt:new Date(now-4*day).toISOString(),sellerReplied:true,buyerWrote:true,alreadyRated:false,sellerGone:false};

test('four criteria from 1 to 5 stars, and an optional comment',()=>{
 assert.deepEqual(RATING_CRITERIA.map(item=>item.key),['accuracy','price','punctuality','manners']);
 assert.deepEqual(validateRating({accuracy:5,price:4,punctuality:'3',manners:5,comment:'  تعامل   ممتاز '}),{accuracy:5,price:4,punctuality:3,manners:5,comment:'تعامل ممتاز'});
 assert.throws(()=>validateRating({accuracy:5,price:4,punctuality:3}),error=>error instanceof RatingError&&error.field==='manners');
 assert.throws(()=>validateRating({accuracy:6,price:4,punctuality:3,manners:5}),/مطابقة الوصف/);
 assert.throws(()=>validateRating({accuracy:4.5,price:4,punctuality:3,manners:5}),/مطابقة الوصف/);
 assert.equal(validateRating({accuracy:1,price:1,punctuality:1,manners:1,comment:'x'.repeat(900)}).comment.length,600);
 assert.equal(ratingOverall({accuracy:5,price:4,punctuality:4,manners:5}),4.5);
 assert.equal(starsText(4.5),'★★★★★','rounded to whole stars');
 assert.equal(starsText(3),'★★★☆☆');
});

test('only a buyer who chatted and got a reply, after the sale or three days, once',()=>{
 assert.equal(ratingBlocker(eligible,now),null);
 assert.match(ratingBlocker({...eligible,role:'seller'},now),/للمشتري/);
 assert.match(ratingBlocker({...eligible,sellerReplied:false},now),/بعد أن يرد البائع/);
 assert.match(ratingBlocker({...eligible,buyerWrote:false},now),/بعد أن يرد البائع/);
 assert.match(ratingBlocker({...eligible,chatCreatedAt:new Date(now-2*day).toISOString()},now),/بعد بيع الإعلان، أو بعد 3 أيام/);
 assert.equal(ratingBlocker({...eligible,chatCreatedAt:new Date(now-2*day).toISOString(),listingStatus:'sold'},now),null,'a sale opens it at once');
 assert.match(ratingBlocker({...eligible,alreadyRated:true},now),/من قبل/);
 assert.match(ratingBlocker({...eligible,sellerGone:true},now),/لم يعد حساب البائع متاحًا/);
});

test('the average shows only after three ratings',()=>{
 assert.deepEqual(ratingSummary({ratings:0}),{shown:false,text:'لا توجد تقييمات بعد'});
 assert.deepEqual(ratingSummary({ratings:1,overall:2}),{shown:false,text:'تقييم واحد حتى الآن'});
 assert.deepEqual(ratingSummary({ratings:2,overall:5}),{shown:false,text:'تقييمان حتى الآن'});
 assert.deepEqual(ratingSummary({ratings:3,overall:4.67}),{shown:true,value:4.67,text:'4.7 من 5 · 3 تقييمات'});
 assert.equal(ratingSummary({ratings:12,overall:4.5}).text,'4.5 من 5 · 12 تقييمًا');
});

test('how fast a seller answers, once there are a few chats',()=>{
 assert.equal(responseText({chats:2,answered:2,response_hours:0.2}),null);
 assert.equal(responseText({chats:4,answered:4,response_hours:0.5}),'يرد خلال ساعة عادةً · يرد على 100% من الرسائل');
 assert.equal(responseText({chats:4,answered:3,response_hours:5}),'يرد خلال ساعات عادةً · يرد على 75% من الرسائل');
 assert.equal(responseText({chats:5,answered:2,response_hours:30}),'قد يتأخر في الرد · يرد على 40% من الرسائل');
 assert.equal(responseText({chats:3,answered:0,response_hours:null}),'نادرًا ما يرد · يرد على 0% من الرسائل');
});

test('rating notifications',()=>{
 const row={id:'0b8f1c2e-1111-4111-8111-111111111111',href:'/market/rate/x',created_at:'2026-11-09T10:00:00Z',read_at:null,count:1};
 assert.equal(marketNotice({...row,kind:'rate_request',subject:'تويوتا هايلكس'}).title,'قيّم البائع: «تويوتا هايلكس»');
 assert.match(marketNotice({...row,kind:'new_rating',subject:'آيفون',detail:'★★★★☆'}).description,/^★★★★☆ · /);
});

test('ratings are private to the server; one per buyer and listing; hidden ones are left out',()=>{
 const sql=read('supabase/migrations/20261109210000_market_ratings.sql');
 assert.match(sql,/alter table public\.market_ratings enable row level security/);
 assert.match(sql,/revoke all on public\.market_ratings from anon,authenticated/);
 assert.match(sql,/unique\(listing_id,buyer_id\)/);
 assert.match(sql,/buyer_id uuid references auth\.users\(id\) on delete set null/,'a deleted buyer\'s rating stays as «حساب محذوف»');
 assert.match(sql,/seller_id uuid not null references auth\.users\(id\) on delete cascade/,'a deleted seller\'s ratings disappear');
 assert.match(sql,/where seller_id=p_seller and not hidden/);
 assert.match(sql,/revoke all on function public\.market_seller_stats\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/'rate_request','new_rating'/);
 assert.match(sql,/l\.status='sold' or c\.created_at<now\(\)-interval '3 days'/,'the request follows the same rule');
 const server=read('lib/market/ratingsServer.js');
 assert.match(server,/\.eq\('seller_id',user\.id\)\.is\('reply',null\)/,'one reply, by the seller');
 assert.match(server,/if\(rating\.reported_at\)throw new MarketActionError\('NOT_ALLOWED'/,'one report per rating, by its seller');
 assert.match(server,/fileReport\(db,user,\{target:'rating',ratingId,reason,note\}\)/,'it reaches the team\'s report list');
 assert.match(server,/if\(blocker\)throw new MarketActionError\('NOT_ALLOWED',blocker\)/);
 const page=read('app/market/seller/[id]/page.jsx');
 assert.match(page,/initial=\{stats\.ratings>=MIN_RATINGS_SHOWN\?ratings:\[\]\}/,'visitors get the ratings only from three on');
 assert.match(page,/noindex:true/);
});
