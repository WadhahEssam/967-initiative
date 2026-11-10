-- «دليل المعاملات» (2026-11-10): step-by-step guides to government transactions, one variant
-- per city (Sanaa, Aden) in variants jsonb. Guides are written as drafts, checked by a person who
-- knows the offices, then published; a published guide must carry its verification date.
-- Nothing is deleted from the site: a guide is unpublished by moving it back to draft.
-- The site reads and writes through the server (service role); browsers have no direct access.

create table if not exists public.transaction_guides(
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug)<=60),
 title text not null check (char_length(title) between 1 and 120),
 summary text not null default '' check (char_length(summary)<=400),
 audience text not null default '' check (char_length(audience)<=400),
 category text not null check (category in ('identity','travel','vehicles','education','legal','other')),
 status text not null default 'draft' check (status in ('draft','review','published')),
 variants jsonb not null default '{}'::jsonb check (jsonb_typeof(variants)='object' and pg_column_size(variants)<200000),
 sources text[] not null default '{}',
 verified_at date,
 verified_by text check (verified_by is null or char_length(verified_by)<=80),
 editor_note text check (editor_note is null or char_length(editor_note)<=600),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 check (status<>'published' or verified_at is not null)
);
create index if not exists transaction_guides_status_idx on public.transaction_guides(status,category);

-- People who may write and check guides without being editors (the guides verifier).
create table if not exists public.transaction_guide_editors(
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);

alter table public.transaction_guides enable row level security;
alter table public.transaction_guide_editors enable row level security;
revoke all on public.transaction_guides from public,anon,authenticated;
revoke all on public.transaction_guide_editors from public,anon,authenticated;
grant all on public.transaction_guides to service_role;
grant all on public.transaction_guide_editors to service_role;

-- Page-view counters: the new «transactions» bucket (same lists as 20261110120000, plus transactions).
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
   'professionals','services','transactions','search','contribute','other'
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
