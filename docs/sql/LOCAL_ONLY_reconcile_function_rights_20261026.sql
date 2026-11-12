-- LOCAL ONLY: reconcile execute rights + postgres default table privileges.
-- Source: read-only production catalog snapshot 2026-10-26.
-- Do NOT run this against production. Do NOT move into supabase/migrations.
-- Run only with docker exec against supabase_db_967-db-backup.
-- The transaction rolls back automatically on SQL errors.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE expected_public_function_rights (
  sig text PRIMARY KEY,
  right_public boolean NOT NULL,
  right_anon boolean NOT NULL,
  right_auth boolean NOT NULL,
  right_service boolean NOT NULL
) ON COMMIT DROP;
INSERT INTO expected_public_function_rights VALUES
  ('public.contact_message_status_audit()',false,true,true,true),
  ('public.contact_rate_limit(p_key text)',false,false,false,true),
  ('public.debate_admin_mutate(p_action text, p_id uuid, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.debate_admin_mutate_base(p_action text, p_id uuid, p_revision bigint, p_data jsonb)',false,false,false,true),
  ('public.debate_audience_mutate(p_action text, p_id uuid, p_data jsonb)',false,false,true,true),
  ('public.debate_audience_mutate_pre_lifecycle(p_action text, p_id uuid, p_data jsonb)',false,false,false,true),
  ('public.debate_catalog()',false,true,true,true),
  ('public.debate_delete_rate()',false,false,false,true),
  ('public.debate_detail(p_slug text)',false,true,true,true),
  ('public.debate_detail_pre_lifecycle(p_slug text)',false,false,false,true),
  ('public.debate_discussion(p_debate uuid, p_kind text, p_page integer, p_order text)',false,true,true,true),
  ('public.debate_discussion_target(p_debate uuid, p_kind text, p_id uuid, p_order text)',false,true,true,true),
  ('public.debate_live_results(p_debate uuid)',false,true,true,true),
  ('public.debate_live_results_pre_lifecycle(p_debate uuid)',false,false,false,true),
  ('public.debate_live_results_visible(p_id uuid)',false,true,true,true),
  ('public.debate_participation_state(p_debate uuid)',false,true,true,true),
  ('public.debate_profile_signup()',false,false,false,true),
  ('public.debate_public_record(p_debate debates)',false,false,false,true),
  ('public.debate_recording_lifecycle_guard()',false,false,false,true),
  ('public.debate_require_user(p_action text)',false,false,false,true),
  ('public.debate_require_user_base(p_action text)',false,false,false,true),
  ('public.debate_result_change()',false,false,false,true),
  ('public.debate_result_debate_change()',false,false,false,true),
  ('public.debate_result_snapshot(p_id uuid, p_phase text)',false,false,false,true),
  ('public.debate_result_updates_visible(p_id uuid)',false,true,true,true),
  ('public.debate_role()',false,false,true,true),
  ('public.debate_slug_route_guard()',false,false,false,true),
  ('public.debate_speaker_public(p_slug text)',false,true,true,true),
  ('public.debate_touch_results(p_id uuid)',false,false,false,true),
  ('public.debate_visible(p_id uuid)',false,false,true,true),
  ('public.debate_work_guard()',false,false,false,true),
  ('public.directory_assert_writer()',false,false,false,false),
  ('public.directory_editorial_trigger()',false,false,false,false),
  ('public.directory_jsonb_array_equal(p_left jsonb, p_right jsonb)',false,false,false,false),
  ('public.directory_save_medical_center(p_id uuid, p_revision bigint, p_record jsonb, p_specialties jsonb, p_services jsonb, p_hours jsonb, p_branches jsonb, p_sources jsonb, p_origin text)',false,false,true,true),
  ('public.directory_save_university(p_id uuid, p_revision bigint, p_record jsonb, p_programs jsonb, p_branches jsonb, p_sources jsonb, p_origin text)',false,false,true,true),
  ('public.directory_set_deleted(p_kind text, p_id uuid, p_revision bigint, p_deleted boolean)',false,false,true,true),
  ('public.directory_touch_revision()',true,true,true,true),
  ('public.editor_delete_draft(p_key text, p_revision bigint)',false,false,true,true),
  ('public.editor_message_update(p_id uuid, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.editor_messages(p_filters jsonb)',false,false,true,true),
  ('public.editor_save_draft(p_kind text, p_key text, p_value jsonb, p_revision bigint)',false,false,true,true),
  ('public.editorial_can_read()',false,true,true,true),
  ('public.editorial_content_trigger()',false,false,false,false),
  ('public.editorial_current_path(p_type text, p_id text, p_known text)',false,false,true,true),
  ('public.editorial_debate_children(p_id uuid)',false,false,false,false),
  ('public.editorial_debate_mutate_legacy(p_action text, p_id uuid, p_revision bigint, p_data jsonb)',false,false,false,false),
  ('public.editorial_emit(p_type text, p_section text, p_id text, p_before jsonb, p_after jsonb, p_path text, p_fields text[])',false,false,false,false),
  ('public.editorial_inline_bridge()',false,false,false,false),
  ('public.editorial_inline_correction(p_kind text, p_id text, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.editorial_publication(p_type text, p_id text, p_known boolean)',false,false,true,true),
  ('public.editorial_report(p_filters jsonb)',false,false,true,true),
  ('public.editorial_service_save(p_kind text, p_id text, p_revision timestamp with time zone, p_data jsonb, p_actor uuid, p_action text, p_profile_changed boolean, p_page_baseline jsonb)',false,false,false,true),
  ('public.editorial_statistic_save(p_id uuid, p_revision timestamp with time zone, p_data jsonb, p_source_ids uuid[])',false,false,true,true),
  ('public.inline_comment_pin_guard()',false,false,false,true),
  ('public.inline_content_audit_change()',false,false,false,true),
  ('public.inline_content_fields(p_kind text)',false,false,false,true),
  ('public.inline_content_guard()',false,false,false,true),
  ('public.inline_content_read(p_kind text, p_id text, p_history boolean)',false,false,true,true),
  ('public.inline_content_save(p_kind text, p_id text, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.inline_content_table(p_kind text)',false,false,false,true),
  ('public.inline_content_undo(p_id uuid)',false,false,true,true),
  ('public.inline_editor_mutate(p_action text, p_kind text, p_id uuid, p_data jsonb)',false,false,true,true),
  ('public.inline_editor_read(p_view text, p_debate uuid, p_kind text, p_id uuid, p_status text, p_page integer, p_comment uuid)',false,false,true,true),
  ('public.inline_item(p_kind text, p_id uuid)',false,false,false,true),
  ('public.inline_service_save(p_kind text, p_id text, p_revision timestamp with time zone, p_data jsonb, p_actor uuid, p_action text)',false,false,false,true),
  ('public.is_967_editor()',false,true,true,true),
  ('public.is_editor()',false,true,true,true),
  ('public.is_management()',false,true,true,true),
  ('public.is_ranking_editor()',false,true,true,true),
  ('public.task_archive_completed()',false,false,true,true),
  ('public.task_audit()',false,false,false,true),
  ('public.task_can_complete_step(p_id uuid)',false,false,true,true),
  ('public.task_can_edit(p_id uuid)',false,false,true,true),
  ('public.task_child_audit()',false,false,false,true),
  ('public.task_child_guard()',false,false,false,true),
  ('public.task_collaboration_copy()',false,false,false,true),
  ('public.task_collaboration_primary()',false,false,false,true),
  ('public.task_collaboration_status()',false,false,false,true),
  ('public.task_complete_step(p_task uuid, p_revision bigint, p_step uuid, p_completed boolean)',false,false,true,true),
  ('public.task_deadline(p_due_at timestamp with time zone, p_due_date date, p_zone text)',false,false,true,true),
  ('public.task_guard()',false,false,false,true),
  ('public.task_is_member(p_id uuid, p_user uuid)',false,false,true,true),
  ('public.task_lock(p_id uuid, p_revision bigint)',false,false,true,true),
  ('public.task_member_audit()',false,false,false,true),
  ('public.task_member_guard()',false,false,false,true),
  ('public.task_mutate(p_action text, p_id uuid, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.task_mutate_legacy(p_action text, p_id uuid, p_revision bigint, p_data jsonb)',false,false,true,true),
  ('public.task_refresh_reminders()',false,false,true,true),
  ('public.task_role()',false,false,true,true),
  ('public.task_schedule_auto_archive()',false,false,false,true),
  ('public.task_soft_delete(p_id uuid, p_revision bigint)',false,false,true,true),
  ('public.task_team()',false,false,true,true),
  ('public.task_visible(p_id uuid)',false,false,true,true),
  ('public.touch_ranking_updated_at()',false,true,true,true),
  ('public.touch_stats_updated_at()',true,true,true,true);
DO $guard$
DECLARE actual_count int;
BEGIN
 IF inet_server_addr() IS NOT NULL THEN
   RAISE EXCEPTION 'Refusing TCP/remote database connection. Run inside local Docker by Unix socket.';
 END IF;
 SELECT count(*) INTO actual_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
 IF actual_count<>96 THEN
   RAISE EXCEPTION 'Expected 96 local functions; got %',actual_count;
 END IF;
 IF EXISTS (
   WITH local_functions AS (
     SELECT p.oid,
       n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS sig
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
   )
   SELECT 1
   FROM local_functions l
   FULL JOIN expected_public_function_rights e USING(sig)
   WHERE e.sig IS NULL OR l.oid IS NULL
 ) THEN
   RAISE EXCEPTION 'Function signatures do not match production. Aborting.';
 END IF;
END;
$guard$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
DO $grant$
DECLARE f record;
BEGIN
 FOR f IN
  SELECT p.oid, e.*
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN expected_public_function_rights e
    ON e.sig=n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
  WHERE n.nspname='public'
 LOOP
  IF f.right_public THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', f.oid::regprocedure); END IF;
  IF f.right_anon THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.oid::regprocedure); END IF;
  IF f.right_auth THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.oid::regprocedure); END IF;
  IF f.right_service THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.oid::regprocedure); END IF;
 END LOOP;
END;
$grant$;
-- Production: postgres-created public tables have no default TRUNCATE/TRIGGER for anon/authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 REVOKE TRUNCATE, TRIGGER ON TABLES FROM anon, authenticated;
DO $verify$
DECLARE mismatch int; default_excess int;
BEGIN
 SELECT count(*) INTO mismatch
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN expected_public_function_rights e
    ON e.sig=n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
 WHERE n.nspname='public' AND (
 has_function_privilege('anon',p.oid,'EXECUTE') IS DISTINCT FROM (e.right_anon OR e.right_public)
 OR has_function_privilege('authenticated',p.oid,'EXECUTE') IS DISTINCT FROM (e.right_auth OR e.right_public)
 OR has_function_privilege('service_role',p.oid,'EXECUTE') IS DISTINCT FROM (e.right_service OR e.right_public)
 );
 IF mismatch<>0 THEN RAISE EXCEPTION 'Function EXECUTE rights differ: %',mismatch; END IF;
 SELECT count(*) INTO default_excess
 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 JOIN pg_roles gr ON gr.oid=a.grantee
 WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole)='postgres'
   AND d.defaclobjtype='r' AND gr.rolname IN ('anon','authenticated')
   AND a.privilege_type IN ('TRIGGER','TRUNCATE');
 IF default_excess<>0 THEN RAISE EXCEPTION 'Unsafe local defaults remain: %',default_excess; END IF;
 RAISE NOTICE 'Verified 96 local function execute rights and postgres default table privileges.';
END;
$verify$;
COMMIT;
