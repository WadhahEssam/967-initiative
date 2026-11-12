import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createTimedFetch} from './requestSecurity';

export function serverDb() {
  // Local visual QA can exercise bundled, source-backed preview catalogs without
  // depending on (or writing to) a configured remote Supabase project.
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_CONTENT_FALLBACK === '1') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {persistSession: false, autoRefreshToken: false},
    // No automatic retries: the circuit breaker in createTimedFetch decides when to try again.
    db: {retry: false},
    global: {fetch: createTimedFetch(10000)},
  });
}
