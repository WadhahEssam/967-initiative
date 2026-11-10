'use client';
import {useMemo,useState,useEffect} from 'react';
import Link from '@/components/SiteLink';
import {ArrowUpLeft,BookOpen,CalendarDays,MapPinned,Search,ScrollText,SlidersHorizontal,ListOrdered} from 'lucide-react';
import {historyEras,historyKinds,historyEntryPath,historyYear,historySourceCount} from '@/lib/yemenHistory';
import styles from './HistoryExplorer.module.css';
import HistoryTimeline from './HistoryTimeline';
import HistoryMedia from './HistoryMedia';
import HistoryComparison from './HistoryComparison';
import HistoryPending from './HistoryPending';
import useDeferredDetails,{withDetails} from '@/components/useDeferredDetails';

function normalized(s){return String(s||'').normalize('NFKD').replace(/[\u064B-\u065F]/g,'').replace(/[أإآ]/g,'ا').toLowerCase();}
export default function HistoryExplorer({entries:index,details:initialDetails,detailsUrl,initialEra='',initialType=''}) {
 const {details,status,load}=useDeferredDetails(detailsUrl,initialDetails);
 const entries=useMemo(()=>withDetails(index,details),[index,details]);
 const [era,setEra]=useState(initialEra),[type,setType]=useState(initialType),[query,setQuery]=useState(''),[mode,setMode]=useState('timeline'),[more,setMore]=useState(12);
 useEffect(()=>{
  const onBack=()=>{const p=new URLSearchParams(location.search);setEra(p.get('era')||'');setType(p.get('type')||'');};
  addEventListener('popstate',onBack);return()=>removeEventListener('popstate',onBack);
 },[]);
 const change=(nextEra,nextType)=>{
  setEra(nextEra);setType(nextType);setMore(12);
  const p=new URLSearchParams(location.search);
  if(nextEra)p.set('era',nextEra);else p.delete('era');
  if(nextType)p.set('type',nextType);else p.delete('type');
  history.replaceState(history.state,'',location.pathname+(p.size?'?'+p:'')+location.hash);
 };
 const published=useMemo(()=>entries.filter(e=>e.isPublished!==false),[entries]);
 const selected=useMemo(()=>published.filter(e=>(!era||e.era===era)&&(!type||e.kind===type)&&(!query||normalized([e.title,e.summary,e.period,e.location].join(' ')).includes(normalized(query)))),[published,era,type,query]);
 const states=published.filter(e=>e.kind==='state');
 // Any use of the explorer fetches the remaining summaries at once.
 return <div className={styles.wrap} onPointerDownCapture={load} onFocusCapture={load}>
  <div className={styles.eras} aria-label="اختر عصراً تاريخياً لاستكشاف محطاته على الخط الزمني">
   {historyEras.map((item,index)=><button key={item.id} className={era===item.id?styles.eraSelected:styles.era} type="button" onClick={()=>change(era===item.id?'':item.id,type)} aria-pressed={era===item.id}>
    <span className={styles.eraNumber}>{String(index+1).padStart(2,'0')}</span>
    <strong>{item.title}</strong><small>{item.period}</small>
   </button>)}
  </div>
  <section className={styles.intro}>
   <div><span className="eyebrow">رحلة عبر الزمن</span><h2>{era?historyEras.find(x=>x.id===era)?.title:'العصور والدول والأحداث'}</h2><p>{era?historyEras.find(x=>x.id===era)?.summary:'اقرأ الأحداث والسير والآثار في سياقها الزمني، مع إظهار المصادر والفترات التقريبية.'}</p></div>
   <div className={styles.stats}><span><strong>{published.length.toLocaleString('ar')}</strong> مادة معرفية</span><span><strong>{historyEras.length.toLocaleString('ar')}</strong> عصور</span></div>
  </section>
  <section className={styles.controls} aria-label="خيارات استكشاف تاريخ اليمن">
   <label className={styles.search}><Search size={19}/><span className="sr-only">بحث في تاريخ اليمن</span><input value={query} onChange={e=>{setQuery(e.target.value);setMore(12);}} placeholder="ابحث عن دولة أو حدث أو موقع..." maxLength={120}/></label>
   <label className={styles.select}><SlidersHorizontal size={17}/><span className="sr-only">نوع المحتوى</span><select value={type} onChange={e=>change(era,e.target.value)}><option value="">جميع الموضوعات</option>{Object.entries(historyKinds).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <div className={styles.viewModes} role="group" aria-label="طريقة العرض"><button type="button" className={mode==='cards'?styles.active:''} aria-pressed={mode==='cards'} onClick={()=>setMode('cards')}><ListOrdered size={17}/> القائمة</button><button type="button" className={mode==='timeline'?styles.active:''} aria-pressed={mode==='timeline'} onClick={()=>setMode('timeline')}><CalendarDays size={17}/> الخط الزمني</button></div>
  </section>
  <div className={styles.resultCount} role="status">المواد المطابقة: <strong>{selected.length.toLocaleString('ar')}</strong> {query&&status!=='ready'&&<small>البحث في العناوين فقط حتى يكتمل تحميل الملخصات </small>}{era&&<button onClick={()=>change('',type)} type="button">جميع العصور ×</button>}</div>
  {selected.length===0?<div className={styles.empty}>لا توجد مواد مطابقة. جرّب إزالة الفلاتر أو استخدام عبارة أخرى. <button type="button" onClick={()=>{change('','');setQuery('');}}>إعادة ضبط البحث</button></div>:mode==='timeline'?<HistoryTimeline entries={selected} detailsStatus={status} onRetry={load}/>:<div className={styles.cards}>{selected.slice(0,more).map(entry=><article key={entry.slug} data-history-kind={entry.kind} className={styles.card}>
    <span className={styles.date}>{historyYear(entry.year)}</span>
    <div className={styles.cardBody}>
     <div className={styles.cardTop}><span className={styles.kind}>{historyKinds[entry.kind]}</span><small className={styles.period}>{entry.period}</small></div>
     <h3><Link href={historyEntryPath(entry.slug)}>{entry.title}</Link></h3>
     {entry.pending?<HistoryPending status={status} onRetry={load}/>:<p>{entry.summary}</p>}
     <div className={styles.cardBottom}>{!entry.pending&&<span><BookOpen size={14}/> {historySourceCount(entry)} مصادر</span>}{entry.location&&<span><MapPinned size={14}/>{entry.location}</span>}<Link href={historyEntryPath(entry.slug)} aria-label={'قراءة '+entry.title}>اقرأ الملف <ArrowUpLeft size={15}/></Link></div>
    </div>
    <div className={styles.cardThumb}>{!entry.pending&&<HistoryMedia entry={entry} variant="thumbnail"/>}</div>
   </article>)}</div>}
  {mode==='cards'&&selected.length>more&&<button className={styles.more} type="button" onClick={()=>setMore(x=>x+12)}>عرض المزيد ({Math.min(12,selected.length-more).toLocaleString('ar')})</button>}
  <HistoryComparison entries={states} detailsStatus={status} onRetry={load}/>
  <section className={styles.evidence}><ScrollText size={24}/><div><h2>كيف نعرف ما حدث؟</h2><p>نعتمد في المواد على النقوش والمواقع الأثرية والدراسات التاريخية والمراجع المنشورة. التواريخ القديمة تقريبية وقد تتداخل الممالك والدول؛ لا تعرض الخريطة الحالية حدوداً سياسية قديمة.</p></div></section>
 </div>;
}
