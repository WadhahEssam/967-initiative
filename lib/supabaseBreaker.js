// Circuit breaker for every request to Supabase (added after the outage of 2026-11-12).
// When Supabase is down, each page view used to try it again, often several times
// (supabase-js retried each read up to three more times). That steady stream of
// retries kept the database busy while it was trying to start back up.
//
// The breaker counts failures in a row: a network error, a timeout, or an answer
// that means Supabase or its gateway is down (502, 503, 504, 520-530, 544).
// - After `threshold` failures in a row it opens: requests fail at once, without
//   reaching Supabase, for `baseMs`.
// - When that wait ends, a single request is let through to test the service while
//   the others still fail at once. If it succeeds, the breaker closes. If it fails,
//   the wait doubles, up to `maxMs`.
// Any other answer, 4xx included, means Supabase is reachable and resets the count.
// Pages then fall back to the copies kept in lib/serverMemo.js and lib/data.js.

export const DOWN_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530, 544]);

export class SupabaseUnavailableError extends Error {
  constructor(retryInMs) {
    super('Supabase is unavailable; not trying again for now.');
    this.name = 'SupabaseUnavailableError';
    this.retryInMs = retryInMs;
  }
}

// A request the caller cancelled (the visitor left the page) says nothing about Supabase.
// A timeout does: it is how a busy or stuck database shows itself.
export function isCallerAbort(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

export function createCircuitBreaker({threshold = 3, baseMs = 10_000, maxMs = 5 * 60_000, now = () => Date.now(), onChange = () => {}} = {}) {
  let failures = 0, openUntil = 0, waitMs = baseMs, probing = false, state = 'closed';
  const setState = next => { if (next !== state) { state = next; onChange(next, {failures, waitMs}); } };
  const open = () => {
    openUntil = now() + waitMs;
    setState('open');
  };
  return {
    // Call before a request. Returns a token to pass to success() or failure(); throws while open.
    enter() {
      if (state === 'closed') return {probe: false};
      if (now() < openUntil || probing) throw new SupabaseUnavailableError(Math.max(0, openUntil - now()));
      probing = true;
      setState('half-open');
      return {probe: true};
    },
    success(token) {
      if (token?.probe) probing = false;
      failures = 0;
      waitMs = baseMs;
      setState('closed');
    },
    failure(token) {
      if (token?.probe) {
        probing = false;
        waitMs = Math.min(waitMs * 2, maxMs);
        open();
        return;
      }
      if (state !== 'closed') return;
      failures++;
      if (failures >= threshold) open();
    },
    // A request that ended without telling us anything (cancelled by the caller).
    release(token) { if (token?.probe) { probing = false; openUntil = 0; } },
    status() { return {state, failures, retryInMs: state === 'open' ? Math.max(0, openUntil - now()) : 0}; },
  };
}

// One breaker for the whole server process (or browser tab). Kept on globalThis because Next.js
// may load this module more than once (server components, route handlers, client bundle).
const KEY = Symbol.for('967.supabaseBreaker');
export function supabaseBreaker() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = createCircuitBreaker({
      onChange(state, {failures, waitMs}) {
        if (typeof window === 'undefined') console.warn(JSON.stringify({event: 'supabase_breaker', state, failures, waitMs, at: new Date().toISOString()}));
      },
    });
  }
  return globalThis[KEY];
}

// Wraps a fetch so that every call goes through the breaker.
export function guardFetch(fetchImpl, breaker = supabaseBreaker()) {
  return async (input, init) => {
    const token = breaker.enter();
    let response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      if (isCallerAbort(error)) breaker.release(token);
      else breaker.failure(token);
      throw error;
    }
    if (DOWN_STATUSES.has(response.status)) breaker.failure(token);
    else breaker.success(token);
    return response;
  };
}
