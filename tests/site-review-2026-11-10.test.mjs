import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {countOf} from '../lib/arabicCount.js';
import {phoneNumbers} from '../lib/phoneNumbers.js';
import {localStartTime} from '../lib/gameClock.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Arabic counts agree with their number', () => {
  assert.deepEqual([1, 2, 3, 10, 11, 12, 100].map(n => countOf(n, 'lesson')), ['درس واحد', 'درسان', '3 دروس', '10 دروس', '11 درسًا', '12 درسًا', '100 درس']);
  assert.deepEqual([1, 2, 5, 12].map(n => countOf(n, 'source')), ['مصدر واحد', 'مصدران', '5 مصادر', '12 مصدرًا']);
});

test('a phone field with several numbers becomes several dialable numbers', () => {
  assert.deepEqual(phoneNumbers('01-577777 / 774778805').map(n => n.dial), ['01577777', '774778805']);
  assert.deepEqual(phoneNumbers('+967 776 000 061').map(n => n.dial), ['+967776000061']);
  assert.deepEqual(phoneNumbers('٧٧٧١٢٣٤٥٦').map(n => n.dial), ['777123456']);
  assert.deepEqual(phoneNumbers('—'), []);
  assert.ok(read('components/InstitutionDetail.jsx').includes('phoneNumbers(item.phone).map('));
});

test('official question timers follow the server clock, not the phone', () => {
  const now = Date.now(), server = new Date(now + 5000).toISOString(), start = new Date(now + 5000 - 2000).toISOString();
  const elapsed = now - Date.parse(localStartTime(start, server));
  assert.ok(elapsed >= 1990 && elapsed <= 2100, String(elapsed));
  assert.equal(localStartTime('not a date', server), null);
  assert.equal((read('app/api/games/daily/round/route.js').match(/serverNow:new Date\(\)\.toISOString\(\)/g) || []).length, 3);
  for (const file of ['components/games/QuizGame.jsx', 'components/games/ArcadeChallenge.jsx', 'components/games/ExtraArcadeChallenge.jsx', 'components/games/FriendDuel.jsx'])
    assert.ok(read(file).includes('localStartTime('), file);
});

test('an unfinished daily round can be resumed and is not left by accident', () => {
  const route = read('app/api/games/daily/route.js');
  assert.ok(route.includes("data.phase!=='finished'") && route.includes('tasks:data.question_bank.map(entry=>friendPublicTask(data.game_type,entry.reveal))'));
  assert.ok(route.includes('reveals:data.answers.map('), 'answered steps carry their reveal, unanswered steps none');
  const hook = read('components/games/useDailyAttempt.js');
  assert.ok(hook.includes("state.kind==='resume'") && hook.includes('export function useLeaveWarning('));
  for (const file of ['components/games/QuizGame.jsx', 'components/games/ArcadeChallenge.jsx', 'components/games/ExtraArcadeChallenge.jsx']) {
    const source = read(file);
    assert.ok(source.includes('function resumeRound(saved)') && source.includes('.resume){resumeRound('), file);
    assert.ok(source.includes('أكمل جولة اليوم') && source.includes('إنهاء الجولة الرسمية الآن ينهي محاولتك'), file);
    assert.ok(source.includes('useLeaveWarning('), file);
  }
});

test('the public leaderboard is computed once per period, not on every request', () => {
  const route = read('app/api/games/leaderboard/route.js');
  assert.ok(route.includes('RANK_TTL_MS=45000') && route.includes('rankedPeriod(db,period,today)'));
});

test('copy and accessibility fixes from the 2026-11-10 review stay in place', () => {
  assert.ok(!read('app/school/civic/page.jsx').includes('5 من 6'));
  assert.ok(!read('app/school/nature/page.jsx').includes('5 من 6'));
  assert.ok(read('components/games/TimeControls.jsx').includes('role="timer"'));
  assert.ok(read('components/Pagination.jsx').includes('window.scrollTo'));
  assert.ok(read('app/error.jsx').includes('router.refresh()'));
  assert.ok(!read('app/yemen-in-numbers/[slug]/page.jsx').includes('لوحة التحرير'));
  assert.ok(!read('components/members/MemberProfile.jsx').includes('<main'));
  assert.ok(read('app/share/result/page.jsx').includes('{card.challenge}'));
});

test('a skipped page transition is not reported as a site error', () => {
  assert.ok(read('app/layout.jsx').includes("r.name==='AbortError'&&/Transition was skipped/.test(r.message))e.preventDefault()"));
  assert.ok(read('components/OperationalMonitor.jsx').includes("if(!event.defaultPrevented)send('client_error',{kind:'unhandledrejection'})"));
});
