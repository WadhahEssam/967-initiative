import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {queryGroups,setTeamSynonyms} from '../lib/market/search.js';
import {marketNotice} from '../lib/market/notices.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('a reminder for a draft left unfinished, once, a day after it was last touched',()=>{
 const sql=read('supabase/migrations/20261109240000_market_team_tools.sql');
 assert.match(sql,/l\.status='draft' and l\.seller_id is not null and l\.draft_reminded_at is null/);
 assert.match(sql,/l\.updated_at<now\(\)-interval '1 day' and l\.updated_at>now\(\)-interval '14 days'/);
 assert.match(sql,/'\/market\/new\?draft='\|\|r\.id/);
 assert.match(sql,/cron\.schedule\('967-market-drafts'/);
 const notice=marketNotice({id:'0b8f1c2e-1111-4111-8111-111111111111',kind:'draft_reminder',subject:'لابتوب',href:'/market/new?draft=x',created_at:'2026-11-09T10:00:00Z',read_at:null,count:1});
 assert.equal(notice.title,'أكمل إعلانك «لابتوب»');
 assert.match(read('lib/market/listingsServer.js'),/\.eq\('kind','draft_reminder'\)\.is\('read_at',null\)/,'publishing answers the reminder');
});

test('synonyms the team adds join the search dictionary',()=>{
 assert.deepEqual(queryGroups('جالون'),[['جالون']]);
 setTeamSynonyms([['جالون','دبه']]);
 assert.deepEqual(queryGroups('جالون')[0].sort(),['جالون','دبه'].sort());
 assert.ok(queryGroups('دبه')[0].includes('جالون'),'both ways');
 setTeamSynonyms([]);
 assert.deepEqual(queryGroups('جالون'),[['جالون']]);
 const server=read('lib/market/searchServer.js');
 assert.match(server,/if\(Date\.now\(\)-synonymsReadAt<300000\)return;/,'read at most every 5 minutes');
 assert.match(server,/if\(filters\.q\)await loadTeamSynonyms\(db\);/);
});

test('catalogue upkeep stays with the team',()=>{
 const sql=read('supabase/migrations/20261109240000_market_team_tools.sql');
 assert.match(sql,/alter table public\.market_synonyms enable row level security/);
 assert.match(sql,/revoke all on public\.market_synonyms from anon,authenticated/);
 assert.match(sql,/revoke all on function public\.market_other_values\(\) from public,anon,authenticated/);
 assert.match(sql,/where l\.status<>'draft' and right\(a\.key,6\)='_other'/,'only published listings');
 const route=read('app/api/admin/market/route.js');
 assert.match(route,/if\(view==='brands'\)return json/);
 assert.match(route,/if\(view==='misses'\)return json/);
 assert.match(route,/authorizeEditorRequest\(request,db\)/);
});
