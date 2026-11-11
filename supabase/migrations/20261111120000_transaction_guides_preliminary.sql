-- «دليل المعاملات» (2026-11-11): a guide may be published before a person checks it at the office,
-- as long as it cites published sources. The page then says plainly that the information is
-- preliminary («معلومات أولية») and has not been checked by the 967 team yet.
alter table public.transaction_guides drop constraint if exists transaction_guides_check;
alter table public.transaction_guides drop constraint if exists transaction_guides_published_check;
alter table public.transaction_guides add constraint transaction_guides_published_check
 check (status<>'published' or verified_at is not null or cardinality(sources)>0);
