import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appBarPlace} from '../lib/appBar.js';

test('home has no place; section roots show their name without a back link', () => {
  assert.equal(appBarPlace('/'), null);
  assert.deepEqual(appBarPlace('/yemen-in-numbers'), {label: 'اليمن بالأرقام', href: '/yemen-in-numbers', isRoot: true});
  assert.deepEqual(appBarPlace('/games'), {label: 'ألعاب 967', href: '/games', isRoot: true});
  assert.deepEqual(appBarPlace('/school/'), {label: 'مدرسة 967', href: '/school', isRoot: true});
});

test('detail pages link back to the list they belong to', () => {
  assert.deepEqual(appBarPlace('/yemen-in-numbers/indicator/gdp'), {label: 'اليمن بالأرقام', href: '/yemen-in-numbers', isRoot: false});
  assert.equal(appBarPlace('/yemen-in-numbers/timeline').label, 'المؤشرات عبر الزمن');
  assert.deepEqual(appBarPlace('/school/courses/musnad'), {label: 'خط المسند', href: '/school/courses/musnad', isRoot: true});
  assert.equal(appBarPlace('/school/courses/musnad/3').href, '/school/courses/musnad');
  assert.deepEqual(appBarPlace('/school/courses/logic-basics/2'), {label: 'خريطة المسار', href: '/school/courses/logic-basics', isRoot: false});
  assert.equal(appBarPlace('/games/quiz').href, '/games');
  assert.equal(appBarPlace('/debates/some-debate').href, '/debates');
  assert.equal(appBarPlace('/yemen-map/governorates/YE27').href, '/yemen-map');
  assert.equal(appBarPlace('/unknown-path'), null);
});

test('header renders the place after the logo, with an accessible back link', () => {
  const header = readFileSync(new URL('../components/Header.jsx', import.meta.url), 'utf8');
  assert.ok(header.includes('const place = appBarPlace(path);'));
  assert.ok(header.indexOf('className="ed-brand"') < header.indexOf('ed-appbar-place'));
  assert.ok(header.includes("aria-label={'رجوع إلى '+place.label}"));
});
