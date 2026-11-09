import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('these screens reload only when the signed-in account changes',()=>{
 for(const file of ['components/AdminDashboard.jsx','components/admin/ContributionsDashboard.jsx','components/debates/useAudience.js','components/games/FriendDuel.jsx','components/school/SchoolDashboard.jsx']){
  const source=read(file);
  assert.ok(source.includes("import {createAccountWatch,shouldReloadOnAuth} from '@/lib/authEvents';"),file);
  assert.match(source,/if\(!shouldReloadOnAuth\(account,event,session\)\)return;|if\(!shouldReloadOnAuth\(account,e,s\)\)return;/,file);
  assert.match(source,/account\.seen\(/,file);
 }
 assert.ok(read('components/tasks/TaskCenter.jsx').includes('if(active.current===id&&id)return;'),'same account keeps the session object');
});

test('an indicator page is cached for five minutes and cleared with the catalog',()=>{
 const data=read('lib/data.js');
 assert.ok(data.includes("export const getStatIndicator = publicItem('statistics',cachedStatIndicator);"));
 assert.match(data,/statIndicatorMemos\.clear\(\);\}/);
 assert.match(data,/createMemo\(\{ttlMs:5\*60\*1000,staleMs:60\*60\*1000\}\);statIndicatorMemos\.set\(slug,memo\);/);
 assert.ok(data.includes('return value?structuredClone(value):value;'),'callers get their own copy');
});
