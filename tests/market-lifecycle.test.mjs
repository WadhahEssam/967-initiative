import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editedParts,previousPriceAfterEdit} from '../lib/market/listing.js';
import {countedText,marketChatNotice,marketNotice} from '../lib/market/notices.js';
import {conditionRequired} from '../lib/market/catalog.js';
import {validNotificationId} from '../lib/unifiedNotifications.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const listing={title:'تويوتا هايلكس',description:'نظيفة',price:8500,currency:'USD',negotiable:true,condition:'used',governorate_id:'YE24',district_id:'YE2404',
 attributes:{brand:'toyota',model:'hilux',year:2015},images:[{id:'a'},{id:'b'}]};

test('an edit marks only what changed',()=>{
 assert.deepEqual(editedParts(listing,{...listing}),[]);
 assert.deepEqual(editedParts(listing,{...listing,attributes:{year:2015,model:'hilux',brand:'toyota',color:''}}),[],'key order and empty values do not count');
 assert.deepEqual(editedParts(listing,{...listing,price:'8000'}),['price']);
 assert.deepEqual(editedParts(listing,{...listing,negotiable:false}),['price']);
 assert.deepEqual(editedParts(listing,{...listing,title:'هايلكس 2015',district_id:'YE2403'}),['title','place']);
 assert.deepEqual(editedParts(listing,{...listing,images:[{id:'b'},{id:'a'}],attributes:{...listing.attributes,year:2016}}),['details','photos']);
 assert.deepEqual(editedParts({...listing,description:null},{...listing,description:''}),[]);
});

test('the old price is struck through only after a drop in the same currency',()=>{
 assert.equal(previousPriceAfterEdit(listing,{...listing,price:8000}),8500);
 assert.equal(previousPriceAfterEdit({...listing,price:8000,previous_price:8500},{...listing,price:7500}),8500,'the first price stays struck');
 assert.equal(previousPriceAfterEdit({...listing,price:8000,previous_price:8500},{...listing,price:9000}),null,'a rise clears it');
 assert.equal(previousPriceAfterEdit({...listing,previous_price:9000},{...listing}),9000,'no price change keeps it');
 assert.equal(previousPriceAfterEdit(listing,{...listing,price:1000000,currency:'YER_OLD'}),null);
});

test('market notifications read naturally in Arabic',()=>{
 const words={one:'رسالة',two:'رسالتان',few:'رسائل',many:'رسالة'};
 assert.deepEqual([1,2,3,10,11,250].map(n=>countedText(n,words)),['رسالة','رسالتان','3 رسائل','10 رسائل','11 رسالة','250 رسالة']);
 const row={id:'0b8f1c2e-1111-4111-8111-111111111111',href:'/market/mine',created_at:'2026-11-09T10:00:00Z',read_at:null,count:1};
 assert.equal(marketNotice({...row,kind:'ask_sold',subject:'دراجة هوندا'}).title,'هل بعت «دراجة هوندا»؟');
 assert.equal(marketNotice({...row,kind:'price_drop',subject:'آيفون',detail:'600 $'}).description,'السعر الجديد 600 $. الإعلان في مفضلتك.');
 assert.equal(marketNotice({...row,kind:'saved_search',subject:'«هايلكس» · عدن',count:4}).title,'4 إعلانات جديدة تطابق بحثك');
 assert.equal(marketNotice({...row,kind:'saved_search',count:2}).title,'إعلانان جديدان يطابقان بحثك');
 assert.equal(marketNotice({...row,kind:'expired',href:'//evil.example'}).href,'/market','only links within the site');
 assert.equal(marketNotice({...row,kind:'unknown'}),null);
 const notice=marketNotice({...row,kind:'expired',subject:'ثلاجة'});
 assert.equal(notice.source,'market');assert.equal(notice.category,'market');assert.equal(notice.unread,true);
 assert.ok(validNotificationId('market',row.id));
 assert.ok(!validNotificationId('market','not-an-id'));
});

test('a market chat with unread messages is one notice, cleared by reading the chat',()=>{
 const chat={id:'7b124275-a888-4014-911b-9a580e18a2c4',unread:3,last_preview:'عرض سعر',last_message_at:'2026-11-09T10:00:00Z'};
 const notice=marketChatNotice(chat,'تويوتا هايلكس 2015');
 assert.equal(notice.title,'3 رسائل جديدة على «تويوتا هايلكس 2015»');
 assert.equal(notice.source,'message','not marked by hand: it follows the chat');
 assert.equal(notice.href,'/messages?tab=market&chat='+chat.id);
 assert.equal(marketChatNotice({...chat,unread:0},'x'),null);
 assert.equal(marketChatNotice({...chat,unread:2},'x').title,'رسالتان جديدتان على «x»');
});

test('«الحالة» stays required for goods',()=>{
 assert.ok(conditionRequired('electronics'));
 assert.ok(!conditionRequired('real_estate'));
 assert.ok(!conditionRequired('animals'));
});

test('the scheduled job and market notifications are private to the server',()=>{
 const sql=read('supabase/migrations/20261109200000_market_lifecycle.sql');
 assert.match(sql,/alter table public\.market_notifications enable row level security/);
 assert.match(sql,/revoke all on public\.market_notifications from anon,authenticated/);
 for(const fn of ['market_notify\\(uuid,text,uuid,uuid,text,text,text,integer\\)','market_expire_offers\\(uuid\\)','market_lifecycle\\(\\)'])
  assert.match(sql,new RegExp('revoke all on function public\\.'+fn+' from public,anon,authenticated'));
 assert.match(sql,/cron\.schedule\('967-market-lifecycle','\*\/30 \* \* \* \*','select public\.market_lifecycle\(\);'\)/);
 assert.match(sql,/expires_at<now\(\)\+interval '3 days'/,'«هل تم البيع؟» three days before the end');
 assert.match(sql,/coalesce\(l\.last_viewed_at,l\.published_at\)<now\(\)-interval '7 days'/,'…or after a week without views');
 assert.match(sql,/l\.expires_at<now\(\)-interval '3 days'/,'expired three days after the end');
 assert.match(sql,/l\.reserved_at<now\(\)-interval '3 days'/,'«هل تمت الصفقة؟» three days after a reservation');
 assert.match(sql,/s\.last_notified_at<now\(\)-interval '20 hours'/,'one digest a day per saved search');
 assert.match(sql,/-'views'-'saves'-'last_viewed_at'-'updated_at'-'revision'/,'views are not edits');
});

test('editing keeps the category, re-checks the text, and answers mark the questions read',()=>{
 const server=read('lib/market/listingsServer.js');
 assert.match(server,/data\.category!==current\.category\|\|data\.subcategory!==current\.subcategory\)throw new ListingError\('لا يمكن تغيير فئة الإعلان بعد نشره\.'/);
 assert.match(server,/const status=matches\.length\?'pending_review':current\.status;/);
 const chats=read('lib/market/chatServer.js');
 assert.match(chats,/\.in\('kind',\['ask_sold','ask_deal','expired'\]\)\.is\('read_at',null\)/);
 assert.match(chats,/keep:\['active'\]/);
 const route=read('app/api/notifications/route.js');
 assert.match(route,/service\.from\('market_notifications'\)\.update\(\{read_at:time\}\)\.eq\('user_id',user\.id\)\.in\('id',ids\)/,'members mark only their own');
});
