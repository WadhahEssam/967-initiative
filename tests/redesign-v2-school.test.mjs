import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHOOL_COURSE_TOOLS} from '../lib/schoolCourseTools.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Phase 8 retired the v1 players (LessonParts, SchoolLesson, ArudLesson, GenericSchoolLesson, SchoolGuidedLesson);
// every course now plays in the full-screen card player.
test('card lesson player: segmented progress, pinned action bar and reduced motion', () => {
  const player = read('components/school/v2/CardLessonPlayer.jsx');
  assert.ok(player.includes('role="progressbar" aria-label="تقدم الدرس" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={index + 1}'));
  assert.ok(player.includes('<footer className={styles.bottom}>'));
  const css = read('components/school/v2/CardLessonPlayer.module.css');
  assert.ok(css.includes('.shell{position:fixed;inset:0'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
});

test('card labs keep the experiment gate: «تحقق» stays disabled until the lab returns its proof', () => {
  const labs = read('components/school/v2/CardInteractions.jsx');
  for (const token of ["{lab.kind === 'morse' && <MorseLab", "{lab.kind === 'gates' && <LogicGatesLab", "{lab.kind === 'science' && <ScienceLab", "{lab.kind === 'civic' && <CivicLab",
    "case 'lab': return Boolean(value && typeof value === 'object');"])
    assert.ok(labs.includes(token), token);
  const player = read('components/school/v2/CardLessonPlayer.jsx');
  assert.ok(player.includes("{label: 'تحقق', action: check, enabled: !busy && taskReady(card.task, values[card.id])}"));
  assert.ok(player.includes('if (!card?.task || busy || !taskReady(card.task, values[card.id])) return;'));
});

test('the Musnad course keeps its alphabet and practice tools under the journey map', () => {
  assert.deepEqual(SCHOOL_COURSE_TOOLS.musnad.map(t => t.href), ['/school/writing/musnad/alphabet', '/school/writing/musnad/practice']);
  const course = read('app/school/courses/[slug]/page.jsx');
  assert.ok(course.includes('const tools=SCHOOL_COURSE_TOOLS[slug]'));
  assert.ok(course.includes('aria-label="أدوات المسار"'));
});
