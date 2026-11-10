import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BAN_DAYS,BLOCKED_TEXT,BLOCK_REASONS,REPORT_REASONS,SafetyError,banActive,banUntil,validateAdminMessage,validateBlock,validateReport} from '../lib/market/safety.js';
import {ratingBlocker} from '../lib/market/ratings.js';
import {marketNotice} from '../lib/market/notices.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const now=Date.parse('2026-11-09T12:00:00Z');

test('report and block reasons follow the spec',()=>{
 assert.deepEqual(REPORT_REASONS.map(item=>item.label),['احتيال أو نصب','منتج ممنوع','إعلان مكرر','معلومات أو صور مضللة','إساءة أو إزعاج في المحادثة','أخرى']);
 assert.deepEqual(BLOCK_REASONS.map(item=>item.label),['إزعاج','أسلوب غير لائق','احتيال أو محاولة نصب','عدم جدية','أخرى']);
 assert.equal(BLOCKED_TEXT,'لا يمكن مراسلة هذا المستخدم.');
});

test('a report needs a target and a listed reason; «أخرى» needs a few words',()=>{
 assert.deepEqual(validateReport({target:'listing',reason:'duplicate'}),{target:'listing',reason:'duplicate',note:null});
 assert.deepEqual(validateReport({target:'chat',reason:'abuse',note:'  شتائم   متكررة '}),{target:'chat',reason:'abuse',note:'شتائم متكررة'});
 assert.throws(()=>validateReport({target:'listing',reason:'other',note:'لا'}),error=>error instanceof SafetyError&&error.field==='note');
 assert.throws(()=>validateReport({target:'listing',reason:'spam'}),error=>error.field==='reason');
 assert.throws(()=>validateReport({target:'comment',reason:'fraud'}),error=>error.field==='target');
});

test('a block needs a reason (shown to the team only)',()=>{
 assert.deepEqual(validateBlock({reason:'fraud'}),{reason:'fraud',note:null});
 assert.throws(()=>validateBlock({}),/اختر سبب الحظر/);
 assert.throws(()=>validateBlock({reason:'other'}),/اكتب سبب الحظر/);
});

test('market bans: a few days, a month, or for good',()=>{
 assert.deepEqual(BAN_DAYS,[3,7,30,null]);
 assert.equal(banUntil(3,now),'2026-11-12T12:00:00.000Z');
 assert.equal(banUntil(null,now),null);
 assert.throws(()=>banUntil(5,now),/مدة الإيقاف/);
 assert.equal(banActive({until:'2026-11-12T12:00:00Z',lifted_at:null},now),true);
 assert.equal(banActive({until:'2026-11-08T12:00:00Z',lifted_at:null},now),false);
 assert.equal(banActive({until:null,lifted_at:'2026-11-09T10:00:00Z'},now),false);
 assert.equal(banActive({until:null,lifted_at:null},now),true);
 assert.throws(()=>validateAdminMessage('هه'),/نص الرسالة/);
});

test('no rating between two members while one blocks the other',()=>{
 const eligible={role:'buyer',listingStatus:'sold',chatCreatedAt:new Date(now-86400000).toISOString(),sellerReplied:true,buyerWrote:true,alreadyRated:false,sellerGone:false};
 assert.equal(ratingBlocker(eligible,now),null);
 assert.equal(ratingBlocker({...eligible,blocked:true},now),'لا يمكن تقييم هذا البائع.');
});

test('moderation notices for the member',()=>{
 const row={id:'0b8f1c2e-1111-4111-8111-111111111111',href:'/market/notices',created_at:'2026-11-09T10:00:00Z',read_at:null,count:1,subject:'هايلكس'};
 assert.equal(marketNotice({...row,kind:'listing_removed',detail:'السبب: إعلان مكرر'}).description,'السبب: إعلان مكرر');
 assert.equal(marketNotice({...row,kind:'listing_approved'}).title,'اعتُمد إعلانك «هايلكس»');
 assert.equal(marketNotice({...row,kind:'admin_message',detail:'نرجو الالتزام'}).title,'رسالة من إدارة السوق');
 assert.equal(marketNotice({...row,kind:'market_ban',detail:'x'}).href,'/market/notices');
});

test('blocks, reports and bans stay on the server',()=>{
 const sql=read('supabase/migrations/20261109220000_market_moderation.sql');
 for(const table of ['market_reports','market_report_views','market_bans']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.'+table+' from anon,authenticated'));
 }
 assert.match(sql,/check \(reason is null or reason in \('spam','rude','fraud','not_serious','other'\)\)/);
 assert.match(sql,/create unique index if not exists market_reports_open_once/,'one open report per member and thing');
 assert.match(sql,/create trigger private_user_blocks_market after insert on public\.private_user_blocks/,'blocks from messages count too');
 assert.match(sql,/update public\.market_offers o set status='cancelled'/,'offers between them are cancelled');
 assert.match(sql,/update public\.market_listings set status='active',reserved_for=null/,'a reservation between them is released');
 assert.match(sql,/having count\(distinct blocker_id\)>=greatest\(p_min,1\)/);
 assert.match(sql,/not exists\(select 1 from public\.market_bans b where b\.user_id=l\.seller_id/,'search leaves out banned sellers');
 for(const fn of ['market_blocked\\(uuid,uuid\\)','market_block_alerts\\(integer\\)','market_banned\\(uuid\\)'])
  assert.match(sql,new RegExp('revoke all on function public\\.'+fn+' from public,anon,authenticated'));
});

test('who may do what',()=>{
 const access=read('lib/market/access.js');
 assert.match(access,/if\(request\.method!=='GET'\)\{const ban=await activeBan\(db,user\.id\)/,'a banned member can read but not act');
 const chat=read('lib/market/chatServer.js');
 assert.equal((chat.match(/await assertNotBlocked\(/g)||[]).length,6,'start, open-for-listing, message, offer, answer, reserve');
 assert.match(chat,/closed:!partner\|\|blocked,blockedByMe/);
 const moderation=read('lib/market/moderationServer.js');
 assert.match(moderation,/export async function banMember\(db,actor,[^)]*\)\{\n managementOnly\(actor\);/);
 assert.match(moderation,/export async function reportedChat\(db,actor,reportId\)\{\n managementOnly\(actor\);/);
 assert.match(moderation,/market_report_views'\)\.insert/,'reading a reported chat is logged');
 const route=read('app/api/admin/market/route.js');
 assert.match(route,/authorizeEditorRequest\(request,db\)/);
 const safety=read('lib/market/safetyServer.js');
 assert.match(safety,/if\(staff\)throw new MarketActionError\('STAFF'/);
});
