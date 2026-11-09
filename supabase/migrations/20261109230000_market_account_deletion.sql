-- «سوق 967» phase 8: a safety net for account deletion. The site archives a member's listings and
-- removes their photos before deleting the account (lib/market/accountServer.js). If an account is
-- deleted another way, seller_id becomes null (foreign key); the listing is then archived, not
-- left as an orphan that is merely hidden.
create or replace function public.market_listing_orphaned() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.seller_id is null and old.seller_id is not null and new.status<>'archived' then
  new.status:='archived';new.reserved_for:=null;new.show_whatsapp:=false;
 end if;
 return new;
end $$;
revoke all on function public.market_listing_orphaned() from public,anon,authenticated;
drop trigger if exists market_listings_orphaned on public.market_listings;
create trigger market_listings_orphaned before update of seller_id on public.market_listings for each row execute function public.market_listing_orphaned();
