-- «سوق 967»: the last items of the spec.
-- · A reminder for a draft left unfinished («حفظ تلقائي للمسودة، وتذكير إذا لم يكتمل الإعلان»).
-- · Brands and models typed under «أخرى», for the team to update the lists.
-- · Searches with no results, and synonyms the team adds from them («قاموس يتوسع مع الوقت»).

-- ---- Draft reminder: once per draft, a day after it was last touched (up to two weeks old) ----
alter table public.market_listings add column if not exists draft_reminded_at timestamptz;
alter table public.market_notifications drop constraint if exists market_notifications_kind_check;
alter table public.market_notifications add constraint market_notifications_kind_check
 check (kind in ('ask_sold','ask_deal','expired','price_drop','favourite_sold','saved_search','rate_request','new_rating',
  'listing_held','listing_approved','listing_rejected','listing_removed','admin_message','market_ban','draft_reminder'));

create or replace function public.market_draft_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare r record;v integer:=0;
begin
 for r in update public.market_listings l set draft_reminded_at=now()
  where l.status='draft' and l.seller_id is not null and l.draft_reminded_at is null
   and l.updated_at<now()-interval '1 day' and l.updated_at>now()-interval '14 days'
   and not exists(select 1 from public.public_profiles p where p.user_id=l.seller_id and (p.suspended or p.deletion_requested_at is not null))
  returning l.id,l.seller_id,l.title
 loop
  perform public.market_notify(r.seller_id,'draft_reminder',r.id,null,coalesce(nullif(btrim(r.title),''),'إعلانك'),'','/market/new?draft='||r.id);
  v:=v+1;
 end loop;
 return v;
end $$;
revoke all on function public.market_draft_reminders() from public,anon,authenticated;
grant execute on function public.market_draft_reminders() to service_role;
select cron.unschedule('967-market-drafts') where exists(select 1 from cron.job where jobname='967-market-drafts');
select cron.schedule('967-market-drafts','20 * * * *','select public.market_draft_reminders();');

-- ---- Names typed under «أخرى» in published listings, most common first ----
drop function if exists public.market_other_values();
create or replace function public.market_other_values() returns table(category text,subcategory text,field text,value text,listings bigint,latest timestamptz,example bigint)
language sql stable security definer set search_path='' as $$
 select l.category,l.subcategory,left(a.key,length(a.key)-6),btrim(a.value),count(*),max(l.created_at),max(l.number)
 from public.market_listings l cross join lateral jsonb_each_text(l.attributes) a
 where l.status<>'draft' and right(a.key,6)='_other' and btrim(a.value)<>''
 group by l.category,l.subcategory,left(a.key,length(a.key)-6),btrim(a.value)
 order by count(*) desc,max(l.created_at) desc
 limit 300;
$$;
revoke all on function public.market_other_values() from public,anon,authenticated;
grant execute on function public.market_other_values() to service_role;

-- ---- Searches with no results: the team marks them handled ----
alter table public.market_search_misses add column if not exists handled_at timestamptz;

-- Synonym groups the team adds (spellings already normalised by lib/market/text.js).
create table if not exists public.market_synonyms(
 id uuid primary key default gen_random_uuid(),
 words text[] not null check (cardinality(words) between 2 and 10),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.market_synonyms enable row level security;
revoke all on public.market_synonyms from anon,authenticated;
