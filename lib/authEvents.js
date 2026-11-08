// Supabase auth events that do not change who is signed in. INITIAL_SESSION fires right after a
// component subscribes (its first load already read the session), and TOKEN_REFRESHED fires about
// hourly with the same account. Reloading on them only repeats requests.
const SAME_ACCOUNT_EVENTS = new Set(['INITIAL_SESSION', 'TOKEN_REFRESHED']);
export const authEventChangesAccount = event => !SAME_ACCOUNT_EVENTS.has(event);

// Remembers which account a component last loaded for. Opening a page with an expired token makes
// Supabase refresh it and announce SIGNED_IN for the same account; that must not reload again.
// Until the first load has read the session (undefined), events are ignored: that load reads the
// session after Supabase has finished starting, so it already sees the result.
export function createAccountWatch() {
  let current;
  return {
    seen(session) { current = session?.user?.id ?? null; },
    changed(session) { return current !== undefined && (session?.user?.id ?? null) !== current; },
  };
}
// Reload only for an event that changes the account the component last loaded for.
export const shouldReloadOnAuth = (watch, event, session) => authEventChangesAccount(event) && watch.changed(session);

// Returning to a tab fires both `focus` and `visibilitychange`; this lets a reload on either run
// at most once per interval.
export function createRefreshThrottle(intervalMs = 60 * 1000, now = () => Date.now()) {
  let last = -Infinity;
  return {
    mark() { last = now(); },
    due() { return now() - last >= intervalMs; },
  };
}
