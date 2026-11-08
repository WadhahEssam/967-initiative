// Mobile weight: list pages send only what their cards, filters and search use.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyListEntries, historySourceCount} from '../lib/yemenHistory.js';
import {institutionListItems, institutionSearchFields} from '../lib/institutionDirectories.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('history list: cards keep their fields, states keep what the comparison uses, drafts are dropped', () => {
  const event = {slug: 'e', title: 'حدث', summary: 'ملخص', period: 'فترة', location: 'مأرب', kind: 'event', era: 'origins', year: -700, governorate: 'YE26',
    hideImages: false, images: [{file: 'a.jpg'}, {file: 'b.jpg'}], sources: [{url: 'u1'}, {url: 'u2'}, {url: 'u3'}], paragraphs: ['p1', 'p2', 'p3'], related: ['x'], certainty: 'c'};
  const state = {...event, slug: 's', kind: 'state', comparison: {capital: 'مأرب'}};
  const [card, kept] = historyListEntries([event, state, {...event, slug: 'draft', isPublished: false}]);
  assert.equal(historyListEntries([event, {...event, isPublished: false}]).length, 1);
  assert.deepEqual(Object.keys(card).sort(), ['era', 'governorate', 'hideImages', 'images', 'kind', 'location', 'period', 'slug', 'sourceCount', 'summary', 'title', 'year']);
  assert.deepEqual(card.images, [{file: 'a.jpg'}]);
  assert.equal(historySourceCount(card), 3);
  assert.equal(historySourceCount(state), 3, 'full entries still count their sources');
  assert.deepEqual(kept.paragraphs, ['p1', 'p2']);
  assert.deepEqual(kept.images, [{file: 'a.jpg'}]);
  assert.deepEqual(kept.sources, state.sources);
  assert.deepEqual(kept.related, ['x']);
  assert.deepEqual(kept.comparison, {capital: 'مأرب'});
  assert.equal(state.paragraphs.length, 3, 'the cached catalog is not changed');
  assert.match(read('app/yemen-history/page.jsx'), /<HistoryExplorer entries=\{historyListEntries\(catalog\.entries\)\}/);
});

test('institution list items keep every field the cards, filters and search read', () => {
  const university = {id: 'u', databaseId: 'x', name: 'جامعة', englishName: 'Uni', summary: 's', governorate: 'صنعاء', city: 'صنعاء', district: 'd', type: 'public_university', typeLabel: 'حكومية',
    ownership: 'government', ownershipLabel: 'حكومي', logoUrl: null, createdAt: '1', updatedAt: '2', verifiedAt: null, educationLevels: ['بكالوريوس'], studyModes: ['انتظام'],
    admissionInfo: 'long text', sources: [{url: 'x'}], branches: [{}], programs: [{id: 1, university_id: 'x', name: 'طب', field: 'صحة', faculty: 'f', department: 'dep', qualification: 'q', language: 'ar', study_mode: 'm', level: 'l', source_url: 'x'}]};
  const [item] = institutionListItems([university], 'university');
  assert.equal(item.admissionInfo, undefined);
  assert.equal(item.sources, undefined);
  assert.deepEqual(item.programs, [{name: 'طب', field: 'صحة', faculty: 'f', department: 'dep', qualification: 'q', language: 'ar', study_mode: 'm', level: 'l'}]);
  assert.deepEqual(institutionSearchFields(item, 'university'), institutionSearchFields(university, 'university'), 'search finds the same records');
  const center = {...university, programs: undefined, emergencyAvailable: true, operatingStatus: 'operating', operatingStatusAsOf: '2020-01',
    specialties: [{id: 1, name: 'قلب', source_url: 'x'}], services: [{id: 2, name: 'أشعة', details: 'تفاصيل', source_url: 'y'}], hours: [{}]};
  const [medical] = institutionListItems([center], 'medical');
  assert.deepEqual(medical.specialties, [{name: 'قلب'}]);
  assert.deepEqual(medical.services, [{name: 'أشعة', details: 'تفاصيل'}]);
  assert.equal(medical.emergencyAvailable, true);
  assert.equal(medical.operatingStatusAsOf, '2020-01');
  assert.equal(medical.hours, undefined);
  assert.deepEqual(institutionSearchFields(medical, 'medical'), institutionSearchFields(center, 'medical'));
  assert.match(read('app/universities/page.jsx'), /items=\{institutionListItems\(institutions,'university'\)\}/);
  assert.match(read('app/medical-centers/page.jsx'), /items=\{institutionListItems\(centers,'medical'\)\}/);
});

test('figure photos from our storage go through the image optimiser; static files get a cache lifetime', () => {
  for (const file of ['components/yemen-map/YemeniFiguresDirectory.jsx', 'app/yemeni-figures/[slug]/page.jsx', 'components/FigureDossier.jsx']) {
    const source = read(file);
    assert.match(source, /unoptimized=\{!canOptimizeImage\(/, file);
    assert.doesNotMatch(source, /startsWith\('http'\)\}/, file);
  }
  const config = read('next.config.mjs');
  assert.match(config, /minimumCacheTTL: 7 \* 24 \* 60 \* 60/);
  assert.match(config, /source: '\/fonts\/:path\*'/);
  assert.match(read('app/api/map-profiles/route.js'), /'Cache-Control':'private, max-age=300'/);
});
