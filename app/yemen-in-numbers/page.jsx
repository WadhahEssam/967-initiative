import NextLink from 'next/link';
import {countOf} from '@/lib/arabicCount';
import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import Link from '@/components/SiteLink';
import {pageMetadata} from '@/lib/seo';
import StatisticsExplorer from '@/components/StatisticsExplorer';
import FigureLedger from '@/components/numbers/FigureLedger';
import {KnowledgeReadingGuide} from '@/components/knowledge/KnowledgeGuides';
import {getStatIndicators, getStatSections, getSiteSettings} from '@/lib/data';
import {statisticsCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {formatNumber} from '@/lib/format';
import {indicatorListItem} from '@/lib/yemenNumbers';
import {filterIndicatorList, indicatorCardDetailsMap, indicatorIndexItem} from '@/lib/yemenNumbers';
import {pickDetails, versionedDetails} from '@/lib/deferredDetails';
import {readListState} from '@/lib/listState';

// Light rows for every indicator; values, sources and trend lines for the cards on the first page
// (default view and the filters in the address). /api/numbers/details brings the rest.
function numbersExplorerProps(listItems, indicators, searchParams = {}) {
 const {details, version} = versionedDetails(indicators, () => indicatorCardDetailsMap(listItems));
 const query = new URLSearchParams(Object.entries(searchParams || {}).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(item => [key, String(item)])));
 const state = readListState('?' + query.toString(), {q: '', domain: 'all', year: 'all', page: 1});
 const results = filterIndicatorList(listItems, state), page = Math.min(state.page, Math.max(1, Math.ceil(results.length / 12)));
 const first = [...filterIndicatorList(listItems).slice(0, 12), ...results.slice((page - 1) * 12, page * 12)];
 return {indicators: listItems.map(indicatorIndexItem), details: pickDetails(details, first.map(item => item.id)), detailsUrl: '/api/numbers/details?v=' + version};
}

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({title:'اليمن بالأرقام', description:'مؤشرات وطنية عن اليمن مع المصدر وسنة القياس والمنهجية والسلسلة الزمنية عند توفر البيانات.', path:'/yemen-in-numbers'});

export default async function YemenInNumbersPage({searchParams}) {
 const [sections, indicators, settings] = await Promise.all([getStatSections(), getStatIndicators(), getSiteSettings()]);
 const withValues = indicators.filter(x => x.allValues.length > 0);
 const conflicts = indicators.filter(x => x.hasSourceConflict).length;
 const highlights = indicators.filter(x=>x.latestValue).sort((a,b) => Number(b.latestValue.year) - Number(a.latestValue.year)).slice(0,3);
 // Bounded client payload: one card-sized record per indicator, no time series.
 const listItems = indicators.map(indicatorListItem);
 const domainSections = sections.map(section => ({id:section.id, name:section.name, domains:section.domains.map(domain => ({id:domain.id, name:domain.name}))}));
 return <KnowledgeTheme area="statistics"><div className="ed-page ed-numbers" style={{'--hue':'var(--c-teal)','--hue-2':'var(--c-indigo)'}}>
  <div className="ed-mesh" aria-hidden="true"/>
  <header className="ed-pagehead"><div className="ed-wrap">
   <nav aria-label="مسار التصفح"><ol className="ed-crumbs"><li><NextLink href="/">الرئيسية</NextLink></li><li>المعرفة</li><li aria-current="page">اليمن بالأرقام</li></ol></nav>
   <h1>اليمن بالأرقام</h1>
   <p className="ed-dek">وراء كل رقم سياق. ابحث عن مؤشر، راجع مصدره وسنة قياسه، وافهم كيف تغيّر عبر الزمن. جميع البيانات على مستوى الجمهورية اليمنية.</p>
   <dl className="ed-facts">
    <div><dt>مؤشرات منشورة</dt><dd>{formatNumber(indicators.length)}</dd></div>
    <div><dt>لها قيم منشورة</dt><dd>{formatNumber(withValues.length)}</dd></div>
    {indicators.length > withValues.length && <div><dt>دون قيم بعد</dt><dd>{formatNumber(indicators.length - withValues.length)}</dd></div>}
    {indicators.some(x=>x.hasSourceConflict) && <div><dt>بانتظار اعتماد المصدر</dt><dd>{formatNumber(conflicts)}</dd></div>}
   </dl>
   <p className="ed-head-links"><Link href="/yemen-in-numbers/timeline" className="ed-link">قارن المؤشرات عبر الزمن</Link><Link href="/yemen-ranking" className="ed-link">ترتيب اليمن عالميًا</Link></p>
  </div></header>
  <KnowledgeNavigation/>

  <section className="ed-wrap ed-block" id="indicators" aria-labelledby="indicators-title">
   <div className="ed-section-head"><h2 id="indicators-title">فهرس المؤشرات</h2></div>
   <StatisticsExplorer {...numbersExplorerProps(listItems, indicators, await searchParams)} sections={domainSections}/>
  </section>

  {highlights.length > 0 && <section className="ed-wrap ed-block" aria-labelledby="latest-title">
   <div className="ed-section-head"><h2 id="latest-title">أحدث سنوات القياس</h2><p>القيمة الأحدث في السلسلة المعتمدة، وليست تاريخ تحديث السجل.</p></div>
   <FigureLedger indicators={highlights.map(indicatorListItem)}/>
  </section>}

  <KnowledgeReadingGuide kind="statistics"/>


  <section className="ed-wrap ed-block" aria-labelledby="domains-title">
   <div className="ed-section-head"><h2 id="domains-title">المجالات</h2><p>تصفّح المؤشرات بحسب ما يهمك.</p></div>
   <ul className="ed-domains">{sections.map(section => <li key={section.id}><details>
    <summary><span className="ed-domain-name">{section.name}</span><span className="ed-domain-count">{countOf(section.domains.length,'domain')}</span></summary>
    {section.description && <p>{section.description}</p>}
    <ul className="ed-domain-links">{section.domains.map(domain => <li key={domain.id}><Link href={'/yemen-in-numbers/' + domain.slug}>{domain.name}</Link></li>)}</ul>
   </details></li>)}</ul>
  </section>

  <section className="ed-wrap ed-block ed-method" aria-labelledby="method-title">
   <h2 id="method-title" className="ed-section-label">المصادر والمنهجية: ماذا تعني الأرقام المعروضة؟</h2>
   <div className="ed-method-cols">
    <p>تعرض كل قائمة أحدث قيمة فعلية في السلسلة المعتمدة، مع سنة القياس، وليست سنة تحديث السجل. الصفر قيمة صحيحة، والقيم المفقودة لا تُعوّض بتقديرات. تُميّز القيم التقديرية عن الرسمية. عند تعارض المصادر دون اعتماد سلسلة، يتوقف العرض الرقمي حتى المراجعة.</p>
    <p>العدادات تخص المؤشرات المنشورة المتاحة للزائر. لا تُعد المؤشرات الفارغة أو المتعارضة ذات سلسلة معتمدة. راجع صفحة كل مؤشر للتعريف والمنهجية والمراجع. جميع المؤشرات وطنية ولا تمثل إحصاءات المحافظات.</p>
   </div>
  </section>
  <div className="ed-wrap"><CrossSectionPaths items={statisticsCrossLinks(settings.pageVisibility)} id="numbers-cross-paths" title="تعلّم كيف تقرأ هذه الأرقام"/></div>
 </div></KnowledgeTheme>;
}
