import Link from '@/components/SiteLink';
import {formatCompact, formatNumber, formatYear} from '@/lib/format';
import {statusLabels, valueStatusLabels} from '@/lib/yemenNumbers';
import {sourceLabel, dataStatusHelp} from '@/lib/indicatorPresentation';
import {indicatorMeasurementEvidence} from '@/lib/contentEvidence';
import SaveForLater from '@/components/reading/SaveForLater';
import Sparkline from './Sparkline';

// One indicator card: what it is, the latest number with its trend, and the
// evidence that qualifies it (year, source, kind of value, data status).
export default function IndicatorEntry({indicator, detailsStatus = 'ready'}) {
  const latest = indicator.latestValue;
  const href = '/yemen-in-numbers/indicator/' + indicator.slug;
  const evidence = latest ? indicatorMeasurementEvidence(latest.year) : null;
  const dated = evidence && ['historical', 'older', 'future'].includes(evidence.kind);
  const valueText = !latest ? '' : Math.abs(Number(latest.value)) >= 1e6 ? formatCompact(latest.value) : formatNumber(latest.value, {maximumFractionDigits: 2});
  return <article className="ed-entry">
    <p className="ed-entry-top"><span className="ed-kicker">{indicator.domain?.name || 'مؤشر وطني'}</span><span className="ed-status" data-tone={indicator.data_status === 'complete' ? 'positive' : 'neutral'} title={dataStatusHelp[indicator.data_status]}>البيانات: {statusLabels[indicator.data_status] || indicator.data_status}</span></p>
    <h3 className="ed-entry-title"><Link href={href}>{indicator.name}</Link></h3>
    <p className="ed-entry-desc">{indicator.short_description || indicator.definition || 'بيانات وطنية موثقة على مستوى الجمهورية اليمنية.'}</p>
    {indicator.pending ? <p className="ed-entry-missing" role="status">{detailsStatus === 'failed' ? 'تعذر تحميل القيمة. المس الصفحة للمحاولة مجددًا.' : 'جارٍ تحميل القيمة…'}</p> : latest ? <div className="ed-entry-figure">
      <p className="ed-figure" data-len={valueText.length > 10 ? 'long' : undefined}><bdi dir="ltr">{valueText}</bdi> <span>{indicator.unit}</span></p>
      <Sparkline points={indicator.spark} label={'اتجاه ' + indicator.name}/>
    </div> : <p className="ed-entry-missing">{indicator.hasSourceConflict ? 'بانتظار تحديد السلسلة المعتمدة' : 'لم تُنشر قيم لهذا المؤشر بعد'}</p>}
    <div className="ed-entry-foot">
      {latest && <span className="ed-chip-data"><span>سنة القياس <bdi>{formatYear(latest.year)}</bdi></span></span>}
      {latest && <span className="ed-status" data-tone={latest.value_status === 'official' ? 'neutral' : 'caution'}>{valueStatusLabels[latest.value_status] || 'نوع القيمة غير محدد'}</span>}
      {!indicator.pending && <span className="ed-chip-data ed-entry-source"><span>المصدر: {sourceLabel(latest?.source || indicator.adopted_source, indicator.name)}</span></span>}
      <span className="ed-entry-save"><SaveForLater compact item={{kind: 'indicator', href: '/yemen-in-numbers/indicator/' + encodeURIComponent(indicator.slug), title: indicator.name}}/></span>
    </div>
    {dated && <p className="ed-entry-note" role="note">{evidence.message}</p>}
  </article>;
}
