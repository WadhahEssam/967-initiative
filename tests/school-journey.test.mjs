// مدرسة 967 — الإصدار الثاني، المرحلة 4: خريطة الرحلة والتنقل.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {journeyUnits, journeyState} from '../lib/schoolJourney.js';
import {GUEST_LESSONS} from '../lib/schoolGuest.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stages = Array.from({length: 12}, (_, index) => ({index, title: 'درس ' + (index + 1)}));

test('units: authored units are kept, missing stages gathered, otherwise groups of 3', () => {
  const auto = journeyUnits(stages);
  assert.equal(auto.length, 4);
  assert.deepEqual(auto[0], {title: 'الدروس 1–3', stages: [0, 1, 2]});
  const authored = journeyUnits(stages, [{title: 'السوق', stages: [0, 1, 2, 3]}, {title: 'الأسعار', stages: [4, 5, 99]}]);
  assert.deepEqual(authored.map(u => u.title), ['السوق', 'الأسعار', 'دروس أخرى']);
  assert.deepEqual(authored[1].stages, [4, 5], 'unpublished stages are dropped');
  assert.equal(authored[2].stages.length, 6);
  assert.equal(journeyUnits(stages, [{title: '', stages: [0]}]).length, 4, 'invalid units fall back to automatic groups');
});

test('state for a learner: stars, current lesson, locks and totals', () => {
  const progress = {stages: stages.map(s => ({index: s.index, completed: s.index < 3, stars: [3, 2, 1][s.index] || 0, locked: s.index > 3}))};
  const st = journeyState(stages, progress);
  assert.equal(st.done, 3);
  assert.equal(st.stars, 6);
  assert.equal(st.current, 3);
  assert.equal(st.byIndex[3].status, 'current');
  assert.equal(st.byIndex[4].status, 'locked');
  assert.equal(st.byIndex[0].stars, 3);
  assert.equal(st.finished, false);
  const all = journeyState(stages, {stages: stages.map(s => ({index: s.index, completed: true, stars: 3}))});
  assert.equal(all.finished, true);
  assert.equal(all.current, null);
});

test('guests see the first lessons open, their own finished lessons done; loading shows nothing as locked yet', () => {
  const guest = journeyState(stages, {guest: true});
  assert.equal(guest.byIndex[0].status, 'current');
  assert.ok(stages.slice(1, GUEST_LESSONS).every(s => guest.byIndex[s.index].status === 'open'));
  assert.ok(stages.slice(GUEST_LESSONS).every(s => guest.byIndex[s.index].status === 'locked'));
  const local = journeyState(stages, {guest: true, local: {0: {stars: 3}}});
  assert.deepEqual([local.byIndex[0].status, local.byIndex[0].stars, local.current, local.done], ['done', 3, 1, 1]);
  const loading = journeyState(stages, {loading: true});
  assert.ok(stages.every(s => loading.byIndex[s.index].status === 'pending'));
});

test('staff preview: unlocked lessons after the current one are open', () => {
  const st = journeyState(stages, {stages: stages.map(s => ({index: s.index, completed: false, locked: false}))});
  assert.equal(st.byIndex[0].status, 'current');
  assert.equal(st.byIndex[5].status, 'open');
});

test('course progress returns best stars per stage (cards or v1 score)', () => {
  const server = read('lib/schoolGenericServer.js');
  assert.match(server, /select\('stage_index,status,score,stars:submission->stars'\)/);
  assert.match(server, /stars:progress\.stars\.get\(item\.index\)\|\|0/);
});

test('course page: card courses use the journey and only lesson metadata reaches the browser', () => {
  const page = read('app/school/courses/[slug]/page.jsx');
  assert.match(page, /const stageMeta=s=>\(\{index:s\.index,title:s\.title,subtitle:s\.subtitle\|\|'',format:/);
  assert.match(page, /stages=\{journey\}/);
  assert.ok(!/stages=\{stages\}[^]*CourseJourney/.test(page.split('<CourseJourney')[1] || ''), 'full stages never passed to the journey');
  assert.match(page, /process\.env\.SCHOOL_V2_FIXTURES!=='1'/);
  // Phase 8: every course is a card course; the v1 station map is gone.
  assert.doesNotMatch(page, /SchoolCourseMap/);
  assert.match(page, /\.filter\(s=>s\.format===2\)/, 'only card lessons are listed');
});

test('school home shows the continue card for signed-in learners only', () => {
  const home = read('app/school/page.jsx'), card = read('components/school/v2/SchoolContinueCard.jsx');
  assert.match(home, /<SchoolContinueCard\/>/);
  assert.match(card, /if \(!token\) return;/);
  assert.match(card, /\/api\/school\/dashboard/);
});
