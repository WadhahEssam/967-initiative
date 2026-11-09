import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 NOTIFICATION_CATEGORIES,validNotificationId,safeNoticeHref,isDuplicatedMessageNotice,
 accountNotice,taskNotice,conversationNotice,orderNotices,noticeCountLabel
} from '../lib/unifiedNotifications.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const a='30000000-0000-4000-8000-000000000001';
const b='30000000-0000-4000-8000-000000000002';
const date='2026-11-04T16:30:00Z';

test('account messages are not duplicated with unread conversation groups',()=>{
 const duplicated={id:a,kind:'system',href:'/messages?conversation='+b,title:'رسالة جديدة',created_at:date};
 assert.equal(isDuplicatedMessageNotice(duplicated),true);
 assert.equal(accountNotice(duplicated),null);
 assert.equal(isDuplicatedMessageNotice({href:'/messages',kind:'system'}),true);
 const account={...duplicated,kind:'reply',href:'/debates/topic#comment-1'};
 const mapped=accountNotice(account);
 assert.equal(mapped.source,'account');
 assert.equal(mapped.category,'debates');
 assert.equal(mapped.unread,true);
 assert.equal(mapped.href,account.href);
});

test('links are always safe internal routes; no external redirects are generated',()=>{
 for(const href of ['//evil.example','/\\evil','https://example.com','javascript:alert(1)','/bad\nlink','/bad\\link']){
  assert.equal(safeNoticeHref(href),'/notifications');
 }
 assert.equal(safeNoticeHref('/messages?conversation='+b),'/messages?conversation='+b);
 assert.equal(safeNoticeHref('/admin/tasks?task='+a),'/admin/tasks?task='+a);
 assert.equal(accountNotice({id:a,kind:'system',href:'//evil.example',created_at:date}).href,'/notifications');
});

test('task alerts show the right category and deep link to the exact task/comment',()=>{
 const item=taskNotice({id:53,task_id:a,comment_id:b,kind:'comment',created_at:date,read_at:null},'اختبار الفيديو');
 assert.equal(item.id,'task:53');
 assert.equal(item.category,'tasks');
 assert.equal(item.href,'/admin/tasks?task='+a+'&comment='+b);
 assert.equal(item.description,'اختبار الفيديو');
 assert.equal(item.unread,true);
 assert.equal(taskNotice({id:8,task_id:a,kind:'review',created_at:date,read_at:date}).unread,false);
});

test('private messages display at most one notification per conversation',()=>{
 const shared={id:a,partner_id:b,partner_name:'عضو 967',status:'accepted',
  requested_by:a,unread:7,last_message_at:date};
 const item=conversationNotice(shared,a);
 assert.equal(item.id,'message:'+a);
 assert.equal(item.category,'messages');
 assert.match(item.description,/7 رسائل/);
 assert.equal(item.href,'/messages?conversation='+a);
 assert.equal(item.unread,true);
 assert.equal(conversationNotice({...shared,unread:0},a),null);
 assert.equal(conversationNotice({...shared,blocked:true},a),null);
 assert.equal(conversationNotice({...shared,status:'pending',unread:0,requested_by:b},a).title,'طلب محادثة جديد');
 assert.equal(conversationNotice({...shared,status:'pending',unread:0,requested_by:a},a),null);
});

test('sorting and unread badge values are deterministic and bounded',()=>{
 const input=[{id:'a',created_at:'2026-11-01T11:00:00Z'},
  {id:'b',created_at:'2026-11-04T11:00:00Z'},null,{id:'c',created_at:'2026-11-02T11:00:00Z'}];
 assert.deepEqual(orderNotices(input).map(x=>x.id),['b','c','a']);
 assert.equal(noticeCountLabel(0),'0');assert.equal(noticeCountLabel(101),'99+');
 assert.equal(noticeCountLabel(-20),'0');
 assert.deepEqual(NOTIFICATION_CATEGORIES,['all','messages','market','tasks','debates','account']);
});

test('mark-read accepts only a source-scoped UUID or positive integer',()=>{
 assert.equal(validNotificationId('account',a),true);
 assert.equal(validNotificationId('account','not-uuid'),false);
 assert.equal(validNotificationId('task','123'),true);
 for(const id of [0,-4,'1.5','1 OR 1=1','99999999999999999',a])
  assert.equal(validNotificationId('task',id),false);
 assert.equal(validNotificationId('message',a),false);
});

test('unified API uses authenticated RLS and service-role messages only after verification',()=>{
 const api=source('app/api/notifications/route.js');
 assert.match(api,/const user=await authorizeAudience\(request,db\)/);
 assert.match(api,/const db=taskRequestDb\(request\)/);
 assert.match(api,/\.eq\('user_id',id\)/);
 assert.match(api,/\.or\('href\.is\.null,href\.not\.like\.\/messages%'\)/);
 assert.match(api,/\.rpc\('private_messaging_inbox',\{p_actor:user\.id\}\)/);
 assert.match(api,/db\.from\(table\)\.update\(\{read_at:time\}\)/);
 assert.match(api,/if\(body\.action==='read_all'\)/);
 assert.doesNotMatch(api,/\.from\('private_messages'\)/);
 assert.doesNotMatch(api,/\.insert\(/);
});

test('header and page expose discoverable notifications without duplicating message badges',()=>{
 const header=source('components/Header.jsx');
 const bell=source('components/notifications/NotificationBell.jsx');
 const page=source('components/notifications/NotificationCenter.jsx');
 const style=source('components/notifications/Notifications.module.css');
 assert.match(header,/signedIn&&<NotificationBell userId=\{sessionUserId\}/);
 assert.match(header,/href="\/notifications"/);
 assert.match(bell,/aria-expanded=\{open\}/);
 assert.match(bell,/aria-controls="notifications-preview"/);
 assert.match(bell,/document\.addEventListener\('keydown',key\)/);
 assert.match(bell,/window\.setInterval\(refresh,60000\)/);
 // «السوق» shows only when the market is open to the member, or they have market news.
 assert.match(page,/NOTIFICATION_CATEGORIES\.filter\(key=>key!=='market'\|\|marketEnabled\|\|category==='market'\)\.map\(key=>/);
 assert.match(page,/markNotificationsRead\(\)/);
 assert.match(page,/onOpen=\{openItem\}/);
 assert.match(style,/\.popover\{position:absolute;/);
 assert.match(style,/@media\(max-width:680px\)/);
});
