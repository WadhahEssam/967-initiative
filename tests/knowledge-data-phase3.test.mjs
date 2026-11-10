import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('app/knowledge-data.css');

test('stage-three stylesheet only targets statistics and rankings and preserves shared identity',()=>{
 // Legacy sheets now load per route through app/legacy-styles.js, not the root layout.
 assert.ok(read('app/legacy-styles.js').includes("import './knowledge-data.css';"));
 assert.ok(!read('app/layout.jsx').includes('knowledge-data.css'));
 assert.ok(read('app/knowledge-identity.css').includes('[data-knowledge-area="statistics"]'));
 assert.ok(read('app/knowledge-identity.css').includes('[data-knowledge-area="ranking"]'));
 assert.ok(css.includes('[data-knowledge-area="statistics"]'));
 assert.ok(css.includes('[data-knowledge-area="ranking"]'));
 assert.ok(!css.includes(':root'));
 assert.ok(!css.includes('.site-header'));
 assert.ok(!css.includes('.platform-footer'));
 assert.ok(!css.includes('[data-knowledge-area="history"]'));
 assert.ok(!css.includes('[data-knowledge-area="atlas"]'));
 assert.ok(!css.includes('[data-knowledge-area="figures"]'));
});

test('the national indicator catalogue retains its published values, status and source evidence',()=>{
 // The redesigned list renders IndicatorEntry rows; IndicatorCard still serves the domain page.
 const card=read('components/IndicatorCard.jsx')+read('components/numbers/IndicatorEntry.jsx');
 const explorer=read('components/StatisticsExplorer.jsx');
 const page=read('app/yemen-in-numbers/page.jsx');
 for(const token of ['indicator.latestValue','formatNumber(latest.value','formatYear(latest.year)','valueStatusLabels[latest.value_status]','dataStatusHelp[indicator.data_status]','sourceLabel(latest?.source','indicatorMeasurementEvidence(latest.year)','SaveForLater'])assert.ok(card.includes(token),token);
 assert.ok(card.includes("dir=\"ltr\""));
 assert.ok(explorer.includes('filterIndicatorList(indicators, {q: query, domain, year})'));
 assert.ok(read('lib/yemenNumbers.js').includes('rankSearchResults(q, candidates)'));
 assert.ok(explorer.includes('Pagination page={currentPage}'));
 assert.ok(explorer.includes("useListState({q:'',domain:'all',year:'all',page:1})"));
 assert.ok(page.includes('indicators.filter(x=>x.latestValue)'));
 assert.ok(page.includes("indicator.hasSourceConflict")||page.includes('indicators.some(x=>x.hasSourceConflict)'));
});

test('indicator cards have distinct metric, year, domain and source but status colors remain semantic',()=>{
 for(const sel of ['.stat-indicator-grid .saveable-card','.stat-card-top>span:first-child','.stat-card-value','.stat-value-context','.stat-card-meta','.stat-card-empty','.stat-toolbar'])assert.ok(css.includes('[data-knowledge-area="statistics"] '+sel),sel);
 assert.ok(css.includes('.stat-value-kind{'));
 assert.ok(css.includes('/* Never infer quality from a value.'));
 assert.ok(!css.includes('.stat-status-complete{'));
 assert.ok(!css.includes('.stat-status-limited{'));
 assert.ok(!css.includes('.stat-status-discontinued{'));
 assert.ok(css.includes('min-width:0'));
});

test('statistics detail and timeline pages have a section identity and only one navigation',()=>{
 for(const path of ['app/yemen-in-numbers/[slug]/page.jsx','app/yemen-in-numbers/indicator/[slug]/page.jsx','app/yemen-in-numbers/timeline/page.jsx']){
  const source=read(path);
  assert.ok(source.includes('<KnowledgeTheme area="statistics">'),path);
  assert.equal((source.match(/<KnowledgeNavigation\/>/g)||[]).length,1,path);
  assert.equal((source.match(/<\/KnowledgeTheme>/g)||[]).length,1,path);
  assert.ok(source.indexOf('<KnowledgeNavigation/>')>source.indexOf('</section>'),path);
 }
 const detail=read('app/yemen-in-numbers/indicator/[slug]/page.jsx');
 for(const token of ['IndicatorChart values={indicator.values}','indicator.values.map','sourceLabel(item.source','indicator.adopted_source_id','valueStatusLabels[value.value_status]','ContentReadingAction'])assert.ok(detail.includes(token),token);
 const timeline=read('components/TimelineExplorer.jsx');
 assert.ok(timeline.includes('connectNulls={false}'));
 assert.ok(timeline.includes('indicator.unit !== activeUnit'));
 assert.ok(timeline.includes('timelineRows(selected, fromYear, toYear, effectiveMode)'));
});

test('ranking table and neighbor graph emphasize Yemen without manipulating positions',()=>{
 const explorer=read('components/YemenRankingExplorer.jsx');
 for(const token of ['buildRanking','getYemenNeighborhood','rankingBarGeometry(rows)','rankingHistoryPoints(dataset.values)','yemen.rank','row.code===\'YEM\'','rank','tieCount','year','source.url'])assert.ok(explorer.includes(token),token);
 for(const token of ['.yr-neighbors>li.is-yemen','.yr-rank-card','.yr-coverage','.yr-comparison-values>div:first-child','.yr-table-scroll tr.is-yemen','.yr-methodology','.yr-controls'])assert.ok(css.includes('[data-knowledge-area="ranking"] '+token),token);
 assert.ok(css.includes('/* Rankings: use indigo for section identity, not as a score of good/bad. */'));
 assert.ok(!css.includes('order:reverse'));
 assert.ok(!css.includes('.yr-table-scroll{display:none'));
 assert.ok(!css.includes('.yr-neighbors{display:none'));
 assert.ok(!css.includes('content:"أفضل"'));
});

test('ranking interaction, source attribution and missing-value behavior remain intact',()=>{
 const explorer=read('components/YemenRankingExplorer.jsx');
 for(const token of ['aria-pressed={selection.scope','onChange={event=>selectMetric(event.target.value)}','onClick={()=>setExpanded(value=>!value)}','aria-controls={listId}','className="yr-table-scroll"','رقماً','مصدر','القيم المفقودة','getDefaultRankingYear','onClick={()=>commit({year:latestYemen})}'])assert.ok(explorer.includes(token),token);
 assert.ok(explorer.includes("if(!indicators.length)return"));
 assert.ok(explorer.includes('yemen?<div className="yr-rank-card"'));
 assert.ok(explorer.includes('role="alert"'));
 assert.ok(explorer.includes('role="status"'));
});

test('mobile refinements and readable keyboard controls do not hide the real tables',()=>{
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(css.includes('@media(max-width:380px)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 // Redesign v2 removed the old results head, domain accordion and series table markup; their dead rules went with it.
 assert.ok(read('components/YemenRankingExplorer.jsx').includes('className="yr-table-hint"'));
 assert.ok(read('app/yemen-in-numbers/indicator/[slug]/page.jsx').includes('className="knowledge-table-hint"'));
 assert.ok(css.includes(':focus-visible'));
 const ranks=read('components/YemenRanking.css');
 assert.ok(ranks.includes('.yr-table-scroll{overflow-x:auto;max-width:100%'));
 assert.ok(ranks.includes('min-width:570px'));
 const indicator=read('app/yemen-in-numbers/indicator/[slug]/page.jsx');
 assert.ok(indicator.includes('role="region" aria-label="الجدول الزمني للمؤشر" tabIndex={0}'));
});
