import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDistrictMatcher,displayPlaceName,nearbyDistricts,districtNeighbours,districtOutline,districtPath,districtSummary,facilitiesInDistrict,historyForDistrict,normalizePlaceName,pointInGeometry} from '../lib/districtPages.js';
import {buildSitemap} from '../lib/seo.js';

const bounds=JSON.parse(readFileSync(new URL('../public/data/yemen-map/yemen-boundaries.json',import.meta.url),'utf8'));
const byName=name=>bounds.districts.find(item=>item.nameAr===name);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('place names match across spelling variants and governorate prefixes',()=>{
 assert.equal(normalizePlaceName('محافظة أمانة العاصمة'),normalizePlaceName('امانه العاصمه'));
 const match=createDistrictMatcher(bounds);
 assert.equal(match({governorate:'إب',district:'اب السده'}),match({governorate:'اب',district:'السدة'}));
 assert.ok(match({governorate:'تعز',district:'صاله'}));
 assert.equal(match({governorate:'بلد غير موجود',district:'صاله'}),null);
 assert.equal(match({governorate:'تعز',district:''}),null);
});

test('every district has neighbours, and neighbourhood is symmetric',()=>{
 const neighbours=districtNeighbours(bounds);
 assert.equal(neighbours.size,bounds.districts.length);
 const lonely=[...neighbours].filter(([,list])=>!list.length);
 assert.ok(lonely.length<=2,'isolated: '+lonely.map(([id])=>id).join(','));
 for(const [id,list] of neighbours)for(const other of list)assert.ok(neighbours.get(other).includes(id),id+'↔'+other);
 const abs=byName('عبس');
 for(const name of ['ميدي','اسلم','الزهره'])assert.ok(neighbours.get(abs.id).includes(byName(name).id),name);
});

test('every district gets a small SVG outline inside its governorate',()=>{
 for(const district of bounds.districts){
  const outline=districtOutline(district,bounds.governorates.find(item=>item.id===district.governorateId));
  assert.ok(outline.district.startsWith('M')&&outline.governorate.startsWith('M'),district.id);
  assert.ok(outline.district.length+outline.governorate.length<30000,district.id);
 }
});

test('facilities are matched by name first, then by coordinates',()=>{
 const district=byName('عبس'),match=createDistrictMatcher(bounds);
 const [lng,lat]=district.center;
 const inside=pointInGeometry([lng,lat],district.geometry);
 const items=[
  {id:'a',name:'مستشفى عبس',governorate:'حجة',district:'عبس'},
  {id:'b',name:'مركز آخر',governorate:'حجة',district:'ميدي',latitude:lat,longitude:lng},
  {id:'c',name:'مركز بلا اسم مديرية',governorate:'',district:'',latitude:lat,longitude:lng},
  {id:'d',name:'بعيد',governorate:'',district:'',latitude:12.8,longitude:45.0},
 ];
 const ids=facilitiesInDistrict(district,items,match).map(item=>item.id);
 assert.ok(ids.includes('a'));
 assert.ok(!ids.includes('b'),'a recorded district name wins over coordinates');
 assert.equal(ids.includes('c'),inside);
 assert.ok(!ids.includes('d'));
});

test('history links need the same governorate and the district name in the place line',()=>{
 const district=byName('عبس');
 const entries=[
  {slug:'x',title:'حدث',location:'عبس، حجة',governorate:district.governorateId,year:1900},
  {slug:'y',title:'حدث آخر',location:'عبس',governorate:'YE11',year:1800},
  {slug:'z',title:'مسودة',location:'عبس',governorate:district.governorateId,isPublished:false},
 ];
 assert.deepEqual(historyForDistrict(district,entries).map(item=>item.slug),['x']);
});

test('summaries stay short and never invent facts',()=>{
 const names={name:'عبس',governorateName:'حجة'};
 assert.ok(districtSummary({description:''},names).includes('عبس'));
 assert.ok(districtSummary({description:'ن'.repeat(400)},names).length<=161);
 assert.equal(displayPlaceName('صنعاء القديمه',['تضم مدينة صنعاء القديمة ومعالمها']),'صنعاء القديمة');
 assert.equal(displayPlaceName('عبس',['لا ذكر هنا']),'عبس');
 const dar=bounds.districts.find(item=>item.id==='YE2401');
 assert.ok(nearbyDistricts(dar,bounds.districts,districtNeighbours(bounds).get(dar.id)).length>=3);
 assert.ok(districtOutline(bounds.districts.find(item=>item.id==='YE1301'),bounds.governorates.find(item=>item.id==='YE13')).marker);
 assert.equal(districtPath('YE1704'),'/yemen-map/districts/YE1704');
});

test('district and governorate pages are listed in the sitemap only when the atlas is visible',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://967ye.com',VERCEL_ENV:'production',NODE_ENV:'production'};
 const places=['/yemen-map/governorates/YE17','/yemen-map/districts/YE1704','/yemen-map/districts/../../x'];
 const urls=buildSitemap({places},env).map(item=>item.url);
 assert.ok(urls.length>0);{
  assert.ok(urls.includes('https://967ye.com/yemen-map/districts/YE1704'));
  assert.ok(urls.includes('https://967ye.com/yemen-map/governorates/YE17'));
  assert.ok(!urls.some(url=>url.includes('..')));
  assert.ok(!buildSitemap({places,pageVisibility:{atlas:false}},env).some(item=>item.url.includes('/yemen-map/districts/')));
 }
 assert.ok(read('app/sitemap.js').includes("'/yemen-map/districts/'+item.id"));
});

test('the district page, map panel, province page and search all lead to district pages',()=>{
 const page=read('app/yemen-map/districts/[id]/page.jsx');
 assert.ok(page.includes('readPublicHistoryCatalog')&&page.includes('readPublicMapProfiles')&&page.includes("sectionGate('atlas'"));
 assert.ok(page.includes('DISTRICT_ID_PATTERN.test(id)'));
 assert.ok(read('components/yemen-map/RegionInfoPanel.jsx').includes('"/yemen-map/districts/"+encodeURIComponent(region.id)'));
 assert.ok(read('app/yemen-map/governorates/[id]/page.jsx').includes('href={districtPath(d.id)}'));
 assert.ok(read('lib/search.js').includes("'/yemen-map/districts/'+encodeURIComponent(x.id)"));
});

test('names are respelled only by adding ة, hamza or alif maqsura found in the district text',()=>{
 assert.equal(displayPlaceName('الضحى',['مديرية الضحي']),'الضحى');
 assert.equal(displayPlaceName('المضاربة و العاره',['مديرية المضاربة والعارة']),'المضاربة والعارة');
 assert.equal(displayPlaceName('افلح اليمن',['مديرية أفلح اليمن']),'أفلح اليمن');
 assert.equal(displayPlaceName('بيت الفقيه',['بيت الفقيه']),'بيت الفقيه');
});
