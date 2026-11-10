import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUEST_LESSONS, finishedGuestLessons, guestCourseProgress, guestLessonKey, guestLessonOpen, recordGuestAnswer} from '../lib/schoolGuest.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {get length() { return map.size; }, key: i => [...map.keys()][i] ?? null, getItem: k => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k)};
}

test('guests may take the first lessons only, and their answers are kept (two tries at most)', () => {
  assert.equal(GUEST_LESSONS, 3);
  assert.deepEqual([0, 1, 2, 3, -1, 1.5].map(guestLessonOpen), [true, true, true, false, false, false]);
  let record = recordGuestAnswer(null, 'c1', 'a');
  record = recordGuestAnswer(record, 'c1', 'b');
  record = recordGuestAnswer(record, 'c1', 'c');
  assert.deepEqual(record.answers, {c1: ['a', 'b']});
});

test('only finished guest lessons with answers are offered for transfer, in course order', () => {
  const storage = memoryStorage({
    [guestLessonKey('economics-basics', 1)]: JSON.stringify({finished: true, stars: 2, cards: {}, answers: {c: [1]}}),
    [guestLessonKey('economics-basics', 0)]: JSON.stringify({finished: true, stars: 3, cards: {}, answers: {c: [0]}}),
    [guestLessonKey('arud', 0)]: JSON.stringify({cards: {}, answers: {c: [0]}}),
    [guestLessonKey('arud', 2)]: JSON.stringify({finished: true, cards: {}}),
    [guestLessonKey('arud', 5)]: JSON.stringify({finished: true, answers: {c: [0]}}),
    [guestLessonKey('arud', 1)]: 'not json',
    'other-key': '{}',
  });
  assert.deepEqual(finishedGuestLessons(storage).map(item => item.slug + ':' + item.index), ['economics-basics:0', 'economics-basics:1']);
  assert.deepEqual(guestCourseProgress(storage, 'economics-basics'), {0: {stars: 3}, 1: {stars: 2}});
});

test('the transfer replays every lesson through the member API; nothing from the browser is trusted', () => {
  const claim = read('components/school/v2/GuestProgressClaim.jsx');
  for (const token of ["action: 'start'", "action: 'check'", "action: 'submit'", 'stages.get(item.index)?.completed', 'storage.removeItem(guestLessonKey('])
    assert.ok(claim.includes(token), token);
  assert.doesNotMatch(claim, /post\(token, \{[^}]*(stars|xp|score)/, 'stars and points are never sent; the server computes them');
  const player = read('components/school/v2/CardLessonPlayer.jsx');
  assert.ok(player.includes('recordGuestAnswer(readLocal(guestKey(slug, stageIndex)), card.id, values[card.id])'));
  assert.ok(player.includes('finished: true, stars: r.stars'));
  assert.ok(read('app/school/courses/[slug]/[stage]/page.jsx').includes('guestSnapshot={guestLessonOpen(index)?cardSnapshot(stage):null}'));
  for (const file of ['components/school/v2/CourseJourney.jsx', 'components/school/v2/SchoolContinueCard.jsx']) assert.ok(read(file).includes('<GuestProgressClaim'), file);
});

test('visitors are invited to sign up after lessons and practice rounds, and the invitation is counted', () => {
  const invite = read('components/SignupInvite.jsx');
  assert.ok(invite.includes("trackFunnel('signup_prompt_shown', next)"));
  assert.ok(invite.includes("trackFunnel('signup_prompt_click', next)"));
  for (const file of ['components/games/QuizGame.jsx', 'components/games/ArcadeChallenge.jsx', 'components/games/ExtraArcadeChallenge.jsx'])
    assert.ok(read(file).includes("{mode!=='daily'&&<GameSignupInvite/>}"), file);
  assert.ok(read('components/games/GameSignupInvite.jsx').includes('browserMayBeSignedIn()'));
});
