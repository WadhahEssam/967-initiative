// «المتابعة بحساب Google» (owner, 2026-11-12). Supabase handles the Google side (provider set up
// in the Supabase dashboard); the site only starts the sign-in and finishes it on /auth/callback.
// The button shows only when Supabase reports the provider as enabled, so it never appears broken.
export const GOOGLE_TERMS_KEY = '967-google-terms';
const TERMS_WINDOW_MS = 30 * 60 * 1000;
const SETTINGS_KEY = '967-auth-providers';

export async function googleSignInEnabled({url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, fetcher = fetch, storage = globalThis.sessionStorage} = {}) {
  if (!url || !key) return false;
  try { const saved = storage?.getItem(SETTINGS_KEY); if (saved === 'google' || saved === 'none') return saved === 'google'; } catch {}
  try {
    const response = await fetcher(url.replace(/\/$/, '') + '/auth/v1/settings', {headers: {apikey: key}, cache: 'no-store'});
    if (!response.ok) return false;
    const enabled = (await response.json())?.external?.google === true;
    try { storage?.setItem(SETTINGS_KEY, enabled ? 'google' : 'none'); } catch {}
    return enabled;
  } catch { return false; }
}

// Where Google sends the visitor back: our callback, then the page they came from.
export function googleRedirectTo(origin, next) {
  return origin + '/auth/callback?provider=google&next=' + encodeURIComponent(next || '/account');
}

// The visitor agrees to the terms before leaving for Google; the agreement is recorded on return.
export function rememberGoogleTerms(storage = globalThis.sessionStorage, now = Date.now()) {
  try { storage?.setItem(GOOGLE_TERMS_KEY, String(now)); } catch {}
}
export function takeGoogleTerms(storage = globalThis.sessionStorage, now = Date.now()) {
  let saved = null;
  try { saved = Number(storage?.getItem(GOOGLE_TERMS_KEY)); storage?.removeItem(GOOGLE_TERMS_KEY); } catch {}
  return Number.isFinite(saved) && saved > 0 && now - saved <= TERMS_WINDOW_MS;
}

// A new Google account gets its public profile (name from Google) from the signup trigger, without
// the terms date. Record the agreement, keeping the name and picture already in the profile.
export function termsProfileUpdate(profile) {
  if (!profile || profile.terms_accepted_at) return null;
  const name = String(profile.display_name || '').trim();
  if (name.length < 2) return null;
  return {action: 'profile', data: {display_name: name.slice(0, 60), avatar_url: profile.avatar_url || null, show_avatar: profile.show_avatar === true, accepted: true}};
}
