import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {downloadCountLabel,isBotAgent,issueDownloadPath} from '../lib/issueDownloads.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('download counts read naturally in Arabic and stay hidden at zero',()=>{
 assert.equal(downloadCountLabel(0),'');
 assert.equal(downloadCountLabel(null),'');
 assert.equal(downloadCountLabel(1),'حُمّل مرة واحدة');
 assert.equal(downloadCountLabel(2),'حُمّل مرتين');
 assert.equal(downloadCountLabel(7),'حُمّل 7 مرات');
 assert.equal(downloadCountLabel(12),'حُمّل 12 مرة');
 assert.equal(downloadCountLabel(100),'حُمّل 100 مرة');
 assert.equal(downloadCountLabel(1305),'حُمّل 1,305 مرات');
 assert.equal(issueDownloadPath('issue 2'),'/api/magazine/download/issue%202');
});

test('crawlers and link previews are not counted',()=>{
 for(const agent of ['Googlebot/2.1','facebookexternalhit/1.1','WhatsApp/2.23','TelegramBot','curl/8.0','HeadlessChrome'])assert.ok(isBotAgent(agent),agent);
 assert.ok(!isBotAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'));
});

test('only the server can count, and only published issues',()=>{
 const sql=read('supabase/migrations/20261109130000_issue_download_counts.sql');
 assert.match(sql,/if coalesce\(auth\.role\(\),''\)<>'service_role' then raise exception/);
 assert.match(sql,/if not exists\(select 1 from public\.issues where id=p_issue and is_published\) then return null;/);
 assert.match(sql,/revoke all on function public\.count_issue_download\(uuid\) from public,anon,authenticated;/);
 assert.match(sql,/revoke insert,update,delete,truncate on public\.issue_download_counts from anon,authenticated;/);
 assert.match(sql,/enable row level security/);
});

test('download links go through the counting route, which never blocks the file',()=>{
 const route=read('app/api/magazine/download/[slug]/route.js');
 assert.ok(route.includes("rpc('count_issue_download',{p_issue:issue.id}).then(()=>null,()=>null)"));
 assert.ok(route.includes('status:302')&&route.includes('safeExternalUrl(issue.pdf_url)'));
 assert.ok(route.includes('!isBotAgent(')&&route.includes('firstTime(key)'));
 assert.ok(read('app/magazine/page.jsx').includes('href={issueDownloadPath(latest.slug)}'));
 assert.ok(read('app/magazine/[slug]/page.jsx').includes('downloadHref={issue.is_demo?issue.pdf_url:issueDownloadPath(issue.slug)}'));
 assert.ok(read('components/PdfReader.jsx').includes('href={downloadHref}'));
});
