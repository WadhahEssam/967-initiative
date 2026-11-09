-- «سوق 967» phase 3: search, favourites and saved searches.
-- Every table here is private: no browser role can read or write it; the site's server
-- (service role) does, after checking who is asking.

-- Favourites: a member's saved listings. listings.saves counts them.
create table if not exists public.market_favourites(
 user_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid not null references public.market_listings(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,listing_id)
);
create index if not exists market_favourites_listing on public.market_favourites(listing_id);

-- Saved searches (20 per member at most, checked by the server). Members are told about new
-- matching listings while notify is on (notifications arrive with phase 5).
create table if not exists public.market_saved_searches(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 filters jsonb not null check (jsonb_typeof(filters)='object' and length(filters::text)<=1000),
 label text not null check (length(label) between 1 and 160),
 notify boolean not null default true,
 created_at timestamptz not null default now(),
 last_notified_at timestamptz
);
create index if not exists market_saved_searches_user on public.market_saved_searches(user_id,created_at desc);

-- Searches that found nothing, to grow the synonyms list. Only the normalised words are kept.
create table if not exists public.market_search_misses(
 query text primary key check (length(query) between 1 and 80),
 count integer not null default 1,
 first_at timestamptz not null default now(),
 last_at timestamptz not null default now()
);

alter table public.market_favourites enable row level security;
alter table public.market_saved_searches enable row level security;
alter table public.market_search_misses enable row level security;
revoke all on public.market_favourites,public.market_saved_searches,public.market_search_misses from anon,authenticated;

-- Keep listings.saves equal to the number of members who saved the listing.
create or replace function public.market_count_saves() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then update public.market_listings set saves=saves+1 where id=new.listing_id;
 elsif tg_op='DELETE' then update public.market_listings set saves=greatest(saves-1,0) where id=old.listing_id;
 end if;
 return null;
end $$;
revoke all on function public.market_count_saves() from public,anon,authenticated;
drop trigger if exists market_favourites_count on public.market_favourites;
create trigger market_favourites_count after insert or delete on public.market_favourites for each row execute function public.market_count_saves();

-- Counting views and saves must not look like an edit of the listing.
create or replace function public.market_touch() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'views'-'saves'-'updated_at'-'revision')=(to_jsonb(old)-'views'-'saves'-'updated_at'-'revision') then
  new.updated_at:=old.updated_at;new.revision:=old.revision;
  return new;
 end if;
 new.updated_at:=now();
 new.revision:=old.revision+1;
 return new;
end $$;

create or replace function public.market_log_miss(p_query text) returns void language sql security definer set search_path='' as $$
 insert into public.market_search_misses(query) values(left(btrim(p_query),80))
 on conflict(query) do update set count=public.market_search_misses.count+1,last_at=now();
$$;
revoke all on function public.market_log_miss(text) from public,anon,authenticated;
grant execute on function public.market_log_miss(text) to service_role;

-- Listings people can see, filtered and sorted. p_groups is the query as groups of spellings
-- (lib/market/search.js queryGroups): each group must match the listing's search_text, by a word
-- that starts with one of the spellings (also after ال/وال/بال/لل), or, for spellings of 4 letters
-- or more, by a close spelling (pg_trgm word similarity ≥ 0.5: «هيلكس» finds «هايلكس»).
-- Sellers who are suspended or leaving are left out.
create or replace function public.market_search(
 p_groups jsonb default '[]'::jsonb,p_category text default null,p_subcategory text default null,
 p_governorate text default null,p_not_governorate text default null,p_district text default null,
 p_currency text default null,p_min numeric default null,p_max numeric default null,p_condition text default null,
 p_sort text default 'new',p_limit integer default 24,p_offset integer default 0
) returns setof public.market_listings language sql stable security definer set search_path='' as $$
 select l.* from public.market_listings l
 where l.status in ('active','reserved') and l.seller_id is not null
  and not exists(select 1 from public.public_profiles p where p.user_id=l.seller_id and (p.suspended or p.deletion_requested_at is not null))
  and (p_category is null or l.category=p_category)
  and (p_subcategory is null or l.subcategory=p_subcategory)
  and (p_governorate is null or l.governorate_id=p_governorate)
  and (p_not_governorate is null or l.governorate_id is distinct from p_not_governorate)
  and (p_district is null or l.district_id=p_district)
  and (p_currency is null or l.currency=p_currency)
  and (p_min is null or l.price>=p_min)
  and (p_max is null or l.price<=p_max)
  and (p_condition is null or l.condition=p_condition)
  and not exists(
   select 1 from jsonb_array_elements(case when jsonb_typeof(p_groups)='array' then p_groups else '[]'::jsonb end) g
   where not exists(
    select 1 from jsonb_array_elements_text(case when jsonb_typeof(g.value)='array' then g.value else '[]'::jsonb end) v(word)
    where length(v.word) between 1 and 40 and (
     (' '||l.search_text) like any(array['% '||v.word||'%','% ال'||v.word||'%','% وال'||v.word||'%','% بال'||v.word||'%','% لل'||v.word||'%'])
     or (length(v.word)>=4 and extensions.word_similarity(v.word,l.search_text)>=0.5)
    )
   )
  )
 order by
  case when p_sort in ('price_asc','price_desc') then l.currency end,
  case when p_sort='price_asc' then l.price end asc nulls last,
  case when p_sort='price_desc' then l.price end desc nulls last,
  l.published_at desc nulls last,l.number desc
 limit least(greatest(coalesce(p_limit,24),1),61) offset least(greatest(coalesce(p_offset,0),0),3000);
$$;
revoke all on function public.market_search(jsonb,text,text,text,text,text,text,numeric,numeric,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.market_search(jsonb,text,text,text,text,text,text,numeric,numeric,text,text,integer,integer) to service_role;
