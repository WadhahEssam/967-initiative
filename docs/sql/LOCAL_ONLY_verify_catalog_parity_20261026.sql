-- READ ONLY, LOCAL TEST. Production fingerprint snapshot: 2026-10-26.
-- Comparing PostgreSQL catalog SQL definitions and privileges from the restored
-- local test database vs the live production public schema (read-only sampled).
-- MD5 is a catalog COMPARISON FINGERPRINT, not cryptographic validation or backup checksum.
-- Differences can be caused by differing Supabase/PostgreSQL versions, defaults,
-- or actual schema drift. Do not blindly GRANT, DROP, or REPAIR production.
-- Never include the backup contents in GitHub. Run inside Docker: psql -X -f thisfile
WITH signatures AS (
 SELECT 'function_definitions' kind, count(*) n,
 md5(string_agg(pg_get_function_identity_arguments(p.oid) || ':' || n.nspname || '.' || p.proname || ':' || pg_get_functiondef(p.oid), E'\n' ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) fingerprint
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'function_execute_rights', count(*),
 md5(string_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')/'||r.role_name||':'||has_function_privilege(r.role_name,p.oid,'EXECUTE')::text,E'\n' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid),r.role_name))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name) WHERE n.nspname='public'
 UNION ALL
 SELECT 'rls_policies',count(*),
 md5(string_agg(concat_ws('|',schemaname,tablename,policyname,permissive,roles::text,cmd,coalesce(qual,''),coalesce(with_check,'')),E'\n' ORDER BY tablename,policyname))
 FROM pg_policies WHERE schemaname='public'
 UNION ALL
 SELECT 'triggers',count(*),
 md5(string_agg(n.nspname||'.'||c.relname||'.'||t.tgname||'|'||t.tgenabled::text||'|'||pg_get_triggerdef(t.oid,true),E'\n' ORDER BY c.relname,t.tgname))
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL
 SELECT 'rls_table_flags',count(*),
 md5(string_agg(c.relname||'|'||c.relrowsecurity::text||'|'||c.relforcerowsecurity::text,E'\n' ORDER BY c.relname))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
 UNION ALL
 SELECT 'foreign_key_definitions',count(*),
 md5(string_agg(c.conrelid::regclass::text||'/'||c.conname||'|'||pg_get_constraintdef(c.oid,true)||'|'||c.convalidated::text,E'\n' ORDER BY c.conrelid::regclass::text,c.conname))
 FROM pg_constraint c WHERE c.connamespace='public'::regnamespace AND c.contype='f'
 UNION ALL
 SELECT 'indexes',count(*),
 md5(string_agg(t.relname||'/'||idx.relname||'|'||pg_get_indexdef(i.indexrelid),E'\n' ORDER BY t.relname,idx.relname))
 FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class idx ON idx.oid=i.indexrelid WHERE n.nspname='public'
 UNION ALL
 SELECT 'sequences',count(*),
 md5(string_agg(c.relname||'|'||coalesce(c.relacl::text,'')||'|'||s.seqstart::text||'|'||s.seqincrement::text||'|'||s.seqmin::text||'|'||s.seqmax::text,E'\n' ORDER BY c.relname))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_sequence s ON s.seqrelid=c.oid WHERE n.nspname='public'
 UNION ALL
 SELECT 'default_privileges', count(*),
 md5(string_agg(pg_get_userbyid(d.defaclrole) || '/' || d.defaclobjtype::text || '/' || coalesce(n.nspname,'') || '/' || coalesce(g.rolname,'PUBLIC') || '/' || a.privilege_type || '/' || a.is_grantable::text,E'\n' ORDER BY pg_get_userbyid(d.defaclrole),d.defaclobjtype::text,coalesce(n.nspname,''),coalesce(g.rolname,'PUBLIC'),a.privilege_type))
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 LEFT JOIN pg_roles g ON g.oid=a.grantee
 WHERE n.nspname='public'
), expected(kind, expected_count, expected_fingerprint) AS (
 VALUES
  ('foreign_key_definitions',72,'92d7c24c1349099e1f5750670859d5a6'),
  ('function_definitions',96,'4e92dde75187f09629d77cb7913b3266'),
  ('function_execute_rights',288,'e9131498c65ba844eb335a8eaf477ea3'),
  ('indexes',155,'abbacda4f740783018e8c259c3490790'),
  ('rls_policies',123,'e96b3bbf24e66c1f88421d11c27986c4'),
  ('rls_table_flags',57,'253f03d4c4c93e617cda0d8909bef897'),
  ('sequences',2,'ebac810260c55f4da81bdcc4703a02c5'),
  ('triggers',75,'30ddb8e60fc766bf79857501e3a77893'),
  ('default_privileges',92,'33d65b1308851af0e4e908220314bf2d')
)
SELECT e.kind AS check_item, e.expected_count, s.n AS local_count,
CASE WHEN e.expected_count=s.n AND e.expected_fingerprint=s.fingerprint THEN 'MATCH' ELSE 'DIFF' END AS result,
s.fingerprint AS local_signature
FROM expected e LEFT JOIN signatures s USING(kind)
ORDER BY e.kind;
