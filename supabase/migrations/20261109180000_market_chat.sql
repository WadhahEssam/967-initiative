-- «سوق 967» phase 4: chats between buyers and sellers, price offers and reservations.
-- Every table here is private: no browser role can read or write it; the site's server
-- (service role) does, after checking that the member is part of the chat.

-- Who a reserved listing is held for (null when the seller reserved it by hand).
alter table public.market_listings add column if not exists reserved_for uuid references auth.users(id) on delete set null;

-- One chat per buyer and listing. Unread counts are kept per side so the header badge is one
-- cheap query. A deleted account leaves the chat in place for the other side.
create table if not exists public.market_chats(
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.market_listings(id) on delete cascade,
 buyer_id uuid references auth.users(id) on delete set null,
 seller_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 last_message_at timestamptz not null default now(),
 last_preview text not null default '' check (length(last_preview)<=160),
 last_sender_id uuid,
 buyer_unread integer not null default 0 check (buyer_unread>=0),
 seller_unread integer not null default 0 check (seller_unread>=0),
 buyer_read_at timestamptz not null default now(),
 seller_read_at timestamptz,
 unique(listing_id,buyer_id)
);
create index if not exists market_chats_buyer on public.market_chats(buyer_id,last_message_at desc);
create index if not exists market_chats_seller on public.market_chats(seller_id,last_message_at desc);

-- Price offers. The buyer offers; the seller accepts, rejects or counters (a new offer from the
-- seller); the buyer may accept or reject a counter. One pending offer per chat; 48 hours to reply.
create table if not exists public.market_offers(
 id uuid primary key default gen_random_uuid(),
 chat_id uuid not null references public.market_chats(id) on delete cascade,
 listing_id uuid not null references public.market_listings(id) on delete cascade,
 from_role text not null check (from_role in ('buyer','seller')),
 amount numeric(14,2) not null check (amount>0),
 currency text not null check (length(currency) between 2 and 10),
 note text not null default '' check (length(note)<=300),
 status text not null default 'pending' check (status in ('pending','accepted','rejected','countered','expired','withdrawn','cancelled')),
 reply_to uuid references public.market_offers(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '48 hours',
 responded_at timestamptz
);
create unique index if not exists market_offers_one_pending on public.market_offers(chat_id) where status='pending';
create index if not exists market_offers_listing on public.market_offers(listing_id,status);

create table if not exists public.market_messages(
 id uuid primary key default gen_random_uuid(),
 chat_id uuid not null references public.market_chats(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete set null,
 kind text not null check (kind in ('text','image','offer','system')),
 body text not null default '' check (length(body)<=2000),
 image jsonb check (image is null or (jsonb_typeof(image)='object' and length(image::text)<=200)),
 offer_id uuid references public.market_offers(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists market_messages_chat on public.market_messages(chat_id,created_at desc);
create index if not exists market_messages_sender on public.market_messages(sender_id,created_at desc);

-- A photo sent in a chat is kept apart from listing photos.
alter table public.market_uploads add column if not exists chat_id uuid references public.market_chats(id) on delete set null;

alter table public.market_chats enable row level security;
alter table public.market_offers enable row level security;
alter table public.market_messages enable row level security;
revoke all on public.market_chats,public.market_offers,public.market_messages from anon,authenticated;

-- Each message moves the chat to the top, sets its preview, and counts as unread for the other side.
create or replace function public.market_chat_after_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.market_chats c set
  last_message_at=new.created_at,
  last_preview=left(case new.kind when 'image' then 'صورة' when 'offer' then 'عرض سعر' else regexp_replace(new.body,'\s+',' ','g') end,160),
  last_sender_id=new.sender_id,
  buyer_unread=c.buyer_unread+(case when new.sender_id is distinct from c.buyer_id then 1 else 0 end),
  seller_unread=c.seller_unread+(case when new.sender_id is distinct from c.seller_id then 1 else 0 end),
  buyer_read_at=case when new.sender_id=c.buyer_id then new.created_at else c.buyer_read_at end,
  seller_read_at=case when new.sender_id=c.seller_id then new.created_at else c.seller_read_at end
 where c.id=new.chat_id;
 return null;
end $$;
revoke all on function public.market_chat_after_message() from public,anon,authenticated;
drop trigger if exists market_messages_after_insert on public.market_messages;
create trigger market_messages_after_insert after insert on public.market_messages for each row execute function public.market_chat_after_message();

-- Unread market messages for the header badge, and when the newest of them arrived (for the chime).
create or replace function public.market_unread_summary(p_user uuid) returns table(unread bigint,latest timestamptz)
language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when c.buyer_id=p_user then c.buyer_unread else 0 end+case when c.seller_id=p_user then c.seller_unread else 0 end),0),
  max(c.last_message_at) filter (where (c.buyer_id=p_user and c.buyer_unread>0) or (c.seller_id=p_user and c.seller_unread>0))
 from public.market_chats c where c.buyer_id=p_user or c.seller_id=p_user;
$$;
revoke all on function public.market_unread_summary(uuid) from public,anon,authenticated;
grant execute on function public.market_unread_summary(uuid) to service_role;
