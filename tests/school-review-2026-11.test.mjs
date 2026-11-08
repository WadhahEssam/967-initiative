// School review (2026-11-08): published content cache, per-lesson SEO, modal players.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('published school content is cached and cleared on publish; callers get copies', () => {
  const server = read('lib/schoolContentServer.js');
  assert.match(server, /const publishedContentMemo=createVersionedMemo\(\{checkMs:60\*1000,maxAgeMs:30\*60\*1000,staleMs:60\*60\*1000\}\);/);
  assert.match(server, /invalidatePublishedSchoolContent\(\);\r?\n return \{version,action:'published'\};/);
  assert.match(server, /return structuredClone\(\(await publishedContent\(db\)\)\.catalog\);/);
  assert.match(server, /return structuredClone\(\(await publishedContent\(db\)\)\.stages\[slug\]\|\|\[\]\);/);
  // Lists without lesson content for the dashboard, hubs and course maps.
  assert.match(server, /export async function publishedSchoolStageList\(db,slug\)/);
  assert.match(read('lib/schoolDashboardServer.js'), /stages:await publishedSchoolStageList\(db,c\.slug\)/);
  for (const hub of ['civic', 'logic', 'nature']) assert.doesNotMatch(read('app/school/' + hub + '/page.jsx'), /publishedSchoolStages\(/, hub);
});

test('every course and lesson has its own title and canonical address', () => {
  const course = read('app/school/courses/[slug]/page.jsx'), lesson = read('app/school/courses/[slug]/[stage]/page.jsx');
  for (const source of [course, lesson]) {
    assert.match(source, /export async function generateMetadata\(\{params\}\)/);
    assert.doesNotMatch(source, /path:'\/school\/courses'\}\)/, 'no canonical pointing at /school/courses');
  }
  assert.match(lesson, /pageMetadata\(\{title:lesson\.title\+' — '\+course\.title,description:lesson\.subtitle\|\|course\.description,path\}\)/);
  assert.match(course, /pageMetadata\(\{title:course\.title\+' — مدرسة 967',description:course\.description,path\}\)/);
  // The lesson page reads one lesson and the lesson list, not the whole course.
  assert.match(lesson, /publishedSchoolStageList\(db,slug\),fixture\?null:publishedSchoolStage\(db,slug,index\)/);
});

test('school world links are named by their visible text', () => {
  assert.doesNotMatch(read('components/school/SchoolWorldMap.jsx'), /className=\{styles\.world\} aria-label=/);
});
