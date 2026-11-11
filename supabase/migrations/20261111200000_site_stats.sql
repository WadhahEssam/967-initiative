-- «إحصاءات الموقع» (owner, 2026-11-11): first-party visitor statistics for the management team.
-- No third party, no IP address, no user agent, no search text and no account id is stored.
-- A visitor is a random id kept in the visitor's browser; a visit (session) is another random id
-- that ends after 30 minutes without activity. Days are Yemen days (Asia/Aden).
-- Written only through the service-role functions below (called by /api/analytics/collect);
-- read only by /api/admin/stats for the management role. RLS is on with no policies.

create table if not exists public.analytics_views (
  id uuid primary key,
  visitor text not null check (visitor ~ '^[a-z0-9]{16,32}$'),
  session text not null check (session ~ '^[a-z0-9]{16,32}$'),
  day date not null,
  at timestamptz not null default now(),
  path text not null check (char_length(path) between 1 and 200 and left(path,1) = '/'),
  title text check (title is null or char_length(title) <= 160),
  seq integer not null check (seq between 1 and 5000),
  new_visitor boolean not null default false,
  member boolean not null default false,
  source text not null check (source in ('direct','google','bing','search','whatsapp','facebook','instagram','x','telegram','youtube','tiktok','linkedin','share','other')),
  device text not null check (device in ('phone','tablet','desktop')),
  os text not null check (os in ('android','ios','windows','macos','linux','other')),
  theme text check (theme is null or theme in ('dark','light')),
  duration_ms integer not null default 0 check (duration_ms between 0 and 1800000)
);
create index if not exists analytics_views_day on public.analytics_views (day);
create index if not exists analytics_views_session on public.analytics_views (session, at);
create index if not exists analytics_views_day_path on public.analytics_views (day, path);

-- One row per visitor and day: unique visitors over any range (kept for the yearly count).
create table if not exists public.analytics_visitor_days (
  day date not null,
  visitor text not null check (visitor ~ '^[a-z0-9]{16,32}$'),
  member boolean not null default false,
  primary key (day, visitor)
);

-- Who is on the site now: one row per open visit, refreshed while a page is visible.
create table if not exists public.analytics_presence (
  session text primary key check (session ~ '^[a-z0-9]{16,32}$'),
  visitor text not null,
  path text not null,
  device text not null,
  seen_at timestamptz not null default now()
);
create index if not exists analytics_presence_seen on public.analytics_presence (seen_at);

alter table public.analytics_views enable row level security;
alter table public.analytics_visitor_days enable row level security;
alter table public.analytics_presence enable row level security;
revoke all on public.analytics_views, public.analytics_visitor_days, public.analytics_presence from public, anon, authenticated;

create or replace function public.analytics_today() returns date
language sql stable set search_path = pg_catalog as $$ select (now() at time zone 'Asia/Aden')::date $$;

create or replace function public.analytics_record_view(
  p_id uuid, p_visitor text, p_session text, p_path text, p_title text, p_seq integer,
  p_new boolean, p_member boolean, p_source text, p_device text, p_os text, p_theme text
) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_day date := public.analytics_today();
begin
  insert into public.analytics_views (id, visitor, session, day, path, title, seq, new_visitor, member, source, device, os, theme)
  values (p_id, p_visitor, p_session, v_day, p_path, nullif(left(coalesce(p_title,''),160),''), p_seq, p_new, p_member, p_source, p_device, p_os, p_theme)
  on conflict (id) do nothing;
  insert into public.analytics_visitor_days (day, visitor, member) values (v_day, p_visitor, p_member)
  on conflict (day, visitor) do update set member = analytics_visitor_days.member or excluded.member;
  insert into public.analytics_presence (session, visitor, path, device, seen_at) values (p_session, p_visitor, p_path, p_device, now())
  on conflict (session) do update set path = excluded.path, device = excluded.device, seen_at = now();
  delete from public.analytics_presence where seen_at < now() - interval '15 minutes';
end $$;

-- Visible time on a page (the browser sends the running total; the largest wins, capped at 30 min).
create or replace function public.analytics_record_time(p_id uuid, p_visitor text, p_duration_ms integer, p_title text)
returns void language sql security invoker set search_path = pg_catalog, public as $$
  update public.analytics_views
     set duration_ms = greatest(duration_ms, least(greatest(p_duration_ms, 0), 1800000)),
         title = coalesce(nullif(left(coalesce(p_title,''),160),''), title)
   where id = p_id and visitor = p_visitor and at > now() - interval '12 hours';
$$;

create or replace function public.analytics_ping(p_session text, p_visitor text, p_path text, p_device text)
returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.analytics_presence (session, visitor, path, device, seen_at) values (p_session, p_visitor, p_path, p_device, now())
  on conflict (session) do update set path = excluded.path, seen_at = now();
  delete from public.analytics_presence where seen_at < now() - interval '15 minutes';
end $$;

create or replace function public.analytics_live() returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
  with p as (select * from public.analytics_presence where seen_at > now() - interval '5 minutes')
  select jsonb_build_object(
    'now', (select count(*) from p),
    'pages', coalesce((select jsonb_agg(x order by x.count desc, x.path) from (select path, count(*) as count from p group by path order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_object_agg(device, n) from (select device, count(*) n from p group by device) d), '{}'::jsonb)
  );
$$;

-- Daily totals. The detailed rows (which random id opened which page) are summed here and then
-- deleted after two days (analytics_refresh); the dashboard reads only these totals.
create table if not exists public.analytics_day_totals (
  day date primary key,
  views integer not null default 0,
  visits integer not null default 0,
  bounces integer not null default 0,
  visit_ms bigint not null default 0,
  new_visitors integer not null default 0
);
create table if not exists public.analytics_day_pages (
  day date not null,
  path text not null,
  title text,
  views integer not null default 0,
  dur_sum bigint not null default 0,
  dur_n integer not null default 0,
  entries integer not null default 0,
  exits integer not null default 0,
  bounces integer not null default 0,
  primary key (day, path)
);
-- Visits by source (of the first page), device, system and theme.
create table if not exists public.analytics_day_dims (
  day date not null,
  dim text not null check (dim in ('source','device','os','theme')),
  key text not null,
  visits integer not null default 0,
  primary key (day, dim, key)
);
alter table public.analytics_day_totals enable row level security;
alter table public.analytics_day_pages enable row level security;
alter table public.analytics_day_dims enable row level security;
revoke all on public.analytics_day_totals, public.analytics_day_pages, public.analytics_day_dims from public, anon, authenticated;
grant select, insert, update, delete on public.analytics_day_totals, public.analytics_day_pages, public.analytics_day_dims to service_role;

-- Sums every day that still has detailed rows, then removes details older than two days, open-visit
-- rows older than 15 minutes, and visitor-day ids older than 400 days. Called before each report.
create or replace function public.analytics_refresh() returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare d date; v_today date := public.analytics_today();
begin
  perform pg_advisory_xact_lock(967011);
  for d in select distinct day from public.analytics_views order by 1 loop
    delete from public.analytics_day_totals where day = d;
    delete from public.analytics_day_pages where day = d;
    delete from public.analytics_day_dims where day = d;
    with v as (select * from public.analytics_views where day = d),
    s as (select session, count(*) as views, sum(duration_ms) as dur from v group by session),
    last_view as (select distinct on (session) session, path from v order by session, at desc, seq desc),
    entry as (select v.session, v.path, v.source, v.device, v.os, v.theme, s.views from v join s using (session) where v.seq = 1),
    totals as (insert into public.analytics_day_totals (day, views, visits, bounces, visit_ms, new_visitors)
      select d, (select count(*) from v), (select count(*) from s), (select count(*) from s where views = 1),
             (select coalesce(sum(dur), 0) from s), (select count(distinct visitor) from v where new_visitor) returning 1),
    pages as (insert into public.analytics_day_pages (day, path, title, views, dur_sum, dur_n, entries, exits, bounces)
      select d, v.path, max(v.title), count(*), coalesce(sum(v.duration_ms) filter (where v.duration_ms > 0), 0), count(*) filter (where v.duration_ms > 0),
             (select count(*) from entry e where e.path = v.path),
             (select count(*) from last_view l where l.path = v.path),
             (select count(*) from entry e where e.path = v.path and e.views = 1)
        from v group by v.path returning 1)
    insert into public.analytics_day_dims (day, dim, key, visits)
      select d, 'source', source, count(*) from entry group by source
      union all select d, 'device', device, count(*) from entry group by device
      union all select d, 'os', os, count(*) from entry group by os
      union all select d, 'theme', theme, count(*) from entry where theme is not null group by theme;
  end loop;
  delete from public.analytics_views where day < v_today - 2;
  delete from public.analytics_presence where seen_at < now() - interval '15 minutes';
  delete from public.analytics_visitor_days where day < v_today - 400;
end $$;

-- Everything the dashboard shows for a range of Yemen days, from the daily totals.
create or replace function public.analytics_report(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
  with t as (select * from public.analytics_day_totals where day between p_from and p_to),
  p as (select path, max(title) as title, sum(views)::int as views, sum(dur_sum) as dur_sum, sum(dur_n) as dur_n,
               sum(entries)::int as entries, sum(exits)::int as exits, sum(bounces)::int as bounces
          from public.analytics_day_pages where day between p_from and p_to group by path),
  dims as (select dim, key, sum(visits)::int as visits from public.analytics_day_dims where day between p_from and p_to group by dim, key),
  days as (select generate_series(p_from, p_to, interval '1 day')::date as day),
  sums as (select coalesce(sum(views), 0) as views, coalesce(sum(visits), 0) as visits, coalesce(sum(bounces), 0) as bounces,
                  coalesce(sum(visit_ms), 0) as visit_ms, coalesce(sum(new_visitors), 0) as new_visitors from t)
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
      'views', views, 'visits', visits, 'bounces', bounces, 'newVisitors', new_visitors,
      'visitors', (select count(distinct visitor) from public.analytics_visitor_days where day between p_from and p_to),
      'memberVisitors', (select count(distinct visitor) from public.analytics_visitor_days where day between p_from and p_to and member),
      'visitMs', case when visits > 0 then round(visit_ms::numeric / visits) else 0 end,
      'viewsPerVisit', case when visits > 0 then round(views::numeric / visits, 2) else 0 end) from sums),
    'daily', (select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'visitors', (select count(*) from public.analytics_visitor_days a where a.day = d.day),
        'visits', coalesce((select visits from t where t.day = d.day), 0),
        'views', coalesce((select views from t where t.day = d.day), 0)) order by d.day) from days d),
    'pages', coalesce((select jsonb_agg(x order by x.views desc, x.path) from (
        select path, title, views, entries, exits, bounces,
               case when dur_n > 0 then round(dur_sum::numeric / dur_n) else 0 end as "avgMs"
          from p order by views desc, path limit 60) x), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(x order by x.views desc, x.id) from (
        select case when path = '/' then 'home' else split_part(path, '/', 2) end as id, sum(views)::int as views,
               case when sum(dur_n) > 0 then round(sum(dur_sum)::numeric / sum(dur_n)) else 0 end as "avgMs"
          from p group by 1) x), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(x order by x.visits desc, x.path) from (
        select path, entries as visits, bounces from p where entries > 0 order by entries desc, path limit 20) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('id', key, 'visits', visits) order by visits desc, key) from dims where dim = 'source'), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id', key, 'visits', visits) order by visits desc, key) from dims where dim = 'device'), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(jsonb_build_object('id', key, 'visits', visits) order by visits desc, key) from dims where dim = 'os'), '[]'::jsonb),
    'themes', coalesce((select jsonb_agg(jsonb_build_object('id', key, 'visits', visits) order by visits desc, key) from dims where dim = 'theme'), '[]'::jsonb)
  );
$$;

-- Accounts: auth.users is read inside this function only; nothing but counts leaves it.
create or replace function public.analytics_accounts(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  with u as (select (created_at at time zone 'Asia/Aden')::date as day from auth.users where deleted_at is null and not coalesce(is_anonymous, false)),
  t as (select public.analytics_today() as today)
  select jsonb_build_object(
    'total', (select count(*) from u),
    'inRange', (select count(*) from u where day between p_from and p_to),
    'today', (select count(*) from u, t where u.day = t.today),
    'week', (select count(*) from u, t where u.day > t.today - 7),
    'month', (select count(*) from u, t where u.day > t.today - 30),
    'year', (select count(*) from u, t where u.day > t.today - 365),
    'daily', (select jsonb_agg(jsonb_build_object('day', d.day, 'count', (select count(*) from u where u.day = d.day)) order by d.day)
                from (select generate_series(p_from, p_to, interval '1 day')::date as day) d)
  );
$$;

-- «سوق 967» in the same range: listings and conversations from the market tables, listing-page
-- views from the statistics above. Counts only.
create or replace function public.analytics_market(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
  with r as (select (p_from::timestamp at time zone 'Asia/Aden') as start_at, ((p_to + 1)::timestamp at time zone 'Asia/Aden') as end_at),
  v as (select path, views from public.analytics_day_pages where day between p_from and p_to and path like '/market%')
  select jsonb_build_object(
    'published', (select count(*) from public.market_listings, r where published_at >= r.start_at and published_at < r.end_at),
    'active', (select count(*) from public.market_listings where status = 'active'),
    'pending', (select count(*) from public.market_listings where status = 'pending_review'),
    'sold', (select count(*) from public.market_listings, r where sold_at >= r.start_at and sold_at < r.end_at),
    'chats', (select count(*) from public.market_chats, r where created_at >= r.start_at and created_at < r.end_at),
    'offers', (select count(*) from public.market_offers, r where created_at >= r.start_at and created_at < r.end_at),
    'favourites', (select count(*) from public.market_favourites, r where created_at >= r.start_at and created_at < r.end_at),
    'views', (select coalesce(sum(views), 0) from v),
    'listingViews', (select coalesce(sum(views), 0) from v where path ~ '^/market/[0-9]+$'),
    'searchViews', (select coalesce(sum(views), 0) from v where path = '/market/search')
  );
$$;

-- Daily counters: two market contact steps (WhatsApp, message) join the conversion steps.
-- Same lists as 20261110200000_transaction_guides.sql otherwise.
create or replace function public.record_site_usage(p_metric text,p_section text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog,public
as $$
begin
 if not (
  (p_metric='page_view' and p_section in (
   'home','school','games','history','figures','atlas','statistics','rankings',
   'debates','works','magazine','universities','medical','products',
   'professionals','services','transactions','search','contribute','other'
  ))
  or
  (p_metric='search_miss' and p_section in (
   'all','works','debates','issues','indicators','figures','history',
   'companies','professionals','places','domains'
  ))
  or
  (p_metric='funnel' and p_section in (
   'lesson_start_guest','lesson_start_member','lesson_done_guest','lesson_done_member','game_start_guest','game_start_member','game_done_guest','game_done_member','signup_prompt_shown','signup_prompt_click','signup_done','share_click','share_arrival',
   'market_whatsapp','market_message'
  ))
 ) then
  raise exception 'invalid analytics category' using errcode='22023';
 end if;
 insert into public.site_usage_daily as counters (day,metric,section,total)
 values ((current_timestamp at time zone 'UTC')::date,p_metric,p_section,1)
 on conflict (day,metric,section)
 do update set total=counters.total+1;
end;
$$;
revoke all on function public.record_site_usage(text,text) from public,anon,authenticated;
grant execute on function public.record_site_usage(text,text) to service_role;
revoke all on function public.analytics_market(date,date) from public, anon, authenticated;
grant execute on function public.analytics_market(date,date) to service_role;
revoke all on function public.analytics_refresh() from public, anon, authenticated;
grant execute on function public.analytics_refresh() to service_role;

revoke all on function public.analytics_today() from public, anon, authenticated;
revoke all on function public.analytics_record_view(uuid,text,text,text,text,integer,boolean,boolean,text,text,text,text) from public, anon, authenticated;
revoke all on function public.analytics_record_time(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.analytics_ping(text,text,text,text) from public, anon, authenticated;
revoke all on function public.analytics_live() from public, anon, authenticated;
revoke all on function public.analytics_report(date,date) from public, anon, authenticated;
revoke all on function public.analytics_accounts(date,date) from public, anon, authenticated;
grant execute on function public.analytics_today() to service_role;
grant execute on function public.analytics_record_view(uuid,text,text,text,text,integer,boolean,boolean,text,text,text,text) to service_role;
grant execute on function public.analytics_record_time(uuid,text,integer,text) to service_role;
grant execute on function public.analytics_ping(text,text,text,text) to service_role;
grant execute on function public.analytics_live() to service_role;
grant execute on function public.analytics_report(date,date) to service_role;
grant execute on function public.analytics_accounts(date,date) to service_role;
grant select, insert, update, delete on public.analytics_views, public.analytics_visitor_days, public.analytics_presence to service_role;

comment on table public.analytics_views is 'First-party page views: random visitor/visit ids from the browser, normalized path, category-only source/device/os. No IP, user agent, query string or account id.';
comment on table public.analytics_visitor_days is 'Random visitor id per Yemen day, for unique-visitor counts over a range.';
comment on table public.analytics_presence is 'Open visits seen in the last minutes (who is on the site now); rows older than 15 minutes are removed.';
