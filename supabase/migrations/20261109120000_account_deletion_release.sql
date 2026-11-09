-- Account deletion no longer stops at editors' tasks and lesson edits.
--
-- Seven foreign keys from the task tables (RESTRICT) and four from the school studio (NO ACTION)
-- refuse to delete an auth user who ever created, was assigned, commented on or edited something.
-- Only editors have such rows. public.release_deleted_account(user, successor) detaches them
-- first, then the server deletes the auth user:
--   * memberships of the user are removed;
--   * tasks assigned to the user go to the successor (the manager doing the deletion);
--   * created_by, completed_by, added_by, author_id, actor_id and updated_by become NULL
--     (the task screens already show «عضو سابق» for an unknown member).
-- The trigger guards and logs skip their checks only inside that function, and only for the
-- service role (auth.role()), so members cannot use the switch.

alter table public.tasks alter column created_by drop not null;
alter table public.task_comments alter column author_id drop not null;
alter table public.task_members alter column added_by drop not null;
alter table public.tasks drop constraint tasks_check1;
alter table public.tasks add constraint tasks_check1 check (
 (status='completed' and completed_at is not null)
 or (status<>'completed' and completed_at is null and completed_by is null)
);

create or replace function public.account_release_active() returns boolean
language sql stable set search_path='' as $$
 select coalesce(current_setting('app.account_release',true),'')='on' and coalesce(auth.role(),'')='service_role'
$$;

create or replace function public.release_deleted_account(p_user uuid,p_successor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:='{}'::jsonb; n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if p_user is null or p_successor is null or p_user=p_successor then raise exception 'User and successor required' using errcode='22023'; end if;
 if not exists(select 1 from public.editors where user_id=p_successor and role='management') then raise exception 'Successor must be management' using errcode='22023'; end if;
 perform set_config('app.account_release','on',true);
 delete from public.task_members where user_id=p_user; get diagnostics n=row_count; result:=result||jsonb_build_object('memberships',n);
 -- The successor cannot be both assignee and participant of the same task.
 delete from public.task_members where user_id=p_successor and task_id in (select id from public.tasks where assigned_to=p_user);
 update public.tasks set assigned_to=p_successor where assigned_to=p_user; get diagnostics n=row_count; result:=result||jsonb_build_object('reassigned',n);
 update public.tasks set created_by=null where created_by=p_user;
 update public.tasks set completed_by=null where completed_by=p_user;
 update public.task_members set added_by=null where added_by=p_user;
 update public.task_comments set author_id=null where author_id=p_user; get diagnostics n=row_count; result:=result||jsonb_build_object('comments',n);
 update public.task_activity set actor_id=null where actor_id=p_user;
 update public.school_editor_courses set updated_by=null where updated_by=p_user;
 update public.school_editor_stages set updated_by=null where updated_by=p_user;
 update public.school_editor_questions set updated_by=null where updated_by=p_user;
 update public.school_editor_audit set actor_id=null where actor_id=p_user;
 perform set_config('app.account_release','',true);
 return result;
end $$;
revoke all on function public.release_deleted_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.release_deleted_account(uuid,uuid) to service_role;

-- Trigger functions, unchanged except for the early exit after "begin".
CREATE OR REPLACE FUNCTION public.task_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r text:=public.task_role();v text;touch_only boolean:=false;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 if r is null then raise exception 'Editor required' using errcode='42501'; end if;
 if tg_op='UPDATE' then touch_only:=public.task_is_member(old.id) and
  (to_jsonb(new)-array['revision','updated_at'])=(to_jsonb(old)-array['revision','updated_at']); end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from auth.uid() or (r<>'management' and new.assigned_to is distinct from auth.uid())
   or new.archived_at is not null or new.deleted_at is not null or (new.recurrence_of is not null and pg_trigger_depth()<2)
  then raise exception 'Invalid task ownership' using errcode='42501';end if;
  new.created_at:=clock_timestamp();new.revision:=1;
 else
  if old.deleted_at is not null or (r<>'management' and old.assigned_to is distinct from auth.uid() and not touch_only) then raise exception 'Task edit denied' using errcode='42501';end if;
  if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at or new.recurrence_of is distinct from old.recurrence_of then raise exception 'Immutable task field' using errcode='42501';end if;
  if r<>'management' and (new.assigned_to<>old.assigned_to or new.requires_review<>old.requires_review or new.deleted_at is distinct from old.deleted_at) then raise exception 'Management required' using errcode='42501';end if;
  if new.deleted_at is distinct from old.deleted_at then new.deleted_at:=clock_timestamp();end if;new.revision:=old.revision+1;
 end if;
 if tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to then
  if not exists(select 1 from public.editors where user_id=new.assigned_to and role in ('admin','management')) then raise exception 'Assignee is not an editor' using errcode='23514';end if;
 end if;
 if new.project_id is not null and (tg_op='INSERT' or new.project_id is distinct from old.project_id) and not exists(select 1 from public.task_projects where id=new.project_id and is_active)
  and not(tg_op='INSERT' and pg_trigger_depth()>1 and new.recurrence_of is not null and exists(select 1 from public.tasks where id=new.recurrence_of and project_id=new.project_id)) then raise exception 'Inactive project' using errcode='23514';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.due_timezone) then raise exception 'Invalid timezone' using errcode='23514';end if;
 if new.start_at>=public.task_deadline(new.due_at,new.due_date,new.due_timezone) then raise exception 'Start follows deadline' using errcode='23514';end if;
 foreach v in array new.tags loop if v is null or length(btrim(v)) not between 1 and 60 then raise exception 'Invalid tag' using errcode='23514';end if;end loop;
 foreach v in array new.links loop if v is null or length(v)>2048 or v !~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$' then raise exception 'Invalid link' using errcode='23514';end if;end loop;
 if new.status='completed' then
  if tg_op='INSERT' or old.status<>'completed' then
   if new.requires_review and r<>'management' then raise exception 'Review approval required' using errcode='42501';end if;
   new.completed_at:=clock_timestamp();new.completed_by:=auth.uid();
  else new.completed_at:=old.completed_at;new.completed_by:=old.completed_by;end if;
 else new.completed_at:=null;new.completed_by:=null;end if;
 if new.archived_at is not null then
  if new.status<>'completed' then raise exception 'Only completed tasks can be archived' using errcode='23514';end if;
  if tg_op='INSERT' or old.archived_at is null then new.archived_at:=clock_timestamp();else new.archived_at:=old.archived_at;end if;
 end if;
 new.updated_at:=clock_timestamp();return new;
end $function$;

CREATE OR REPLACE FUNCTION public.task_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; a text; recipient uuid; next_id uuid; step interval;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 if tg_op='INSERT' then
  insert into public.task_activity(task_id,actor_id,action,new_value) values(new.id,auth.uid(),'created',jsonb_build_object('title',new.title));
 else
  for k in select key from jsonb_each(to_jsonb(new)-array['updated_at','revision']) loop
   if to_jsonb(old)->k is distinct from to_jsonb(new)->k then
    a:=case when k='status' and new.status='completed' then 'completed' when k='status' and old.status='completed' then 'reopened' when k='archived_at' and new.archived_at is not null then 'archived' when k='archived_at' then 'restored' when k='deleted_at' then 'deleted' else 'updated' end;
    insert into public.task_activity(task_id,actor_id,action,field,old_value,new_value) values(new.id,auth.uid(),a,k,to_jsonb(old)->k,to_jsonb(new)->k);
   end if;
  end loop;
 end if;
 if tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to then
  insert into public.task_notifications(user_id,task_id,kind,dedupe_key) values(new.assigned_to,new.id,'assignment',new.id||':assignment:'||new.revision) on conflict do nothing;
 end if;
 if tg_op='UPDATE' and old.status='completed' and new.status<>'completed' then
  insert into public.task_notifications(user_id,task_id,kind,dedupe_key) values(new.assigned_to,new.id,'reopened',new.id||':reopened:'||new.revision) on conflict do nothing;
 end if;
 if new.status='in_review' and (tg_op='INSERT' or old.status<>'in_review') then
  insert into public.task_notifications(user_id,task_id,kind,dedupe_key)
   select user_id,new.id,'review',new.id||':review:'||new.revision from public.editors where role='management' on conflict do nothing;
 end if;
 -- Row update lock + UNIQUE(recurrence_of) make completion/retries/reopening idempotent.
 if new.status='completed' and new.recurrence<>'none' and (tg_op='INSERT' or old.status<>'completed') then
  step:=case new.recurrence when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
  insert into public.tasks(title,description,notes,project_id,created_by,assigned_to,priority,start_at,due_at,due_date,due_timezone,estimated_minutes,tags,links,requires_review,recurrence,recurrence_of)
   values(new.title,new.description,new.notes,new.project_id,auth.uid(),new.assigned_to,new.priority,
    case when new.start_at is null then null else ((new.start_at at time zone new.due_timezone)+step) at time zone new.due_timezone end,
    case when new.due_at is null then null else ((new.due_at at time zone new.due_timezone)+step) at time zone new.due_timezone end,
    (new.due_date+step)::date,new.due_timezone,new.estimated_minutes,new.tags,new.links,new.requires_review,new.recurrence,new.id)
   on conflict(recurrence_of) do nothing returning id into next_id;
  if next_id is not null then
   insert into public.task_subtasks(task_id,title,position) select next_id,title,position from public.task_subtasks where task_id=new.id;
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.task_schedule_auto_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 if new.status<>'completed' then new.auto_archive_at:=null;new.auto_archived:=false;
 elsif tg_op='INSERT' or old.status<>'completed' then new.auto_archive_at:=new.completed_at+interval '24 hours';new.auto_archived:=false;
 elsif old.archived_at is not null and new.archived_at is null then new.auto_archive_at:=clock_timestamp()+interval '24 hours';new.auto_archived:=false;
 else new.auto_archive_at:=old.auto_archive_at; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.task_collaboration_primary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 if new.assigned_to is distinct from old.assigned_to then delete from public.task_members where task_id=new.id and user_id=new.assigned_to;end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.task_collaboration_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 delete from public.task_notifications where task_id=new.id and user_id=auth.uid() and
  dedupe_key in(new.id||':assignment:'||new.revision,new.id||':reopened:'||new.revision,new.id||':review:'||new.revision);
 if tg_op='UPDATE' and new.status is distinct from old.status then
  insert into public.task_notifications(user_id,task_id,kind,dedupe_key)
  select distinct recipient,new.id,'status',new.id||':status:'||new.revision
  from unnest(array[new.assigned_to,new.created_by]||array(select user_id from public.task_members where task_id=new.id)) recipient
  join public.editors e on e.user_id=recipient and e.role in ('admin','management')
  where recipient<>auth.uid() and not(new.status='in_review' and e.role='management')
  and not(old.status='completed' and recipient=new.assigned_to)
  on conflict do nothing;
 end if;return new;
end $function$;

CREATE OR REPLACE FUNCTION public.task_child_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tid uuid;r text:=public.task_role();uid uuid;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 tid:=case when tg_op='DELETE' then old.task_id else new.task_id end;
 perform 1 from public.tasks where id=tid for update;
 if r is null or not public.task_visible(tid) then raise exception 'Editor required' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.task_id<>old.task_id or new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Immutable child field' using errcode='42501';end if;
 if tg_table_name='task_subtasks' then
  if not public.task_can_edit(tid) then
   if tg_op<>'UPDATE' or not public.task_can_complete_step(tid) then raise exception 'Task edit denied' using errcode='42501';end if;
   if (to_jsonb(new)-array['is_completed','completed_at'])<>(to_jsonb(old)-array['is_completed','completed_at']) then raise exception 'Only step completion allowed' using errcode='42501';end if;
  end if;
  if tg_op<>'DELETE' then
   if new.is_completed then if tg_op='INSERT' or not old.is_completed then new.completed_at:=clock_timestamp();else new.completed_at:=old.completed_at;end if;
   else new.completed_at:=null;end if;
  end if;
 else
  if tg_op='DELETE' then raise exception 'Use comment tombstone' using errcode='42501';end if;
  if tg_op='INSERT' then
   if new.author_id<>auth.uid() or new.deleted_at is not null then raise exception 'Invalid author' using errcode='42501';end if;
   if new.parent_id is not null and not exists(select 1 from public.task_comments where id=new.parent_id and task_id=tid and deleted_at is null) then raise exception 'Reply parent unavailable' using errcode='23514';end if;
   new.created_at:=clock_timestamp();new.updated_at:=new.created_at;new.edited_at:=null;new.revision:=1;
  else
   if old.author_id<>auth.uid() and r<>'management' or old.deleted_at is not null then raise exception 'Comment edit denied' using errcode='42501';end if;
   if current_setting('app967.task_comment_revision',true) is distinct from old.id::text||':'||old.revision then raise exception 'Comment changed; reload' using errcode='40001';end if;
   perform set_config('app967.task_comment_revision','',true);
   if new.author_id<>old.author_id or new.parent_id is distinct from old.parent_id then raise exception 'Immutable comment ancestry' using errcode='42501';end if;
   new.updated_at:=clock_timestamp();new.edited_at:=new.updated_at;new.revision:=old.revision+1;
   if new.deleted_at is not null then new.deleted_at:=clock_timestamp();new.body:='تم حذف هذا التعليق';new.mention_ids:='{}';end if;
  end if;
  if cardinality(new.mention_ids)<>(select count(distinct x) from unnest(new.mention_ids)x) then raise exception 'Duplicate mention' using errcode='23514';end if;
  foreach uid in array new.mention_ids loop
   if uid is null or not exists(select 1 from public.editors where user_id=uid and role in ('admin','management')) then raise exception 'Invalid mention' using errcode='23514';end if;
  end loop;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION public.task_child_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tid uuid:=case when tg_op='DELETE' then old.task_id else new.task_id end;
 kind text:=case when tg_table_name='task_comments' then 'comment' else 'subtask' end;parent_author uuid;uid uuid;action text;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 action:=kind||'_'||lower(tg_op);
 if tg_table_name='task_comments' then
  if tg_op='UPDATE' and new.deleted_at is not null then action:='comment_delete';end if;
 end if;
 insert into public.task_activity(task_id,actor_id,action,old_value,new_value) values(tid,auth.uid(),action,
  case when tg_op='INSERT' then null else to_jsonb(old) end,case when tg_op='DELETE' then null else to_jsonb(new) end);
 if tg_table_name='task_comments' then
 if new.deleted_at is null then
  if new.parent_id is not null then select author_id into parent_author from public.task_comments where id=new.parent_id;end if;
  if tg_op='INSERT' and parent_author is not null and parent_author<>auth.uid() then
   insert into public.task_notifications(user_id,task_id,comment_id,kind,dedupe_key)
   values(parent_author,tid,new.id,'reply','reply:'||new.id) on conflict do nothing;
  end if;
  foreach uid in array new.mention_ids loop
   if uid<>auth.uid() and uid is distinct from parent_author and (tg_op='INSERT' or not(uid=any(old.mention_ids))) then
    insert into public.task_notifications(user_id,task_id,comment_id,kind,dedupe_key)
    values(uid,tid,new.id,'mention','mention:'||new.id||':'||uid) on conflict do nothing;
   end if;
  end loop;
  if tg_op='INSERT' then
   -- One rolling notification per recipient/task/day, not one per message.
   insert into public.task_notifications(user_id,task_id,comment_id,kind,dedupe_key)
   select distinct recipient,tid,new.id,'comment',tid||':discussion:'||(clock_timestamp() at time zone 'UTC')::date
   from public.tasks t cross join lateral unnest(array[t.assigned_to,t.created_by]||array(select user_id from public.task_members where task_id=tid)) recipient
   join public.editors e on e.user_id=recipient and e.role in ('admin','management')
   where t.id=tid and recipient<>auth.uid() and recipient is distinct from parent_author and not(recipient=any(new.mention_ids))
   on conflict(user_id,dedupe_key) do update set created_at=excluded.created_at,comment_id=excluded.comment_id,read_at=null;
  end if;
 end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION public.task_member_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tasks; copied boolean:=false;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 select * into t from public.tasks where id=case when tg_op='DELETE' then old.task_id else new.task_id end for update;
 if tg_op='INSERT' and pg_trigger_depth()>1 and t.recurrence_of is not null then
  copied:=exists(select 1 from public.task_members m where m.task_id=t.recurrence_of and m.user_id=new.user_id);
 end if;
 if not copied and (public.task_role() is distinct from 'management' or t.deleted_at is not null) then
  raise exception 'Management required' using errcode='42501';
 end if;
 if tg_op='INSERT' then
  if new.user_id=t.assigned_to or not exists(select 1 from public.editors e where e.user_id=new.user_id and e.role in ('admin','management')) then
   raise exception 'Invalid task participant' using errcode='23514'; end if;
  new.added_by:=auth.uid();new.created_at:=clock_timestamp();
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION public.task_member_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tid uuid:=case when tg_op='DELETE' then old.task_id else new.task_id end;
 uid uuid:=case when tg_op='DELETE' then old.user_id else new.user_id end; t public.tasks;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 -- The task guard still runs; recurrence inserts may be made by the primary.
 update public.tasks set title=title where id=tid returning * into t;
 insert into public.task_activity(task_id,actor_id,action,field,old_value,new_value)
 values(tid,auth.uid(),case when tg_op='INSERT' then 'member_added' else 'member_removed' end,'participant',
  case when tg_op='DELETE' then to_jsonb(uid) end,case when tg_op='INSERT' then to_jsonb(uid) end);
 if uid<>auth.uid() and (tg_op='INSERT' or uid<>t.assigned_to) then
  insert into public.task_notifications(user_id,task_id,kind,dedupe_key)
  values(uid,tid,case when tg_op='INSERT' then 'assignment' else 'unassigned' end,tid||':membership:'||t.revision||':'||lower(tg_op)) on conflict do nothing;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;

CREATE OR REPLACE FUNCTION public.school_editor_audit_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 key text;
 kind text;
 activity text;
 old_value jsonb;
begin
 -- Account deletion (public.release_deleted_account) detaches a user's rows; skip the editor checks and logs.
 if public.account_release_active() then return case when tg_op='DELETE' then old else new end; end if;
 if TG_TABLE_NAME='school_editor_courses' then
  kind:='course'; key:=NEW.slug;
 elsif TG_TABLE_NAME='school_editor_stages' then
  kind:='stage'; key:=NEW.course_slug||':'||NEW.stage_index::text;
 else
  kind:='question'; key:=NEW.course_slug||':'||NEW.stage_index::text||':'||NEW.id::text;
 end if;
 if TG_OP='INSERT' then
  activity:='created'; old_value:=null;
 else
  old_value:=to_jsonb(OLD);
  if OLD.published_version is distinct from NEW.published_version then
   activity:='published';
  else
   activity:='saved';
  end if;
 end if;
 insert into public.school_editor_audit(actor_id,entity,entity_key,action,before_snapshot,after_snapshot)
 values(NEW.updated_by,kind,key,activity,old_value,to_jsonb(NEW));
 return NEW;
end;
$function$;
