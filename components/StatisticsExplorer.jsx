'use client';

import {useEffect, useMemo} from 'react';
import IndicatorEntry from '@/components/numbers/IndicatorEntry';
import {formatNumber} from '@/lib/format';
import {formatYear} from '@/lib/format';
import {filterIndicatorList} from '@/lib/yemenNumbers';
import useDeferredDetails,{withDetails} from './useDeferredDetails';
import Pagination from './Pagination';
import useListState from './useListState';
import ExplorationProgress, {useExplorationTrail} from './ExplorationProgress';
import ActiveFilters from './ActiveFilters';

// Receives card-sized records (lib/yemenNumbers indicatorListItem): latest
// adopted value, measured years and short text — never whole time series.
export default function StatisticsExplorer({indicators: index, details: initialDetails, detailsUrl, sections}) {
  const {details, status, load} = useDeferredDetails(detailsUrl, initialDetails);
  const indicators = useMemo(() => withDetails(index, details, 'id'), [index, details]);
  const [{q:query,domain,year,page},update]=useListState({q:'',domain:'all',year:'all',page:1});
  const availableDomains = useMemo(() => sections.flatMap(section => section.domains).filter(item => indicators.some(indicator => indicator.domain_id === item.id)), [sections, indicators]);
  const [exploredDomains, exploreDomain, restartTour, tourSaved] = useExplorationTrail('967-data-tour-v1', availableDomains);
  const explorationGoal = Math.min(3, availableDomains.length);
  const setQuery=q=>update({q,page:1}),setDomain=domain=>update({domain,page:1}),setYear=year=>update({year,page:1}),setPage=page=>update({page});
  const years = useMemo(() => [...new Set(indicators.flatMap(item => item.years || []))].sort((a, b) => b - a), [indicators]);
  const visible = useMemo(() => filterIndicatorList(indicators, {q: query, domain, year}), [domain, indicators, query, year]);
  const currentPage=Math.min(page,Math.max(1,Math.ceil(visible.length/12)));

  useEffect(() => {
    const selected = availableDomains.find(item => item.id === domain);
    if (selected && visible.length > 0) exploreDomain(selected.id, selected.name);
  }, [domain, availableDomains, visible.length, exploreDomain]);

  // Any use of the list fetches the remaining cards' values at once.
  return <div className="ed-stat-explorer" onPointerDownCapture={load} onFocusCapture={load}>
    <div className="ed-filters" role="search">
      <label className="ed-field"><span>ابحث في المؤشرات</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="مثل: السكان، التضخم، الكهرباء"/></label>
      <label className="ed-field"><span>المجال</span><select value={domain} onChange={event => setDomain(event.target.value)}><option value="all">كل المجالات</option>{sections.map(section => <optgroup key={section.id} label={section.name}>{section.domains.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label>
      <label className="ed-field"><span>لها قيمة منشورة في</span><select value={year} onChange={event => setYear(event.target.value)}><option value="all">كل السنوات</option>{years.map(item => <option key={item} value={item}>{formatYear(item)}</option>)}</select></label>
    </div>
    <ActiveFilters filters={[query&&{key:'q',label:'البحث: '+query,onRemove:()=>setQuery('')},domain!=='all'&&{key:'domain',label:'المجال: '+(sections.flatMap(section=>section.domains).find(item=>item.id===domain)?.name||'غير متاح'),onRemove:()=>setDomain('all')},year!=='all'&&{key:'year',label:'سنة القياس: '+(formatYear(year)||year),onRemove:()=>setYear('all')}]} onClear={()=>update({q:'',domain:'all',year:'all',page:1})}/>
    <p className="ed-results" aria-live="polite"><strong>المؤشرات المطابقة: {formatNumber(visible.length)}</strong><span>النطاق الجغرافي: الجمهورية اليمنية</span></p>
    {visible.length ? <ol className="ed-index">{visible.slice((currentPage-1)*12,currentPage*12).map(indicator => <li key={indicator.id}><IndicatorEntry indicator={indicator} detailsStatus={status}/></li>)}</ol> : <div className="ed-empty"><h3>لا توجد مؤشرات مطابقة</h3><p>{indicators.length ? 'غيّر كلمات البحث أو عوامل التصفية.' : 'لم تُنشر مؤشرات رقمية بعد. ستظهر هنا بعد توثيقها ونشرها من لوحة التحرير.'}</p></div>}
    <Pagination page={currentPage} count={visible.length} onChange={setPage}/>
    {explorationGoal > 1 && <div className="ed-tour"><ExplorationProgress items={exploredDomains} goal={explorationGoal} tone="blue" title="صورة أوسع، مجالًا بعد مجال." description="غيّر المجال في القائمة أعلاه، وتعرّف على مؤشرات من جوانب مختلفة للحياة في اليمن." completeLabel="أكملت جولتك بين مجالات البيانات!" onRestart={restartTour} persistent={tourSaved}/></div>}
  </div>;
}
