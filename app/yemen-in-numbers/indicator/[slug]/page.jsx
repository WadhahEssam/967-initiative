import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import ContextBackLink from '@/components/ContextBackLink';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {ArrowRight, ExternalLink} from 'lucide-react';
import IndicatorActions from '@/components/IndicatorActions';
import IndicatorEditorial from '@/components/IndicatorEditorial';
import InlineTarget from '@/components/inline/InlineTarget';
import Resilient from '@/components/front/Resilient';
import CorrectionLink from '@/components/CorrectionLink';
import Sparkline from '@/components/numbers/Sparkline';
import JumpNav from '@/components/knowledge/JumpNav';
import {getStatIndicator} from '@/lib/data';
import {shareCardPath} from '@/lib/shareCard';
import {formatArabicDate, formatNumber, formatYear} from '@/lib/format';
import {directionLabels, statusLabels, valueStatusLabels} from '@/lib/yemenNumbers';
import {detailPath, hasIndexableIndicator, pageMetadata} from '@/lib/seo';
import {breadcrumbSchema, indicatorSchema, JsonLd} from '@/lib/seo-schema';
import {dataStatusHelp,indicatorReading,sourceLabel} from '@/lib/indicatorPresentation';
import {indicatorMeasurementEvidence} from '@/lib/contentEvidence';
// Recharts loads only when a multi-year series is drawn (see LazyIndicatorChart);
// the value, table and sources are server-rendered before it.
import IndicatorChart from '@/components/numbers/LazyIndicatorChart';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}) {
  const {slug} = await params;
  const indicator = await getStatIndicator(slug);
  if (!indicator) notFound();
  return pageMetadata({title:indicator.name, description:indicator.short_description || indicator.definition, path:detailPath('yemen-in-numbers/indicator', indicator.slug), noindex:!hasIndexableIndicator(indicator), image:shareCardPath('indicator',indicator.slug,indicator.name,indicator.latestValue?.value,indicator.latestValue?.year,indicator.values?.length)});
}

export default async function IndicatorPage({params}) {
  const {slug} = await params;
  const indicator = await getStatIndicator(slug);
  if (!indicator) notFound();
  const latest = indicator.latestValue;
  const measurement=latest?indicatorMeasurementEvidence(latest.year):null;
  const latestDisplayValue = latest ? formatNumber(latest.value, {maximumFractionDigits: 3}) : null;
  const sourceIds = new Set(indicator.allValues.map(value => value.source_id));
  const yearCount=new Set(indicator.values.map(value=>value.year)).size;
  const path=detailPath('yemen-in-numbers/indicator',indicator.slug);
  return <KnowledgeTheme area="statistics"><div className="ed-page ed-indicator" style={{'--hue':'var(--c-teal)','--hue-2':'var(--c-indigo)'}}>
    <div className="ed-mesh" aria-hidden="true"/>
    <InlineTarget kind="statistic" id={indicator.id} slug={indicator.slug} title={indicator.name} href={path}/>
    <JsonLd data={indicatorSchema(indicator)}/>
    <JsonLd data={breadcrumbSchema([{name:'اليمن بالأرقام', path:'/yemen-in-numbers'}, {name:indicator.domain.name, path:detailPath('yemen-in-numbers', indicator.domain.slug)}, {name:indicator.name, path}])}/>
    <section className="ed-detailhead ed-indicator-head" aria-labelledby="indicator-title"><div className="ed-wrap">
      <ContextBackLink fallback={'/yemen-in-numbers/'+indicator.domain.slug} label={indicator.domain.name} className="ed-back" leading={<ArrowRight size={17} aria-hidden="true"/>}/>
      <div className="ed-indicator-grid">
        <div>
          <p className="ed-kicker">{indicator.domain.section?.name} · مؤشر وطني</p>
          <h1 id="indicator-title">{indicator.name}</h1>
          <p className="ed-dek">{indicator.short_description || indicator.definition}</p>
        </div>
        {latest ? <div className="ed-latest" aria-label="أحدث قيمة منشورة">
          <p className="ed-latest-label">أحدث قيمة منشورة</p>
          <p className="ed-figure ed-figure-xl" data-len={latestDisplayValue.length > 10 ? 'long' : undefined}><bdi dir="ltr">{latestDisplayValue}</bdi> <span>{indicator.unit}</span></p>
          <Sparkline points={indicator.values.map(value => ({year:Number(value.year), value:Number(value.value)}))} label={'اتجاه '+indicator.name}/>
          <p className="ed-meta"><span>سنة القياس <bdi>{formatYear(latest.year)}</bdi></span><span className="ed-status" data-tone={latest.value_status==='official'?'neutral':'caution'}>{valueStatusLabels[latest.value_status] || 'نوع القيمة غير محدد'}</span></p>
          <p className="ed-meta"><span>المصدر: {sourceLabel(latest.source||indicator.adopted_source,indicator.name)}</span></p>
        </div> : <div className="ed-latest"><p className="ed-latest-label">لا توجد قيمة منشورة</p><p className="ed-entry-missing">{indicator.hasSourceConflict?'بانتظار تحديد السلسلة المعتمدة.':'ستظهر القيمة بعد توثيقها ونشرها.'}</p></div>}
      </div>
      {measurement&&measurement.kind!=='recent'&&<p className="ed-unavailable" role="note">{measurement.message}</p>}
      <div className="ed-actions"><IndicatorActions indicator={indicator}/><ContentReadingAction kind="indicator" href={path} title={indicator.name}/></div>
      {indicator.updated_at && <p className="ed-record-date">آخر تحديث للسجل: {formatArabicDate(indicator.updated_at)} · سنة القياس موضحة بجانب القيمة.</p>}
    </div></section>
    <JumpNav items={[
      {href: '#series-title', title: 'القيم', icon: 'chart'},
      {href: '#factsheet-title', title: 'بطاقة المؤشر', icon: 'card'},
      indicator.editorial?.is_published && {href: '#indicator-reading', title: 'قراءة موسّعة', icon: 'reading'},
      indicator.values.length > 0 && {href: '#table-title', title: 'الجدول', icon: 'table'},
      {href: '#sources-title', title: 'المصادر', icon: 'sources'},
    ]}/>
    <KnowledgeNavigation/>

    <section className="ed-wrap ed-block" aria-labelledby="series-title">
      <p className="ed-reading">{indicatorReading(indicator)}</p>
      <div className="ed-series-layout">
        <div className="ed-chart-panel">
          <div className="ed-section-head"><h2 id="series-title">{yearCount>1?'القيم عبر السنوات':'قيمة سنة واحدة'}</h2><p>الوحدة: {indicator.unit}</p></div>
          {yearCount>1?<Resilient name="indicator-chart" label="تعذّر عرض الرسم. القيم كاملة في الجدول أدناه."><IndicatorChart values={indicator.values} unit={indicator.unit} type={indicator.chart_type}/></Resilient>:<p className="ed-single-year">{latest?`تتوفر قيمة معتمدة لسنة ${formatYear(latest.year)} فقط. تظهر تفاصيلها في الجدول أدناه.`:'لا توجد سلسلة معتمدة للرسم حالياً.'}</p>}
          {sourceIds.size > 1 && !indicator.adopted_source_id && <p className="ed-unavailable" role="note">توجد مصادر متعددة دون سلسلة معتمدة؛ أوقف الرسم حتى المراجعة. القيم الأصلية متاحة في CSV.</p>}
        </div>
        <aside className="ed-factsheet" aria-labelledby="factsheet-title">
          <h2 id="factsheet-title" className="ed-section-label">بطاقة المؤشر</h2>
          <dl>
            <div><dt>الوحدة</dt><dd>{indicator.unit}</dd></div>
            <div><dt>حالة البيانات</dt><dd>{statusLabels[indicator.data_status]}<small>{dataStatusHelp[indicator.data_status]}</small></dd></div>
            <div><dt>اتجاه التحسن</dt><dd>{directionLabels[indicator.improvement_direction]}</dd></div>
            {latest && <div><dt>طبيعة أحدث قيمة</dt><dd>{valueStatusLabels[latest.value_status]}</dd></div>}
            <div><dt>النطاق</dt><dd>الجمهورية اليمنية</dd></div>
          </dl>
        </aside>
      </div>
    </section>

    {indicator.editorial?.is_published&&<div className="ed-wrap" id="indicator-reading"><IndicatorEditorial data={indicator.editorial} indicatorName={indicator.name}/></div>}

    {indicator.values.length > 0 && <section className="ed-wrap ed-block" aria-labelledby="table-title">
      <div className="ed-section-head"><h2 id="table-title">البيانات المنشورة للسلسلة المعتمدة</h2><p>{formatNumber(indicator.values.length)} قيمة</p></div>
      <p className="knowledge-table-hint">مرّر الجدول أفقيًا للاطلاع على بقية الأعمدة.</p>
      <div className="ed-table-scroll" role="region" aria-label="الجدول الزمني للمؤشر" tabIndex={0}><table className="ed-table"><caption>{indicator.name} — النطاق الوطني: الجمهورية اليمنية؛ الوحدة: {indicator.unit}</caption><thead><tr><th scope="col">سنة القياس</th><th scope="col">القيمة</th><th scope="col">حالة القيمة</th><th scope="col">المصدر</th></tr></thead><tbody>{indicator.values.map((value, index) => <tr key={value.id || `${value.year}-${index}`}><th scope="row">{formatYear(value.year)}</th><td dir="ltr">{formatNumber(value.value, {maximumFractionDigits:3})}</td><td>{valueStatusLabels[value.value_status] || 'غير محددة'}</td><td>{value.source?.url ? <a href={value.source.url} target="_blank" rel="noopener noreferrer">{value.source.name || 'رابط المصدر'}</a> : value.source?.name || 'لم يُرفق مصدر'}</td></tr>)}</tbody></table></div>
    </section>}

    <section className="ed-wrap ed-block ed-notes" aria-labelledby="sources-title">
      <details className="ed-fold"><summary><span>التعريف والمنهجية</span></summary><div><p>{indicator.definition || 'لم يُضف تعريف تفصيلي لهذا المؤشر بعد.'}</p><p>{indicator.measurement_method || 'راجع وثيقة المصدر لطريقة القياس وحدود المقارنة.'}</p></div></details>
      <div className="ed-section-head"><h2 id="sources-title">المصادر والوثائق</h2></div>
      {indicator.sources.length ? <ul className="ed-sources">{indicator.sources.map(item => <li key={item.source_id}><div><strong>{sourceLabel(item.source,indicator.name)}</strong>{item.is_adopted && <span className="ed-status" data-tone="positive">السلسلة المعتمدة</span>}<details><summary>تفاصيل المصدر</summary><p>{item.methodology || item.source?.description || 'مصدر مستخدم في توثيق هذا المؤشر.'}</p></details></div>{item.source?.url && <a href={item.source.url} target="_blank" rel="noopener noreferrer">زيارة المصدر <ExternalLink size={15} aria-hidden="true"/></a>}</li>)}</ul>
        : latest?.source ? <ul className="ed-sources"><li><div><strong>{sourceLabel(latest.source,indicator.name)}</strong><p>{latest.methodology_note || 'مصدر أحدث قيمة منشورة.'}</p></div>{latest.source.url && <a href={latest.source.url} target="_blank" rel="noopener noreferrer">زيارة المصدر <ExternalLink size={15} aria-hidden="true"/></a>}</li></ul>
        : <p className="ed-single-year">لم تُضف تفاصيل المصدر بعد.</p>}
      <p className="ed-meta ed-doc-line">{latest?.document_url && <a className="ed-link" href={latest.document_url} target="_blank" rel="noopener noreferrer">وثيقة أحدث قيمة</a>}{latest?.publication_date && <span>تاريخ النشر: {formatArabicDate(latest.publication_date)}</span>}<CorrectionLink title={indicator.name} path={path} id={indicator.id} className="ed-correction"/></p>
    </section>
  </div></KnowledgeTheme>;
}
