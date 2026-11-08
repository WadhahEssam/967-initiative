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
