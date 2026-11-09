import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateManagementAction} from '../lib/managementUsers.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261109120000_account_deletion_release.sql');
const route=read('app/api/admin/users/route.js');

test('the release function is for the service role only and detaches every blocking reference',()=>{
 assert.match(migration,/create or replace function public\.release_deleted_account\(p_user uuid,p_successor uuid\) returns jsonb\s+language plpgsql security definer set search_path=''/);
 assert.match(migration,/if coalesce\(auth\.role\(\),''\)<>'service_role' then raise exception 'Service role required'/);
 assert.match(migration,/revoke all on function public\.release_deleted_account\(uuid,uuid\) from public,anon,authenticated;/);
 assert.match(migration,/grant execute on function public\.release_deleted_account\(uuid,uuid\) to service_role;/);
 for(const column of ['tasks set assigned_to=p_successor','tasks set created_by=null','tasks set completed_by=null','task_members set added_by=null','task_comments set author_id=null','task_activity set actor_id=null','school_editor_courses set updated_by=null','school_editor_stages set updated_by=null','school_editor_questions set updated_by=null','school_editor_audit set actor_id=null'])
  assert.ok(migration.includes(column),column);
 assert.match(migration,/delete from public\.task_members where user_id=p_user;/);
 assert.match(migration,/Successor must be management/);
});

test('trigger guards skip only while a release runs for the service role',()=>{
 assert.match(migration,/select coalesce\(current_setting\('app\.account_release',true\),''\)='on' and coalesce\(auth\.role\(\),''\)='service_role'/);
 for(const name of ['task_guard','task_audit','task_schedule_auto_archive','task_collaboration_primary','task_collaboration_status','task_child_guard','task_child_audit','task_member_guard','task_member_audit','school_editor_audit_change']){
  const body=migration.slice(migration.indexOf('FUNCTION public.'+name+'()'));
  assert.ok(body.length<migration.length,name+' redefined');
  assert.match(body.slice(0,body.indexOf('$function$;')),/\nbegin\n -- Account deletion[^\n]*\n if public\.account_release_active\(\) then return case when tg_op='DELETE' then old else new end; end if;\n/,name);
 }
 assert.match(migration,/perform set_config\('app\.account_release','',true\);\n return result;/,'the switch is turned off before returning');
});

test('completed tasks may lose their completer, never their completion date',()=>{
 assert.match(migration,/alter table public\.tasks alter column created_by drop not null;/);
 assert.match(migration,/\(status='completed' and completed_at is not null\)\s+or \(status<>'completed' and completed_at is null and completed_by is null\)/);
});

test('the management API deletes only anonymised members who asked, and never staff or yourself',()=>{
 assert.equal(validateManagementAction({action:'delete',user_id:'8f0b0b1e-9d2a-4a39-9d4c-3c5c0ad2c0a1'}),null);
 assert.match(route,/if\(editor\)throw new RequestValidationError\('هذا الحساب لديه صلاحيات تحرير/);
 assert.match(route,/if\(!profile\.data\?\.deletion_requested_at\)throw/);
 assert.match(route,/if\(profile\.data\.display_name!=='حساب محذوف'\)throw/);
 assert.ok(route.indexOf("db.rpc('release_deleted_account'")<route.indexOf('db.auth.admin.deleteUser(target.id)'),'release before delete');
 assert.match(route,/body\.action==='delete'\?'لا يمكنك حذف حسابك الحالي من هنا\.'/);
 const admin=read('components/debates/DebateAdmin.jsx');
 assert.ok(admin.includes("{p.display_name==='حساب محذوف'&&<button")&&admin.includes("audienceRequest('/api/admin/users',{action:'delete',user_id:member.user_id})"));
 assert.ok(!admin.includes('لوحة Supabase'));
});
