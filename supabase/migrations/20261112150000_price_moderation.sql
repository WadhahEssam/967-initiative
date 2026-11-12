-- «المُبلّغ المحلي» (2026-11-12), phase 4: the editors' tools.
-- - An editor can accept a held report (it then counts) or reject one (it carries no weight).
-- - Alerts for the editors (lib/priceAlerts.js), one open alert per thing at a time.
-- - Every editor action is logged: who, what, when. The log is never edited or deleted.
-- Server only (service role), like the rest of the price tables.

alter table public.price_reports
 add column if not exists review text check (review is null or review in ('accepted','rejected')),
 add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
 add column if not exists reviewed_at timestamptz;
create index if not exists price_reports_held_idx on public.price_reports(created_at desc) where status in ('held','outlier') and review is null;

create table if not exists public.price_alerts(
 id bigint generated always as identity primary key,
 alert_type text not null check (alert_type in ('fast_move','anchor_gap','held_surge','spread','anchor_misses')),
 dedupe text not null check (char_length(dedupe)<=200),
 kind text check (kind is null or kind in ('rate','food')),
 region text,
 item text,
 side text,
 reporter_id uuid references auth.users(id) on delete set null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references auth.users(id) on delete set null
);
create unique index if not exists price_alerts_open_idx on public.price_alerts(dedupe) where resolved_at is null;
create index if not exists price_alerts_recent_idx on public.price_alerts(created_at desc);

create table if not exists public.price_moderation_log(
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('accept_report','reject_report','clear_review','ban','unban','anchor_on','anchor_off','resolve_alert','recompute','anchor_price','hide_anchor','show_anchor')),
 target text not null check (char_length(target)<=200),
 before jsonb,
 after jsonb,
 note text check (note is null or char_length(note)<=300),
 created_at timestamptz not null default now()
);
create index if not exists price_moderation_log_recent_idx on public.price_moderation_log(created_at desc);

alter table public.price_alerts enable row level security;
alter table public.price_moderation_log enable row level security;
revoke all on public.price_alerts from public,anon,authenticated;
revoke all on public.price_moderation_log from public,anon,authenticated;
grant all on public.price_alerts to service_role;
grant select,insert on public.price_moderation_log to service_role;
