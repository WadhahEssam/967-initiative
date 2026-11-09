import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {messageBadgeCount,messageBadgeLabel,safeMessageCount} from '../lib/messageBadge.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('unread badge counts private messages and incoming conversation requests',()=>{
 assert.equal(messageBadgeCount({unread:3,requests:2}),5);
 assert.equal(messageBadgeCount({unread:1,requests:0}),1);
 assert.equal(messageBadgeCount({unread:0,requests:1}),1);
 assert.equal(messageBadgeCount({unread:0,requests:0}),0);
 assert.equal(messageBadgeCount(null),0);
 assert.equal(messageBadgeCount({unread:-5,requests:'invalid'}),0);
 assert.equal(safeMessageCount(Infinity),0);
 assert.equal(safeMessageCount(2.5),0);
 assert.equal(messageBadgeLabel(1),'1');
 assert.equal(messageBadgeLabel(99),'99');
 assert.equal(messageBadgeLabel(120),'99+');
});

test('header badge is restricted to signed-in users, refreshes on focus, and stops on sign-out',()=>{
 const header=read('components/Header.jsx');
 const css=read('app/foundation/shell.css');
 const messages=read('components/messages/PrivateMessaging.jsx');
 assert.match(header,/setSessionUserId\(session\?\.user\?\.id \|\| null\)/);
 assert.match(header,/if \(!db \|\| !sessionUserId\)/);
 assert.match(header,/setMessageCounts\(\{unread:0,requests:0\}\)/);
 assert.match(header,/fetch\('\/api\/messages\?mode=summary'/);
 assert.match(header,/cache:'no-store'/);
 assert.match(header,/window\.setInterval\(refresh,60000\)/);
 assert.match(header,/\}, \[db,sessionUserId\]\);/,'navigating does not restart the poll');
 assert.match(header,/returning\.due\(\)/,'returning to the tab refreshes at most every 15 s');
 assert.match(header,/document\.visibilityState !== 'visible'/);
 assert.match(header,/window\.addEventListener\('focus',onReturn\)/);
 assert.match(header,/window\.addEventListener\('967:messages-changed',refresh\)/);
 assert.match(header,/window\.removeEventListener\('967:messages-changed',refresh\)/);
 assert.match(header,/active=false;/);
 assert.match(header,/newMessageCount>0&&<span className="ed-message-count"/);
 assert.match(header,/newMessageCount>0&&<span className="ed-message-menu-count"/);
 assert.match(header,/signedIn && <Link href="\/messages"/);
 assert.match(header,/aria-label=\{messageLinkLabel\}/);
 assert.match(css,/\.ed-message-link \{ position: relative;/);
 assert.match(css,/\.ed-message-count/);
 assert.match(messages,/window\.dispatchEvent\(new Event\('967:messages-changed'\)\)/);
});
