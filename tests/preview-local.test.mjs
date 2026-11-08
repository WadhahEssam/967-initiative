// `npm run preview` must only ever talk to the local Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnvFile, pointsOutside, previewEnvironment} from '../scripts/preview-local.mjs';

const development = [
  'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
  'SUPABASE_URL=http://127.0.0.1:54321',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon',
  'SUPABASE_SERVICE_ROLE_KEY=local-service',
  'SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  'NEXT_PUBLIC_SITE_URL=http://localhost:3000',
].join('\n');
const production = [
  'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co',
  'SUPABASE_SERVICE_ROLE_KEY=prod-service',
  'SUPABASE_DB_URL="postgresql://user:p@ss@db.example.supabase.co:5432/postgres"',
  'SITE_ADMIN_EMAIL=admin@example.com',
  'SITE_ADMIN_PASSWORD=secret',
].join('\r\n');

test('env files parse with quotes and CRLF', () => {
  const values = parseEnvFile(production);
  assert.equal(values.SITE_ADMIN_PASSWORD, 'secret');
  assert.equal(values.SUPABASE_DB_URL, 'postgresql://user:p@ss@db.example.supabase.co:5432/postgres');
});

test('only localhost addresses count as local', () => {
  assert.equal(pointsOutside('http://127.0.0.1:54321'), false);
  assert.equal(pointsOutside('postgresql://postgres:postgres@localhost:54322/postgres'), false);
  assert.equal(pointsOutside('https://abc.supabase.co'), true);
  assert.equal(pointsOutside('postgresql://u:p@db.abc.supabase.co:5432/postgres'), true);
  assert.equal(pointsOutside('local-anon'), false);
});

test('the preview uses the local settings and blanks production-only ones', () => {
  const {env, problems} = previewEnvironment(production, development, {PATH: '/bin'});
  assert.deepEqual(problems, []);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:54321');
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, 'local-service');
  assert.equal(env.SITE_ADMIN_PASSWORD, '', 'production admin password never reaches the preview');
  assert.equal(env.SITE_ADMIN_EMAIL, '');
  assert.equal(env.NEXT_PREVIEW_LOCAL, '1');
  assert.equal(env.PATH, '/bin');
  for (const [key, value] of Object.entries(env)) assert.equal(/supabase\.co/.test(value), false, key);
});

test('the preview refuses a development file that points at a real database', () => {
  const {problems} = previewEnvironment('', development.replace('http://127.0.0.1:54321', 'https://abc.supabase.co'));
  assert.ok(problems.includes('NEXT_PUBLIC_SUPABASE_URL'));
  assert.ok(previewEnvironment('', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=x').problems.includes('NEXT_PUBLIC_SUPABASE_URL (missing)'));
});

test('the preview build has its own directory and npm script', () => {
  const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /process\.env\.NEXT_PREVIEW_LOCAL === '1' \? '\.next-preview'/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts.preview, 'node scripts/preview-local.mjs');
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^\.next-preview\/$/m);
});
