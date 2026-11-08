#!/usr/bin/env bash
# Restores the newest encrypted database backup from Backblaze into the LOCAL
# Supabase running in Docker (`npx supabase start`), so local work uses real
# data without spending the production Supabase egress quota.
#
# Safety:
# - It writes only to the local container supabase_db_967-initiative. It never
#   reads .env.local and never connects to production.
# - It replaces the local public data, plus auth.users and auth.identities.
# - The decrypted backup goes to a temporary folder that is deleted at the end.
#
# Needs .env.backup.local (never committed) with B2_KEY_ID, B2_APPLICATION_KEY
# and BACKUP_ENCRYPTION_PASSPHRASE.
#
# Usage (Git Bash):  bash scripts/restore-local-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB_CONTAINER=supabase_db_967-initiative
B2_BUCKET=967ye-supabase-backups-2026
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003

fail(){ echo "ERROR: $*" >&2; exit 1; }

[[ -f .env.backup.local ]] || fail ".env.backup.local is missing."
# Read values literally: a passphrase may contain $, quotes or spaces, so the file is never run as shell code.
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^(B2_KEY_ID|B2_APPLICATION_KEY|BACKUP_ENCRYPTION_PASSPHRASE)=(.*)$ ]] || continue
  printf -v "${BASH_REMATCH[1]}" '%s' "${BASH_REMATCH[2]}"
done < .env.backup.local
for name in B2_KEY_ID B2_APPLICATION_KEY BACKUP_ENCRYPTION_PASSPHRASE; do
  [[ -n "${!name:-}" ]] || fail "$name is empty in .env.backup.local."
done
command -v gpg >/dev/null || fail "gpg is not installed."
[[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null)" == true ]] \
  || fail "Local Supabase is not running. Run: npx supabase start"

work="$(mktemp -d)"
trap 'rm -rf "$work"; docker exec "$DB_CONTAINER" rm -f /tmp/967.dump /tmp/967.list >/dev/null 2>&1 || true' EXIT
s3(){ curl -sSf --aws-sigv4 "aws:amz:$B2_REGION:s3" --user "$B2_KEY_ID:$B2_APPLICATION_KEY" "$@"; }

echo "1/5 Finding the newest backup in Backblaze..."
listing="$(s3 "$B2_ENDPOINT/$B2_BUCKET?list-type=2&prefix=database/daily/&max-keys=1000")" \
  || fail "Backblaze refused the request. Check B2_KEY_ID and B2_APPLICATION_KEY."
grep -q '<IsTruncated>true</IsTruncated>' <<<"$listing" && fail "More than 1000 backups listed; extend this script."
key="$(grep -o '<Key>database/daily/967-[^<]*\.tar\.gz\.gpg</Key>' <<<"$listing" | sed 's/<[^>]*>//g' | sort | tail -1)"
[[ -n "$key" ]] || fail "No database backup found."
echo "    $key"

echo "2/5 Downloading..."
s3 "$B2_ENDPOINT/$B2_BUCKET/$key" -o "$work/backup.tar.gz.gpg"

echo "3/5 Decrypting and checking the checksum..."
printf '%s\n' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback \
  --passphrase-fd 0 --decrypt --output "$work/backup.tar.gz" "$work/backup.tar.gz.gpg" \
  || fail "Decryption failed. Check BACKUP_ENCRYPTION_PASSPHRASE."
tar -xzf "$work/backup.tar.gz" -C "$work"
dump="$work/967-backup/database.dump"
expected="$(awk '{print $1; exit}' "$work/967-backup/database.dump.sha256")"
actual="$(sha256sum "$dump" | awk '{print $1}')"
[[ "$expected" == "$actual" ]] || fail "Checksum mismatch: the backup is damaged."

echo "4/5 Replacing local data (public tables, auth.users, auth.identities)..."
host_dump="$dump"; command -v cygpath >/dev/null && host_dump="$(cygpath -w "$dump")" # docker.exe on Windows needs a Windows path
MSYS_NO_PATHCONV=1 docker cp "$host_dump" "$DB_CONTAINER:/tmp/967.dump" >/dev/null
psql_local(){ MSYS_NO_PATHCONV=1 docker exec -i "$DB_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql_local <<'SQL'
do $$
declare tables text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into tables
  from pg_tables where schemaname = 'public';
  execute 'truncate ' || concat_ws(', ', tables, 'auth.identities', 'auth.users') || ' cascade';
end $$;
SQL
# Only table rows and sequence positions: the schema already comes from the migrations.
MSYS_NO_PATHCONV=1 docker exec "$DB_CONTAINER" sh -ec \
  "pg_restore --list /tmp/967.dump | grep -E '^[0-9]+; [0-9]+ [0-9]+ (TABLE DATA public |TABLE DATA auth (users|identities) |SEQUENCE SET public )' > /tmp/967.list"
MSYS_NO_PATHCONV=1 docker exec "$DB_CONTAINER" pg_restore -U supabase_admin -d postgres \
  --data-only --disable-triggers --no-owner --no-privileges --exit-on-error \
  --use-list=/tmp/967.list /tmp/967.dump
psql_local -c 'analyze;'

echo "5/5 Restored. Row counts:"
psql_local -At -F ' = ' -c "select 'auth.users', count(*) from auth.users
  union all select 'yemeni_figures', count(*) from public.yemeni_figures
  union all select 'stat_indicators', count(*) from public.stat_indicators
  union all select 'site_settings', count(*) from public.site_settings
  union all select 'debates', count(*) from public.debates"
echo "Done. Backup used: $key"
