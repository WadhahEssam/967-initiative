-- «سوق 967» phase 1: listings and uploaded images.
-- The market is a hidden section until the owner launches it. Every write goes through the
-- site's server (service role): browsers can read published listings only, and write nothing.
-- Photos are stored in a private Backblaze B2 bucket; these tables keep only their ids.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.market_listings(
 id uuid primary key default gen_random_uuid(),
 number bigint generated always as identity unique,
 -- A deleted account's listings stay as history, without an owner, and are never shown.
 seller_id uuid references auth.users(id) on delete set null,
 status text not null default 'draft'
  check (status in ('draft','pending_review','active','reserved','sold','expired','removed','archived')),
 category text not null check (category ~ '^[a-z_]{2,40}$'),
 subcategory text not null check (subcategory ~ '^[a-z_0-9]{2,40}$'),
 title text not null default '' check (length(title)<=120),
 description text not null default '' check (length(description)<=4000),
 price numeric(14,2) check (price is null or price>=0),
 currency text check (currency is null or currency in ('YER_OLD','YER_NEW','USD','SAR','EUR')),
 negotiable boolean not null default true,
 condition text check (condition is null or condition in ('new','like_new','used','needs_repair')),
 governorate_id text check (governorate_id is null or governorate_id ~ '^YE[0-9]{2}$'),
 district_id text check (district_id is null or district_id ~ '^YE[0-9]{4}$'),
 attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes)='object'),
 -- [{"id": uuid, "w": width, "h": height}], the first one is the cover.
 images jsonb not null default '[]'::jsonb check (jsonb_typeof(images)='array' and jsonb_array_length(images)<=10),
 show_whatsapp boolean not null default false,
 review_reason text check (review_reason is null or length(review_reason)<=500),
 -- Normalised title, category, attributes and description (lib/market/listing.js), for search.
 search_text text not null default '' check (length(search_text)<=6000),
 views integer not null default 0 check (views>=0),
 saves integer not null default 0 check (saves>=0),
 published_at timestamptz,
 expires_at timestamptz,
 reserved_at timestamptz,
 sold_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision bigint not null default 1
);
create index if not exists market_listings_browse on public.market_listings(status,governorate_id,published_at desc);
create index if not exists market_listings_category on public.market_listings(category,subcategory,status,published_at desc);
create index if not exists market_listings_seller on public.market_listings(seller_id,status);
create index if not exists market_listings_search on public.market_listings using gin(search_text extensions.gin_trgm_ops);

-- Each photo a member uploads, so a listing can only use its owner's photos and uploads can be rate-limited.
create table if not exists public.market_uploads(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid references public.market_listings(id) on delete set null,
 width integer not null check (width>0),
 height integer not null check (height>0),
 bytes integer not null check (bytes>0),
 promoted boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists market_uploads_owner on public.market_uploads(owner_id,created_at desc);

create or replace function public.market_touch() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at:=now();
 new.revision:=old.revision+1;
 return new;
end $$;
drop trigger if exists market_listings_touch on public.market_listings;
create trigger market_listings_touch before update on public.market_listings for each row execute function public.market_touch();

alter table public.market_listings enable row level security;
alter table public.market_uploads enable row level security;
revoke all on public.market_listings,public.market_uploads from anon,authenticated;
grant select on public.market_listings to anon,authenticated;

-- Public: listings people can see (active, reserved, and sold for two more days, per the spec).
drop policy if exists market_listings_public_read on public.market_listings;
create policy market_listings_public_read on public.market_listings for select to anon,authenticated using (
 seller_id is not null and (status in ('active','reserved') or (status='sold' and sold_at>now()-interval '2 days'))
);
-- Sellers also read their own drafts, held and finished listings.
drop policy if exists market_listings_owner_read on public.market_listings;
create policy market_listings_owner_read on public.market_listings for select to authenticated using (seller_id=auth.uid());
