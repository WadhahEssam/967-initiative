'use client';
import NextLink from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {History} from 'lucide-react';
import {formatDayMonth} from '@/lib/onThisDay';
import styles from './OnThisDay.module.css';

function Slide({item,label,id}){
 const href='/yemen-history/'+encodeURIComponent(item.slug);
 return <article className={styles.band} aria-labelledby={id}>
  <span className={styles.icon} aria-hidden="true"><History size={20} strokeWidth={1.8}/></span>
  <div className={styles.body}>
   <p className={styles.kicker}><span id={id}>{label}</span> · <time>{formatDayMonth(item)} {item.year}م</time></p>
   <h2 className={styles.title}><NextLink href={href}>{item.title}</NextLink></h2>
   <p className={styles.text}>{item.sentence}</p>
  </div>
  <NextLink href={href} className={styles.more} aria-label={'اقرأ القصة: '+item.title}>اقرأ القصة</NextLink>
 </article>;
}

// «في مثل هذا اليوم»: today's dated event from the history texts. Swiping left (or «أمس») shows
// yesterday's, for whoever missed it. Only today and yesterday: never a day ahead.
export default function OnThisDay({result,yesterday=null}){
 const item=result?.items?.[0];
 const missed=yesterday?.items?.[0];
 const track=useRef(null);
 const [active,setActive]=useState(0);
 const slides=[
  item&&{key:'today',item,label:result.exact?'في مثل هذا اليوم':'هذا الأسبوع في تاريخ اليمن'},
  missed&&missed.slug!==item?.slug&&{key:'yesterday',item:missed,label:'فاتك أمس'},
 ].filter(Boolean);
 useEffect(()=>{
  const node=track.current;
  if(!node||slides.length<2)return;
  // The slide that fills most of the track is the current one (works for swipes and buttons).
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.6)setActive(Number(entry.target.dataset.index));
  },{root:node,threshold:[.6]});
  node.querySelectorAll('[data-index]').forEach(slide=>observer.observe(slide));
  return()=>observer.disconnect();
 },[slides.length]);
 if(!slides.length)return null;
 if(slides.length===1)return <section className={styles.single} aria-label={slides[0].label}><Slide item={slides[0].item} label={slides[0].label} id="on-this-day-title"/></section>;
 const go=index=>{
  const slide=track.current?.querySelector('[data-index="'+index+'"]');
  slide?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest',inline:'start'});
  setActive(index);
 };
 return <section className={styles.carousel} aria-roledescription="شرائح" aria-label="في مثل هذا اليوم">
  <div ref={track} className={styles.track}>
   {slides.map((slide,index)=><div key={slide.key} className={styles.slide} data-index={index} aria-roledescription="شريحة" aria-label={slide.label} aria-hidden={active!==index||undefined} inert={active!==index?true:undefined}>
    <Slide item={slide.item} label={slide.label} id={'on-this-day-'+slide.key}/>
   </div>)}
  </div>
  <div className={styles.switch} role="group" aria-label="اختر اليوم">
   {slides.map((slide,index)=><button key={slide.key} type="button" aria-pressed={active===index} onClick={()=>go(index)}>{slide.key==='today'?'اليوم':'أمس'}</button>)}
   {active===0&&<span className={styles.hint} aria-hidden="true">اسحب لترى ما فاتك أمس</span>}
  </div>
 </section>;
}
