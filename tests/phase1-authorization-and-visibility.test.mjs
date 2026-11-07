import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pageIsVisible,validatePageVisibility} from '../lib/pageVisibility.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const users={
 management:'20000000-0000-4000-8000-000000000001',
 admin:'20000000-0000-4000-8000-000000000002',
 unconfirmed:'20000000-0000-4000-8000-000000000003',
 banned:'20000000-0000-4000-8000-000000000004',
 regular:'20000000-0000-4000-8000-000000000005',
};
test('editor SQL helpers honor email confirmation and bans through direct authenticated/RLS calls',async t=>{
 const pg=new PGlite();
 t.after(()=>pg.close());
 await pg.exec([
  'create role anon nologin',
  'create role authenticated nologin',
  'create schema auth',
  'create table auth.users(id uuid primary key,email_confirmed_at timestamptz,banned_until timestamptz)',
  'create table public.editors(user_id uuid primary key,role text not null)',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$",
  "create function public.editorial_can_read() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.editors e join auth.users u on u.id=e.user_id where e.user_id=(select auth.uid()) and e.role in ('admin','management') and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()))$$",
  'grant usage on schema public,auth to anon,authenticated',
  'grant execute on function auth.uid() to anon,authenticated',
  'create table public.editor_data(id integer primary key,label text)',
  "insert into public.editor_data values(1,'private')",
  'alter table public.editor_data enable row level security',
  'grant select on public.editor_data to anon,authenticated'
 ].join(';\n')+';');
 for(const [name,id] of Object.entries(users)){
  await pg.query('insert into auth.users(id,email_confirmed_at,banned_until) values($1,$2,$3)',[id,name==='unconfirmed'?null:'2026-01-01',name==='banned'?'2099-01-01':null]);
  if(name!=='regular')await pg.query('insert into public.editors(user_id,role) values($1,$2)',[id,name==='management'?'management':'admin']);
 }
 await pg.exec(read('supabase/migrations/20261031020834_editor_role_session_guards.sql'));
 await pg.exec('create policy editor_read on public.editor_data for select to authenticated using (public.is_editor());');

 const policies=[
  ['editor_drafts','editor_own_drafts','owner_id'],
  ['message_followups','editor_message_followups',null],
  ['public_profiles','profile_read','user_id'],
  ['debate_votes','votes_own_only','user_id'],
  ['debate_comments','comments_own_editor','user_id'],
  ['debate_questions','questions_own_editor','user_id'],
  ['debate_suggestions','suggestions_own_editor','user_id'],
  ['debate_reports','reports_read','user_id']
 ];
 for(const [table,policy,column] of policies){
  await pg.exec('create table public.'+table+'(id integer primary key'+(column?','+column+' uuid':'')+');'
   +'alter table public.'+table+' enable row level security;'
   +'grant select on public.'+table+' to anon,authenticated;'
   +'create policy '+policy+' on public.'+table+' for select to authenticated using (true);');
 }
 await pg.query('insert into public.editor_drafts(id,owner_id) values(1,$1),(2,$2)',[users.management,users.banned]);
 await pg.exec('insert into public.message_followups(id) values(1);');
 await pg.exec('create index debate_vote_poll_idx on public.debate_votes(id);create index debate_vote_distribution_idx on public.debate_votes(id);');
 await pg.exec(read('supabase/migrations/20261031020839_editor_rls_policy_hardening.sql'));
 assert.equal((await pg.query("select to_regclass('public.debate_vote_distribution_idx') is null as removed")).rows[0].removed,true);
 assert.equal((await pg.query("select to_regclass('public.debate_vote_poll_idx') is not null as retained")).rows[0].retained,true);

 async function probe(user,role='authenticated'){
  return pg.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);
   await tx.exec('set local role '+role);
   return (await tx.query('select public.is_editor() as editor,public.is_967_editor() as old_editor,public.is_management() as manager,public.is_ranking_editor() as ranking,public.debate_role() as debate,public.task_role() as task,(select count(*)::int from public.editor_data) as private_rows')).rows[0];
  });
 }
 const manager=await probe(users.management);
 assert.deepEqual(manager,{editor:true,old_editor:true,manager:true,ranking:true,debate:'management',task:'management',private_rows:1});
 const admin=await probe(users.admin);
 assert.equal(admin.editor,true);assert.equal(admin.manager,false);assert.equal(admin.debate,'admin');assert.equal(admin.task,'admin');
 for(const id of [users.unconfirmed,users.banned,users.regular]){
  const state=await probe(id);
  assert.equal(state.editor,false,id);assert.equal(state.old_editor,false,id);
  assert.equal(state.manager,false,id);assert.equal(state.ranking,false,id);
  assert.equal(state.debate,null,id);assert.equal(state.task,null,id);
  assert.equal(state.private_rows,0,id);
 }
 async function restrictedRows(user){
  return pg.transaction(async tx=>{
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
   await tx.exec('set local role authenticated');
   return (await tx.query('select (select count(*)::int from public.editor_drafts) as drafts,(select count(*)::int from public.message_followups) as followups')).rows[0];
  });
 }
 assert.deepEqual(await restrictedRows(users.management),{drafts:1,followups:1});
 assert.deepEqual(await restrictedRows(users.admin),{drafts:0,followups:1});
 for(const id of [users.unconfirmed,users.banned,users.regular])
  assert.deepEqual(await restrictedRows(id),{drafts:0,followups:0});

 const visitor=await probe(null,'anon');
 assert.equal(visitor.editor,false);assert.equal(visitor.manager,false);assert.equal(visitor.ranking,false);
 assert.equal(visitor.debate,null);assert.equal(visitor.task,null);
});
test('nested figure visibility requires BOTH atlas and figure sections',()=>{
 const atlasHidden=validatePageVisibility({atlas:false,figures:true});
 const figuresHidden=validatePageVisibility({atlas:true,figures:false});
 for(const visibility of [atlasHidden,figuresHidden]){
  assert.equal(pageIsVisible('/yemen-map/figures/someone',visibility),false);
  assert.equal(pageIsVisible('/yemen-map#yemeni-figures',visibility),false);
 }
 assert.equal(pageIsVisible('/yemeni-figures/person',atlasHidden),true);
 assert.equal(pageIsVisible('/yemen-map/figures/person',validatePageVisibility({})),true);
 assert.equal(pageIsVisible('/yemen-map?region=YE19#map',figuresHidden),true);
});
test('server-side section layouts protect public nested routes without changing visual layout',()=>{
 for(const [path,section] of [
  ['app/games/layout.jsx','games'],
  ['app/yemen-history/layout.jsx','history'],
  ['app/yemeni-figures/layout.jsx','figures'],
  ['app/yemen-map/layout.jsx','atlas'],
  ['app/debates/layout.jsx','debates'],
  ['app/universities/layout.jsx','universities'],
  ['app/medical-centers/layout.jsx','medical'],
 ]){
  const source=read(path);
  assert.ok(source.includes('PublicPageBoundary')||source.includes('InteriorLayout'),path);
  if(source.includes('PublicPageBoundary'))assert.ok(source.includes('section="'+section+'"'),path);
 }
 assert.match(read('components/design/PublicPageBoundary.jsx'),/sectionGate\(section,settings\)/);
 assert.match(read('app/school/studio/page.jsx'),/SchoolStudio/); // Editor access continues through authenticated APIs.
});

test('unreadable section settings never turn into 404: pages throw a temporary error, APIs answer 503', async () => {
  const {sectionStatus, sectionGate, SectionsUnavailableError} = await import('../lib/pageVisibility.js');
  assert.equal(sectionStatus('school', {pageVisibility: {}}), 'visible');
  assert.equal(sectionStatus('school', {pageVisibility: {school: false}}), 'hidden');
  assert.equal(sectionStatus('school', {pageVisibility: {school: false}, pageVisibilityUnavailable: true}), 'unavailable');
  assert.equal(sectionGate('school', {pageVisibility: {school: false}}), false);
  assert.throws(() => sectionGate('school', {pageVisibility: {school: false}, pageVisibilityUnavailable: true}), SectionsUnavailableError);
  const data = read('lib/data.js');
  assert.match(data, /for\(let attempt=0;attempt<2;attempt\+\+\)/);
  assert.match(read('components/design/PublicPageBoundary.jsx'), /if\(!sectionGate\(section,settings\)\)notFound\(\);/);
  for (const route of ['app/api/debates/route.js', 'app/api/figures/route.js', 'app/api/map-profiles/route.js', 'app/api/rankings/route.js']) assert.match(read(route), /gate==='hidden'\?/);
  assert.match(read('app/sitemap.js'), /if\(settings\.pageVisibilityUnavailable\)throw/);
});

test('health endpoint for the host is ready only when section settings are readable', () => {
  const route = read('app/api/health/route.js');
  assert.match(route, /const ready=!settings\.pageVisibilityUnavailable;/);
  assert.match(route, /status:ready\?200:503/);
  assert.ok(!/SUPABASE|process\.env/.test(route), 'no secrets or env values in the response');
});

test('a failed settings read reuses the last good settings for 15 minutes before failing closed', () => {
  const data = read('lib/data.js');
  assert.match(data, /const SETTINGS_STALE_LIMIT_MS=15\*60\*1000;/);
  assert.match(data, /if\(lastGood&&now-lastGood\.at<=SETTINGS_STALE_LIMIT_MS\)return \{\.\.\.lastGood\.value,settingsStale:true\};/);
  assert.match(data, /lastGoodSettings=\{value,at:Date\.now\(\)\};/);
  assert.match(data, /pageVisibilityUnavailable:true\};/);
});
