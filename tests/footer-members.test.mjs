import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {memberCountLabel} from '../lib/memberCountLabel.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('the member count follows Arabic number agreement',()=>{
 assert.equal(memberCountLabel(1),'عضو واحد');
 assert.equal(memberCountLabel(2),'عضوان');
 assert.equal(memberCountLabel(9),'9 أعضاء');
 assert.equal(memberCountLabel(10),'10 أعضاء');
 assert.equal(memberCountLabel(11),'11 عضوًا');
 assert.equal(memberCountLabel(100),'100 عضو');
 assert.equal(memberCountLabel(103),'103 أعضاء');
 assert.equal(memberCountLabel(1250),'1,250 عضوًا');
 for(const value of [0,-3,null,undefined,'x',1.5])assert.equal(memberCountLabel(value),'');
});

test('the footer shows the count from a cached server read and hides it on failure',()=>{
 const layout=read('app/layout.jsx'),footer=read('components/Footer.jsx'),count=read('lib/memberCount.js');
 assert.ok(layout.includes('const memberCount=await getMemberCount().catch(()=>null);'));
 assert.ok(layout.includes('<Footer settings={settings} memberCount={memberCount}/>'));
 assert.ok(footer.includes('{members && <p className="ed-footer-members">'));
 assert.ok(count.includes("import 'server-only';")&&count.includes('listUsers({page:1,perPage:1})')&&count.includes('ttlMs:10*60*1000'));
});
