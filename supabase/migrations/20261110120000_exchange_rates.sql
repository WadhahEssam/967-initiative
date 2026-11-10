-- «الخدمات» / أسعار الصرف (2026-11-10): rates entered by hand every day for Sanaa and Aden.
-- Each submission is a batch of rows (one per city and currency). Nothing is deleted: a wrong
-- batch is hidden by an editor, and the previous one shows again.
-- The site reads and writes through the server (service role); browsers have no direct access.

create table if not exists public.exchange_rates(
 id bigint generated always as identity primary key,
 batch_id uuid not null,
 recorded_at timestamptz not null default now(),
 region text not null check (region in ('sanaa','aden')),
 currency text not null check (currency in ('USD','SAR')),
 buy numeric(12,2) not null check (buy>0 and buy<100000),
 sell numeric(12,2) not null check (sell>0 and sell<100000 and sell>=buy),
 note text check (note is null or char_length(note)<=200),
 entered_by uuid references auth.users(id) on delete set null,
 hidden boolean not null default false,
 hidden_by uuid references auth.users(id) on delete set null,
 hidden_at timestamptz,
 unique (batch_id,region,currency)
);
create index if not exists exchange_rates_latest_idx on public.exchange_rates(region,currency,recorded_at desc) where not hidden;
create index if not exists exchange_rates_batch_idx on public.exchange_rates(batch_id);

-- People who may enter rates without being editors (the daily rates reporter).
create table if not exists public.exchange_rate_reporters(
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;
alter table public.exchange_rate_reporters enable row level security;
revoke all on public.exchange_rates from public,anon,authenticated;
revoke all on public.exchange_rate_reporters from public,anon,authenticated;
grant all on public.exchange_rates to service_role;
grant all on public.exchange_rate_reporters to service_role;

-- Page-view counters: the new «services» bucket (same lists as 20261110060000, plus services).
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
   'professionals','services','search','contribute','other'
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
