-- «سوق 967» phase 2: posting a listing and viewing it.
-- The seller's WhatsApp number and their acceptance of the market terms are private: no browser
-- role can read or write them; the site's server (service role) uses them.

create table if not exists public.market_seller_contacts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 -- Yemeni mobile without +967: 9 digits starting with 7.
 phone text not null check (phone ~ '^7[01378][0-9]{7}$'),
 updated_at timestamptz not null default now()
);
create table if not exists public.market_terms_acceptances(
 user_id uuid primary key references auth.users(id) on delete cascade,
 version text not null check (length(version) between 1 and 20),
 accepted_at timestamptz not null default now()
);
alter table public.market_seller_contacts enable row level security;
alter table public.market_terms_acceptances enable row level security;
revoke all on public.market_seller_contacts,public.market_terms_acceptances from anon,authenticated;

-- One view more for a visible listing (the server de-duplicates visitors before calling it).
create or replace function public.market_count_view(p_listing uuid) returns void
language sql security definer set search_path='' as $$
 update public.market_listings set views=views+1,updated_at=updated_at,revision=revision
 where id=p_listing and status in ('active','reserved');
$$;
revoke all on function public.market_count_view(uuid) from public,anon,authenticated;
grant execute on function public.market_count_view(uuid) to service_role;

-- Counting a view must not look like an edit: keep updated_at and revision when only views change.
create or replace function public.market_touch() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'views'-'updated_at'-'revision')=(to_jsonb(old)-'views'-'updated_at'-'revision') then
  new.updated_at:=old.updated_at;new.revision:=old.revision;
  return new;
 end if;
 new.updated_at:=now();
 new.revision:=old.revision+1;
 return new;
end $$;
