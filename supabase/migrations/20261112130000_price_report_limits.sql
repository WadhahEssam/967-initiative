-- «المُبلّغ المحلي» (2026-11-12), phase 2: saving a report or a confirmation, with the reporting
-- limits checked in the database so that parallel requests cannot pass them:
-- - one report per member for the same thing in the same city every 6 hours (a confirmation
--   counts as a report);
-- - 20 reports a day per member (a day in Yemen time).
-- Called by the server only (service role). The answer says how many were saved and whether a
-- limit was reached; it never says whether a report will count.

create or replace function public.price_report_submit(
 p_user uuid,
 p_entries jsonb,
 p_confirmation boolean,
 p_source text,
 p_device text,
 p_connection text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_entry jsonb;
 v_today integer;
 v_saved integer := 0;
 v_recent integer := 0;
 v_id bigint;
 v_ids bigint[] := '{}';
begin
 if p_user is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) not between 1 and 2 then
  raise exception 'invalid report' using errcode = '22023';
 end if;
 -- One member at a time, so two requests sent together see each other.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('price_report:' || p_user::text, 0));
 select count(*) into v_today
 from public.price_reports
 where user_id = p_user
  and created_at >= (pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'Asia/Aden') at time zone 'Asia/Aden');
 if v_today + jsonb_array_length(p_entries) > 20 then
  return jsonb_build_object('saved', 0, 'recent', 0, 'daily', true, 'ids', '[]'::jsonb);
 end if;
 for v_entry in select value from jsonb_array_elements(p_entries) loop
  if exists (
   select 1 from public.price_reports
   where user_id = p_user
    and kind = v_entry->>'kind' and region = v_entry->>'region'
    and item = v_entry->>'item' and side = v_entry->>'side'
    and created_at > pg_catalog.now() - interval '6 hours'
  ) then
   v_recent := v_recent + 1;
   continue;
  end if;
  insert into public.price_reports(user_id, region, kind, item, side, value, confirmation, source, device_hash, connection_hash)
  values (p_user, v_entry->>'region', v_entry->>'kind', v_entry->>'item', v_entry->>'side', (v_entry->>'value')::numeric,
   coalesce(p_confirmation, false), nullif(p_source, ''), p_device, p_connection)
  returning id into v_id;
  v_ids := v_ids || v_id;
  v_saved := v_saved + 1;
 end loop;
 return jsonb_build_object('saved', v_saved, 'recent', v_recent, 'daily', false, 'ids', to_jsonb(v_ids));
end;
$$;

revoke all on function public.price_report_submit(uuid, jsonb, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.price_report_submit(uuid, jsonb, boolean, text, text, text) to service_role;
