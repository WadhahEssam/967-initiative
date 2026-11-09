-- Download count for each magazine issue, shown on the magazine pages.
-- The site's download links go through /api/magazine/download/<slug>, which calls
-- public.count_issue_download with the service role and then redirects to the PDF.

create table if not exists public.issue_download_counts(
 issue_id uuid primary key references public.issues(id) on delete cascade,
 downloads bigint not null default 0 check (downloads>=0),
 updated_at timestamptz not null default now()
);
alter table public.issue_download_counts enable row level security;
revoke insert,update,delete,truncate on public.issue_download_counts from anon,authenticated;
grant select on public.issue_download_counts to anon,authenticated;
drop policy if exists issue_download_counts_public_read on public.issue_download_counts;
create policy issue_download_counts_public_read on public.issue_download_counts for select to anon,authenticated
 using (exists(select 1 from public.issues i where i.id=issue_id and i.is_published));

create or replace function public.count_issue_download(p_issue uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare total bigint;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
 if not exists(select 1 from public.issues where id=p_issue and is_published) then return null; end if;
 insert into public.issue_download_counts(issue_id,downloads,updated_at) values(p_issue,1,clock_timestamp())
 on conflict (issue_id) do update set downloads=public.issue_download_counts.downloads+1,updated_at=clock_timestamp()
 returning downloads into total;
 return total;
end $$;
revoke all on function public.count_issue_download(uuid) from public,anon,authenticated;
grant execute on function public.count_issue_download(uuid) to service_role;
