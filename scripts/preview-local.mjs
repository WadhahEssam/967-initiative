#!/usr/bin/env node
// Production build of the site running against the LOCAL Supabase (Docker), never the real one.
//
//   npm run preview            build, then serve on http://localhost:3080
//   npm run preview -- --no-build   serve the last preview build again
//   npm run preview -- --port=3090
//
// Why: `next build` / `next start` read .env.local, which points at the production database.
// This script loads .env.development.local instead, refuses to run if any setting still points
// at a non-local Supabase or database, and blanks every other .env.local value (for example the
// site admin password) so nothing in the preview can reach production by accident.
// The build goes to .next-preview, so it never collides with `npm run dev` (.next).
import {readFileSync, existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args.find(arg => arg.startsWith('--port='))?.slice(7) || 3080);
const skipBuild = args.includes('--no-build');

export function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

// A value is local when every URL-like host in it is localhost / 127.0.0.1 / [::1].
export function pointsOutside(value) {
  const hosts = [...String(value).matchAll(/(?:https?|postgres(?:ql)?):\/\/(?:[^@/\s]*@)?(\[[^\]]+\]|[^:/?#\s]+)/gi)].map(match => match[1].toLowerCase());
  return hosts.some(host => !['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(host));
}

export function previewEnvironment(localFile, developmentFile, base = process.env) {
  const local = localFile ? parseEnvFile(localFile) : {};
  const development = parseEnvFile(developmentFile);
  const problems = Object.entries(development).filter(([key, value]) => /SUPABASE|DB_URL|DATABASE/.test(key) && pointsOutside(value)).map(([key]) => key);
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL']) if (!development[key]) problems.push(key + ' (missing)');
  const env = {...base};
  // Blank production-only settings that the development file does not replace.
  for (const key of Object.keys(local)) if (!(key in development)) env[key] = '';
  Object.assign(env, development, {NEXT_PREVIEW_LOCAL: '1', NEXT_TELEMETRY_DISABLED: '1'});
  if (pointsOutside(env.NEXT_PUBLIC_SITE_URL || 'http://localhost')) env.NEXT_PUBLIC_SITE_URL = 'http://localhost:' + port;
  return {env, problems};
}

// Runs the Next.js CLI with this Node binary (no shell, so arguments are passed as they are).
function runNext(commandArgs, env) {
  const cli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...commandArgs], {cwd: root, env, stdio: 'inherit'});
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('next ' + commandArgs.join(' ') + ' exited with ' + code)));
  });
}

async function main() {
  const developmentPath = path.join(root, '.env.development.local');
  if (!existsSync(developmentPath)) throw new Error('Missing .env.development.local. See PROJECT_GUIDE_AR.md §10.4 to set up the local Supabase.');
  const localPath = path.join(root, '.env.local');
  const {env, problems} = previewEnvironment(existsSync(localPath) ? readFileSync(localPath, 'utf8') : '', readFileSync(developmentPath, 'utf8'));
  if (problems.length) throw new Error('Refusing to start: these settings are not local: ' + problems.join(', '));
  const health = await fetch(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/', {headers: {apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY}}).then(response => response.status).catch(() => 0);
  if (!health) throw new Error('The local Supabase is not running. Start it with: npx supabase start');
  if (!skipBuild) await runNext(['build'], env);
  console.log('\nPreview (local database only): http://localhost:' + port + '\n');
  await runNext(['start', '-p', String(port)], env);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
