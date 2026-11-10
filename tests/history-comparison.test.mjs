import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyStarter,historyBySlug} from '../lib/yemenHistory.js';
import {validateHistoryEntry,validateHistoryComparison,mergeHistoryCatalog} from '../lib/historyRepository.js';
import {HISTORY_COMPARISON_GROUPS,HISTORY_COMPARISON_FIELDS,comparisonFact,comparisonPeriod,comparisonCoverage,comparisonPairNote,historyComparisonOverlap} from '../lib/historyComparisons.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const originals=['saba','qataban','himyar','main','rasulids'];

test('the historical comparison has four sections and thirteen sourced criteria',()=>{
 assert.deepEqual(HISTORY_COMPARISON_GROUPS.map(group=>group.id),['overview','governance','economy','civilization']);
 assert.equal(HISTORY_COMPARISON_FIELDS.length,13);
 assert.equal(new Set(HISTORY_COMPARISON_FIELDS.map(field=>field.key)).size,13);
 for(const slug of originals){
  const entry=historyBySlug(slug);
  assert.equal(entry.kind,'state');
  assert.ok(entry.comparison);
  const valid=validateHistoryEntry(entry);
  assert.deepEqual(valid.comparison,entry.comparison,slug);
  assert.ok(comparisonCoverage(entry)>0,slug);
  for(const [key,fact] of Object.entries(entry.comparison.facts)){
   assert.ok(HISTORY_COMPARISON_FIELDS.some(field=>field.key===key),key);
   assert.deepEqual(comparisonFact(entry,key),fact);
   assert.ok(entry.sources.some(source=>source.url===fact.sourceUrl),slug+' has unlisted source for '+key);
  }
  const interval=comparisonPeriod(entry);
  if(interval)assert.ok(entry.sources.some(source=>source.url===interval.sourceUrl));
 }
 assert.ok(historyStarter.length>=177);
});

test('validated comparison facts must cite a source in the same dossier',()=>{
 const original=historyBySlug('saba');
 const sourceUrl=original.sources[0].url;
 assert.throws(()=>validateHistoryEntry({...original,comparison:{facts:{capital:{text:'ادعاء بلا مصدر',sourceUrl:''}}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{facts:{capital:{text:'ادعاء',sourceUrl:'https://example.com/'}}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{facts:{unlisted:{text:'ادعاء',sourceUrl}}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{facts:{capital:{text:'x'.repeat(501),sourceUrl}}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{timeline:{from:-900,to:'',label:'فترة زمنية',sourceUrl},facts:{}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{timeline:{from:2020,to:1800,label:'معكوس',sourceUrl},facts:{}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{timeline:{from:900,to:3000,label:'مستقبل',sourceUrl},facts:{}}}));
 assert.throws(()=>validateHistoryEntry({...original,comparison:{timeline:{from:-900,to:200,label:'',sourceUrl},facts:{}}}));
 assert.deepEqual(validateHistoryComparison({facts:{capital:{text:'   ',sourceUrl}}},original.sources),{facts:{}});
 const changed=validateHistoryEntry({...original,comparison:{facts:{capital:{text:'مركز حكم موثق',sourceUrl}}}});
 assert.equal(changed.comparison.facts.capital.text,'مركز حكم موثق');
});

test('legacy editor records retain editorially seeded comparisons without migration',()=>{
 const saba=historyBySlug('saba');
 const legacy={...saba,summary:'وصف محدّث للمملكة من أرشيف المحرر، محفوظ دون حقول المقارنة الجديدة.'};
 delete legacy.comparison;
 const merged=mergeHistoryCatalog([legacy]);
 const out=merged.find(entry=>entry.slug==='saba');
 assert.equal(out.summary,legacy.summary);
 assert.deepEqual(out.comparison,saba.comparison);
 const clear=mergeHistoryCatalog([{...saba,comparison:{facts:{}},summary:legacy.summary}]);
 assert.deepEqual(clear.find(entry=>entry.slug==='saba').comparison,{facts:{}});
});

test('time overlap is shown only for two independently sourced intervals',()=>{
 assert.equal(historyComparisonOverlap(historyBySlug('saba'),historyBySlug('himyar')),true);
 assert.equal(historyComparisonOverlap(historyBySlug('saba'),historyBySlug('qataban')),null);
 assert.equal(comparisonPeriod(historyBySlug('qataban')),null);
 assert.ok(comparisonPairNote(historyBySlug('saba'),historyBySlug('qataban'))?.sources.length===2);
 assert.ok(comparisonPairNote(historyBySlug('saba'),historyBySlug('himyar'))?.sources.length===2);
 assert.equal(comparisonPairNote(historyBySlug('saba'),historyBySlug('rasulids')),null);
});

test('public selector, evidence, timeline and mobile comparison are wired',()=>{
 const explorer=read('components/history/HistoryExplorer.jsx');
 const panel=read('components/history/HistoryComparison.jsx');
 const css=read('components/history/HistoryComparison.module.css');
 assert.ok(explorer.includes('<HistoryComparison entries={states} detailsStatus={status} onRetry={load}/>'));
 assert.ok(explorer.includes('location.hash'));
 for(const token of ['role="tablist"','role="tabpanel"','history-comparison-panel','history-compare-heading','comparisonFact(entry,field.key)','comparisonPeriod','historyComparisonOverlap','historyPairNotes','history-comp-sources']) {
  const good=token==='historyPairNotes'?read('lib/historyComparisons.js').includes(token):panel.includes(token);
  assert.ok(good,token);
 }
 assert.ok(panel.includes("p.set('compareA',a)"));
 assert.ok(panel.includes("p.set('compareB',b)"));
 assert.ok(panel.includes("location.hash"));
 assert.ok(panel.includes("history.replaceState"));
 assert.ok(panel.includes("navigator.clipboard"));
 assert.ok(panel.includes("'/yemen-map?region='+region.id+'#map'"));
 assert.ok(css.includes('@media(max-width:700px)'));
 assert.ok(css.includes('@media(max-width:365px)'));
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.equal(css.split('{').length,css.split('}').length);
});

test('the management editor publishes state comparison fields through the existing secure endpoint',()=>{
 const page=read('components/HistoryAdminPanel.jsx');
 const editor=read('components/history/HistoryComparisonEditor.jsx');
 const repository=read('lib/historyRepository.js');
 const api=read('app/api/admin/history/route.js');
 assert.ok(page.includes("form.kind==='state'&&<HistoryComparisonEditor"));
 assert.ok(page.includes("patch('comparison',value)"));
 assert.ok(editor.includes('HISTORY_COMPARISON_GROUPS'));
 assert.ok(editor.includes('source.url'));
 assert.ok(editor.includes('required={required}'));
 assert.ok(repository.includes('validateHistoryComparison(input.comparison,sources,input.kind)'));
 assert.ok(repository.includes("base?.comparison&&!Object.hasOwn(item,'comparison')"));
 assert.ok(api.includes('authorizeEditorRequest'));
 assert.ok(api.includes('writeHistoryEntry'));
});
