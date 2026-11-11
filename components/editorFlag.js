import {markTeamDevice} from '../lib/siteStatsDevice.js';
// Whether the signed-in account may edit, remembered for this browser tab for 10 minutes.
// Used by the header (edit link) and the inline editor (session check). It only decides what the
// browser asks for and shows: every editing API checks the role on the server.
const EDITOR_FLAG_KEY = '967:can-edit';
export const EDITOR_FLAG_MS = 10 * 60 * 1000;

export function readEditorFlag(userId, now = Date.now()) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(EDITOR_FLAG_KEY) || 'null');
    if (saved?.userId === userId && typeof saved.canEdit === 'boolean' && now - saved.at < EDITOR_FLAG_MS) return saved.canEdit;
  } catch {}
  return null;
}

export function writeEditorFlag(userId, canEdit, now = Date.now()) {
  // An editor's or manager's browser is left out of the site statistics from now on.
  if (canEdit === true) markTeamDevice();
  try { window.sessionStorage.setItem(EDITOR_FLAG_KEY, JSON.stringify({userId, canEdit, at: now})); } catch {}
}
