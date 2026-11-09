-- «سوق 967» phase 5: the life of a listing (expiry, «هل تم البيع؟», «هل تمت الصفقة؟»), in-site
-- notifications for the market, and editing a published listing.
-- All new objects are private to the site's server (service role) and the scheduled job.

alter table public.market_listings
 add column if not exists last_viewed_at timestamptz,
 add column if not exists ask_sold_at timestamptz,
 add column if not exists ask_deal_at timestamptz,
 add column if not exists previous_price numeric(14,2) check (previous_price is null or previous_price>0),
 add column if not exists edited_fields text[] not null default '{}',
 add column if not exists edited_at timestamptz;

-- A saved search keeps its query as groups of spellings (lib/market/search.js queryGroups) and its
-- page link, so the daily digest can run in the database.
alter table public.market_saved_searches
 add column if not exists query_groups jsonb not null default '[]'::jsonb check (jsonb_typeof(query_groups)='array'),
 add column if not exists href text check (href is null or (left(href,1)='/' and length(href)<=600));

-- Market events outside chats. Similar unread events are merged into one (count grows).
-- Chat messages, offers and reservations are shown from the chats themselves, not stored here.
create table if not exists public.market_notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('ask_sold','ask_deal','expired','price_drop','favourite_sold','saved_search')),
 listing_id uuid references public.market_listings(id) on delete cascade,
 saved_search_id uuid references public.market_saved_searches(id) on delete cascade,
 subject text not null default '' check (length(subject)<=160),
 detail text not null default '' check (length(detail)<=200),
 count integer not null default 1 check (count>0),
 href text not null check (left(href,1)='/' and length(href)<=600),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists market_notifications_user on public.market_notifications(user_id,created_at desc);
create index if not exists market_notifications_unread on public.market_notifications(user_id,kind,listing_id,saved_search_id) where read_at is null;
alter table public.market_notifications enable row level security;
revoke all on public.market_notifications from anon,authenticated;

create or replace function public.market_notify(p_user uuid,p_kind text,p_listing uuid,p_search uuid,p_subject text,p_detail text,p_href text,p_count integer default 1)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_user is null then return; end if;
 update public.market_notifications set count=count+greatest(p_count,1),subject=left(coalesce(p_subject,''),160),detail=left(coalesce(p_detail,''),200),href=p_href,created_at=now()
  where user_id=p_user and kind=p_kind and read_at is null and listing_id is not distinct from p_listing and saved_search_id is not distinct from p_search;
 if not found then
  insert into public.market_notifications(user_id,kind,listing_id,saved_search_id,subject,detail,href,count)
  values(p_user,p_kind,p_listing,p_search,left(coalesce(p_subject,''),160),left(coalesce(p_detail,''),200),p_href,greatest(p_count,1));
 end if;
end $$;
revoke all on function public.market_notify(uuid,text,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.market_notify(uuid,text,uuid,uuid,text,text,text,integer) to service_role;

-- «8,000 $» in the database (same short names as lib/market/catalog.js CURRENCIES).
create or replace function public.market_price_text(p_price numeric,p_currency text) returns text language sql immutable set search_path='' as $$
 select trim(to_char(p_price,'FM999,999,999,999,990.99'),'.')||' '||case p_currency when 'YER_OLD' then 'ر.ي' when 'YER_NEW' then 'ر.ي (عدن)' when 'USD' then '$' when 'SAR' then 'ر.س' when 'EUR' then '€' else '' end;
$$;

-- Members who saved a listing hear when it is sold or gets cheaper.
create or replace function public.market_listing_after_update() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if new.status='sold' and old.status is distinct from 'sold' then
  for r in select f.user_id from public.market_favourites f where f.listing_id=new.id and f.user_id is distinct from new.reserved_for loop
   perform public.market_notify(r.user_id,'favourite_sold',new.id,null,new.title,'','/market/'||new.number);
  end loop;
 elsif new.price<old.price and new.currency=old.currency and new.status in ('active','reserved') then
  for r in select f.user_id from public.market_favourites f where f.listing_id=new.id loop
   perform public.market_notify(r.user_id,'price_drop',new.id,null,new.title,public.market_price_text(new.price,new.currency),'/market/'||new.number);
  end loop;
 end if;
 return null;
end $$;
revoke all on function public.market_listing_after_update() from public,anon,authenticated;
drop trigger if exists market_listings_after_update on public.market_listings;
create trigger market_listings_after_update after update of status,price on public.market_listings for each row execute function public.market_listing_after_update();

-- Views and the last view time are counters, not edits.
create or replace function public.market_touch() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'views'-'saves'-'last_viewed_at'-'updated_at'-'revision')=(to_jsonb(old)-'views'-'saves'-'last_viewed_at'-'updated_at'-'revision') then
  new.updated_at:=old.updated_at;new.revision:=old.revision;
  return new;
 end if;
 new.updated_at:=now();
 new.revision:=old.revision+1;
 return new;
end $$;
create or replace function public.market_count_view(p_listing uuid) returns void
language sql security definer set search_path='' as $$
 update public.market_listings set views=views+1,last_viewed_at=now()
 where id=p_listing and status in ('active','reserved');
$$;

-- Offers unanswered for 48 hours expire, and the member who made the offer is told in the chat
-- (the message comes from the other side, so it counts as unread for the offer's sender).
create or replace function public.market_expire_offers(p_chat uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 with expired as (
  update public.market_offers o set status='expired',responded_at=now()
  where o.status='pending' and o.expires_at<now() and (p_chat is null or o.chat_id=p_chat)
  returning o.chat_id,o.from_role
 )
 insert into public.market_messages(chat_id,sender_id,kind,body)
 select e.chat_id,case when e.from_role='buyer' then c.seller_id else c.buyer_id end,'system','انتهى عرض السعر دون رد خلال 48 ساعة.'
 from expired e join public.market_chats c on c.id=e.chat_id;
 get diagnostics v_count=row_count;
 return v_count;
end $$;
revoke all on function public.market_expire_offers(uuid) from public,anon,authenticated;
grant execute on function public.market_expire_offers(uuid) to service_role;

-- The scheduled life of listings (every 30 minutes):
-- · «هل تم البيع؟» to the seller when the listing has 3 days left, or had no view for 7 days;
-- · expired 3 days after its end when the seller did not answer (renewable from «إعلاناتي»);
-- · «هل تمت الصفقة؟» 3 days after a reservation;
-- · unanswered offers expire;
-- · once a day per saved search, how many new listings match it.
create or replace function public.market_lifecycle() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record;v_asked integer:=0;v_expired integer:=0;v_deals integer:=0;v_digests integer:=0;v_offers integer;v_new integer;
begin
 v_offers:=public.market_expire_offers(null);
 for r in update public.market_listings l set ask_sold_at=now()
  where l.status='active' and l.ask_sold_at is null and l.seller_id is not null
   and (l.expires_at<now()+interval '3 days' or (l.published_at<now()-interval '7 days' and coalesce(l.last_viewed_at,l.published_at)<now()-interval '7 days'))
  returning l.id,l.seller_id,l.title loop
  perform public.market_notify(r.seller_id,'ask_sold',r.id,null,r.title,'','/market/mine');v_asked:=v_asked+1;
 end loop;
 for r in update public.market_listings l set status='expired'
  where l.status='active' and l.expires_at<now()-interval '3 days'
  returning l.id,l.seller_id,l.title loop
  perform public.market_notify(r.seller_id,'expired',r.id,null,r.title,'','/market/mine');v_expired:=v_expired+1;
 end loop;
 for r in update public.market_listings l set ask_deal_at=now()
  where l.status='reserved' and l.ask_deal_at is null and l.reserved_at<now()-interval '3 days' and l.seller_id is not null
  returning l.id,l.seller_id,l.title loop
  perform public.market_notify(r.seller_id,'ask_deal',r.id,null,r.title,'','/market/mine');v_deals:=v_deals+1;
 end loop;
 for r in select s.* from public.market_saved_searches s
  where s.notify and (s.last_notified_at is null or s.last_notified_at<now()-interval '20 hours')
   and not (s.filters ? 'q' and jsonb_array_length(s.query_groups)=0) loop
  select count(*) into v_new from public.market_search(
   r.query_groups,r.filters->>'category',r.filters->>'sub',nullif(r.filters->>'gov','all'),null,r.filters->>'district',
   r.filters->>'currency',(r.filters->>'min')::numeric,(r.filters->>'max')::numeric,r.filters->>'condition','new',60,0) m
  where m.published_at>coalesce(r.last_notified_at,r.created_at) and m.seller_id is distinct from r.user_id;
  update public.market_saved_searches set last_notified_at=now() where id=r.id;
  if v_new>0 then
   perform public.market_notify(r.user_id,'saved_search',null,r.id,r.label,'',coalesce(r.href,'/market/saved-searches'),v_new);v_digests:=v_digests+1;
  end if;
 end loop;
 return jsonb_build_object('offers',v_offers,'asked',v_asked,'expired',v_expired,'deals',v_deals,'digests',v_digests);
end $$;
revoke all on function public.market_lifecycle() from public,anon,authenticated;
grant execute on function public.market_lifecycle() to service_role;

select cron.unschedule('967-market-lifecycle') where exists(select 1 from cron.job where jobname='967-market-lifecycle');
select cron.schedule('967-market-lifecycle','*/30 * * * *','select public.market_lifecycle();');
