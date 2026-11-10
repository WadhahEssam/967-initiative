// Mobile weight: list pages send only what their cards, filters and search use.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyDetailsMap, historyEntryDetails, historyIndexEntry, historySourceCount} from '../lib/yemenHistory.js';
import {toFigureDetails, toFigureIndexEntry} from '../lib/yemeniFigures.js';
import {figureFilterDefaults, filterFigures} from '../lib/figureFilters.js';
import {institutionListItems, institutionSearchFields} from '../lib/institutionDirectories.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('history page: light rows for every entry, details for cards and states, drafts dropped', () => {
  const event = {slug: 'e', title: 'حدث', summary: 'ملخص', period: 'فترة', location: 'مأرب', kind: 'event', era: 'origins', year: -700, governorate: 'YE26',
    hideImages: false, images: [{file: 'a.jpg', caption: 'c', alt: 'c', credit: 'x', license: 'y', kind: 'context'}, {file: 'b.jpg'}], sources: [{url: 'u1', title: 't1', note: 'n'}, {url: 'u2'}, {url: 'u3'}], paragraphs: ['p1', 'p2', 'p3'], related: ['x'], certainty: 'c'};
  const state = {...event, slug: 's', kind: 'state', comparison: {capital: 'مأرب'}};
  assert.deepEqual(historyIndexEntry(event), {slug: 'e', title: 'حدث', kind: 'event', era: 'origins', year: -700, governorate: 'YE26'});
  const map = historyDetailsMap([event, state, {...event, slug: 'draft', isPublished: false}]);
  assert.deepEqual(Object.keys(map), ['e', 's']);
  const card = map.e, kept = map.s;
  assert.deepEqual(Object.keys(card).sort(), ['images', 'location', 'period', 'sourceCount', 'summary']);
  assert.deepEqual(card.images, [{file: 'a.jpg', caption: 'c', kind: 'context'}], 'one photo, no credit, alt only when it differs');
  assert.equal(historySourceCount({...historyIndexEntry(event), ...card}), 3);
  assert.equal(historySourceCount(state), 3, 'full entries still count their sources');
  assert.deepEqual(kept.paragraphs, ['p1', 'p2']);
  assert.deepEqual(kept.sources, [{url: 'u1', title: 't1'}, {url: 'u2', title: undefined}, {url: 'u3', title: undefined}]);
  assert.deepEqual(kept.related, ['x']);
  assert.deepEqual(kept.comparison, {capital: 'مأرب'});
  assert.equal(historyEntryDetails({...event, hideImages: true}).hideImages, true);
  assert.equal(state.paragraphs.length, 3, 'the cached catalog is not changed');
  const page = read('app/yemen-history/page.jsx');
  assert.ok(page.includes("<HistoryExplorer entries={published.map(historyIndexEntry)} details={pickDetails(details,[firstStop,...pair])} detailsUrl={'/api/history/details?v='+version}"));
});

test('figures page: light rows keep every filter and sort field, details carry the card', () => {
  const figure = {id: 'id1', slug: 'f', fullName: 'اسم', knownFor: 'عمل', shortBio: 'نبذة', field: 'أدب', governorateId: 'YE11', governorateName: 'صنعاء', era: 'معاصر', birthYear: 1950, deathYear: null,
    imageUrl: 'https://x/a.jpg', imageCredit: 'c', imageKind: 'portrait', imageSourceUrl: 'https://x', createdAt: '2026-01-01T00:00:00Z', isDemo: false, displayOrder: 3, website: '', facebookUrl: 'https://fb', instagramUrl: null, xUrl: null, youtubeUrl: null};
  const row = toFigureIndexEntry(figure);
  assert.deepEqual(row, {slug: 'f', fullName: 'اسم', field: 'أدب', governorateId: 'YE11', era: 'معاصر', birthYear: 1950, createdAt: '2026-01-01T00:00:00Z', hasPhoto: true, hasSocial: true});
  assert.deepEqual(toFigureDetails(figure), {id: 'id1', knownFor: 'عمل', shortBio: 'نبذة', imageUrl: 'https://x/a.jpg', imageCredit: 'c', imageKind: 'portrait', imageSourceUrl: 'https://x', governorateName: 'صنعاء', facebookUrl: 'https://fb'});
  const filters = {...figureFilterDefaults, social: true, photo: true, century: '20'};
  assert.equal(filterFigures([row], filters).length, 1, 'filters work before the details arrive');
  assert.equal(filterFigures([{...row, hasSocial: undefined, hasPhoto: undefined}], filters).length, 0);
  const page = read('app/yemeni-figures/page.jsx');
  assert.ok(page.includes("figures={figures.map(toFigureIndexEntry)} details={pickDetails(details,firstCards)} detailsUrl={'/api/figures/details?v='+version}"));
  for (const route of ['app/api/history/details/route.js', 'app/api/figures/details/route.js']) assert.ok(read(route).includes("gate==='hidden'?"), route);
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
