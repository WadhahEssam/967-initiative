-- «المُبلّغ المحلي» (2026-11-12), phase 5: the reporters' badges (lib/priceIncentives.js).
-- Earned once and kept, like the games' badges: a later drop in score never takes one away.
-- Server only (service role); members read their own through the site.

create table if not exists public.price_reporter_badges(
 user_id uuid not null references auth.users(id) on delete cascade,
 code text not null check (code in ('first_report','city_eye','trusted_source','first_mover')),
 earned_at timestamptz not null default now(),
 primary key (user_id,code)
);

alter table public.price_reporter_badges enable row level security;
revoke all on public.price_reporter_badges from public,anon,authenticated;
grant all on public.price_reporter_badges to service_role;

-- The weekly board reads the week's graded reports by time.
create index if not exists price_reports_graded_idx on public.price_reports(created_at desc) where scored_at is not null and not confirmation;
