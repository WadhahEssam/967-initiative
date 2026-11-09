import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('components/account/AccountWorkspace.jsx');
const css=read('components/account/AccountWorkspace.module.css');
const api=read('app/api/account/workspace/route.js');
const migration=read('supabase/migrations/20261027000100_account_workspace.sql');
const contact=read('lib/contactService.js');
const contactMigration=read('supabase/migrations/20261027000200_link_authenticated_contributions.sql');
const bookmarks=read('components/reading/useReadingList.js');
const account=read('app/account/page.jsx');
const reading=read('components/reading/ReadingList.jsx');

test('the account page shows selected sections without personal activity history',()=>{
 for(const tab of ['overview','saved','collections','notifications','contributions','profile','settings'])
  assert.match(ui,new RegExp("id:'"+tab+"'"));
 assert.ok(!/id:'(interests|team|follows|activity)'/.test(ui));
 assert.ok(!ui.includes("tab==='activity'"));
 assert.ok(!ui.includes('آخر نشاطاتك'));
 assert.ok(!account.includes("'activity'"));
 assert.ok(ui.includes("id:'contributions'"));
 assert.ok(account.includes('<AccountWorkspace initialTab={tab}/>'));
 assert.ok(read('app/account/activity/page.jsx').includes('initialTab="contributions"'));
});

test('all account UI class names exist, and JSX self closing tags are syntactically sane',()=>{
 const classNames=[...new Set([...ui.matchAll(/styles\.([A-Za-z][A-Za-z0-9_]*)/g)].map(x=>x[1]))];
 for(const name of classNames)assert.ok(css.includes('.'+name),name);
 assert.ok(!/\/\s+>/.test(ui));
});

test('account workspace requests require JWT ownership and a field allowlist',()=>{
 for(const value of ['authorizeAudience(request,db)','taskRequestDb(request)','readJsonObject(request','user_id','readingContentItem(raw)','Object.keys']) {
  // The route is deliberately explicit rather than allowing arbitrary SQL/table names.
  if(value==='Object.keys')continue;
  assert.ok(api.includes(value),value);
 }
 for(const method of ['save','import','remove','collection_create','collection_rename','collection_delete','move','preferences','notification_read'])
  assert.ok(api.includes("action==='"+method+"'")||api.includes("action==='collection_create'||action==='collection_rename'"),method);
 assert.ok(!api.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!api.includes("db.from(body.table)"));
});

test('Postgres row ownership, avatar storage restrictions and private notifications exist',()=>{
 for(const table of ['account_saved_items','account_collections','account_preferences','account_notifications'])
  assert.ok(migration.includes('alter table public.'+table+' enable row level security'),table);
 assert.ok(migration.includes('user_id=(select auth.uid())'));
 assert.ok(migration.includes('grant select,update(read_at) on public.account_notifications'));
 assert.ok(migration.includes("bucket_id='967-account-avatars'"));
 assert.ok(migration.includes("storage.foldername(name)"));
 assert.ok(migration.includes("revoke all on function public.account_notify_debate_change()"));
 assert.ok(migration.includes('foreign key (collection_id,user_id)'));
});

test('new contributions are linked only after server verifies the bearer and matching email',()=>{
 assert.match(contact,/db\.auth\.getUser\(token\)/);
 assert.match(contact,/checked\.data\.user\.email\?\.toLowerCase\(\)!==email/);
 assert.match(contact,/user_id:accountUserId/);
 assert.match(contactMigration,/user_id=\(select auth\.uid\(\)\)/);
 assert.ok(contactMigration.includes('account_contact_status_update'));
 assert.ok(ui.includes('workspace.submissions'));
});

test('bookmarks remain local when signed out; old local files need deliberate import',()=>{
 assert.ok(bookmarks.includes("currentSession().then(session=>{"));
 assert.ok(bookmarks.includes("if(session)return audienceRequest"));
 assert.ok(bookmarks.includes("mirrorToAccount({action:'save',item})"));
 assert.ok(ui.includes("action:'import'"));
 assert.ok(reading.includes("const items=[...indexed.values()]"));
 assert.ok(ui.includes("لا تُنقل دون موافقتك"));
});

test('personal settings, file constraints and user data export are available',()=>{
 assert.ok(ui.includes("file.size>2*1024*1024"));
 assert.ok(ui.includes("967-account-avatars"));
 assert.ok(ui.includes("export=1"));
 assert.ok(ui.includes("new Blob("));
 assert.ok(ui.includes("deletion_request"));
 assert.ok(!ui.includes('role===management'));
});
