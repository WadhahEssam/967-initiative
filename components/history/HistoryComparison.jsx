'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from '@/components/SiteLink';
import {ArrowLeftRight,ArrowUpLeft,BookOpenText,CalendarRange,Check,Copy,ExternalLink,GitCompareArrows,Landmark,MapPinned,ScrollText} from 'lucide-react';
import {historyEntryPath,historyEras,historyYear} from '@/lib/yemenHistory';
import {yemenGovernorates} from '@/lib/yemeniFigures';
import {HISTORY_COMPARISON_GROUPS,defaultHistoryPair,comparisonFact,comparisonPeriod,comparisonCoverage,comparisonPairNote,historyComparisonOverlap} from '@/lib/historyComparisons';
import styles from './HistoryComparison.module.css';

function citedSource(entry,url){
 return entry.sources?.find(source=>source.url===url)||null;
}
function Timeline({first,second}){
 const entries=[first,second];
 const points=entries.map(entry=>{
  const interval=comparisonPeriod(entry);
  return {entry,interval,year:interval?.from??Number(entry.year)};
 });
 const years=points.flatMap(point=>point.interval?[point.interval.from,point.interval.to]:[point.year]).filter(Number.isFinite);
 if(!years.length)return null;
 const min=Math.min(...years),max=Math.max(...years);
 const span=Math.max(1,max-min),pad=Math.max(8,span*.05),start=min-pad,end=max+pad;
 const percent=value=>Math.max(0,Math.min(100,100*(value-start)/(end-start)))+'%';
 const overlap=historyComparisonOverlap(first,second);
 return <section className={styles.timeline} aria-labelledby="history-comp-timeline-title">
  <div className={styles.subhead}><span><CalendarRange size={20}/> التاريخ المشترك</span><h3 id="history-comp-timeline-title">متى تلتقي الفترات الزمنية؟</h3><p>الشريط الملوّن يمثل نطاقًا مُسندًا إلى مصدر، والنقطة تمثل سنة مرجعية للمادة فقط. كلاهما لا يعني بداية الدولة أو نهايتها بالضرورة.</p></div>
  <div className={styles.axis}><span>{historyYear(Math.round(start))}</span><span>الأقدم ← الزمن ← الأحدث</span><span>{historyYear(Math.round(end))}</span></div>
  <div className={styles.timelineTracks}>{points.map((point,index)=>{
   const {entry,interval,year}=point;
   return <div className={styles.timelineTrack} key={entry.slug}>
    <div className={styles.trackLabel}><strong>{entry.title}</strong><small>{interval?'نطاق موثق':'سنة مرجعية فقط'}</small></div>
    <div className={styles.track} role="img" aria-label={entry.title+': '+(interval?(historyYear(interval.from)+' إلى '+historyYear(interval.to)+'؛ '+interval.label):('نقطة عند '+historyYear(year)+'؛ لا تتوفر فترة كاملة'))}>
     {interval?<span className={index===0?styles.periodA:styles.periodB} style={{insetInlineStart:percent(interval.from),width:Math.max(.8,100*(interval.to-interval.from)/(end-start))+'%'}}/>:<span className={styles.marker} style={{insetInlineStart:percent(year)}}/>}
    </div>
    <p>{interval?<><span>{historyYear(interval.from)} – {historyYear(interval.to)}</span> · {interval.label}</>:<>المرجع الزمني: {historyYear(year)}، ولا نملك تاريخَي بداية ونهاية موثقَين لهذه المادة.</>}
     {interval&&<a href={interval.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'مرجع الفترة الزمنية '+entry.title}><ExternalLink size={14}/> المرجع</a>}
    </p>
   </div>;
  })}</div>
  <p className={styles.timelineResult}>{overlap===true?'تتداخل الفترتان المعروضتان في جزء من التاريخ، وفق نطاقَي المصدرين، دون أن يثبت ذلك وجود علاقة سياسية مباشرة.':overlap===false?'لا تتداخل الفترتان المسجلتان في المصادر المحددة؛ وقد لا تمثلان كامل مدة الدولتين.':'لا يمكن حساب التزامن بدقة لأن إحدى الفترتين أو كلتيهما لا تملك بداية ونهاية موثقتين.'}</p>
 </section>;
}
function GeographicComparison({first,second}){
 return <section className={styles.geography} aria-labelledby="history-comp-geography">
  <div className={styles.subhead}><span><MapPinned size={19}/> الجغرافيا المرتبطة</span><h3 id="history-comp-geography">المراكز والأماكن على الخريطة</h3><p>نعرض مواقع ذات صلة بالدولتين على خريطة المحافظات الحالية. هذه الروابط ليست خرائط للحدود السياسية القديمة.</p></div>
  <div className={styles.geoGrid}>{[first,second].map(entry=>{
   const region=yemenGovernorates.find(g=>g.id===entry.governorate);
   return <article key={entry.slug} className={styles.geoCard}>
    <h4>{entry.title}</h4>
    <dl><dt>المكان المرتبط في الملف</dt><dd>{entry.location||'مناطق متعددة أو غير محددة'}</dd><dt>المحافظة الحالية</dt><dd>{region?.name||'لم تحدد محافظة معاصرة'}</dd></dl>
    {region&&<Link href={'/yemen-map?region='+region.id+'#map'}>استكشف المحافظة في الأطلس <ArrowUpLeft size={16}/></Link>}
   </article>;
  })}</div>
 </section>;
}
function Value({entry,field}){
 const fact=comparisonFact(entry,field.key);
 const source=fact&&citedSource(entry,fact.sourceUrl);
 return <div className={fact?styles.value:styles.valueMissing}>
  <span className={styles.mobileLabel}>{entry.title}</span>
  {fact?<><p>{fact.text}</p><a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" title={source?.title||'فتح المرجع'}><BookOpenText size={14}/> {source?.title||'عرض المصدر'} <ExternalLink size={13}/></a></>:<p>لا توجد معلومة موثقة لهذا المعيار بعد.</p>}
 </div>;
}
function Conclusions({first,second}){
 const note=comparisonPairNote(first,second);
 const c1=comparisonFact(first,'capital'),c2=comparisonFact(second,'capital');
 const eraA=historyEras.find(item=>item.id===first.era)?.title,eraB=historyEras.find(item=>item.id===second.era)?.title;
 const common=note?.common||(
  first.era===second.era?'يصنف أرشيف 967 الملفين ضمن «'+(eraA||'العصر نفسه')+'». لا يعني ذلك بالضرورة التزامنهما في الحكم أو اشتراكهما في الحدود.':
  'يرتبط كل ملف بعصر مختلف في فهرس 967، وتحتاج أي صلات تاريخية مباشرة بينهما إلى دراسة مصادر متخصصة.'
 );
 const difference=note?.difference||(
  c1&&c2&&c1.text!==c2.text?'تختلف مراكز الحكم المذكورة في مصادر الملفين؛ راجع معيار «العاصمة ومراكز الحكم» للمقارنة بين التفاصيل المسندة.':
  'لم تُحرر بعد خلاصة مستقلة موثقة عن الاختلافات الجوهرية لهذه الثنائية. تعرض الجداول أعلاه المعلومات المسندة المتاحة لكل دولة.'
 );
 const linked=first.related?.includes(second.slug)||second.related?.includes(first.slug);
 return <section className={styles.conclusions} aria-labelledby="history-comp-conclusions">
  <div className={styles.subhead}><span><ScrollText size={19}/> ملخص القراءة</span><h3 id="history-comp-conclusions">أوجه التشابه والاختلاف</h3><p>هذه خلاصة مقيدة بالمراجع المتاحة، وليست ترتيبًا للأفضل أو الأقوى.</p></div>
  <div className={styles.insightGrid}>
   <article><span>ما الذي يجمعهما؟</span><p>{common}</p></article>
   <article><span>أين يختلف السياق؟</span><p>{difference}</p></article>
   <article><span>مستوى التوثيق</span><p>تتوفر {comparisonCoverage(first)} معايير مسندة في ملف {first.title}، مقابل {comparisonCoverage(second)} في ملف {second.title}. {linked?'الملفان مرتبطان ببعضهما في فهرس المواد التاريخية، لكن الارتباط التحريري لا يثبت علاقة سياسية بذاته.':'لا تُستنتج علاقات حربية أو دبلوماسية تلقائيًا من التصنيف أو تقارب التواريخ.'}</p></article>
  </div>
  {note&&<div className={styles.pairSources}><strong>مراجع الخلاصة</strong>{note.sources.map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer">فتح المصدر <ExternalLink size={13}/></a>)}</div>}
 </section>;
}
function ReferenceList({entry}){
 return <section className={styles.referenceCard} aria-label={'مراجع '+entry.title}>
  <h4>{entry.title}</h4><p>مصادر المادة التاريخية؛ قد تغطي بعض المراجع جوانب أوسع من الدولة نفسها.</p>
  <ol>{entry.sources?.map((source,index)=><li key={source.url+'-'+index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={14}/></a></li>)}</ol>
 </section>;
}
export default function HistoryComparison({entries,detailsStatus='ready',onRetry}){
 const states=useMemo(()=>entries.filter(item=>item.kind==='state'&&item.isPublished!==false),[entries]);
 const [initialA,initialB]=useMemo(()=>defaultHistoryPair(states),[states]);
 const [firstSlug,setFirstSlug]=useState(initialA);
 const [secondSlug,setSecondSlug]=useState(initialB);
 const [activeTab,setActiveTab]=useState('overview');
 const [message,setMessage]=useState('');
 const ids=useMemo(()=>new Set(states.map(item=>item.slug)),[states]);
 useEffect(()=>{
  const sync=()=>{
   const params=new URLSearchParams(location.search);
   setFirstSlug(ids.has(params.get('compareA'))?params.get('compareA'):initialA);
   setSecondSlug(ids.has(params.get('compareB'))?params.get('compareB'):initialB);
  };
  sync();window.addEventListener('popstate',sync);
  return()=>window.removeEventListener('popstate',sync);
 },[ids,initialA,initialB]);
 const writeUrl=useCallback((a,b)=>{
  const p=new URLSearchParams(location.search);
  if(a)p.set('compareA',a);else p.delete('compareA');
  if(b)p.set('compareB',b);else p.delete('compareB');
  history.replaceState(history.state,'',location.pathname+(p.size?'?'+p:'')+location.hash);
 },[]);
 const choose=(which,value)=>{
  const nextA=which==='first'?value:firstSlug,nextB=which==='second'?value:secondSlug;
  setFirstSlug(nextA);setSecondSlug(nextB);setMessage('');writeUrl(nextA,nextB);
 };
 const preset=(a,b)=>{setFirstSlug(a);setSecondSlug(b);setActiveTab('overview');setMessage('');writeUrl(a,b);};
 const swap=()=>{setFirstSlug(secondSlug);setSecondSlug(firstSlug);writeUrl(secondSlug,firstSlug);};
 const copy=async()=>{
  const params=new URLSearchParams(location.search);
  params.set('compareA',firstSlug);params.set('compareB',secondSlug);
  const url=location.origin+location.pathname+'?'+params.toString()+'#compare';
  try{await navigator.clipboard.writeText(url);setMessage('تم نسخ رابط المقارنة.');}
  catch{setMessage('تعذر النسخ التلقائي. يمكنك نسخ عنوان الصفحة من المتصفح.');}
 };
 const first=states.find(item=>item.slug===firstSlug),second=states.find(item=>item.slug===secondSlug);
 const ready=Boolean(first&&second&&first.slug!==second.slug);
 const waiting=ready&&(first.pending||second.pending);
 const presets=[['saba','qataban'],['saba','himyar'],['rasulids','sulayhids']].filter(([a,b])=>ids.has(a)&&ids.has(b));
 return <section id="compare" className={styles.section} aria-labelledby="history-compare-heading">
  <header className={styles.heading}>
   <div><span className={styles.kicker}><GitCompareArrows size={17}/> أداة المقارنة التاريخية</span><h2 id="history-compare-heading">قارن بين دولتين</h2><p>افهم الحكم والاقتصاد والحضارة، وتابع الزمن والمكان والمصادر في عرض واحد. نُظهر المعلومات المتاحة كما هي، ونحدد الجوانب التي لم توثق بعد.</p></div>
   <span className={styles.headingIcon}><Landmark size={37}/></span>
  </header>
  <div className={styles.picker}>
   <div className={styles.selectors}>
    <label><span>الدولة الأولى</span><select value={firstSlug} onChange={event=>choose('first',event.target.value)} aria-label="اختر الدولة الأولى">{states.map(entry=><option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select></label>
    <button className={styles.swap} type="button" onClick={swap} disabled={!first||!second} aria-label="تبديل موقع الدولتين" title="تبديل موقع الدولتين"><ArrowLeftRight size={22}/></button>
    <label><span>الدولة الثانية</span><select value={secondSlug} onChange={event=>choose('second',event.target.value)} aria-label="اختر الدولة الثانية">{states.map(entry=><option key={entry.slug} value={entry.slug}>{entry.title}</option>)}</select></label>
   </div>
   <div className={styles.pickerFoot}><div className={styles.presets} aria-label="مقارنات مقترحة"><span>مقارنات جاهزة:</span>{presets.map(([a,b])=><button key={a+'-'+b} type="button" onClick={()=>preset(a,b)}>{states.find(e=>e.slug===a)?.title} × {states.find(e=>e.slug===b)?.title}</button>)}</div><button className={styles.copy} type="button" onClick={copy} disabled={!ready}><Copy size={15}/> نسخ الرابط</button></div>
   {message&&<p className={styles.feedback} role="status"><Check size={15}/>{message}</p>}
  </div>
  {!ready?<p className={styles.empty} role="status">اختر دولتين مختلفتين من القائمة لعرض المقارنة التفصيلية.</p>:waiting?<p className={styles.empty} role="status">{detailsStatus==='failed'?<>تعذر تحميل بيانات المقارنة. <button type="button" onClick={onRetry}>أعد المحاولة</button></>:'جارٍ تحميل بيانات المقارنة…'}</p>:<>
   <div className={styles.stateCards}>{[first,second].map((entry,index)=><article className={styles.stateCard} key={entry.slug}>
    <span className={styles.stateIndex}>{index===0?'01':'02'} · ملف دولة</span>
    <h3>{entry.title}</h3>
    <p>{entry.summary}</p>
    <details className={styles.context}><summary>قراءة سياق تاريخي أوسع</summary><div>{entry.paragraphs?.slice(0,2).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div><small>مقتطف من المادة التاريخية العامة؛ راجع مراجع الملف قبل اعتماد أي معلومة دقيقة.</small></details>
    <dl><div><dt>الفترة المعروضة</dt><dd>{entry.period}</dd></div><div><dt>السنة المرجعية</dt><dd>{historyYear(entry.year)}</dd></div><div><dt>معايير مسندة</dt><dd>{comparisonCoverage(entry)} من 13</dd></div><div><dt>المراجع</dt><dd>{entry.sources?.length||0} مصدر</dd></div></dl>
    <Link href={historyEntryPath(entry.slug)}>اقرأ الملف التاريخي <ArrowUpLeft size={17}/></Link>
   </article>)}</div>
   <div className={styles.tabs} role="tablist" aria-label="جوانب المقارنة">{HISTORY_COMPARISON_GROUPS.map(group=><button type="button" key={group.id} id={'history-comparison-tab-'+group.id} role="tab" aria-controls="history-comparison-panel" aria-selected={activeTab===group.id} tabIndex={activeTab===group.id?0:-1} className={activeTab===group.id?styles.tabActive:styles.tab} onClick={()=>setActiveTab(group.id)} onKeyDown={event=>{
    const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return;
    event.preventDefault();const i=HISTORY_COMPARISON_GROUPS.findIndex(item=>item.id===activeTab),next=event.key==='Home'?0:event.key==='End'?HISTORY_COMPARISON_GROUPS.length-1:(i+(event.key==='ArrowLeft'?1:-1)+HISTORY_COMPARISON_GROUPS.length)%HISTORY_COMPARISON_GROUPS.length;
    const id=HISTORY_COMPARISON_GROUPS[next].id;setActiveTab(id);document.getElementById('history-comparison-tab-'+id)?.focus();
   }}><strong>{group.title}</strong><small>{group.description}</small></button>)}</div>
   {HISTORY_COMPARISON_GROUPS.filter(group=>group.id===activeTab).map(group=><div id="history-comparison-panel" key={group.id} className={styles.panel} role="tabpanel" aria-labelledby={'history-comparison-tab-'+group.id} tabIndex={0}>
    <div className={styles.tableHead}><span>المعيار</span><strong>{first.title}</strong><strong>{second.title}</strong></div>
    {group.id==='overview'&&<div className={styles.metricRow}><h4>الفترة والمدة</h4>{[first,second].map(entry=><div className={styles.value} key={entry.slug}><span className={styles.mobileLabel}>{entry.title}</span><p>{entry.period}</p><small>{comparisonPeriod(entry)?'يتوفر نطاق زمني مسند أسفل المقارنة':'لم تُحدد مدة الحكم بدقة في هذا الملف'}</small></div>)}</div>}
    {group.fields.map(field=><div className={styles.metricRow} key={field.key}><h4>{field.label}</h4><Value entry={first} field={field}/><Value entry={second} field={field}/></div>)}
   </div>)}
   <Timeline first={first} second={second}/>
   <GeographicComparison first={first} second={second}/>
   <Conclusions first={first} second={second}/>
   <section className={styles.references} aria-labelledby="history-comp-sources">
    <div className={styles.subhead}><span><BookOpenText size={19}/> الشواهد والمراجع</span><h3 id="history-comp-sources">المصادر لكل دولة</h3><p>كل معلومة تفصيلية موثقة في الجدول تحمل رابط مصدرها. القائمة أدناه تجمع بقية المراجع الموجودة في الملفين.</p></div>
    <div className={styles.referenceGrid}><ReferenceList entry={first}/><ReferenceList entry={second}/></div>
   </section>
   <p className={styles.disclaimer}><ScrollText size={18}/> حدود المقارنة: الممالك والدول قد تتزامن أو تتداخل جغرافيًا. تواريخ الازدهار لا تعني بالضرورة التأسيس أو السقوط، ومراكز المواقع المعاصرة لا تمثل حدودًا سياسية قديمة. غياب المعلومة لا يعني أنها لم تحدث.</p>
  </>}
 </section>;
}
