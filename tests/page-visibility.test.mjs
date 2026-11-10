import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSections,validatePageVisibility,resolvePageVisibility,pageIsVisible,sectionIsVisible,PAGE_VISIBILITY_KEY} from '../lib/pageVisibility.js';
import {createDefaultContentPages,mutateContentCatalog,contentPagesForSearch,resolveContentCatalog,CONTENT_PAGES_KEY} from '../lib/contentPages.js';
import {buildSitemap} from '../lib/seo.js';

test('missing visibility settings preserve published sections; malformed saved settings cannot reopen them',()=>{
 const visibility=resolvePageVisibility();assert.equal(Object.keys(visibility).length,publicSections.length);
 // Published sections stay open; a new section marked defaultHidden (the market) starts closed.
 for(const section of publicSections)assert.equal(visibility[section.id],!section.defaultHidden,section.id);
 assert.equal(visibility.market,false);
 assert.throws(()=>resolvePageVisibility([{key:PAGE_VISIBILITY_KEY,value:{version:2,sections:{}}}]),error=>error.status===503);
 for(const input of [{works:'false'},{admin:false},{__proto__:null,login:false},[],null])assert.throws(()=>validatePageVisibility(input));
});
test('hiding a section covers its details, queries and anchors without matching a similarly named path',()=>{
 const visibility=validatePageVisibility({works:false,atlas:false,debates:false});
 for(const href of ['/works','/works/story?q=x#watch','/debates/speakers/person','/yemen-map','/yemen-map?district=YE1908#map'])assert.equal(pageIsVisible(href,visibility),false,href);
 for(const href of ['/','/admin?tab=pages','/login','/register','/account','/forgot-password','/works-other','/magazine'])assert.equal(pageIsVisible(href,visibility),true,href);
 assert.equal(sectionIsVisible('figures',visibility),true);
 assert.equal(pageIsVisible('/yemeni-figures',visibility),true);
 assert.equal(pageIsVisible('/yemeni-figures/person',visibility),true);
});
test('figures can be hidden separately while geographical discovery remains available',()=>{
 const visibility=validatePageVisibility({figures:false});
 assert.equal(pageIsVisible('/yemen-map?region=YE19#map',visibility),true);
 assert.equal(pageIsVisible('/yemen-map#yemeni-figures',visibility),false);
 assert.equal(pageIsVisible('/yemeni-figures',visibility),false);
 assert.equal(pageIsVisible('/yemeni-figures/person',visibility),false);
 assert.equal(pageIsVisible('/yemen-map/figures/person',visibility),false);
 assert.equal(pageIsVisible('/pages/%ZZ',visibility),false);
});
test('hiding and restoring a managed page retains its sections and removes it from public discovery',()=>{
 const pages=createDefaultContentPages(),about=pages.find(item=>item.slug==='about');
 const hidden=mutateContentCatalog(pages,'update',{...about,isPublished:false},'admin');
 assert.equal(pageIsVisible('/about',{},hidden),false);assert.equal(contentPagesForSearch(hidden).some(page=>page.href==='/about'),false);
 const recovered=resolveContentCatalog([{key:CONTENT_PAGES_KEY,value:{version:1,pages:hidden}}]);
 assert.deepEqual(recovered.find(item=>item.slug==='about').sections,about.sections);
 const restored=mutateContentCatalog(recovered,'update',{...recovered.find(item=>item.slug==='about'),isPublished:true},'admin');
 assert.equal(pageIsVisible('/about',{},restored),true);assert.equal(contentPagesForSearch(restored).some(page=>page.href==='/about'),true);
 assert.throws(()=>mutateContentCatalog(restored,'update',{...about,isPublished:'false'},'admin'));
});
test('sitemap omits hidden sections, descendants and managed pages while retaining visible content',()=>{
 const pages=createDefaultContentPages().map(page=>({...page,isPublished:page.slug!=='about'}));
 const entries=buildSitemap({pageVisibility:{works:false,atlas:false},contentPages:pages,works:[{slug:'story',is_published:true}],figures:[{slug:'person',is_published:true}],issues:[{slug:'issue-1',is_published:true}]},{NODE_ENV:'production',VERCEL_ENV:'production'});
 const paths=entries.map(item=>new URL(item.url).pathname);
 assert.ok(!paths.includes('/about'));assert.ok(!paths.some(path=>/^\/(works|yemen-map)(\/|$)/.test(path)));
 assert.ok(paths.includes('/yemeni-figures/person'));assert.ok(paths.includes('/magazine/issue-1'));assert.ok(paths.includes('/privacy'));
});
