import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navSections,resolveNavSections} from '../lib/navigation.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

// Owner, 2026-11-11: no «من نحن» or «مشاريعنا» links; the group has a neutral name and is shown in
// the footer only, not in the header bar (where it repeated the footer).
test('the former «المبادرة» group: neutral name, footer only, no about/projects links',()=>{
 const group=navSections.find(section=>section.id==='initiative');
 assert.equal(group.label,'روابط مفيدة');
 assert.equal(group.footerOnly,true);
 const all=JSON.stringify(navSections);
 for(const text of ['المبادرة','من نحن','مشاريعنا','/#about','/#projects'])assert.ok(!all.includes(text),text);
 const managed=[{slug:'about',href:'/pages/about',title:'من نحن'},{slug:'help',href:'/help',title:'المساعدة'}];
 const links=resolveNavSections({contentLinks:managed}).find(section=>section.id==='initiative').links;
 assert.deepEqual(links,[['/help','المساعدة'],['/contribute','ساهم معنا']]);
 assert.ok(read('components/Header.jsx').includes('resolveNavSections({contentLinks, visibility}).filter(section => !section.footerOnly)'));
 const footer=read('components/Footer.jsx');
 assert.ok(footer.includes("!['privacy', 'terms', 'about'].includes(page.slug)"));
 assert.ok(!footer.includes('/#projects'));
});
