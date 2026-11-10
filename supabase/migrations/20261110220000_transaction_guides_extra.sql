-- «دليل المعاملات», second step (2026-11-10): questions and answers, related guides, the
-- «الأكثر طلبًا» flag, and a business category (commercial register, tax card).

alter table public.transaction_guides
 add column if not exists faqs jsonb not null default '[]'::jsonb,
 add column if not exists related text[] not null default '{}',
 add column if not exists featured boolean not null default false;

alter table public.transaction_guides drop constraint if exists transaction_guides_faqs_check;
alter table public.transaction_guides add constraint transaction_guides_faqs_check check (jsonb_typeof(faqs)='array' and jsonb_array_length(faqs)<=20);

alter table public.transaction_guides drop constraint if exists transaction_guides_category_check;
alter table public.transaction_guides add constraint transaction_guides_category_check
 check (category in ('identity','travel','vehicles','education','legal','business','other'));
