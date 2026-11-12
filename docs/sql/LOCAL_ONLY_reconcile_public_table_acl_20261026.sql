-- LOCAL TEST ONLY. Reconcile public TABLE grants to verified 967 production snapshot.
-- Generated from read-only catalog information on 2026-10-26.
-- DO NOT run on Supabase production. DO NOT put this under supabase/migrations.
-- Snapshot comprises 57 public tables and 171 role/table combinations.
-- SQL is deliberately guarded to run only over a local Unix-domain Postgres socket.
-- Uses transaction + error checks; changes only local table access privileges.
-- Does not reconcile schema grants, function/sequence grants, default privileges, or auth/storage users.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $guard$
DECLARE actual_tables text[];
BEGIN
  IF inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'This script must be executed inside the LOCAL Docker container via Unix socket; remote/TCP connections are rejected';
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text)
    INTO actual_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p');
  IF actual_tables IS DISTINCT FROM ARRAY[
    'contact_rate_limits',
    'debate_comments',
    'debate_moderation_actions',
    'debate_participants',
    'debate_poll_options',
    'debate_polls',
    'debate_questions',
    'debate_rate_limits',
    'debate_reports',
    'debate_result_updates',
    'debate_speakers',
    'debate_suggestions',
    'debate_task_links',
    'debate_video_chapters',
    'debate_votes',
    'debates',
    'districts',
    'editor_drafts',
    'editorial_audit_activation',
    'editorial_contributions',
    'editors',
    'governorates',
    'inline_content_audit',
    'issues',
    'medical_center_branches',
    'medical_center_hours',
    'medical_center_services',
    'medical_center_sources',
    'medical_center_specialties',
    'medical_centers',
    'message_followups',
    'messages',
    'professionals',
    'public_profiles',
    'ranking_indicators',
    'ranking_snapshots',
    'site_settings',
    'stat_domains',
    'stat_indicator_sources',
    'stat_indicators',
    'stat_sections',
    'stat_sources',
    'stat_values',
    'task_activity',
    'task_comments',
    'task_members',
    'task_notifications',
    'task_projects',
    'task_subtasks',
    'tasks',
    'universities',
    'university_branches',
    'university_programs',
    'university_sources',
    'works',
    'yemeni_companies',
    'yemeni_figures'
  ]::text[] THEN
    RAISE EXCEPTION 'Local public table names differ from production snapshot. Transaction cancelled.';
  END IF;
END;
$guard$;

-- Clear default local stack permissions unintentionally carried onto RESTORED tables.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- Restore exact *explicit* grants recorded on production public tables.
GRANT SELECT ON TABLE "public"."debate_comments" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_comments" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_moderation_actions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_moderation_actions" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_participants" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_participants" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_poll_options" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_poll_options" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_polls" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_polls" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_questions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_questions" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_rate_limits" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_reports" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_result_updates" TO "anon";
GRANT SELECT ON TABLE "public"."debate_result_updates" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_result_updates" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_speakers" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_speakers" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_suggestions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_suggestions" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_task_links" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_task_links" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_video_chapters" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_video_chapters" TO "service_role";
GRANT SELECT ON TABLE "public"."debate_votes" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debate_votes" TO "service_role";
GRANT SELECT ON TABLE "public"."debates" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."debates" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."districts" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."districts" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."districts" TO "service_role";
GRANT SELECT ON TABLE "public"."editor_drafts" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."editor_drafts" TO "service_role";
GRANT SELECT ON TABLE "public"."editorial_audit_activation" TO "authenticated";
GRANT SELECT ON TABLE "public"."editorial_contributions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."editors" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."editors" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."governorates" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."governorates" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."governorates" TO "service_role";
GRANT SELECT ON TABLE "public"."inline_content_audit" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inline_content_audit" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."issues" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."issues" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."issues" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_center_branches" TO "anon";
GRANT SELECT ON TABLE "public"."medical_center_branches" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_center_branches" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_center_hours" TO "anon";
GRANT SELECT ON TABLE "public"."medical_center_hours" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_center_hours" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_center_services" TO "anon";
GRANT SELECT ON TABLE "public"."medical_center_services" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_center_services" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_center_sources" TO "anon";
GRANT SELECT ON TABLE "public"."medical_center_sources" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_center_sources" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_center_specialties" TO "anon";
GRANT SELECT ON TABLE "public"."medical_center_specialties" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_center_specialties" TO "service_role";
GRANT SELECT ON TABLE "public"."medical_centers" TO "anon";
GRANT SELECT ON TABLE "public"."medical_centers" TO "authenticated";
GRANT SELECT ON TABLE "public"."medical_centers" TO "service_role";
GRANT SELECT ON TABLE "public"."message_followups" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_followups" TO "service_role";
GRANT MAINTAIN, REFERENCES, SELECT ON TABLE "public"."messages" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."professionals" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."professionals" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."professionals" TO "service_role";
GRANT SELECT ON TABLE "public"."public_profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."public_profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."ranking_indicators" TO "anon";
GRANT SELECT ON TABLE "public"."ranking_indicators" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ranking_indicators" TO "service_role";
GRANT SELECT ON TABLE "public"."ranking_snapshots" TO "anon";
GRANT SELECT ON TABLE "public"."ranking_snapshots" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ranking_snapshots" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."site_settings" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."site_settings" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_settings" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_domains" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_domains" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_domains" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_indicator_sources" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_indicator_sources" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_indicator_sources" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_indicators" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_indicators" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_indicators" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_sections" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_sections" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_sections" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_sources" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_sources" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_sources" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_values" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."stat_values" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."stat_values" TO "service_role";
GRANT SELECT ON TABLE "public"."task_activity" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_activity" TO "service_role";
GRANT INSERT, SELECT, UPDATE ON TABLE "public"."task_comments" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_comments" TO "service_role";
GRANT DELETE, INSERT, SELECT ON TABLE "public"."task_members" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_members" TO "service_role";
GRANT SELECT ON TABLE "public"."task_notifications" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_notifications" TO "service_role";
GRANT INSERT, SELECT, UPDATE ON TABLE "public"."task_projects" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_projects" TO "service_role";
GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."task_subtasks" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."task_subtasks" TO "service_role";
GRANT SELECT ON TABLE "public"."tasks" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tasks" TO "service_role";
GRANT SELECT ON TABLE "public"."universities" TO "anon";
GRANT SELECT ON TABLE "public"."universities" TO "authenticated";
GRANT SELECT ON TABLE "public"."universities" TO "service_role";
GRANT SELECT ON TABLE "public"."university_branches" TO "anon";
GRANT SELECT ON TABLE "public"."university_branches" TO "authenticated";
GRANT SELECT ON TABLE "public"."university_branches" TO "service_role";
GRANT SELECT ON TABLE "public"."university_programs" TO "anon";
GRANT SELECT ON TABLE "public"."university_programs" TO "authenticated";
GRANT SELECT ON TABLE "public"."university_programs" TO "service_role";
GRANT SELECT ON TABLE "public"."university_sources" TO "anon";
GRANT SELECT ON TABLE "public"."university_sources" TO "authenticated";
GRANT SELECT ON TABLE "public"."university_sources" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."works" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."works" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."works" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."yemeni_companies" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."yemeni_companies" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."yemeni_companies" TO "service_role";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."yemeni_figures" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, UPDATE ON TABLE "public"."yemeni_figures" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."yemeni_figures" TO "service_role";
-- Audit all 171 role/table entries after restoring explicit grants.
DO $verify$
DECLARE actual_hash text;
BEGIN
  WITH acl_snapshot AS (
    SELECT c.relname, n.nspname, r.rolname,
      COALESCE((SELECT string_agg(x.privilege_type,',' ORDER BY x.privilege_type)
        FROM aclexplode(c.relacl) x WHERE x.grantee=r.oid),'') AS rights
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND r.rolname IN ('anon','authenticated','service_role')
  )
  SELECT md5(string_agg(format('%I.%I/%s:%s',nspname,relname,rolname,rights),
    E'\n' ORDER BY relname,rolname)) INTO actual_hash
  FROM acl_snapshot;
  IF actual_hash IS DISTINCT FROM '5ea378c4c8c3e3c416842a46a8358468' THEN
    RAISE EXCEPTION 'ACL mismatch (found %, expected production snapshot). Transaction cancelled.', actual_hash;
  END IF;
  RAISE NOTICE 'Verified 57 local tables and explicit grants for anon/authenticated/service_role against production snapshot.';
END;
$verify$;
COMMIT;
