-- «سوق 967» (2026-11-11), two spec items the owner had deferred:
-- 1. Categories ordered by how many live listings they hold (market_category_counts).
-- 2. Duplicate photos: every upload keeps a 64-bit difference hash (dHash) of its picture. A listing
--    whose photo matches a photo of ANOTHER seller's listing goes to review instead of going live
--    (stolen photos are the usual sign of a fake listing). The seller's own reposts are not flagged.

alter table public.market_uploads add column if not exists phash text;
alter table public.market_uploads drop constraint if exists market_uploads_phash_check;
alter table public.market_uploads add constraint market_uploads_phash_check check (phash is null or phash ~ '^[0-9a-f]{16}$');

-- Live listings per category, for ordering the category icons.
create or replace function public.market_category_counts()
returns table(category text, listings bigint)
language sql stable security definer set search_path='' as $$
 select l.category, count(*)::bigint from public.market_listings l
 where l.status in ('active','reserved') group by l.category
$$;
revoke all on function public.market_category_counts() from public, anon, authenticated;
grant execute on function public.market_category_counts() to service_role;

-- Listings of other sellers with a photo whose hash differs from one of p_uploads by at most
-- p_distance bits (out of 64). Sold listings count too: their photos are reused in scams.
create or replace function public.market_photo_matches(p_seller uuid, p_uploads uuid[], p_distance integer default 5)
returns table(listing_id uuid, number bigint)
language sql stable security definer set search_path='' as $$
 select distinct l.id, l.number
 from public.market_uploads mine
 join public.market_uploads other on other.phash is not null and other.id <> mine.id and other.listing_id is not null
 join public.market_listings l on l.id = other.listing_id
 where mine.id = any(p_uploads) and mine.phash is not null
  and l.seller_id <> p_seller
  and l.status in ('active','reserved','pending_review','sold')
  and bit_count(('x' || mine.phash)::bit(64) # ('x' || other.phash)::bit(64)) <= least(greatest(p_distance,0),10)
 limit 5
$$;
revoke all on function public.market_photo_matches(uuid, uuid[], integer) from public, anon, authenticated;
grant execute on function public.market_photo_matches(uuid, uuid[], integer) to service_role;
