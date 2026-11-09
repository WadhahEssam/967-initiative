// Calls a database function over a direct Postgres connection (SUPABASE_DB_URL) as the service
// role, instead of through the REST gateway. Used by the bulk directory scripts with DIRECT_DB=1.
//
// Why: on 2026-11-09 a run of ~150 large REST saves set off a retry storm inside Supabase's API
// layer (about 1,400 failing calls per second) that took every page of the site down until the
// PostgREST connections were reset. Direct calls, one at a time with a pause, avoid that layer.
//
// The pg driver is not a project dependency; PG_MODULE points at one (default: .audit-tools).
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function openDirectRpc({pauseMs = 300} = {}) {
  if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required for DIRECT_DB=1');
  const {Client} = require(process.env.PG_MODULE || '../../.audit-tools/node_modules/pg');
  const client = new Client({connectionString: process.env.SUPABASE_DB_URL, ssl: {rejectUnauthorized: false}});
  await client.connect();
  return {
    // args: {name: value}; types: {name: 'uuid' | 'bigint' | 'jsonb' | 'text'}. Returns the function's result.
    async call(name, args, types) {
      if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid function name');
      const keys = Object.keys(args);
      const sql = `select public.${name}(${keys.map((key, index) => `${key}=>$${index + 1}::${types[key]}`).join(',')}) as result`;
      const values = keys.map(key => types[key] === 'jsonb' ? JSON.stringify(args[key]) : args[key]);
      await client.query('begin');
      try {
        // The same identity the REST call had: directory_assert_writer() accepts the service role.
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({role: 'service_role'})]);
        await client.query('set local role service_role');
        const {rows} = await client.query(sql, values);
        await client.query('commit');
        await pause(pauseMs);
        return rows[0]?.result;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      }
    },
    end: () => client.end(),
  };
}
