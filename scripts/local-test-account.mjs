#!/usr/bin/env node
// Creates (or resets) test accounts in the LOCAL Supabase only, for trying signed-in pages with
// `npm run dev` or `npm run preview`. Refuses to run against anything that is not localhost.
//
//   node scripts/local-test-account.mjs
//
// Accounts (emails end in .test, so no real mailbox exists):
//   editor@967.test   management role (admin pages, studio)
//   member@967.test   ordinary member
// Fresh random passwords are written to .env.test-accounts.local (git-ignored); they are not printed.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnvFile, pointsOutside} from './preview-local.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACCOUNTS = [
  {key: 'EDITOR', email: 'editor@967.test', name: 'محرر تجريبي', role: 'management'},
  {key: 'MEMBER', email: 'member@967.test', name: 'عضو تجريبي', role: null},
];

async function main() {
  const file = path.join(root, '.env.development.local');
  if (!existsSync(file)) throw new Error('Missing .env.development.local (local Supabase settings).');
  const env = parseEnvFile(readFileSync(file, 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || pointsOutside(url)) throw new Error('Refusing: NEXT_PUBLIC_SUPABASE_URL is not a local address.');
  const headers = {apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'};
  const call = async (method, pathname, body, extra = {}) => {
    const response = await fetch(url + pathname, {method, headers: {...headers, ...extra}, body: body && JSON.stringify(body)});
    const text = await response.text();
    if (!response.ok) throw new Error(method + ' ' + pathname + ' → ' + response.status + ' ' + text.slice(0, 200));
    return text ? JSON.parse(text) : null;
  };
  const lines = ['# Local test accounts (local Supabase only). Created by scripts/local-test-account.mjs.'];
  const existing = (await call('GET', '/auth/v1/admin/users?per_page=1000')).users || [];
  for (const account of ACCOUNTS) {
    const password = randomBytes(18).toString('base64url');
    const found = existing.find(user => user.email === account.email);
    const attributes = {email: account.email, password, email_confirm: true, user_metadata: {full_name: account.name}};
    const user = found ? await call('PUT', '/auth/v1/admin/users/' + found.id, attributes) : await call('POST', '/auth/v1/admin/users', attributes);
    if (account.role) {
      await call('POST', '/rest/v1/editors?on_conflict=user_id', {user_id: user.id, role: account.role}, {Prefer: 'resolution=merge-duplicates'});
    }
    lines.push('TEST_' + account.key + '_EMAIL=' + account.email, 'TEST_' + account.key + '_PASSWORD=' + password);
    console.log((found ? 'reset ' : 'created ') + account.email + (account.role ? ' (' + account.role + ')' : ''));
  }
  writeFileSync(path.join(root, '.env.test-accounts.local'), lines.join('\n') + '\n');
  console.log('Passwords saved to .env.test-accounts.local');
}

main().catch(error => { console.error(error.message); process.exit(1); });
