-- «المُبلّغ المحلي» (2026-11-12), phase 1: storage for members' price reports and for the price
-- worked out from them (lib/priceConsensus.js). Nothing changes on the site yet: pages still read
-- exchange_rates and food_prices, and editor entries stay the anchor of the computation.
-- The site reads and writes through the server (service role); browsers have no direct access.
-- Members never see their weight, the status of their reports, or whether they are banned.

-- One row per report or quick confirmation («السعر صحيح»). Never deleted.
-- device_hash and connection_hash are keyed hashes (HMAC) used only to treat several accounts on
-- one device or connection as one person; no address is stored in readable form.
create table if not exists public.price_reports(
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete set null,
 region text not null check (region in ('sanaa','aden')),
 kind text not null check (kind in ('rate','food')),
 item text not null,
 side text not null,
 value numeric(14,2) not null check (value>0 and value<10000000),
 confirmation boolean not null default false,
 source text check (source is null or char_length(source)<=120),
 device_hash text check (device_hash is null or device_hash ~ '^[0-9a-f]{64}$'),
 connection_hash text check (connection_hash is null or connection_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check (status in ('pending','counted','held','outlier','ignored')),
 created_at timestamptz not null default now(),
 check ((kind='rate' and item in ('USD','SAR') and side in ('buy','sell')) or (kind='food' and item ~ '^[a-z_]{2,40}$' and side='price'))
);
create index if not exists price_reports_instrument_idx on public.price_reports(kind,region,item,side,created_at desc);
create index if not exists price_reports_recent_idx on public.price_reports(kind,created_at desc);
create index if not exists price_reports_user_idx on public.price_reports(user_id,created_at desc);

-- Each reporter's standing. A member without a row has the starting score (30 of 100).
-- silent_ban: their reports are kept but carry no weight; nothing tells them so.
-- anchor: a changer or trader verified by an editor; their reports weigh double.
create table if not exists public.price_reporters(
 user_id uuid primary key references auth.users(id) on delete cascade,
 score numeric(5,2) not null default 30 check (score>=0 and score<=100),
 reports_total integer not null default 0 check (reports_total>=0),
 reports_agreeing integer not null default 0 check (reports_agreeing>=0),
 silent_ban boolean not null default false,
 anchor boolean not null default false,
 anchor_name text check (anchor_name is null or char_length(anchor_name)<=80),
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- The current price of each city, item and side, as last worked out. value is null when there is
-- no price (no editor entry and fewer than three people agreeing).
create table if not exists public.price_consensus(
 region text not null check (region in ('sanaa','aden')),
 kind text not null check (kind in ('rate','food')),
 item text not null,
 side text not null,
 value numeric(14,2) check (value is null or value>0),
 low numeric(14,2),
 high numeric(14,2),
 report_count integer not null default 0,
 anchored boolean not null default false,
 reason text check (reason is null or reason in ('official','consensus','jump')),
 changed_at timestamptz,
 official_at timestamptz,
 last_activity_at timestamptz,
 computed_at timestamptz not null default now(),
 primary key (kind,region,item,side)
);

-- Every change of the price, for the 7-day chart and for editors' review.
create table if not exists public.price_consensus_history(
 id bigint generated always as identity primary key,
 region text not null,
 kind text not null,
 item text not null,
 side text not null,
 value numeric(14,2) not null,
 low numeric(14,2),
 high numeric(14,2),
 report_count integer not null default 0,
 reason text not null check (reason in ('official','consensus','jump')),
 first_report_id bigint references public.price_reports(id) on delete set null,
 recorded_at timestamptz not null default now()
);
create index if not exists price_consensus_history_idx on public.price_consensus_history(kind,region,item,side,recorded_at desc);

alter table public.price_reports enable row level security;
alter table public.price_reporters enable row level security;
alter table public.price_consensus enable row level security;
alter table public.price_consensus_history enable row level security;
revoke all on public.price_reports from public,anon,authenticated;
revoke all on public.price_reporters from public,anon,authenticated;
revoke all on public.price_consensus from public,anon,authenticated;
revoke all on public.price_consensus_history from public,anon,authenticated;
grant all on public.price_reports to service_role;
grant all on public.price_reporters to service_role;
grant all on public.price_consensus to service_role;
grant all on public.price_consensus_history to service_role;
