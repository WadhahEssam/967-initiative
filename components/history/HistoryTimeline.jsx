'use client';
import {startTransition,useEffect,useMemo,useRef,useState} from 'react';
import {countOf} from '@/lib/arabicCount';
import Link from '@/components/SiteLink';
import {ArrowLeft,ArrowUpLeft,BookOpen,CalendarDays,ChevronLeft,ChevronRight,MapPin,MoveHorizontal} from 'lucide-react';
import {chronologicalHistory,boundedTimelineIndex,timelineAdjacentIndex} from '@/lib/historyTimeline';
import {historyEras,historyKinds,historyEntryPath,historyYear,historySourceCount} from '@/lib/yemenHistory';
import styles from './HistoryTimeline.module.css';
import HistoryMedia from './HistoryMedia';
import HistoryPending from './HistoryPending';

const FIRST_STOPS=24;
export default function HistoryTimeline({entries,detailsStatus='ready',onRetry}){
 const stops=useMemo(()=>chronologicalHistory(entries),[entries]);
 const [selectedSlug,setSelectedSlug]=useState(()=>stops[0]?.slug||'');
 // The page arrives with the first stops only; the rest are drawn once it has loaded, so a phone
 // does not build hundreds of stops before the reader can scroll.
 const [allStops,setAllStops]=useState(false);
 useEffect(()=>{
  if(allStops)return;
  const show=()=>startTransition(()=>setAllStops(true));
  const idle=window.requestIdleCallback?requestIdleCallback(show,{timeout:2000}):setTimeout(show,300);
  return()=>{if(window.cancelIdleCallback)cancelIdleCallback(idle);clearTimeout(idle);};
 },[allStops]);
 const railRef=useRef(null),stopRefs=useRef([]);
 const selectedIndex=Math.max(0,stops.findIndex(item=>item.slug===selectedSlug));
 const selected=stops[selectedIndex];
 const size=stops.length;
 const chooseIndex=(value,{focus=false}={})=>{
  if(!allStops)setAllStops(true);
  const index=boundedTimelineIndex(value,size);
  const item=stops[index];if(!item)return;
  setSelectedSlug(item.slug);
  const button=stopRefs.current[index];
  if(button){
   button.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
   if(focus)button.focus({preventScroll:true});
  }
 };
 const chooseStep=delta=>chooseIndex(timelineAdjacentIndex(selectedIndex,delta,size),{focus:true});
 useEffect(()=>{
  // A filter can remove the selected stop: restore a valid focus without
  // scrolling the entire webpage to the timeline.
  if(!stops.some(item=>item.slug===selectedSlug)){
   setSelectedSlug(stops[0]?.slug||'');
   if(railRef.current)railRef.current.scrollTo({left:0,behavior:'auto'});
  }
 },[stops,selectedSlug]);
 useEffect(()=>{stopRefs.current=stopRefs.current.slice(0,stops.length);},[stops.length]);

 const activeEra=historyEras.find(item=>item.id===selected?.era);
 return <section className={styles.timeline} aria-label="خط زمني تفاعلي لتاريخ اليمن">
  <header className={styles.heading}>
   <div><span className={styles.kicker}><CalendarDays size={16}/> رحلة عبر التاريخ</span><h3>استكشف المحطات التاريخية</h3><p>تصفّح المحور أفقياً، أو انتقل بالأسهم، ثم اختر محطة لقراءة ملخصها.</p></div>
   <div className={styles.buttons} role="group" aria-label="الانتقال بين المحطات">
    <button type="button" onClick={()=>chooseStep(-1)} disabled={selectedIndex===0} aria-label="المحطة الأقدم"><ChevronRight size={22}/> الأقدم</button>
    <span className={styles.position} aria-label={`المحطة ${selectedIndex+1} من ${size}`}>{(selectedIndex+1).toLocaleString('ar')} / {size.toLocaleString('ar')}</span>
    <button type="button" onClick={()=>chooseStep(1)} disabled={selectedIndex===size-1} aria-label="المحطة الأحدث">الأحدث <ChevronLeft size={22}/></button>
   </div>
  </header>
  <div className={styles.navigator} role="group" aria-label="الانتقال المباشر عبر السنوات">
   <label htmlFor="yemen-history-scrub">انتقل على المحور</label>
   <input id="yemen-history-scrub" type="range" dir="rtl" min={0} max={Math.max(0,size-1)} value={selectedIndex} step={1}
    aria-label="اختيار محطة تاريخية" aria-valuetext={selected?.title+'، '+historyYear(selected?.year)}
    onChange={event=>chooseIndex(Number(event.target.value))}/>
   <span className={styles.scrubDate}>{historyYear(selected?.year)}</span>
  </div>
  <div className={styles.railHead}><span><MoveHorizontal size={16}/> مرّر يميناً ويساراً لتصفح التاريخ</span><span>الأقدم <ArrowLeft size={14}/> الأحدث</span></div>
  <div className={styles.viewport} ref={railRef} dir="rtl" tabIndex={0} aria-label="محور الأحداث التاريخية، قابل للتمرير أفقياً"
   onKeyDown={event=>{
    if(event.target!==event.currentTarget)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
     event.preventDefault();chooseStep(event.key==='ArrowRight'?-1:1);
    }
   }}>
   <div className={styles.track} role="list" aria-label="المحطات الزمنية مرتبة من الأقدم إلى الأحدث">
    {(allStops?stops:stops.slice(0,FIRST_STOPS)).map((entry,index)=>{
     const active=index===selectedIndex,top=index%2===0;
     const era=historyEras.find(item=>item.id===entry.era);
     return <div className={styles.stop} role="listitem" key={entry.slug}>
      <button ref={node=>{stopRefs.current[index]=node;}} data-history-stop={entry.slug} data-history-kind={entry.kind} className={[styles.stopButton,top?styles.top:styles.bottom,active?styles.selected:''].join(' ')}
       type="button" aria-pressed={active} aria-label={entry.title+'، '+historyYear(entry.year)}
       onClick={()=>chooseIndex(index)}
       onKeyDown={event=>{
        if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
         event.preventDefault();chooseStep(event.key==='ArrowRight'?-1:1);
        }
       }}>
       <span className={styles.stopCard}>
        <span className={styles.stopEra}>{era?.title||'تاريخ اليمن'}</span>
        <strong>{entry.title}</strong>
        <span className={styles.stopType}>{historyKinds[entry.kind]}</span>
       </span>
       <span className={styles.marker} aria-hidden="true"><span/></span>
       <span className={styles.stopYear}>{historyYear(entry.year)}</span>
      </button>
     </div>;
    })}
   </div>
  </div>
  <div className={styles.axisFoot}><span>نقطة البداية</span><span>نقطة النهاية</span></div>
  <article className={styles.spotlight} aria-live="polite" aria-atomic="true">
   {!selected?.pending&&<HistoryMedia entry={selected} variant="spotlight"/>}
   <div className={styles.spotlightBody}>
    <div className={styles.spotlightMeta}><span>{activeEra?.title}</span><span>{historyKinds[selected?.kind]}</span><span>{historyYear(selected?.year)}</span></div>
    <h4>{selected?.title}</h4>
    {selected?.pending?<HistoryPending status={detailsStatus} onRetry={onRetry}/>:<p>{selected?.summary}</p>}
    {!selected?.pending&&<div className={styles.spotlightFacts}><span><CalendarDays size={15}/>{selected?.period}</span>{selected?.location&&<span><MapPin size={15}/>{selected.location}</span>}<span><BookOpen size={15}/>{countOf(historySourceCount(selected),'source')}</span></div>}
   </div>
   <Link className={styles.readButton} href={historyEntryPath(selected.slug)}>اقرأ الملف التاريخي <ArrowUpLeft size={18}/></Link>
  </article>
  <p className={styles.disclaimer}>* المحطات مرتبة حسب السنة المرجعية في المادة؛ الفواصل بينها للتصفح وليست مقياساً ثابتاً للزمن، وقد تكون التواريخ القديمة تقريبية أو متداخلة.</p>
 </section>;
}
