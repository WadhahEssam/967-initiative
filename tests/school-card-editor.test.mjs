// مدرسة 967 — الإصدار الثاني، المرحلة 6: محرر دروس البطاقات في الاستوديو.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCardLesson, TASK_KINDS, VISUAL_KINDS} from '../lib/schoolCards.js';
import {starterLesson, taskStarter, visualStarter, nextCardId, TASK_LABELS, VISUAL_LABELS} from '../lib/schoolCardStarters.js';
import {validateSchoolEditorial} from '../lib/schoolContent.js';
import {parseUnits, unitsText} from '../lib/schoolJourney.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fixture = JSON.parse(read('data/school-v2/fixtures/economics-basics-1.json'));

test('the starter lesson and every task/visual starter pass validation', () => {
  assert.doesNotThrow(() => validateCardLesson(starterLesson()));
  for (const k of TASK_KINDS) {
    const l = starterLesson(); l.cards[2] = {...l.cards[2], task: taskStarter(k)};
    if (k === 'hotspot') delete l.cards[2].visual;
    assert.doesNotThrow(() => validateCardLesson(l), k);
    assert.ok(TASK_LABELS[k], 'label ' + k);
  }
  for (const k of VISUAL_KINDS) {
    const l = starterLesson(); l.cards[1] = {...l.cards[1], visual: visualStarter(k)};
    assert.doesNotThrow(() => validateCardLesson(l), k);
    assert.ok(VISUAL_LABELS[k], 'label ' + k);
  }
  assert.equal(nextCardId([{id: 'practice-1'}, {id: 'practice-3'}], 'practice'), 'practice-4');
});

test('studio stores card lessons with their keys and rejects invalid ones', () => {
  const doc = validateSchoolEditorial('stage', fixture);
  assert.equal(doc.format, 2);
  assert.equal(doc.cards[0].task.answer, 1, 'answer keys stay in the server-side draft');
  assert.throws(() => validateSchoolEditorial('stage', {...fixture, cards: fixture.cards.slice(0, 3)}), /البطاقات/);
  assert.throws(() => validateSchoolEditorial('stage', {...fixture, summary: ['x'.repeat(30000), 'y'.repeat(31000)]}), /أكبر من المسموح|الملخص/);
  // v1 stages are unchanged
  assert.deepEqual(Object.keys(validateSchoolEditorial('stage', {title: 'محطة قديمة', subtitle: '', intro: 'مقدمة طويلة بما يكفي للمحطة', tips: []})).sort(), ['intro', 'subtitle', 'tips', 'title']);
});

test('course drafts accept format, units and capstone', () => {
  const base = {title: 'أساسيات الاقتصاد', description: 'وصف المسار بما يكفي', category: 'السياسة والاقتصاد'};
  assert.deepEqual(validateSchoolEditorial('course', base), base, 'old courses unchanged');
  const doc = validateSchoolEditorial('course', {...base, format: 2, units: [{title: 'السوق', stages: [2, 0, 1]}], capstone: 11});
  assert.deepEqual(doc.units, [{title: 'السوق', stages: [0, 1, 2]}]);
  assert.equal(doc.capstone, 11);
  assert.throws(() => validateSchoolEditorial('course', {...base, units: [{title: 'أ ب', stages: [0]}, {title: 'ج د', stages: [0]}]}), /بلا تكرار/);
  assert.throws(() => validateSchoolEditorial('course', {...base, capstone: 12}));
  assert.throws(() => validateSchoolEditorial('course', {...base, format: 3}));
});

test('units text: one line per unit, stage numbers 1–12', () => {
  assert.deepEqual(parseUnits('السوق: 1، 2، 3\nالأسعار: 4,5,6'), {units: [{title: 'السوق', stages: [0, 1, 2]}, {title: 'الأسعار', stages: [3, 4, 5]}]});
  assert.match(parseUnits('بلا أرقام').error, /السطر 1/);
  assert.match(parseUnits('الوحدة: 13').error, /من 1 إلى 12/);
  assert.deepEqual(parseUnits('   '), {units: undefined});
  assert.equal(unitsText([{title: 'السوق', stages: [0, 1]}]), 'السوق: 1، 2');
});

test('publishing a card lesson skips the six-question bank; preview never calls the server or saves', () => {
  const server = read('lib/schoolContentServer.js'), player = read('components/school/v2/CardLessonPlayer.jsx'), studio = read('components/school/SchoolStudio.jsx');
  // Since phase 8 only card lessons are playable, so an old-format stage cannot be published at all.
  assert.match(server, /if\(current\.draft\?\.format!==2\)error\('انشر المحطة بصيغة البطاقات/);
  assert.match(player, /if \(preview\) \{ setProgress\(\{\}\); setIndex\(0\); setMode\('playing'\); return; \}/);
  assert.match(player, /if \(!preview\) writeLocal\(/);
  assert.match(studio, /form\.format===2&&<CardLessonEditor/);
  // Every course, musnad included, is a regular card course with units.
  assert.match(studio, /\n\s*<CourseUnitsEditor key=\{slug\}/);
});

test('phase 8: arud and musnad are regular card courses; stale attempts of the other format are closed', () => {
  const content = read('lib/schoolContent.js'), generic = read('lib/schoolGenericServer.js');
  const arud = read('app/school/writing/arud/page.jsx'), arudStage = read('app/school/writing/arud/[stage]/page.jsx');
  assert.match(content, /SCHOOL_FIXED_SLUGS=\[\];/);
  const musnad = read('app/school/writing/musnad/page.jsx'), musnadStage = read('app/school/writing/musnad/[stage]/page.jsx');
  // The old v1 addresses permanently redirect to the card course, after the school visibility gate.
  assert.match(musnad, /if\(!sectionGate\('school',settings\)\)notFound\(\);\s*permanentRedirect\('\/school\/courses\/musnad'\);/);
  assert.match(musnadStage, /if\(!sectionGate\('school',settings\)\)notFound\(\);[^]*permanentRedirect\('\/school\/courses\/musnad\/'\+raw\);/);
  assert.match(generic, /const sameFormat=isCardSnapshot\(current\.questions\)===\(activeStage\.format===2\);/);
  assert.match(generic, /if\(sameFormat&&Date\.now\(\)-Date\.parse\(current\.created_at\)<3600000\)return publicAttempt\(current\);/);
  assert.match(arud, /if\(!sectionGate\('school',settings\)\)notFound\(\);\s*permanentRedirect\('\/school\/courses\/arud'\);/);
  assert.match(arudStage, /if\(!sectionGate\('school',settings\)\)notFound\(\);[^]*permanentRedirect\('\/school\/courses\/arud\/'\+raw\);/);
  // The course page lists only card lessons and hides a course until its card lessons are published.
  const coursePage = read('app/school/courses/[slug]/page.jsx');
  assert.match(coursePage, /const stages=\(await publishedSchoolStageList\(db,slug\)\)\.filter\(s=>s\.format===2\);/);
  assert.match(coursePage, /if\(!stages\.length&&!preview\)notFound\(\);/);
  assert.doesNotMatch(read('app/school/courses/[slug]/[stage]/page.jsx'), /slug==='musnad'/);
});
