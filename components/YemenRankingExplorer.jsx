'use client';

import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import InlineTarget from './inline/InlineTarget';
import {ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, Download, Globe2, Info, LoaderCircle, MapPin, RotateCcw, Search, Share2, X} from 'lucide-react';
import {rankingCategories} from '@/lib/rankingCatalog';
import {buildRanking, getDefaultRankingYear, getRankingYears, getYemenNeighborhood, validateRankingDataset} from '@/lib/rankings';
import {formatArabicDate, formatCompact, formatNumber, formatYear} from '@/lib/format';
import {matchesSearch} from '@/lib/search';
import {rankingBarGeometry, rankingHistoryPoints, rankingLocation, rankingSharePath} from '@/lib/rankingUi';
import {splitRankingDescription} from '@/lib/rankingEditorial';
import {csvEscape} from '@/lib/yemenNumbers';
import './YemenRanking.css';

// Millions and billions are rounded for reading ("21.6 مليار"); the CSV export keeps raw values.
const number = value => Math.abs(Number(value)) >= 1e6 ? formatCompact(value) : formatNumber(value, {maximumFractionDigits: 3});
const scopeName = scope => scope === 'arab' ? 'الدول العربية' : 'العالم';
const countryName = (countries, code) => countries.find(item => item.code === code)?.name || code;

function changeAddress(selection, replace = false) {
  const path = rankingSharePath(selection);
  if (window.location.pathname + window.location.search !== path) window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', path);
}

function Flag({country}) {
  // ISO codes remain a readable fallback on systems without flag glyphs.
  const code = country?.iso2;
  if (!/^[A-Z]{2}$/i.test(code || '')) return <span className="yr-country-code" aria-hidden="true">{country?.code}</span>;
  return <span className="yr-flag" aria-hidden="true">{[...code.toUpperCase()].map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('')}</span>;
}

function NeighborBars({rows, countries, unit}) {
  const geometry = rankingBarGeometry(rows);
  return <ol className="yr-neighbors">{rows.map(row => <li key={row.code} className={row.code === 'YEM' ? 'is-yemen' : ''}>
    <div className="yr-neighbor-heading"><span className="yr-neighbor-place">{formatNumber(row.rank)}</span><Flag country={countries.find(item => item.code === row.code)}/><strong>{row.name}</strong>{row.code === 'YEM' && <span className="yr-you">اليمن</span>}<b dir="ltr">{number(row.value)}</b></div>
    <div className="yr-value-track" aria-hidden="true"><span className="yr-zero" style={{left: geometry.baseline + '%'}}/><span className="yr-value-bar" style={{left: geometry.bars[row.code].left + '%', width: geometry.bars[row.code].width + '%'}}/></div>
    <span className="sr-only">الوحدة: {unit}{row.tieCount > 1 ? '، مرتبة مشتركة' : ''}</span>
  </li>)}</ol>;
}

function History({dataset, currentYear}) {
  const points = useMemo(() => rankingHistoryPoints(dataset.values), [dataset]);
  if (points.length < 2) return null;
  return <div className="yr-history"><div><h3>قيمة اليمن عبر السنوات</h3><p>الفراغات تعني غياب قيمة منشورة؛ لا نصل بين سنوات متباعدة.</p></div>
    <svg viewBox="0 0 700 170" role="img" aria-label={`قيم اليمن المتاحة من ${points[0].year} إلى ${points.at(-1).year}`}>
      <line x1="12" x2="688" y1="150" y2="150" className="yr-history-axis"/>
      {points.slice(1).map((point,index) => point.year - points[index].year === 1 && <line key={'line'+point.year} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} className="yr-history-line"/>)}
      {points.map(point => <circle key={point.year} cx={point.x} cy={point.y} r={point.year === currentYear ? 5 : 3.5} className={point.year === currentYear ? 'yr-history-point is-current' : 'yr-history-point'}><title>{`${point.year}: ${number(point.value)}`}</title></circle>)}
      <text x="12" y="168" textAnchor="start">{points[0].year}</text><text x="688" y="168" textAnchor="end">{points.at(-1).year}</text>
    </svg>
  </div>;
}

function wrapCanvasText(context, text, maxWidth) {
  const lines=[];let line='';
  for(const word of String(text || '').split(/\s+/)) {const next=line?line+' '+word:word;if(line&&context.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);return lines;
}

async function rankingCardImage({indicator,dataset,yemen,rows,neighbors,year,scope}) {
  await document.fonts?.ready;
  const canvas=document.createElement('canvas');canvas.width=1440;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
  const font='"IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
  context.font=`bold 42px ${font}`;
  const title=wrapCanvasText(context,indicator.name,1260);
  context.font=`24px ${font}`;
  const sourceLines=wrapCanvasText(context,'المصدر: '+dataset.source.name+' · '+dataset.source.url,1260);
  const titleHeight=title.length*62, rowHeight=78;
  canvas.height=440+titleHeight+neighbors.length*rowHeight+sourceLines.length*38+100;
  context.fillStyle='#F7F4EC';context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle='#176B75';context.fillRect(0,0,canvas.width,12);
  context.direction='rtl';context.textAlign='right';context.textBaseline='top';
  context.font=`bold 25px ${font}`;context.fillText('مبادرة 967 / اليمن بين العالم',1350,48);
  context.fillStyle='#28343A';context.font=`bold 42px ${font}`;
  title.forEach((line,index)=>context.fillText(line,1350,105+index*62));
  const y=125+titleHeight;
  context.font=`26px ${font}`;context.fillStyle='#5e6b6d';context.fillText(`سنة القياس: ${year} · النطاق: ${scopeName(scope)}`,1350,y);
  context.fillStyle='#176B75';context.font=`bold 62px ${font}`;context.fillText(`اليمن: المرتبة ${yemen.rank} من ${rows.length}`,1350,y+58);
  context.fillStyle='#28343A';context.font=`30px ${font}`;context.fillText(`القيمة: ${number(yemen.value)} ${indicator.unit}`,1350,y+145);
  context.font=`22px ${font}`;context.fillStyle='#5e6b6d';context.fillText(`${indicator.direction==='asc'?'ترتيب من الأقل إلى الأعلى':'ترتيب من الأعلى إلى الأقل'} · محسوب من الدول ذات البيانات في السنة نفسها`,1350,y+197);
  let rowY=y+260;
  for(const row of neighbors){
    if(row.code==='YEM'){context.fillStyle='#e7f0ee';context.fillRect(72,rowY-10,1296,66);}
    context.fillStyle=row.code==='YEM'?'#176B75':'#28343A';context.font=`${row.code==='YEM'?'bold ':''}29px ${font}`;
    context.textAlign='right';context.fillText(`${row.rank}. ${row.name}${row.tieCount>1?' · مرتبة مشتركة':''}`,1330,rowY);
    context.textAlign='left';context.fillText(number(row.value),95,rowY);rowY+=rowHeight;
  }
  context.textAlign='right';context.font=`22px ${font}`;context.fillStyle='#5e6b6d';
  sourceLines.forEach((line,index)=>context.fillText(line,1350,rowY+15+index*38));
  context.fillText('ترتيب تحليلي من القيم المتاحة، وليس تصنيفاً رسمياً صادراً عن المصدر.',1350,rowY+35+sourceLines.length*38);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG unavailable')),'image/png'));
}

async function rankingSummaryImage({indicator,dataset,yemen,rows,year,scope}) {
  await document.fonts?.ready;
  const canvas=document.createElement('canvas');canvas.width=1200;
  const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
  const font='"IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
  context.font=`bold 48px ${font}`;
  const title=wrapCanvasText(context,indicator.name,1040);
  context.font=`26px ${font}`;
  const unit=wrapCanvasText(context,indicator.unit,1040);
  context.font=`22px ${font}`;
  const source=wrapCanvasText(context,'المصدر: '+dataset.source.name,1040);
  const category=rankingCategories.find(item=>item.id===indicator.category)?.name || '';
  canvas.height=1050+title.length*72+unit.length*38+source.length*34;
  context.fillStyle='#143d42';context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle='#d6bd94';context.fillRect(0,0,canvas.width,10);
  context.direction='rtl';context.textAlign='center';context.textBaseline='top';
  context.fillStyle='#d5e6e1';context.font=`26px ${font}`;context.fillText('مبادرة 967 / ترتيب اليمن',600,48);
  context.fillStyle='#f0ddbc';context.fillText(category,600,105);
  context.fillStyle='#ffffff';context.font=`bold 48px ${font}`;
  title.forEach((line,index)=>context.fillText(line,600,170+index*72));
  let y=200+title.length*72;
  context.font=`30px ${font}`;context.fillText('اليمن في المرتبة',600,y);
  context.fillStyle='#f0ddbc';context.font=`bold 200px ${font}`;context.fillText(formatNumber(yemen.rank),600,y+60);
  context.fillStyle='#d5e6e1';context.font=`30px ${font}`;
  context.fillText(`من ${formatNumber(rows.length)} دولة واقتصاد تتوفر لها بيانات`,600,y+310);
  context.font=`28px ${font}`;context.fillText(`سنة القياس: ${year} · النطاق: ${scopeName(scope)}`,600,y+370);
  y+=445;
  context.fillStyle='#ffffff33';context.fillRect(110,y,980,1);
  context.fillStyle='#d5e6e1';context.font=`26px ${font}`;context.fillText('قيمة اليمن',600,y+28);
  context.fillStyle='#ffffff';context.font=`bold 56px ${font}`;context.fillText(number(yemen.value),600,y+80);
  context.fillStyle='#d5e6e1';context.font=`26px ${font}`;
  unit.forEach((line,index)=>context.fillText(line,600,y+165+index*38));
  y+=220+unit.length*38;
  context.font=`22px ${font}`;source.forEach((line,index)=>context.fillText(line,600,y+index*34));
  y+=source.length*34+12;
  context.direction='ltr';context.fillText(dataset.source.url,600,y);
  context.direction='rtl';context.font=`20px ${font}`;
  context.fillText(`${indicator.direction==='asc'?'ترتيب من الأقل إلى الأعلى':'ترتيب من الأعلى إلى الأقل'}${yemen.tieCount>1?' · مرتبة مشتركة':''}`,600,y+48);
  context.fillText('حساب من بيانات السنة نفسها، وليس تصنيفاً رسمياً صادراً عن المصدر.',600,y+88);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG unavailable')),'image/png'));
}

export default function YemenRankingExplorer({indicators = [], initialIndicator, initialDataset, initialYear, initialScope = 'world', initialCompare = ''}) {
  const initialMeta = typeof initialIndicator === 'object' && initialIndicator ? initialIndicator : indicators.find(item => item.slug === initialIndicator) || indicators[0];
  const initialYears = initialDataset ? getRankingYears(initialDataset) : [];
  const [selection,setSelection] = useState(() => ({indicator:initialMeta?.slug || '',year:initialYears.includes(Number(initialYear)) ? Number(initialYear) : initialDataset ? getDefaultRankingYear(initialDataset) || initialYears[0] || null : null,scope:initialScope==='arab'?'arab':'world',compare:/^[A-Z]{3}$/.test(initialCompare)&&initialCompare!=='YEM'?initialCompare:''}));
  const [category,setCategory] = useState(initialMeta?.category || 'all');
  const [dataState,setDataState] = useState({slug:initialMeta?.slug,indicator:initialMeta,dataset:initialDataset});
  const cache = useRef(new Map(initialMeta&&initialDataset?[[initialMeta.slug,{indicator:initialMeta,dataset:initialDataset}]]:[]));
  const requestId=useRef(0), currentSelection=useRef(selection), listYemen=useRef(null), comparisonRef=useRef(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [expanded,setExpanded]=useState(false),[query,setQuery]=useState(''),[focusYemen,setFocusYemen]=useState(false);
  const [shareMessage,setShareMessage]=useState(''),[manualLink,setManualLink]=useState(''),[imageBusy,setImageBusy]=useState(false);
  const listId=useId(), statusId=useId();
  const indicator=indicators.find(item=>item.slug===selection.indicator) || initialMeta;
  // The list arrives without descriptions; the selected indicator's comes with its dataset.
  const narrative=splitRankingDescription((dataState.slug===selection.indicator&&dataState.indicator?.description)||indicator?.description);
  const dataset=dataState.slug===selection.indicator ? dataState.dataset : null;
  const pending=loading || !dataset && !error;
  const commit=useCallback((patch,replace=false)=>{
    const next={...currentSelection.current,...patch};currentSelection.current=next;setSelection(next);changeAddress(next,replace);
    setShareMessage('');setManualLink('');
  },[]);

  useEffect(()=>{
    const onPop=()=>{
      const next=rankingLocation(window.location.search,indicators,{indicator:initialMeta?.slug});
      currentSelection.current=next;setSelection(next);setCategory(indicators.find(item=>item.slug===next.indicator)?.category||'all');setQuery('');setShareMessage('');setManualLink('');
    };
    window.addEventListener('popstate',onPop);
    changeAddress(currentSelection.current,true);
    return()=>window.removeEventListener('popstate',onPop);
  },[indicators,initialMeta?.slug]);

  useEffect(()=>{
    const controller=new AbortController(),request=++requestId.current;
    setError('');
    let cached=retry===0?cache.current.get(selection.indicator):null;
    if(cached){try{validateRankingDataset(cached.dataset,indicator?.code);}catch{cache.current.delete(selection.indicator);cached=null;}}
    if(cached){setDataState({slug:selection.indicator,...cached});setLoading(false);return()=>controller.abort();}
    if(!selection.indicator){setLoading(false);return()=>controller.abort();}
    setLoading(true);
    (async()=>{
      try{
        const response=await fetch('/api/rankings?indicator='+encodeURIComponent(selection.indicator),{signal:controller.signal,headers:{Accept:'application/json'}});
        const body=await response.json().catch(()=>null);
        if(!response.ok||!body?.dataset||body.indicator?.slug!==selection.indicator)throw new Error(body?.error || 'تعذر تحميل هذا المؤشر. حاول مجدداً.');
        validateRankingDataset(body.dataset,indicator?.code);
        if(request!==requestId.current||controller.signal.aborted)return;
        cache.current.set(selection.indicator,body);setDataState({slug:selection.indicator,...body});setLoading(false);
      }catch(problem){if(!controller.signal.aborted&&request===requestId.current){setError(problem instanceof TypeError?'تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.':problem.message);setLoading(false);}}
    })();
    return()=>controller.abort();
  },[selection.indicator,indicator?.code,retry]);

  const years=useMemo(()=>dataset?getRankingYears(dataset):[],[dataset]);
  const scopeCountries=useMemo(()=>dataset?(dataset.countries||[]).filter(item=>selection.scope!=='arab'||item.arab):[],[dataset,selection.scope]);
  useEffect(()=>{
    if(!dataset)return;
    const state=currentSelection.current;
    const year=years.includes(Number(state.year))?Number(state.year):getDefaultRankingYear(dataset)||years[0]||null;
    const compare=scopeCountries.some(item=>item.code===state.compare)&&state.compare!=='YEM'?state.compare:'';
    if(year!==state.year||compare!==state.compare)commit({year,compare},true);
  },[dataset,years,scopeCountries,commit]);
  const rows=useMemo(()=>dataset&&years.includes(selection.year)?buildRanking(dataset,{year:selection.year,scope:selection.scope,direction:indicator?.direction || 'desc'}):[],[dataset,years,selection.year,selection.scope,indicator?.direction]);
  const yemen=rows.find(item=>item.code==='YEM');
  const neighbors=useMemo(()=>getYemenNeighborhood(rows,2,2),[rows]);
  const compared=rows.find(item=>item.code===selection.compare);
  const latestYemen=dataset?getDefaultRankingYear(dataset):null;
  const missing=Math.max(0,scopeCountries.length-rows.length);
  const filtered=useMemo(()=>rows.filter(item=>matchesSearch(query,[item.name,item.code])),[rows,query]);
  const position=yemen&&rows.length>1?(yemen.rank-1)/(rows.length-1)*100:0;
  const categoryOptions=rankingCategories.filter(item=>indicators.some(metric=>metric.category===item.id));
  const metricOptions=indicators.filter(item=>category==='all'||item.category===category);
  const compareCountries=scopeCountries.filter(item=>item.code!=='YEM').sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const directionLabel=indicator?.direction==='asc'?'من الأقل إلى الأعلى':'من الأعلى إلى الأقل';

  useEffect(()=>{
    if(focusYemen&&expanded){listYemen.current?.focus();listYemen.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setFocusYemen(false);}
  },[expanded,query,focusYemen]);

  function selectMetric(slug) {setQuery('');setRetry(0);commit({indicator:slug});}
  function selectCategory(value) {setCategory(value);if(value!=='all'&&indicator?.category!==value){const first=indicators.find(item=>item.category===value);if(first)selectMetric(first.slug);}}
  async function share() {
    setShareMessage('');setManualLink('');
    const url=new URL(rankingSharePath(selection),window.location.origin).href;
    if(navigator.share){try{await navigator.share({title:`${indicator.name} — اليمن بين العالم`,url});return;}catch(problem){if(problem.name==='AbortError')return;}}
    try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url);setShareMessage('تم نسخ رابط هذه المقارنة.');}
    catch{setManualLink(url);setShareMessage('يمكنك تحديد الرابط ونسخه للمشاركة.');}
  }
  async function downloadCard(kind='comparison') {
    if(!dataset||!yemen||imageBusy)return;setImageBusy(true);setShareMessage('جارٍ تجهيز البطاقة…');
    try{
      const render=kind==='summary'?rankingSummaryImage:rankingCardImage;
      const blob=await render({indicator,dataset,yemen,rows,neighbors,year:selection.year,scope:selection.scope});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`yemen-${indicator.slug}-${selection.year}-${selection.scope}${kind==='summary'?'-card':''}.png`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setShareMessage('تم تجهيز البطاقة مع السنة والوحدة والمصدر.');
    }catch{setShareMessage('تعذر تجهيز البطاقة. يمكنك مشاركة رابط المقارنة.');}finally{setImageBusy(false);}
  }
  function downloadCsv() {
    if(!dataset||!rows.length)return;
    const content='\ufeff'+[['rank','country_code','country','year','value','unit','scope','direction','tie_count','source','source_url'],...rows.map(row=>[row.rank,row.code,row.name,selection.year,row.value,indicator.unit,selection.scope,indicator.direction,row.tieCount,dataset.source.name,dataset.source.url])].map(row=>row.map(csvEscape).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download=`yemen-${indicator.slug}-${selection.year}-${selection.scope}.csv`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  if(!indicators.length)return <div className="yr-explorer"><div className="yr-state" role="status"><Info size={28}/><h2>لا توجد معايير منشورة حالياً</h2><p>ستظهر المقارنات هنا عند نشر معايير الترتيب.</p></div></div>;

  return <div className="yr-explorer">
    <InlineTarget kind="ranking" id={indicator?.id} slug={indicator?.slug} title={indicator?.name} href={'/yemen-ranking?indicator='+encodeURIComponent(indicator?.slug||'')}/>
    <section className="yr-controls" aria-label="اختيار المؤشر والمقارنة">
      <label><span>المجال</span><select value={category} onChange={event=>selectCategory(event.target.value)}><option value="all">كل المجالات</option>{categoryOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={17} aria-hidden="true"/></label>
      <label className="yr-metric-select"><span>ما الذي تريد مقارنته؟</span><select value={selection.indicator} onChange={event=>selectMetric(event.target.value)} disabled={!indicators.length}>{metricOptions.map(item=><option key={item.slug} value={item.slug}>{item.name}</option>)}</select><ChevronDown size={17} aria-hidden="true"/></label>
      <label><span>سنة القياس</span><select value={dataset&&years.includes(selection.year)?selection.year:''} disabled={!dataset||!years.length} onChange={event=>commit({year:Number(event.target.value)})}>{!years.length&&<option value="">—</option>}{years.map(year=><option key={year} value={year}>{year}</option>)}</select><ChevronDown size={17} aria-hidden="true"/></label>
      <div className="yr-scope" role="group" aria-label="نطاق المقارنة"><button type="button" aria-pressed={selection.scope==='world'} onClick={()=>commit({scope:'world'})}><Globe2 size={17}/> العالم</button><button type="button" aria-pressed={selection.scope==='arab'} onClick={()=>commit({scope:'arab'})}><MapPin size={17}/> عربياً</button></div>
    </section>

    {error?<div className="yr-state yr-error" role="alert"><Info size={28}/><h2>تعذر عرض المقارنة</h2><p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>{cache.current.delete(selection.indicator);setRetry(value=>value+1);}}><RotateCcw size={17}/> إعادة المحاولة</button></div>:pending?<div className="yr-state" role="status"><LoaderCircle className="spin" size={30}/><h2>جارٍ تحميل بيانات {indicator?.name || 'المؤشر'}…</h2><p>نجهّز القيم المتاحة للسنة نفسها.</p></div>:dataset&&<>
      <section className="yr-result" aria-labelledby={statusId}>
        <div className="yr-story"><span className="yr-kicker">{scopeName(selection.scope)} <span>/</span> {formatYear(selection.year)}</span><h2 id={statusId}>{indicator.name}</h2><p>{narrative.intro}</p><div className="yr-reading"><span>{indicator.direction==='asc'?<ArrowUp size={16}/>:<ArrowDown size={16}/>} {directionLabel}</span><span>{indicator.better==='contextual'?'المقارنة تصف حجم القيمة، ولا تقيّم أداء الدول.':indicator.better==='lower'?'القيمة الأقل هي الاتجاه المرغوب في هذا المؤشر.':'القيمة الأعلى هي الاتجاه المرغوب في هذا المؤشر.'}</span></div>
          <div className="yr-actions"><button type="button" onClick={share}><Share2 size={17}/> مشاركة المقارنة</button><button type="button" onClick={downloadCard} disabled={!yemen||imageBusy}>{imageBusy?<LoaderCircle className="spin" size={17}/>:<Download size={17}/>} تنزيل بطاقة</button><button type="button" onClick={downloadCsv} disabled={!rows.length}><Download size={17}/> تنزيل البيانات CSV</button></div>
          <div className="yr-share-status" role="status">{shareMessage&&<p>{shareMessage.startsWith('تم')&&<Check size={15}/>} {shareMessage}</p>}{manualLink&&<input aria-label="رابط المقارنة للمشاركة" dir="ltr" readOnly value={manualLink} onFocus={event=>event.target.select()}/>}</div>
        </div>
        {yemen?<div className="yr-rank-card" aria-live="polite"><span className="yr-card-category">{rankingCategories.find(item=>item.id===indicator.category)?.name}</span><h3 className="yr-card-metric">{indicator.name}</h3><span className="yr-rank-eyebrow"><Flag country={dataset.countries.find(item=>item.code==='YEM')}/> اليمن في المرتبة</span><div className="yr-rank-number">{formatNumber(yemen.rank)}</div><p>من <strong>{formatNumber(rows.length)}</strong> دولة واقتصاد تتوفر لها بيانات في {formatYear(selection.year)}</p>{yemen.tieCount>1&&<span className="yr-tie">مرتبة مشتركة مع {formatNumber(yemen.tieCount-1)} من الدول والاقتصادات في القيمة نفسها</span>}<div className="yr-country-value"><span>قيمة اليمن</span><strong dir="ltr">{number(yemen.value)}</strong><b>{indicator.unit}</b></div><button type="button" className="yr-save-card" onClick={()=>downloadCard('summary')} disabled={imageBusy}>{imageBusy?<LoaderCircle className="spin" size={17}/>:<Download size={17}/>} {imageBusy?'\u062c\u0627\u0631\u064d \u062a\u062c\u0647\u064a\u0632 \u0627\u0644\u0635\u0648\u0631\u0629\u2026':'\u062d\u0641\u0638 \u0627\u0644\u0643\u0631\u062a \u0643\u0635\u0648\u0631\u0629'}</button></div>:<div className="yr-rank-card yr-unavailable" role="status"><Info size={30}/><h3>لا توجد قيمة منشورة لليمن في {formatYear(selection.year)}</h3><p>لن نعطي ترتيباً لليمن دون قيمة قابلة للمقارنة في السنة نفسها.</p>{latestYemen&&latestYemen!==selection.year&&<button type="button" onClick={()=>commit({year:latestYemen})}>اعرض أحدث سنة لليمن: {latestYemen} <ArrowLeft size={16}/></button>}</div>}
      </section>

      {narrative.sections.length>0&&<section className="yr-editorial" aria-label="قراءة معرفية لمعيار الترتيب"><div className="yr-editorial-head"><span className="yr-kicker">قراءة معرفية</span><h2>كيف نفهم ترتيب اليمن في {indicator.name}؟</h2><p>التفسير التالي يوضح دلالة المعيار وحدوده. تختلف سنة القياس وعدد الدول ذات البيانات باختلاف اختيارك أعلاه.</p></div><div className="yr-editorial-grid">{narrative.sections.map(section=><div className="yr-editorial-part" key={section.title}><h3>{section.title}</h3><p>{section.body}</p></div>)}</div><p className="yr-editorial-footnote">مصدر القيم: <a href={dataset.source.url} target="_blank" rel="noopener noreferrer">{dataset.source.name}</a>. الأرقام والمراتب المحسوبة في هذه الصفحة تخص سنة المقارنة المختارة وليست ترتيباً رسمياً يصدره البنك الدولي.</p></section>}

      <div className="yr-coverage"><span><strong>{formatNumber(rows.length)}</strong> دولة واقتصاد لديها قيمة</span><span><strong>{formatNumber(missing)}</strong> دولة واقتصاد دون قيمة لهذه السنة ضمن النطاق</span><p>المرتبة محسوبة من بيانات المصدر المتاحة، وليست ترتيباً رسمياً صادراً عنه. الدول والاقتصادات ذات القيم المفقودة لا تدخل المقارنة.</p></div>

      <section className="yr-neighborhood" aria-labelledby="ranking-neighborhood-title"><div className="yr-section-title"><div><span className="yr-kicker">الصورة الأقرب</span><h2 id="ranking-neighborhood-title">من يجاور اليمن في القائمة؟</h2></div><p>أقرب الدول إلى موضع اليمن، حتى خمس دول شاملة اليمن. عند أطراف القائمة يتغير العدد على كل جانب. طول الشريط يعكس القيمة بين المعروض هنا فقط.</p></div>
        {yemen?<><NeighborBars rows={neighbors} countries={dataset.countries} unit={indicator.unit}/><div className="yr-position"><div><span>بداية القائمة</span><span>نهاية القائمة</span></div><div className="yr-position-track" aria-hidden="true"><span className="yr-position-mark" style={{right:position+'%'}}/></div><p>موضع اليمن: {formatNumber(yemen.rank)} من {formatNumber(rows.length)} حسب الترتيب {directionLabel}.</p></div></>:<p className="yr-empty">تظهر الدول المجاورة عندما تتوفر قيمة لليمن في السنة المختارة.</p>}
      </section>

      <section className="yr-time" aria-label="التنقل بين السنوات"><div className="yr-time-heading"><div><span className="yr-kicker">تغيّر السؤال مع الزمن</span><h2>اختر سنة، واقرأ سياقها.</h2></div><strong>{formatYear(selection.year)}</strong></div>{years.length>1&&<><label className="sr-only" htmlFor="ranking-year-range">سنة المقارنة</label><input id="ranking-year-range" type="range" min="0" max={years.length-1} step="1" value={Math.max(0,[...years].reverse().indexOf(selection.year))} aria-valuetext={String(selection.year)} onChange={event=>commit({year:[...years].reverse()[Number(event.target.value)]},true)}/><div className="yr-year-ends"><span>{years.at(-1)}</span><span>{years[0]}</span></div></>}<History dataset={dataset} currentYear={selection.year}/><p className="yr-time-note">تختلف الدول التي تنشر بيانات بين سنة وأخرى؛ تغيّر المرتبة وحده لا يشرح تغيّر وضع اليمن. راجع القيمة والتغطية معاً.</p></section>

      <section className="yr-comparison" ref={comparisonRef} aria-labelledby="ranking-compare-title"><div><span className="yr-kicker">ضع القيمتين جنباً إلى جنب</span><h2 id="ranking-compare-title">قارن اليمن بدولة تختارها.</h2><label className="yr-compare-select"><span className="sr-only">دولة المقارنة مع اليمن</span><select value={selection.compare} onChange={event=>commit({compare:event.target.value})}><option value="">اختر دولة للمقارنة</option>{compareCountries.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={18}/></label></div>
        {selection.compare?<div className="yr-comparison-values"><div><span>اليمن</span><strong dir="ltr">{yemen?number(yemen.value):'—'}</strong><small>{yemen?`المرتبة ${yemen.rank}`:'لا توجد قيمة منشورة'}</small></div><div><span>{countryName(dataset.countries,selection.compare)}</span><strong dir="ltr">{compared?number(compared.value):'—'}</strong><small>{compared?`المرتبة ${compared.rank}`:'لا توجد قيمة منشورة لهذه السنة'}</small></div><p>{yemen&&compared?(yemen.value===compared.value?'القيمتان متساويتان في السنة المختارة.':`قيمة اليمن ${yemen.value>compared.value?'أعلى':'أقل'} بمقدار ${number(Math.abs(yemen.value-compared.value))} ${indicator.unit.includes('%')?'نقطة مئوية':indicator.unit}.`):'تحتاج المقارنة إلى قيمة منشورة للدولتين في السنة نفسها.'}<span>الوحدة: {indicator.unit} · سنة القياس: {selection.year}</span></p></div>:<p className="yr-comparison-invite">اختر الدولة التي يهمك فهم موقع اليمن بجانبها. نعرض القيم الأصلية والوحدة والسنة نفسها.</p>}
      </section>

      <section className="yr-full-list"><div className="yr-list-heading"><div><span className="yr-kicker">وسّع الصورة</span><h2>كل الدول والاقتصادات في المقارنة</h2></div><button type="button" aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(value=>!value)}>{expanded?'إخفاء القائمة':'عرض القائمة كاملة'} <ChevronDown size={18}/></button></div><div id={listId} hidden={!expanded}>
        <div className="yr-list-tools"><label><Search size={18}/><span className="sr-only">ابحث عن دولة في الترتيب</span><input type="search" placeholder="ابحث باسم دولة أو رمزها…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="مسح بحث الدول" onClick={()=>setQuery('')}><X size={17}/></button>}</label>{yemen&&<button type="button" onClick={()=>{setQuery('');setFocusYemen(true);}}><MapPin size={16}/> العودة إلى اليمن</button>}<span role="status">عدد النتائج: {formatNumber(filtered.length)}</span></div>
        <p className="yr-table-hint">يمكنك تمرير الجدول أفقيًا لقراءة جميع الأعمدة.</p>
        <div className="yr-table-scroll" role="region" aria-label="جدول ترتيب الدول والاقتصادات" tabIndex={0}><table><caption>{indicator.name} · {selection.year} · {scopeName(selection.scope)} · {indicator.unit}</caption><thead><tr><th scope="col">المرتبة</th><th scope="col">الدولة أو الاقتصاد</th><th scope="col">القيمة</th><th scope="col">المقارنة</th></tr></thead><tbody>{filtered.map(row=><tr key={row.code} className={row.code==='YEM'?'is-yemen':''} tabIndex={row.code==='YEM'?-1:undefined} ref={row.code==='YEM'?listYemen:undefined}><td>{formatNumber(row.rank)}{row.tieCount>1&&<small>مشتركة</small>}</td><th scope="row"><Flag country={dataset.countries.find(item=>item.code===row.code)}/>{row.name}</th><td dir="ltr">{number(row.value)}</td><td>{row.code==='YEM'?<span className="yr-table-yemen">اليمن</span>:<button type="button" onClick={()=>{commit({compare:row.code});comparisonRef.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>قارن مع اليمن <ArrowLeft size={14}/></button>}</td></tr>)}</tbody></table>{!filtered.length&&<div className="yr-empty"><p>لا توجد دولة تطابق هذا البحث.</p><button type="button" onClick={()=>setQuery('')}>مسح البحث</button></div>}</div>
      </div></section>

      <aside className="yr-methodology"><div><Info size={21}/><h2>كيف نقرأ هذه المقارنة؟</h2></div><p>نقارن قيماً من المؤشر والمصدر والسنة نفسها، ونستبعد القيم المفقودة. تتضمن قائمة المصدر دولاً واقتصادات ذات بيانات مستقلة. عند تساوي القيم تتشارك المرتبة، وقد تتجاوز المرتبة التالية رقماً. تُقرّب القيم للعرض فقط؛ الترتيب يحسب بالقيم الأصلية.</p><p>المؤشر يصف جانباً واحداً من الواقع. الحجم السكاني أو الاقتصادي ليس حكماً على جودة الحياة، ولا تختزل مرتبة واحدة سياق بلد كامل.</p><a href={dataset.source.url} target="_blank" rel="noopener noreferrer">المصدر: {dataset.source.name} <ArrowLeft size={16}/></a>{dataset.source.updatedAt&&<span>آخر تحديث لدى المصدر: {formatArabicDate(dataset.source.updatedAt)}</span>}{(dataset.source.sourceOrganization||dataset.source.sourceNote)&&<details><summary>التعريف والجهات الأصلية وملاحظات المصدر</summary>{dataset.source.sourceOrganization&&<p>الجهة الأصلية بحسب بيانات المصدر: <bdi>{dataset.source.sourceOrganization}</bdi></p>}{dataset.source.sourceNote&&<p dir="auto">{dataset.source.sourceNote}</p>}</details>}<p>تختلف شروط إعادة استخدام بعض السلاسل بحسب الجهة الأصلية؛ راجع صفحة المصدر وملاحظاته عند الاستشهاد بالبيانات.</p></aside>
    </>}
  </div>;
}
