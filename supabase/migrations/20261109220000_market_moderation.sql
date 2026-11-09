-- «سوق 967» phase 7: reports, blocks between members, market bans and moderation notices.
-- Everything stays server-side: RLS on, nothing granted to anon/authenticated.

-- ---- Blocks: one list for private messages and the market ----
-- A block made from the market records why (spec: «سبب الحظر إلزامي»; the team sees it, nobody else).
alter table public.private_user_blocks add column if not exists reason text
 check (reason is null or reason in ('spam','rude','fraud','not_serious','other'));
alter table public.private_user_blocks add column if not exists note text check (note is null or length(note)<=500);
alter table public.private_user_blocks add column if not exists source text not null default 'messages'
 check (source in ('messages','market'));
create index if not exists private_user_blocks_blocked on public.private_user_blocks(blocked_id,created_at desc);

-- Either one blocked the other (spec: «في الاتجاهين»).
create or replace function public.market_blocked(p_a uuid,p_b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_a is not null and p_b is not null and exists(
  select 1 from public.private_user_blocks b where (b.blocker_id=p_a and b.blocked_id=p_b) or (b.blocker_id=p_b and b.blocked_id=p_a));
$$;
revoke all on function public.market_blocked(uuid,uuid) from public,anon,authenticated;
grant execute on function public.market_blocked(uuid,uuid) to service_role;

-- On a block (from the market or from private messages): pending offers between the two are
-- cancelled, a reservation for one of them is released, and no rating request follows.
-- Their chats stay readable; the server refuses new messages while the block lasts.
create or replace function public.market_after_block() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 update public.market_offers o set status='cancelled',responded_at=now()
  from public.market_chats c
  where o.chat_id=c.id and o.status='pending'
   and ((c.seller_id=new.blocker_id and c.buyer_id=new.blocked_id) or (c.seller_id=new.blocked_id and c.buyer_id=new.blocker_id));
 for r in
  select l.id,c.id chat_id from public.market_listings l
  join public.market_chats c on c.listing_id=l.id and c.buyer_id=l.reserved_for
  where l.status='reserved'
   and ((l.seller_id=new.blocker_id and l.reserved_for=new.blocked_id) or (l.seller_id=new.blocked_id and l.reserved_for=new.blocker_id))
 loop
  update public.market_listings set status='active',reserved_for=null,reserved_at=null,ask_deal_at=null where id=r.id;
  insert into public.market_messages(chat_id,sender_id,kind,body) values(r.chat_id,new.blocker_id,'system','أُلغي الحجز.');
 end loop;
 update public.market_chats c set rating_requested_at=coalesce(c.rating_requested_at,now())
  where (c.seller_id=new.blocker_id and c.buyer_id=new.blocked_id) or (c.seller_id=new.blocked_id and c.buyer_id=new.blocker_id);
 return null;
end $$;
revoke all on function public.market_after_block() from public,anon,authenticated;
drop trigger if exists private_user_blocks_market on public.private_user_blocks;
create trigger private_user_blocks_market after insert on public.private_user_blocks for each row execute function public.market_after_block();

-- Spec: three different members blocking the same person puts the account in front of the team.
create or replace function public.market_block_alerts(p_min integer default 3) returns table(user_id uuid,blockers bigint,reasons jsonb,latest timestamptz)
language sql stable security definer set search_path='' as $$
 with counts as(
  select blocked_id,count(distinct blocker_id) blockers,max(created_at) latest from public.private_user_blocks
  group by blocked_id having count(distinct blocker_id)>=greatest(p_min,1)
 ),reasons as(
  select blocked_id,jsonb_object_agg(reason,n) r from(
   select blocked_id,reason,count(*) n from public.private_user_blocks where reason is not null group by blocked_id,reason) s
  group by blocked_id
 )
 select c.blocked_id,c.blockers,coalesce(r.r,'{}'::jsonb),c.latest from counts c left join reasons r on r.blocked_id=c.blocked_id
 order by c.latest desc limit 200;
$$;
revoke all on function public.market_block_alerts(integer) from public,anon,authenticated;
grant execute on function public.market_block_alerts(integer) to service_role;

-- ---- Reports ----
create table if not exists public.market_reports(
 id uuid primary key default gen_random_uuid(),
 number bigint generated always as identity unique,
 reporter_id uuid references auth.users(id) on delete set null,
 target text not null check (target in ('listing','user','chat','rating')),
 listing_id uuid references public.market_listings(id) on delete set null,
 chat_id uuid references public.market_chats(id) on delete set null,
 rating_id uuid references public.market_ratings(id) on delete set null,
 reported_id uuid references auth.users(id) on delete set null,
 reason text not null check (reason in ('fraud','prohibited','duplicate','misleading','abuse','other')),
 note text check (note is null or length(note)<=500),
 status text not null default 'open' check (status in ('open','resolved','dismissed')),
 action text check (action is null or length(action)<=40),
 resolved_by uuid references auth.users(id) on delete set null,
 resolved_at timestamptz,
 created_at timestamptz not null default now()
);
-- One open report per member and thing reported.
create unique index if not exists market_reports_open_once on public.market_reports(reporter_id,target,coalesce(listing_id,chat_id,rating_id,reported_id)) where status='open';
create index if not exists market_reports_status on public.market_reports(status,created_at desc);
create index if not exists market_reports_reported on public.market_reports(reported_id,created_at desc);
create index if not exists market_reports_listing on public.market_reports(listing_id) where listing_id is not null;
alter table public.market_reports enable row level security;
revoke all on public.market_reports from anon,authenticated;

-- Spec (terms §6): the team may read a reported chat to check the report. Every reading is logged.
create table if not exists public.market_report_views(
 id bigint generated always as identity primary key,
 report_id uuid not null references public.market_reports(id) on delete cascade,
 viewer_id uuid references auth.users(id) on delete set null,
 viewed_at timestamptz not null default now()
);
alter table public.market_report_views enable row level security;
revoke all on public.market_report_views from anon,authenticated;

-- ---- Market bans (the market only; the whole-site suspension stays in public_profiles) ----
create table if not exists public.market_bans(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (length(reason) between 3 and 500),
 until timestamptz,
 report_id uuid references public.market_reports(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 lifted_at timestamptz,
 lifted_by uuid references auth.users(id) on delete set null
);
create index if not exists market_bans_user on public.market_bans(user_id,created_at desc);
alter table public.market_bans enable row level security;
revoke all on public.market_bans from anon,authenticated;

create or replace function public.market_banned(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.market_bans b where b.user_id=p_user and b.lifted_at is null and (b.until is null or b.until>now()));
$$;
revoke all on function public.market_banned(uuid) from public,anon,authenticated;
grant execute on function public.market_banned(uuid) to service_role;

-- ---- Notifications: moderation events and messages from the team ----
alter table public.market_notifications drop constraint if exists market_notifications_kind_check;
alter table public.market_notifications add constraint market_notifications_kind_check
 check (kind in ('ask_sold','ask_deal','expired','price_drop','favourite_sold','saved_search','rate_request','new_rating',
  'listing_held','listing_approved','listing_rejected','listing_removed','admin_message','market_ban'));
-- A message from the team is longer than an event line.
alter table public.market_notifications drop constraint if exists market_notifications_detail_check;
alter table public.market_notifications add constraint market_notifications_detail_check check (length(detail)<=1000);

-- ---- Search leaves out sellers banned from the market ----
create or replace function public.market_search(
 p_groups jsonb default '[]'::jsonb,p_category text default null,p_subcategory text default null,
 p_governorate text default null,p_not_governorate text default null,p_district text default null,
 p_currency text default null,p_min numeric default null,p_max numeric default null,p_condition text default null,
 p_sort text default 'new',p_limit integer default 24,p_offset integer default 0
) returns setof public.market_listings language sql stable security definer set search_path='' as $$
 select l.* from public.market_listings l
 where l.status in ('active','reserved') and l.seller_id is not null
  and not exists(select 1 from public.public_profiles p where p.user_id=l.seller_id and (p.suspended or p.deletion_requested_at is not null))
  and not exists(select 1 from public.market_bans b where b.user_id=l.seller_id and b.lifted_at is null and (b.until is null or b.until>now()))
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
