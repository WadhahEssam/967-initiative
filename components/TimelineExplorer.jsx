'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {AlertTriangle, Check, Download, ImageDown, SlidersHorizontal} from 'lucide-react';
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {csvEscape} from '@/lib/yemenNumbers';
import {formatNumber, formatYear, formatCompact} from '@/lib/format';
import {canComparePercent, timelineRows} from '@/lib/timeline';
import {matchesSearch} from '@/lib/search';
import {timelineChartPng} from '@/lib/timelineExport';

const colors = ['#176b75', '#a56c12', '#287e62', '#3e70af'];

function downloadBlob(content, type, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], {type}));
  link.download = name;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function TimelineExplorer({indicators}) {
  const available = useMemo(() => indicators.filter(item => item.values?.length), [indicators]);
  const initial = available.length ? [available[0].id] : [];
  const [selectedIds, setSelectedIds] = useState(initial);
  const [filter, setFilter] = useState('');
  // About 300 indicators: a search box, and the chosen ones first, so the chart stays in reach on a phone.
  const listed = useMemo(() => {
    const chosen = available.filter(item => selectedIds.includes(item.id));
    const rest = available.filter(item => !selectedIds.includes(item.id) && (!filter.trim() || matchesSearch(filter, [item.name, item.unit])));
    return [...chosen, ...rest];
  }, [available, selectedIds, filter]);
  const [mode, setMode] = useState('actual');
  const allYears = [...new Set(available.flatMap(item => item.values.map(value => Number(value.year))).filter(Number.isInteger))].sort((a, b) => a - b);
  const latestYear = allYears.at(-1) || new Date().getFullYear();
  const earliestYear = allYears[0] || 1990;
  const [fromYear, setFromYear] = useState(earliestYear);
  const [toYear, setToYear] = useState(latestYear);
  const chartRef = useRef(null);
  const [exportMessage,setExportMessage] = useState('');
  const [exporting,setExporting] = useState(false);
  const selected = useMemo(() => available.filter(item => selectedIds.includes(item.id)), [available,selectedIds]);
  const activeUnit = selected[0]?.unit || '';
  const percentageValid = canComparePercent(selected, fromYear, toYear);
  const effectiveMode = mode === 'percent' && percentageValid ? 'percent' : 'actual';
  useEffect(() => {if(!percentageValid)setMode('actual');}, [percentageValid]);
  const chartData = useMemo(() => timelineRows(selected, fromYear, toYear, effectiveMode), [fromYear,effectiveMode,selected,toYear]);

  function toggleIndicator(indicator) {
    setSelectedIds(current => {
      if (current.includes(indicator.id)) return current.filter(id => id !== indicator.id);
      if (current.length >= 4 || (activeUnit && indicator.unit !== activeUnit)) return current;
      return [...current, indicator.id];
    });
  }
  function exportCsv() {
    const header = ['year', ...selected.map(item => `${item.name} (${effectiveMode==='percent'?'%':item.unit})`)];
    const csv = '\ufeff' + [header, ...chartData.map(row => [row.year, ...selected.map(item => row[item.id] ?? '')])].map(row => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(csv, 'text/csv;charset=utf-8', 'yemen-across-time.csv');
  }
  async function exportImage() {
    if(exporting)return;
    setExporting(true);setExportMessage('جارٍ تجهيز صورة الرسم…');
    try{
      const blob=await timelineChartPng({chartElement:chartRef.current,fromYear,toYear,unit:activeUnit,percent:effectiveMode==='percent',series:selected.map((item,index)=>({name:item.name,source:item.source,color:colors[index]}))});
      downloadBlob(blob,'image/png','yemen-across-time.png');
      setExportMessage('تم تجهيز صورة الرسم مع الفترة والوحدة والمصادر.');
    }catch{
      setExportMessage('تعذر تصدير الصورة في هذا المتصفح. يمكنك تنزيل CSV.');
    }finally{setExporting(false);}
  }

  if (!available.length) return <div className="stat-empty"><SlidersHorizontal size={30}/><h3>لا توجد سلاسل زمنية منشورة بعد</h3><p>ستصبح المقارنة متاحة تلقائياً بعد نشر قيم سنوية لمؤشر واحد على الأقل.</p></div>;
  return <div className="timeline-explorer">
    <aside className="timeline-controls">
      <h2><SlidersHorizontal size={20}/> إعداد المقارنة</h2>
      <p>اختر حتى 4 مؤشرات من الوحدة نفسها لتجنب مقارنة مضللة.</p>
      <label className="timeline-filter"><span className="sr-only">ابحث في المؤشرات</span><input type="search" value={filter} onChange={event => setFilter(event.target.value)} placeholder="ابحث عن مؤشر: السكان، التضخم…" style={{width: '100%', minHeight: 44, boxSizing: 'border-box', marginBottom: 10, padding: '0 12px', borderRadius: 12, border: '1px solid var(--c-line,#d9d2c6)', font: 'inherit', background: 'var(--c-surface,#fff)', color: 'inherit'}}/></label>
      <div className="timeline-indicator-list" style={{maxHeight: 'min(55vh, 440px)', overflowY: 'auto'}}>{listed.map(indicator => {
        const checked = selectedIds.includes(indicator.id);
        const incompatible = !checked && Boolean(activeUnit && indicator.unit !== activeUnit);
        return <label className={incompatible ? 'disabled' : ''} key={indicator.id}><input type="checkbox" checked={checked} disabled={incompatible || (!checked && selectedIds.length >= 4)} onChange={() => toggleIndicator(indicator)}/><span className="timeline-check">{checked && <Check size={14}/>}</span><span><strong>{indicator.name}</strong><small>{indicator.unit}{incompatible ? ' · وحدة مختلفة' : ''}</small></span></label>;
      })}</div>
    </aside>
    <section className="timeline-stage">
      <div className="timeline-toolbar">
        <label>من<select value={fromYear} onChange={event => {const next = Number(event.target.value); setFromYear(next); if (next > toYear) setToYear(next);}}>{Array.from({length: latestYear - earliestYear + 1}, (_, index) => earliestYear + index).map(year => <option key={year}>{year}</option>)}</select></label>
        <label>إلى<select value={toYear} onChange={event => {const next = Number(event.target.value); setToYear(next); if (next < fromYear) setFromYear(next);}}>{Array.from({length: latestYear - earliestYear + 1}, (_, index) => earliestYear + index).map(year => <option key={year}>{year}</option>)}</select></label>
        <div className="stat-segmented" role="group" aria-label="طريقة المقارنة"><button className={effectiveMode === 'actual' ? 'selected' : ''} aria-pressed={effectiveMode==='actual'} onClick={() => setMode('actual')}>القيمة الفعلية</button><button disabled={!percentageValid} className={effectiveMode === 'percent' ? 'selected' : ''} aria-pressed={effectiveMode==='percent'} onClick={() => setMode('percent')}>نسبة التغير</button></div>
        <button title="تنزيل CSV" aria-label="تنزيل CSV" onClick={exportCsv} disabled={!selected.length}><Download size={18}/></button>
        <button title="تنزيل الرسم كصورة" aria-label="تنزيل الرسم كصورة" onClick={exportImage} disabled={!selected.length||exporting} aria-busy={exporting}><ImageDown size={18}/></button>
      </div>
      {!percentageValid && selected.length > 0 && <p className="stat-warning"><AlertTriangle size={17}/> لا تتاح نسبة التغير عندما تكون قيمة الأساس صفراً أو غير موجودة.</p>}
      <div className="timeline-chart" ref={chartRef} role="group" aria-label="رسم مقارنة المؤشرات عبر السنوات">
        {selected.length ? <ResponsiveContainer width="100%" height={460}><LineChart data={chartData}><CartesianGrid stroke="#d9dfd9" vertical={false}/><XAxis dataKey="year" tickFormatter={formatYear} stroke="#5e6b6d"/><YAxis tickFormatter={value => formatCompact(value)} stroke="#5e6b6d" width={70}/><Tooltip labelFormatter={formatYear} formatter={value => [formatNumber(value, {maximumFractionDigits: 2}) + (effectiveMode === 'percent' ? '%' : ` ${activeUnit}`), '']}/><Legend/>{selected.map((indicator, index) => <Line key={indicator.id} dataKey={indicator.id} name={indicator.name} stroke={colors[index]} strokeWidth={2.5} connectNulls={false} dot={{r: 3}}/>)}</LineChart></ResponsiveContainer> : <div className="stat-chart-empty"><p>اختر مؤشراً واحداً على الأقل.</p></div>}
      </div>
      {exportMessage&&<p role="status" className="stat-warning">{exportMessage}</p>}
      {selected.length>0&&<details className="timeline-data"><summary>عرض بيانات المقارنة في جدول</summary><div className="table-scroll"><table><caption>القيم المعروضة ({effectiveMode==='percent'?'نسبة التغير من أول قيمة متاحة في الفترة':activeUnit})</caption><thead><tr><th scope="col">السنة</th>{selected.map(item=><th scope="col" key={item.id}>{item.name}</th>)}</tr></thead><tbody>{chartData.map(row=><tr key={row.year}><th scope="row">{formatYear(row.year)}</th>{selected.map(item=><td key={item.id}>{row[item.id]===null?'غير متوفر':formatNumber(row[item.id],{maximumFractionDigits:3})}</td>)}</tr>)}</tbody></table></div></details>}
      <div className="timeline-sources">{selected.map(item => <span key={item.id}><b>{item.name}:</b> {item.source || 'المصدر غير محدد'}</span>)}</div>
      <p className="timeline-note">الفراغات في الخط الزمني تعني عدم وجود قيمة منشورة. لا تُستكمل السنوات المفقودة ولا تُقدّر آلياً.</p>
    </section>
  </div>;
}
