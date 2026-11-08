import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectedHistoryForFigure,connectedHistoryForGovernorate,connectedFiguresForGovernorate,historyCrossLinks,figureCrossLinks,governorateCrossLinks,musnadCrossLinks,statisticsCrossLinks,civicCrossLinks} from '../lib/knowledgeConnections.js';
import {pageIsVisible} from '../lib/pageVisibility.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const arwa={id:'a',slug:'queen-arwa',fullName:'الملكة أروى بنت أحمد',governorateId:'YE15',field:'السياسة والحكم'};
const otherArwa={id:'b',slug:'other-arwa',fullName:'أروى بنت أخرى',governorateId:'YE26',field:'الفن والموسيقى'};
const entries=[
 {slug:'arwa',title:'الملكة أروى بنت أحمد',year:1067,governorate:'YE15',figureQuery:'أروى',isPublished:true},
 {slug:'saba',title:'مملكة سبأ',year:-800,governorate:'YE26',isPublished:true},
 {slug:'ancient-inscriptions',title:'النقوش العربية الجنوبية',year:-500,isPublished:true},
 {slug:'hidden',title:'مادة غير منشورة',year:1200,governorate:'YE15',figureQuery:'أروى',isPublished:false},
 {slug:'invalid?',title:'رابط غير صالح',year:1234,governorate:'YE15',isPublished:true},
];

test('history links to modern regional map with explicit geographic boundary disclaimer',()=>{
 const links=historyCrossLinks(entries[1]);
 assert.equal(links.some(x=>x.href==='/yemen-map?region=YE26#map'),true);
 assert.ok(links.find(x=>x.kind==='الخريطة').description.includes('وليست حدود'));
 assert.equal(historyCrossLinks(entries[1],{visibility:{atlas:false,school:false}}).length,0);
 assert.equal(historyCrossLinks({...entries[1],governorate:'YE99'},{visibility:{school:false}}).length,0);
 assert.equal(historyCrossLinks({...entries[1],isPublished:false}).length,0);
});

test('cross-section links to a figure only when explicitly referenced and uniquely identifiable',()=>{
 const single=historyCrossLinks(entries[0],{figures:[arwa]});
 assert.equal(single.some(x=>x.href==='/yemeni-figures/queen-arwa'),true);
 const duplicate=historyCrossLinks(entries[0],{figures:[arwa,otherArwa]});
 assert.equal(duplicate.some(x=>x.href.startsWith('/yemeni-figures?figureQ=')),true);
 assert.equal(duplicate.some(x=>x.href.includes('/queen-arwa')),false);
 assert.equal(connectedHistoryForFigure(arwa,entries,[arwa,otherArwa]).length,0);
 assert.deepEqual(connectedHistoryForFigure(arwa,entries,[arwa]).map(x=>x.slug),['arwa']);
 assert.equal(figureCrossLinks(arwa,{historyEntries:entries,figures:[arwa],visibility:{history:false}}).some(x=>x.kind==='تاريخ اليمن'),false);
 assert.equal(historyCrossLinks(entries[0],{figures:[arwa],visibility:{figures:false}}).some(x=>x.kind==='الشخصيات'),false);
});

test('figure related content is explicit while geographic suggestions are clearly labeled',()=>{
 const links=figureCrossLinks(arwa,{historyEntries:entries,figures:[arwa]});
 assert.equal(links.some(x=>x.href==='/yemen-history/arwa'),true);
 assert.equal(links.some(x=>x.href==='/yemen-map?region=YE15#map'),true);
 assert.equal(figureCrossLinks({...arwa,isDemo:true},{historyEntries:entries,figures:[arwa]}).length,0);
 const poet=figureCrossLinks({...arwa,field:'الأدب والشعر'},{visibility:{school:true},historyEntries:[],figures:[arwa]});
 assert.equal(poet.some(x=>x.href==='/school/courses/arud'),true);
 assert.equal(poet.find(x=>x.kind==='مدرسة 967').description.includes('ليس تحليلًا'),true);
});

test('governorates include published matching data only without inferring historic borders',()=>{
 assert.deepEqual(connectedHistoryForGovernorate('YE15',entries).map(x=>x.slug),['arwa']);
 assert.deepEqual(connectedFiguresForGovernorate('YE15',[arwa,otherArwa]).map(x=>x.slug),['queen-arwa']);
 const links=governorateCrossLinks('YE15',{historyEntries:entries,figures:[arwa,otherArwa]});
 assert.equal(links.some(x=>x.href==='/yemen-history/arwa'),true);
 assert.equal(links.some(x=>x.href==='/yemeni-figures/queen-arwa'),true);
 assert.equal(links.some(x=>x.href.includes('/hidden')),false);
 assert.equal(governorateCrossLinks('YE99',{historyEntries:entries,figures:[arwa]}).length,0);
 assert.equal(governorateCrossLinks('YE15',{visibility:{figures:false,history:false},historyEntries:entries,figures:[arwa]}).length,0);
});

test('Musnad and history link both ways only to relevant published topics',()=>{
 const musnad=musnadCrossLinks(entries);
 assert.deepEqual(musnad.map(x=>x.href),['/yemen-history/ancient-inscriptions','/yemen-history/saba']);
 assert.equal(musnadCrossLinks(entries,{history:false}).length,0);
 const history=historyCrossLinks(entries[2]);
 assert.equal(history.some(x=>x.href==='/school/courses/musnad'),true);
 assert.equal(historyCrossLinks(entries[2],{visibility:{school:false}}).length,0);
});

test('real page integrations use shared component, retain existing sections and guard hidden routes',()=>{
 const history=read('app/yemen-history/[slug]/page.jsx');
 const figure=read('app/yemeni-figures/[slug]/page.jsx');
 const governorate=read('app/yemen-map/governorates/[id]/page.jsx');
 const school=read('app/school/courses/[slug]/page.jsx');
 const view=read('components/knowledge/CrossSectionPaths.jsx');
 const css=read('components/knowledge/CrossSectionPaths.module.css');
 for(const [page,fn] of [[history,'historyCrossLinks('],[figure,'figureCrossLinks('],[governorate,'governorateCrossLinks('],[school,'musnadCrossLinks(']]){
  assert.ok(page.includes(fn),fn);
  assert.ok(page.includes('<CrossSectionPaths items={crossLinks}'),fn);
 }
 assert.ok(history.includes('styles.references'));
 assert.ok(figure.includes('related.length > 0'));
 assert.ok(governorate.includes('<ContentSections profile={profile}/>'));
 assert.ok(school.includes('<CourseJourney '));
 assert.ok(school.includes("slug==='musnad'&&sectionIsVisible('history',settings.pageVisibility)"));
 assert.ok(view.includes('if(!items.length)return null'));
 assert.ok(view.includes('aria-labelledby={id}'));
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(css.includes(':focus-visible'));
 assert.equal(pageIsVisible('/yemen-history/saba',{history:false}),false);
 assert.equal(pageIsVisible('/school/writing/musnad',{school:false}),false);
 assert.equal(pageIsVisible('/school/courses/musnad',{school:false}),false);
});

test('statistics and civic courses connect in both directions without exposing hidden sections',()=>{
 assert.deepEqual(statisticsCrossLinks({school:false}),[]);
 assert.equal(statisticsCrossLinks({school:true})[0].href,'/school/civic');
 assert.deepEqual(civicCrossLinks({statistics:false,ranking:false}),[]);
 assert.deepEqual(civicCrossLinks({statistics:true,ranking:true}).map(x=>x.href),['/yemen-in-numbers','/yemen-ranking']);
 assert.ok(civicCrossLinks()[0].description.includes('سنة القياس'));
 const numbers=read('app/yemen-in-numbers/page.jsx');
 const civic=read('app/school/civic/page.jsx');
 assert.ok(numbers.includes('statisticsCrossLinks(settings.pageVisibility)'));
 assert.ok(civic.includes('civicCrossLinks(settings.pageVisibility)'));
 assert.ok(numbers.includes('<CrossSectionPaths'));
 assert.ok(civic.includes('<CrossSectionPaths'));
});
