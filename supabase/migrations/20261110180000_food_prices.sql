-- «الخدمات» / أسعار المواد الأساسية (2026-11-10): staple prices entered by hand every week for
-- Sanaa and Aden. Each submission is a batch of rows (one per city and item). Nothing is deleted:
-- a wrong batch is hidden, and the previous prices show again.
-- The items are defined in lib/foodPrices.js, so adding one needs no migration.
-- The people allowed to enter prices are the same as for exchange rates (exchange_rate_reporters).
-- The site reads and writes through the server (service role); browsers have no direct access.

create table if not exists public.food_prices(
 id bigint generated always as identity primary key,
 batch_id uuid not null,
 recorded_at timestamptz not null default now(),
 region text not null check (region in ('sanaa','aden')),
 item text not null check (item ~ '^[a-z_]{2,40}$'),
 price numeric(14,2) not null check (price>0 and price<100000000),
 note text check (note is null or char_length(note)<=200),
 entered_by uuid references auth.users(id) on delete set null,
 hidden boolean not null default false,
 hidden_by uuid references auth.users(id) on delete set null,
 hidden_at timestamptz,
 unique (batch_id,region,item)
);
create index if not exists food_prices_latest_idx on public.food_prices(region,item,recorded_at desc) where not hidden;
create index if not exists food_prices_recorded_idx on public.food_prices(recorded_at desc);
create index if not exists food_prices_batch_idx on public.food_prices(batch_id);

alter table public.food_prices enable row level security;
revoke all on public.food_prices from public,anon,authenticated;
grant all on public.food_prices to service_role;
