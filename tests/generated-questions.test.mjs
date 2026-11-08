import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {buildGeneratedQuestions,generatedQuestionsForDay,historyYearQuestions,universityQuestions,capitalQuestions,GENERATED_DAILY_COUNT} from '../lib/generatedQuestions.js';
import {normalizePlaceName} from '../lib/districtPages.js';
import {yemenGovernorates} from '../lib/yemeniFigures.js';

const json=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const boundaries=json('public/data/yemen-map/yemen-boundaries.json');
const governorateNames=Object.fromEntries(yemenGovernorates.map(item=>[item.id,item.name]));
const profiles={};
for(const item of json('data/yemen-map/governorates-output.json'))profiles[item.id]={...item};
for(const [id,population] of Object.entries(json('data/yemen-map/governorate-population-2025.json')))profiles[id]={...profiles[id],population,population_year:2025};
for(let i=1;i<=6;i++)for(const item of json('data/yemen-map/districts-output-'+i+'.json'))profiles[item.id]={...item};
const history=[];
for(const file of readdirSync(new URL('../data/yemen-history',import.meta.url)).filter(name=>/output/.test(name))){const data=json('data/yemen-history/'+file);history.push(...(Array.isArray(data)?data:data.entries||[]));}
const universities=[{id:'u1',name:'جامعة الأحقاف',governorate:'حضرموت',city:'تريم'},{id:'u2',name:'جامعة عدن',governorate:'عدن'},{id:'u3',name:'جامعة الرازي',governorate:'أمانة العاصمة',branches:[{}]},{id:'u4',name:'جامعة ما',governorate:'غير معروف'}];
const groups=buildGeneratedQuestions({boundaries,profiles,governorateNames,history,universities});
const all=Object.values(groups).flat();

test('every generated question is well formed with four distinct options',()=>{
 assert.ok(all.length>300);
 assert.equal(new Set(all.map(item=>item.id)).size,all.length,'ids are unique');
 for(const item of all){
  assert.equal(item.options.length,4,item.id);
  assert.equal(new Set(item.options.map(normalizePlaceName)).size,4,item.id);
  assert.ok(Number.isInteger(item.correct)&&item.correct>=0&&item.correct<4,item.id);
  assert.ok(item.question.endsWith('؟')&&item.explanation&&item.source.url.startsWith('https://967ye.com/'),item.id);
  assert.ok(['geography','history','culture','heritage'].includes(item.category)&&[1,2,3].includes(item.difficulty),item.id);
  assert.equal(item.generated,true);
 }
});

test('district answers match the boundary file and ambiguous names are skipped',()=>{
 for(const item of groups.district){
  const district=boundaries.districts.find(row=>row.id===item.id.slice('g-district-'.length));
  assert.equal(item.options[item.correct],governorateNames[district.governorateId],item.id);
 }
 assert.ok(!groups.district.some(item=>item.question.includes('الزاهر')),'a name used in two governorates');
 assert.ok(!groups.district.some(item=>item.question.includes('مديرية الضالع')),'a district named like its governorate');
});

test('capital questions skip shared capitals and give-away names',()=>{
 const ids=capitalQuestions({boundaries,profiles,governorateNames}).map(item=>item.id);
 assert.ok(!ids.includes('g-capital-YE13')&&!ids.includes('g-capital-YE23'),'Sanaa is the centre of two');
 assert.ok(!ids.includes('g-capital-YE24'),'Aden gives the answer away');
 assert.ok(ids.includes('g-capital-YE19'));
});

test('largest-of-four questions have a clear winner',()=>{
 for(const item of groups.superlative){
  const values=item.explanation.split('، ').map(part=>Number(part.split(': ')[1].split(' ')[0].replace(/,/g,'')));
  assert.ok(values[0]>=values[1]*1.1,item.id);
  assert.equal(item.options[item.correct],item.explanation.split(':')[0],item.id);
 }
});

test('year questions use only established event years stated in the summary',()=>{
 for(const item of groups.year){
  const entry=history.find(row=>row.slug===item.id.slice('g-year-'.length));
  assert.equal(entry.kind,'event');
  assert.equal(item.options[item.correct],entry.year+'م');
  assert.ok(entry.summary.includes(String(entry.year)),item.id);
 }
 const fake=[{slug:'a',kind:'event',year:1550,title:'صنعاء والعثمانيون',summary:'دخل العثمانيون صنعاء سنة 1547م.'},{slug:'b',kind:'event',year:1990,title:'الوحدة',summary:'أُعلنت الوحدة سنة 1990.',certainty:'تختلف المصادر في التفاصيل'},{slug:'c',kind:'theme',year:1990,title:'موضوع',summary:'سنة 1990.'},{slug:'d',kind:'event',year:1990,title:'الوحدة',summary:'أُعلنت الوحدة في 22 مايو 1990.'}];
 assert.deepEqual(historyYearQuestions({history:fake}).map(item=>item.id),['g-year-d']);
});

test('university questions skip branches, unknown governorates and names that give the answer',()=>{
 const items=universityQuestions({universities,boundaries,governorateNames});
 assert.deepEqual(items.map(item=>item.id),['g-university-u1']);
 assert.equal(items[0].options[items[0].correct],'حضرموت');
});

test('each day gets a stable mix of up to 40 questions from every kind',()=>{
 const today=generatedQuestionsForDay(groups,'2026-11-09'),again=generatedQuestionsForDay(groups,'2026-11-09'),tomorrow=generatedQuestionsForDay(groups,'2026-11-10');
 assert.equal(today.length,GENERATED_DAILY_COUNT);
 assert.deepEqual(today.map(item=>item.id),again.map(item=>item.id));
 assert.notDeepEqual(today.map(item=>item.id),tomorrow.map(item=>item.id));
 for(const prefix of ['g-district-','g-capital-','g-population-','g-year-'])assert.ok(today.some(item=>item.id.startsWith(prefix)),prefix);
});

test('generated questions are for free play only, never the official daily challenge',()=>{
 const page=read('app/games/quiz/page.jsx');
 assert.match(page,/if\(mode==='practice'\)practice=\[\.\.\.practice,\.\.\.await generatedPracticeQuestions\(date\)\.catch\(\(\)=>\[\]\)\]/);
 assert.ok(!read('lib/dailyOfficialSeed.js').includes('generated'));
});
