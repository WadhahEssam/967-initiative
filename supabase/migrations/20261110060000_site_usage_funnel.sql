-- Conversion counters (2026-11-10): the same anonymous daily counters, with a third metric.
-- Steps match lib/siteAnalytics.js FUNNEL_STEPS. No identifiers are stored.
alter table public.site_usage_daily drop constraint if exists site_usage_daily_metric_check;
alter table public.site_usage_daily add constraint site_usage_daily_metric_check check (metric in ('page_view','search_miss','funnel'));

create or replace function public.record_site_usage(p_metric text,p_section text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog,public
as $$
begin
 if not (
  (p_metric='page_view' and p_section in (
   'home','school','games','history','figures','atlas','statistics','rankings',
   'debates','works','magazine','universities','medical','products',
   'professionals','search','contribute','other'
  ))
  or
  (p_metric='search_miss' and p_section in (
   'all','works','debates','issues','indicators','figures','history',
   'companies','professionals','places','domains'
  ))
  or
  (p_metric='funnel' and p_section in (
   'lesson_start_guest','lesson_start_member','lesson_done_guest','lesson_done_member','game_start_guest','game_start_member','game_done_guest','game_done_member','signup_prompt_shown','signup_prompt_click','signup_done','share_click','share_arrival'
  ))
 ) then
  raise exception 'invalid analytics category' using errcode='22023';
 end if;
 insert into public.site_usage_daily as counters (day,metric,section,total)
 values ((current_timestamp at time zone 'UTC')::date,p_metric,p_section,1)
 on conflict (day,metric,section)
 do update set total=counters.total+1;
end;
$$;

revoke all on function public.record_site_usage(text,text) from public,anon,authenticated;
grant execute on function public.record_site_usage(text,text) to service_role;
