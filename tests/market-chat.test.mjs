import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ChatError,canAnswerOffer,chatRole,listingOpenForChat,listingTakesOffers,messageText,offerStatus,offerSuggestions,roundAmount,validateCounter,validateOffer} from '../lib/market/chat.js';
import {messageBadgeCount} from '../lib/messageBadge.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('ready-made offers are 5, 10 and 15% below the price, rounded',()=>{
 assert.deepEqual(offerSuggestions(8500),[{percent:5,amount:8080},{percent:10,amount:7650},{percent:15,amount:7230}]);
 assert.deepEqual(offerSuggestions(1200000).map(item=>item.amount),[1140000,1080000,1020000]);
 assert.deepEqual(offerSuggestions(0),[]);
 assert.equal(roundAmount(349.6,350),350);
});

test('an offer is at least half the price and not above it',()=>{
 assert.equal(validateOffer('٧٬٠٠٠',8500),7000);
 assert.equal(validateOffer('4250',8500),4250);
 assert.throws(()=>validateOffer('4249',8500),error=>error instanceof ChatError&&/نصف سعر الإعلان \(4,250\)/.test(error.message));
 assert.throws(()=>validateOffer('9000',8500),/أعلى من سعر الإعلان/);
 assert.throws(()=>validateOffer('abc',8500),/بالأرقام/);
 assert.throws(()=>validateOffer('0',8500),/بالأرقام/);
});

test('a counter-price is above the buyer\'s offer and not above the listing price',()=>{
 assert.equal(validateCounter('8000',7000,8500),8000);
 assert.throws(()=>validateCounter('7000',7000,8500),/أعلى من عرض المشتري/);
 assert.throws(()=>validateCounter('9000',7000,8500),/أعلى من سعر الإعلان/);
});

test('offers expire after 48 hours and only the other side answers them',()=>{
 const now=Date.parse('2026-11-09T12:00:00Z');
 const offer={status:'pending',from_role:'buyer',expires_at:'2026-11-10T12:00:00Z'};
 assert.equal(offerStatus(offer,now),'pending');
 assert.equal(offerStatus({...offer,expires_at:'2026-11-09T11:59:59Z'},now),'expired');
 assert.equal(offerStatus({...offer,status:'accepted',expires_at:'2026-11-01T00:00:00Z'},now),'accepted');
 assert.ok(canAnswerOffer(offer,'seller',now));
 assert.ok(!canAnswerOffer(offer,'buyer',now),'a buyer does not answer their own offer');
 assert.ok(!canAnswerOffer({...offer,expires_at:'2026-11-09T00:00:00Z'},'seller',now));
 assert.ok(canAnswerOffer({...offer,from_role:'seller'},'buyer',now),'the buyer answers a counter-price');
});

test('chat roles, messages and which listings take chats and offers',()=>{
 const chat={buyer_id:'b',seller_id:'s'};
 assert.equal(chatRole(chat,'b'),'buyer');
 assert.equal(chatRole(chat,'s'),'seller');
 assert.equal(chatRole(chat,'x'),null);
 assert.equal(chatRole(chat,null),null);
 assert.equal(messageText('  مرحبا   هل ما زال متاحًا؟ '),'مرحبا هل ما زال متاحًا؟');
 assert.throws(()=>messageText('   '),/اكتب رسالتك/);
 assert.equal(messageText('x'.repeat(3000)).length,2000);
 assert.ok(listingOpenForChat({status:'reserved'}));
 assert.ok(!listingOpenForChat({status:'sold'}));
 assert.ok(listingTakesOffers({status:'active',negotiable:true,price:100}));
 assert.ok(!listingTakesOffers({status:'active',negotiable:false,price:100}));
 assert.ok(!listingTakesOffers({status:'active',negotiable:true,price:0}));
});

test('the header badge adds unread market messages',()=>{
 assert.equal(messageBadgeCount({unread:2,requests:1,market:3}),6);
 assert.equal(messageBadgeCount({unread:2,requests:1}),3);
 assert.equal(messageBadgeCount({unread:0,requests:0,market:'x'}),0);
});

test('chats, offers and messages are private; one pending offer per chat',()=>{
 const sql=read('supabase/migrations/20261109180000_market_chat.sql');
 assert.match(sql,/revoke all on public\.market_chats,public\.market_offers,public\.market_messages from anon,authenticated/);
 for(const name of ['market_chats','market_offers','market_messages'])assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 assert.match(sql,/unique\(listing_id,buyer_id\)/,'one chat per buyer and listing');
 assert.match(sql,/create unique index if not exists market_offers_one_pending on public\.market_offers\(chat_id\) where status='pending'/);
 assert.match(sql,/interval '48 hours'/);
 assert.match(sql,/revoke all on function public\.market_unread_summary\(uuid\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.market_unread_summary\(uuid\) to service_role/);
});

test('chat photos are private and checked; members only act in their own chats',()=>{
 const server=read('lib/market/chatServer.js');
 assert.match(server,/if\(!upload\|\|upload\.promoted\|\|upload\.listing_id\|\|upload\.chat_id\)/,'a photo is used once, by its owner');
 assert.match(server,/imageKey\(upload\.id,size,\{chat:true\}\)/);
 assert.match(server,/const role=chat&&chatRole\(chat,user\.id\);\n if\(!role\)throw notFound\(\);/);
 assert.match(server,/listing\.seller_id===user\.id\)throw new MarketActionError\('OWN_LISTING'/);
 assert.match(server,/\.eq\('status','pending'\)\.select\(OFFER\)\.maybeSingle\(\)/,'an offer is answered once');
 const images=read('lib/market/chatImages.js');
 assert.match(images,/timingSafeEqual/);
 const route=read('app/api/market/chat-img/[id]/[size]/route.js');
 assert.match(route,/chatImageAllowed\(id,size,query\.get\('e'\),query\.get\('s'\)\)/);
 assert.match(route,/'Cache-Control':'private, max-age=86400'/);
 const uploads=read('lib/market/uploads.js');
 assert.match(uploads,/byId\.get\(id\)\.chat_id\|\|/,'chat photos cannot become listing photos');
 const messages=read('app/api/messages/route.js');
 assert.match(messages,/market_unread_summary[\s\S]*?\(\)=>null\)/,'a market failure never hides private messages');
});
