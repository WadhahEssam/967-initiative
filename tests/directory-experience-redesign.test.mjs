import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectionDefaults,listStateSearch,readListState} from '../lib/listState.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const experience=read('app/directory-experience.css');
const institution=read('components/InstitutionDirectory.jsx');
const institutionDetail=read('components/InstitutionDetail.jsx');
const products=read('components/YemeniProductDirectory.jsx');
const company=read('app/yemeni-products/[id]/page.jsx');

test('three directories share responsive styles without affecting admin routes',()=>{
  for(const area of ['yemeni-products','universities','medical-centers']){
    const layout=read(`app/${area}/layout.jsx`);
    assert.ok(layout.includes("import '@/app/directory-experience.css';"),area);
  }
  for(const key of ['universities','medical','products'])assert.ok(experience.includes(`[data-area="${key}"]`));
  assert.ok(experience.includes('@media(max-width:640px)'));
  assert.ok(experience.includes('@media(max-width:365px)'));
  assert.ok(experience.includes('prefers-reduced-motion:reduce'));
  assert.ok(experience.includes('data-ed-theme="dark"'));
  assert.ok(experience.includes('var(--c-surface)'));
  assert.ok(experience.includes('var(--c-ink)'));
  assert.ok(!experience.includes('.admin-page'));
});

test('institution filters are accessible and search always visible',()=>{
  assert.match(institution,/useState\(false\)/);
  assert.match(institution,/aria-expanded=\{filtersOpen\}/);
  assert.match(institution,/aria-controls=\{'institution-extra-'\+kind\}/);
  assert.match(institution,/className="institution-toolbar-primary"/);
  assert.match(institution,/className=\{'institution-extra-filters'/);
  assert.match(institution,/type="search"/);
  assert.match(institution,/className="institution-filter-toggle"/);
  assert.match(experience,/\.institution-extra-filters\.is-open\{display:grid\}/);
  assert.match(institution,/set\('governorate',value\)/);
});

test('cards preserve full-card navigation, independent saving and honest availability',()=>{
  assert.match(institution,/className="institution-card-link"/);
  assert.match(institution,/className="institution-card-top"/);
  assert.match(institution,/className="institution-card-footer"/);
  assert.match(institution,/<\/Link>\s*<div className="card-save-action">/);
  assert.match(institution,/medicalOperatingEvidence\(item\)/);
  assert.match(institution,/وليست الحالة الحالية/);
  assert.match(institution,/item\.topics/);
  assert.match(read('lib/institutionDirectories.js'),/programs\.map\(row=>row\.field\|\|row\.name\)/);
  assert.match(read('components/design/ContentSurface.jsx'),/directory: \{label:/);
});

test('company sorting is saved in directory URL and card return path',()=>{
  assert.equal(collectionDefaults.products.sort,'name');
  const custom={...collectionDefaults.products,q:'عسل',sort:'products',page:2};
  const search=listStateSearch('',custom,collectionDefaults.products);
  assert.deepEqual(readListState(search,collectionDefaults.products),custom);
  assert.match(products,/setSort=sort=>update/);
  assert.match(products,/sort==='products'/);
  assert.match(products,/category,location,sort\},collectionDefaults\.products/);
  assert.match(products,/className="products-sort"/);
  assert.match(products,/className=\{\`company-card \$\{styles\.card\}\`\}/);
  assert.doesNotMatch(products,/استكشف ملف الشركة/);
});

test('long detail lists stay usable and evidence remains visible',()=>{
  assert.match(institutionDetail,/function EntryCollection/);
  assert.match(institutionDetail,/rows\.slice\(0,8\)/);
  assert.match(institutionDetail,/institution-more-entries/);
  for(const type of ['programs','specialties','services'])assert.ok(institutionDetail.includes(`rows={item.${type}}`));
  assert.match(institutionDetail,/function EvidenceLink/);
  assert.match(institutionDetail,/function Sources/);
  assert.match(institutionDetail,/اتصل بالفرع/);
  assert.match(company,/company\.productDetails\.slice\(0,8\)/);
  assert.match(company,/company\.productDetails\.slice\(8\)/);
  assert.match(company,/company-more-products/);
  assert.match(company,/اتصل بالشركة/);
  assert.match(company,/إرسال بريد إلكتروني/);
  assert.match(company,/الأسعار دون تاريخ سريان موثق/);
});
