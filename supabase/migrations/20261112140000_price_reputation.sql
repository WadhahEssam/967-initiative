-- «المُبلّغ المحلي» (2026-11-12), phase 3: reputation and the silent ban (lib/priceReputation.js).
-- Each report is graded once, after it settles; the grade moves its reporter's score.
-- Server only (service role), like the rest of the price tables. Members never see any of it.

alter table public.price_reports
 add column if not exists scored_at timestamptz,
 add column if not exists score_delta numeric(5,2),
 add column if not exists agreement text check (agreement is null or agreement in ('very_close','close','far','very_far'));
create index if not exists price_reports_unscored_idx on public.price_reports(kind,created_at) where scored_at is null;

alter table public.price_reporters
 add column if not exists daily_gain numeric(5,2) not null default 0,
 add column if not exists gain_day date,
 add column if not exists jumps_first integer not null default 0 check (jumps_first>=0),
 add column if not exists anchor_miss_streak integer not null default 0 check (anchor_miss_streak>=0),
 add column if not exists ban_reason text check (ban_reason is null or ban_reason in ('auto','editor')),
 add column if not exists banned_at timestamptz;
