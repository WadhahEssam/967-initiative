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

-- Everything the dashboard shows for a range of Yemen days.
create or replace function public.analytics_report(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
  with v as (select * from public.analytics_views where day between p_from and p_to),
  s as (select session, min(day) as day, count(*) as views, sum(duration_ms) as dur from v group by session),
  last_view as (select distinct on (session) session, path from v order by session, at desc, seq desc),
  entry as (select session, path, source from v where seq = 1),
  days as (select generate_series(p_from, p_to, interval '1 day')::date as day)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'views', (select count(*) from v),
      'visitors', (select count(distinct visitor) from public.analytics_visitor_days where day between p_from and p_to),
      'newVisitors', (select count(distinct visitor) from v where new_visitor),
      'memberVisitors', (select count(distinct visitor) from public.analytics_visitor_days where day between p_from and p_to and member),
      'visits', (select count(*) from s),
      'bounces', (select count(*) from s where views = 1),
      'visitMs', (select coalesce(round(avg(dur)), 0) from s),
      'viewsPerVisit', (select coalesce(round(avg(views)::numeric, 2), 0) from s)
    ),
    'daily', (select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'visitors', (select count(*) from public.analytics_visitor_days a where a.day = d.day),
        'visits', (select count(*) from s where s.day = d.day),
        'views', (select count(*) from v where v.day = d.day)) order by d.day) from days d),
    'pages', coalesce((select jsonb_agg(p order by p.views desc, p.path) from (
        select v.path, max(v.title) as title, count(*) as views, count(distinct v.visitor) as visitors,
               coalesce(round(avg(nullif(v.duration_ms, 0))), 0) as "avgMs",
               (select count(*) from entry e where e.path = v.path) as entries,
               (select count(*) from last_view l where l.path = v.path) as exits,
               (select count(*) from entry e join s on s.session = e.session and s.views = 1 where e.path = v.path) as bounces
          from v group by v.path order by count(*) desc, v.path limit 60) p), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.visits desc) from (select source as id, count(*) as visits from entry group by source) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(x order by x.visitors desc) from (select device as id, count(distinct visitor) as visitors from v group by device) x), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(x order by x.visitors desc) from (select os as id, count(distinct visitor) as visitors from v group by os) x), '[]'::jsonb),
    'themes', coalesce((select jsonb_agg(x order by x.visitors desc) from (select theme as id, count(distinct visitor) as visitors from v where theme is not null group by theme) x), '[]'::jsonb)
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
