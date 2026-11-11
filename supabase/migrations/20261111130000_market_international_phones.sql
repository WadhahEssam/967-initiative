-- «سوق 967» (2026-11-11): sellers outside Yemen can show their WhatsApp number. Yemeni mobiles
-- stay as before (9 digits starting with 7); other numbers are stored as international digits
-- without + (country code first, 10–15 digits). Existing numbers are untouched.
alter table public.market_seller_contacts drop constraint if exists market_seller_contacts_phone_check;
alter table public.market_seller_contacts add constraint market_seller_contacts_phone_check
 check (phone ~ '^7[01378][0-9]{7}$' or phone ~ '^[1-9][0-9]{9,14}$');
