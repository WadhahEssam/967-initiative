-- «سوق 967» phase 6: seller ratings and the seller page.
-- Ratings are private to the site's server; the public sees them through the seller page, which
-- shows the average only after three ratings.

-- One rating per buyer and listing, from a buyer who chatted with the seller and got a reply.
-- Four criteria, 1–5 stars each; the overall rating is their average. A deleted buyer's ratings
-- stay as «حساب محذوف»; a deleted seller's ratings disappear with the account.
create table if not exists public.market_ratings(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.market_listings(id) on delete cascade,
 chat_id uuid references public.market_chats(id) on delete set null,
 seller_id uuid not null references auth.users(id) on delete cascade,
 buyer_id uuid references auth.users(id) on delete set null,
 accuracy smallint not null check (accuracy between 1 and 5),
 price smallint not null check (price between 1 and 5),
 punctuality smallint not null check (punctuality between 1 and 5),
 manners smallint not null check (manners between 1 and 5),
 comment text not null default '' check (length(comment)<=600),
 reply text check (reply is null or length(reply) between 1 and 600),
 replied_at timestamptz,
 -- The seller may report an abusive rating; the team reviews it (phase 7) and may hide it.
 reported_at timestamptz,
 report_reason text check (report_reason is null or length(report_reason)<=300),
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 unique(listing_id,buyer_id)
);
create index if not exists market_ratings_seller on public.market_ratings(seller_id,created_at desc);
alter table public.market_ratings enable row level security;
revoke all on public.market_ratings from anon,authenticated;

alter table public.market_chats add column if not exists rating_requested_at timestamptz;

alter table public.market_notifications drop constraint if exists market_notifications_kind_check;
alter table public.market_notifications add constraint market_notifications_kind_check
 check (kind in ('ask_sold','ask_deal','expired','price_drop','favourite_sold','saved_search','rate_request','new_rating'));

-- What the seller page and the seller card show: ratings (per criterion and overall), how often
-- and how fast the seller answers (chats of the last 90 days), and listings sold and active.
create or replace function public.market_seller_stats(p_seller uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with rated as (
  select * from public.market_ratings where seller_id=p_seller and not hidden
 ), first_messages as (
  select c.id,
   (select min(m.created_at) from public.market_messages m where m.chat_id=c.id and m.sender_id=c.buyer_id and m.kind in ('text','image','offer')) asked
  from public.market_chats c where c.seller_id=p_seller and c.created_at>now()-interval '90 days'
 ), answers as (
  select f.asked,(select min(m.created_at) from public.market_messages m join public.market_chats c on c.id=m.chat_id
   where m.chat_id=f.id and m.sender_id=c.seller_id and m.kind in ('text','image','offer') and m.created_at>=f.asked) answered
  from first_messages f where f.asked is not null
 )
 select jsonb_build_object(
  'ratings',(select count(*) from rated),
  'overall',(select round(avg((accuracy+price+punctuality+manners)/4.0),1) from rated),
  'accuracy',(select round(avg(accuracy),1) from rated),
  'price',(select round(avg(price),1) from rated),
  'punctuality',(select round(avg(punctuality),1) from rated),
  'manners',(select round(avg(manners),1) from rated),
  'chats',(select count(*) from answers),
  'answered',(select count(*) from answers where answered is not null),
  'response_hours',(select round((percentile_cont(0.5) within group (order by extract(epoch from answered-asked)/3600))::numeric,1) from answers where answered is not null),
  'sold',(select count(*) from public.market_listings where seller_id=p_seller and status='sold'),
  'active',(select count(*) from public.market_listings where seller_id=p_seller and status in ('active','reserved'))
 );
$$;
revoke all on function public.market_seller_stats(uuid) from public,anon,authenticated;
grant execute on function public.market_seller_stats(uuid) to service_role;

-- The scheduled life of listings, now also asking buyers to rate: once per chat, after the listing
-- is sold or three days after the chat began, when both sides wrote and no rating exists yet.
create or replace function public.market_lifecycle() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record;v_asked integer:=0;v_expired integer:=0;v_deals integer:=0;v_digests integer:=0;v_rates integer:=0;v_offers integer;v_new integer;
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
 for r in update public.market_chats c set rating_requested_at=now()
  from public.market_listings l
  where l.id=c.listing_id and c.rating_requested_at is null and c.buyer_id is not null and c.seller_id is not null
   and (l.status='sold' or c.created_at<now()-interval '3 days')
   and exists(select 1 from public.market_messages m where m.chat_id=c.id and m.sender_id=c.seller_id and m.kind in ('text','image','offer'))
   and exists(select 1 from public.market_messages m where m.chat_id=c.id and m.sender_id=c.buyer_id and m.kind in ('text','image','offer'))
   and not exists(select 1 from public.market_ratings x where x.listing_id=c.listing_id and x.buyer_id=c.buyer_id)
  returning c.id,c.buyer_id,l.id listing_id,l.title loop
  perform public.market_notify(r.buyer_id,'rate_request',r.listing_id,null,r.title,'','/market/rate/'||r.id);v_rates:=v_rates+1;
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
 return jsonb_build_object('offers',v_offers,'asked',v_asked,'expired',v_expired,'deals',v_deals,'rating_requests',v_rates,'digests',v_digests);
end $$;
revoke all on function public.market_lifecycle() from public,anon,authenticated;
grant execute on function public.market_lifecycle() to service_role;
