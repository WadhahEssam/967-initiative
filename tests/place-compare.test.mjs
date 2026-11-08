import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparePath,comparisonHeadline,comparisonRows,placeFacts,placeKind} from '../lib/placeCompare.js';
import {buildSitemap} from '../lib/seo.js';

const bounds=JSON.parse(readFileSync(new URL('../public/data/yemen-map/yemen-boundaries.json',import.meta.url),'utf8'));
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const census={title:'تقديرات سكان اليمن 2025 (الجهاز المركزي للإحصاء)',url:'https://data.humdata.org/dataset/yemen-population-estimates'};
const profiles={
 YE24:{description:'عدن مدينة ساحلية.',capital:'عدن',population:1000000,population_year:2025,area_km2:1000,sources:[census]},
 YE13:{description:'أمانة العاصمة.',capital:'صنعاء',population:3000000,population_year:2025,area_km2:400,sources:[census]},
 YE1301:{description:'تضم مدينة صنعاء القديمة ومعالمها.',capital:'صنعاء القديمة',population:155909,population_year:2025,sources:[census]},
 YE2407:{description:'صيرة.',population:null,population_year:null,sources:[]},
};
const context={boundaries:bounds,profiles,governorateNames:{YE24:'عدن',YE13:'أمانة العاصمة'},
 medicalCenters:[{id:'h1',name:'مستشفى',type:'hospital',typeLabel:'مستشفى',governorate:'عدن',district:'صيره'},{id:'c1',name:'مركز',type:'health_center',governorate:'أمانة العاصمة',district:'صنعاء القديمة'}],
 universities:[{id:'u1',governorate:'عدن'},{id:'u2',governorate:'أمانة العاصمة'},{id:'u3',governorate:'امانة العاصمه'}],
 figures:[{governorateId:'YE13'}],history:[{slug:'x',governorate:'YE13',location:'صنعاء القديمة',title:'حدث'}]};

test('place ids are governorates (YE##) or districts (YE####)',()=>{
 assert.equal(placeKind('YE24'),'governorate');
 assert.equal(placeKind('YE1301'),'district');
 assert.equal(placeKind('YE1'),null);
 assert.equal(placeKind('x'),null);
 assert.equal(comparePath('YE24','YE13'),'/yemen-map/compare?a=YE24&b=YE13');
 assert.equal(comparePath(),'/yemen-map/compare');
});

test('facts carry population with year and source, and derived density',()=>{
 const aden=placeFacts('YE24',context),capital=placeFacts('YE13',context);
 assert.equal(aden.title,'محافظة عدن');
 assert.equal(aden.population,1000000);
 assert.equal(aden.populationYear,2025);
 assert.equal(aden.populationSource.url,census.url);
 assert.equal(aden.density,1000);
 assert.equal(aden.districts,8);
 assert.equal(aden.facilities,1);
 assert.equal(aden.hospitals,1);
 assert.equal(capital.universities,2,'spelling variants of the governorate name still count');
 assert.equal(capital.figures,1);
 assert.equal(placeFacts('YE9999',context),null);
});

test('district facts use the district name, its facilities and its history',()=>{
 const old=placeFacts('YE1301',context),sira=placeFacts('YE2407',context);
 assert.equal(old.title,'مديرية صنعاء القديمة');
 assert.equal(old.facilities,1);
 assert.equal(old.history,1);
 assert.equal(old.universities,null);
 assert.equal(sira.population,null);
 assert.equal(sira.populationSource,null);
 assert.equal(sira.facilities,1);
});

test('rows skip empty facts, mark the higher value, and never invent numbers',()=>{
 const rows=comparisonRows(placeFacts('YE24',context),placeFacts('YE13',context));
 const population=rows.find(row=>row.key==='population');
 assert.equal(population.higher,'b');
 assert.equal(Math.round(population.ratio),3);
 assert.ok(!rows.some(row=>row.key==='governorate'),'the governorate row is for districts');
 const mixed=comparisonRows(placeFacts('YE1301',context),placeFacts('YE2407',context));
 const pop=mixed.find(row=>row.key==='population');
 assert.equal(pop.b,null);
 assert.equal(pop.higher,null);
 assert.ok(mixed.some(row=>row.key==='governorate'));
});

test('the headline names the biggest difference in plain Arabic',()=>{
 assert.equal(comparisonHeadline(placeFacts('YE24',context),placeFacts('YE13',context)),'محافظة أمانة العاصمة أكثر سكانًا من محافظة عدن بنحو 3 أضعاف.');
 assert.equal(comparisonHeadline({title:'أ',population:110},{title:'ب',population:100}),'أ أكثر سكانًا من ب بنحو 10%.');
 assert.equal(comparisonHeadline({title:'أ',area:21},{title:'ب',area:10}),'أ أكبر مساحة من ب بنحو الضعف.');
 assert.equal(comparisonHeadline({title:'أ',population:null},{title:'ب',population:5}),'');
 assert.equal(comparisonHeadline({title:'مديرية أ',population:1000},{title:'مديرية ب',population:1020}),'مديرية أ ومديرية ب متقاربتان في عدد السكان.');
});

test('the compare page is gated by the atlas, linked from places and listed in the sitemap',()=>{
 const page=read('app/yemen-map/compare/page.jsx');
 assert.ok(page.includes("sectionGate('atlas'")&&page.includes('noindex:true'));
 assert.ok(read('app/yemen-map/districts/[id]/page.jsx').includes("'/yemen-map/compare?a='"));
 assert.ok(read('app/yemen-map/governorates/[id]/page.jsx').includes("'/yemen-map/compare?a='"));
 assert.ok(read('components/yemen-map/YemenDiscovery.jsx').includes('href="/yemen-map/compare"'));
 const urls=buildSitemap({},{NEXT_PUBLIC_SITE_URL:'https://967ye.com',VERCEL_ENV:'production'}).map(item=>item.url);
 assert.ok(urls.includes('https://967ye.com/yemen-map/compare'));
});
