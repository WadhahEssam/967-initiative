import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {extractDatedFacts,factsForDay,formatDayMonth,yemenMonthDay,ON_THIS_DAY_LAST_YEAR} from '../lib/onThisDay.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const entries=[];
for(const file of readdirSync(new URL('../data/yemen-history',import.meta.url)).filter(name=>/output/.test(name))){const data=JSON.parse(read('data/yemen-history/'+file));entries.push(...(Array.isArray(data)?data:data.entries||[]));}
const facts=extractDatedFacts(entries);
const one=(summary,extra={})=>extractDatedFacts([{slug:'x',title:'حدث',year:1978,summary,...extra}]);

test('only full Gregorian dates are read, never ranges, BC dates or hedged sentences',()=>{
 assert.deepEqual(one('في 14 أكتوبر 1978م عُقد المؤتمر.').map(item=>[item.day,item.month,item.year]),[[14,10,1978]]);
 assert.equal(one('عُقد في 13–14 أكتوبر 1978م.').length,0);
 assert.equal(one('في 5 يونيو 900 ق.م بُني المعبد.').length,0);
 assert.equal(one('تتفاوت المصادر بين 18 و19 يناير 1839م.').length,0);
 assert.equal(one('في 31 فبراير 1978 حدث شيء.').length,0);
 assert.equal(one('في 1 يناير 2015 حدث شيء.').length,0,'recent conflict years stay out of the headline');
 assert.equal(one('في 22 مايو 1990 أُعلنت الوحدة.',{isPublished:false}).length,0);
 assert.equal(one('وفي 3 مارس 1956م أُعلن التأسيس.')[0].sentence,'في 3 مارس 1956م أُعلن التأسيس.');
 assert.ok(facts.every(item=>item.year<=ON_THIS_DAY_LAST_YEAR));
});

test('landmark dates win their day',()=>{
 const top=(month,day)=>factsForDay(facts,{month,day}).items[0];
 assert.equal(top(5,22).year,1990);
 assert.equal(top(11,30).year,1967);
 assert.equal(top(10,14).year,1963);
 assert.equal(top(9,26).year,1962);
 for(const [month,day] of [[5,22],[11,30]]){const result=factsForDay(facts,{month,day});assert.equal(new Set(result.items.map(item=>item.slug)).size,result.items.length);}
});

test('a day without an event falls back to the nearest dated day within three days',()=>{
 const fake=[{slug:'a',title:'أ',month:3,day:10,year:1900,sentence:'س',weight:1,main:true,lead:true},{slug:'b',title:'ب',month:3,day:6,year:1900,sentence:'س',weight:1,main:true,lead:true}];
 const near=factsForDay(fake,{month:3,day:8});
 assert.equal(near.exact,false);
 assert.equal(near.day,10,'ties go to the coming day');
 assert.equal(factsForDay(fake,{month:6,day:1}).items.length,0);
 const wrap=factsForDay([{...fake[0],month:1,day:1}],{month:12,day:30});
 assert.equal(wrap.day,1,'the window wraps over the new year');
 let covered=0;
 for(let month=1;month<=12;month++)for(let day=1;day<=new Date(Date.UTC(2024,month,0)).getUTCDate();day++)if(factsForDay(facts,{month,day}).items.length)covered++;
 assert.ok(covered>=330,'covered days: '+covered);
});

test('the day is taken in Yemen time and printed in Arabic',()=>{
 assert.deepEqual(yemenMonthDay(new Date('2026-11-08T21:30:00Z')),{month:11,day:9});
 assert.deepEqual(yemenMonthDay(new Date('2026-11-08T20:00:00Z')),{month:11,day:8});
 assert.equal(formatDayMonth({day:22,month:5}),'22 مايو');
});

test('the fallback for a day without an event never looks ahead when asked, and window 0 is exact only',()=>{
 const list=[{slug:'a',title:'a',year:1990,month:5,day:12,sentence:'',score:1},{slug:'b',title:'b',year:1991,month:5,day:9,sentence:'',score:1}];
 assert.equal(factsForDay(list,{month:5,day:10}).items[0].slug,'b');
 assert.equal(factsForDay(list,{month:5,day:11}).items[0].slug,'a','default: a tie goes to the day ahead');
 assert.equal(factsForDay(list,{month:5,day:11},{pastOnly:true}).items[0].slug,'b');
 assert.equal(factsForDay(list,{month:5,day:8},{pastOnly:true}).items.length,0);
 assert.equal(factsForDay(list,{month:5,day:11},{window:0}).items.length,0);
 assert.equal(factsForDay(list,{month:5,day:12},{window:0}).items[0].slug,'a');
});

test('the home page shows the band only when the history section is visible',()=>{
 const page=read('app/page.jsx');
 assert.ok(page.includes("const visibleHistory = sectionIsVisible('history', settings.pageVisibility);"));
 assert.ok(page.includes('visibleHistory ? onThisDay(new Date(), {pastOnly:true}).catch(() => null) : null'));
 // Yesterday too (exact day only), never tomorrow.
 assert.ok(page.includes('visibleHistory ? onThisDay(new Date(Date.now() - 864e5), {window:0}).catch(() => null) : null'));
 assert.ok(page.includes('<OnThisDay result={historyDay} yesterday={missedDay}/>'));
 assert.ok(read('lib/onThisDayServer.js').includes('readPublicHistoryCatalog(serverDb())'));
});
