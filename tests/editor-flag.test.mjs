// Signed-in members must not ask the editor-session API on every page and every minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the editor flag is per account and expires after 10 minutes', async () => {
  const store = new Map();
  globalThis.window = {sessionStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))}};
  const {readEditorFlag, writeEditorFlag, EDITOR_FLAG_MS} = await import('../components/editorFlag.js');
  assert.equal(readEditorFlag('a'), null);
  writeEditorFlag('a', false, 1000);
  assert.equal(readEditorFlag('a', 1000 + EDITOR_FLAG_MS - 1), false);
  assert.equal(readEditorFlag('a', 1000 + EDITOR_FLAG_MS), null, 'expired');
  assert.equal(readEditorFlag('b', 1001), null, 'another account');
  writeEditorFlag('a', true, 2000);
  assert.equal(readEditorFlag('a', 2001), true);
  store.set('967:can-edit', '{broken');
  assert.equal(readEditorFlag('a'), null, 'unreadable storage is ignored');
  delete globalThis.window;
});

test('the inline editor shares one session check and skips known non-editors', () => {
  const provider = read('components/inline/InlineEditorProvider.jsx');
  assert.match(provider, /if\(shared&&shared\.userId===session\.user\.id&&Date\.now\(\)-shared\.at<3000\)return shared\.promise;/);
  assert.match(provider, /if\(!actorRef\.current&&readEditorFlag\(session\.user\.id\)===false\)return;/);
  assert.match(provider, /if\(response\.status===403\)writeEditorFlag\(session\.user\.id,false\);/);
  assert.match(provider, /writeEditorFlag\(session\.user\.id,true\);/);
  const header = read('components/Header.jsx');
  assert.match(header, /import \{readEditorFlag, writeEditorFlag\} from '\.\/editorFlag';/);
  assert.doesNotMatch(header, /function readEditorFlag/);
});

test('auth events that keep the same account do not reload; tab returns reload once a minute', async () => {
  const {authEventChangesAccount, createRefreshThrottle} = await import('../lib/authEvents.js');
  for (const event of ['INITIAL_SESSION', 'TOKEN_REFRESHED']) assert.equal(authEventChangesAccount(event), false, event);
  for (const event of ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED']) assert.equal(authEventChangesAccount(event), true, event);
  let t = 0;
  const throttle = createRefreshThrottle(60000, () => t);
  assert.equal(throttle.due(), true);
  throttle.mark();
  t = 59999; assert.equal(throttle.due(), false);
  t = 60000; assert.equal(throttle.due(), true);
  for (const file of ['components/games/WeeklyArcade.jsx', 'components/games/GamesHomeStatus.jsx', 'components/games/useDailyAttempt.js', 'components/games/GameAchievementGallery.jsx'])
    assert.match(read(file), /if\(!shouldReloadOnAuth\(account,event,session\)\)return;/, file);
});

test('a same-account SIGNED_IN (token refreshed on page open) does not reload; a new account does', async () => {
  const {createAccountWatch, shouldReloadOnAuth} = await import('../lib/authEvents.js');
  const watch = createAccountWatch();
  const me = {user: {id: 'me'}}, other = {user: {id: 'other'}};
  assert.equal(shouldReloadOnAuth(watch, 'SIGNED_IN', me), false, 'first load still running');
  watch.seen(me);
  assert.equal(shouldReloadOnAuth(watch, 'SIGNED_IN', me), false);
  assert.equal(shouldReloadOnAuth(watch, 'TOKEN_REFRESHED', me), false);
  assert.equal(shouldReloadOnAuth(watch, 'SIGNED_IN', other), true);
  assert.equal(shouldReloadOnAuth(watch, 'SIGNED_OUT', null), true);
  watch.seen(null);
  assert.equal(shouldReloadOnAuth(watch, 'SIGNED_IN', me), true, 'guest signs in');
});
