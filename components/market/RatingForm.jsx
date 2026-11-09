'use client';
/* eslint-disable @next/next/no-img-element -- listing covers are 480 px thumbnails; next/image would add nothing. */
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Check,Package,Star} from 'lucide-react';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import {RATING_CRITERIA,ratingOverall} from '@/lib/market/ratings';
import styles from './Ratings.module.css';

// Five stars as a radio group: arrow keys and taps both work.
function Stars({label,hint,value,onChange}){
 return <fieldset className={styles.criterion}>
  <legend>{label}<small>{hint}</small></legend>
  <div className={styles.stars} role="radiogroup" aria-label={label}>
   {[1,2,3,4,5].map(n=><button type="button" key={n} role="radio" aria-checked={value===n} aria-label={n+' من 5'} data-on={n<=value||undefined} onClick={()=>onChange(n)}><Star size={30} fill={n<=value?'currentColor':'none'}/></button>)}
  </div>
 </fieldset>;
}

// «قيّم البائع»: four criteria and an optional comment, once per listing.
export default function RatingForm({chatId}){
 const [context,setContext]=useState(null);
 const [error,setError]=useState('');
 const [scores,setScores]=useState({});
 const [comment,setComment]=useState('');
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(null);
 useEffect(()=>{
  marketSession().then(session=>{
   if(!session){location.href=loginHref();return;}
   marketApi('/api/market/ratings?chat='+encodeURIComponent(chatId)).then(setContext).catch(e=>setError(e.message));
  });
 },[chatId]);
 const complete=RATING_CRITERIA.every(({key})=>scores[key]);
 const submit=async event=>{
  event.preventDefault();setBusy(true);setError('');
  try{const result=await marketApi('/api/market/ratings',{method:'POST',body:{action:'rate',chatId,scores:{...scores,comment}}});setDone(result.rating);window.scrollTo(0,0);}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 if(error&&!context)return <p className={styles.notice} role="alert">{error}</p>;
 if(!context)return <p className={styles.notice} aria-busy="true">جارٍ التحميل…</p>;
 const listing=context.listing;
 const header=listing&&<div className={styles.listing}>
  <span className={styles.thumb}>{listing.cover?<img src={listing.cover} alt=""/>:<Package size={22} aria-hidden="true"/>}</span>
  <div><strong>{listing.title}</strong><small>البائع: {context.seller?.name||'غير متاح'}</small></div>
 </div>;
 if(done||context.existing)return <div className={styles.done}>
  {header}
  <span className={styles.doneIcon}><Check size={30} aria-hidden="true"/></span>
  <h2>{done?'شكرًا، وصل تقييمك':'قيّمت هذا البائع من قبل'}</h2>
  <p>تقييمك العام {ratingOverall((done||context.existing).scores)} من 5.</p>
  {context.seller&&<Link className={styles.secondary} href={'/market/seller/'+context.seller.id}>صفحة البائع</Link>}
 </div>;
 if(context.blocker)return <div className={styles.done}>{header}<p className={styles.notice}>{context.blocker}</p><Link className={styles.secondary} href={'/messages?tab=market&chat='+chatId}>العودة إلى المحادثة</Link></div>;
 return <form className={styles.form} onSubmit={submit}>
  {header}
  {RATING_CRITERIA.map(item=><Stars key={item.key} label={item.label} hint={item.hint} value={scores[item.key]||0} onChange={n=>setScores(current=>({...current,[item.key]:n}))}/>)}
  <label className={styles.comment}><span>تعليق (اختياري)</span>
   <textarea rows={3} maxLength={600} value={comment} onChange={event=>setComment(event.target.value)} placeholder="ما الذي أعجبك أو ما الذي يمكن أن يتحسن؟"/>
  </label>
  <p className={styles.hint}>يظهر تقييمك باسمك في صفحة البائع، ويستطيع البائع الرد عليه مرة واحدة.</p>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <button type="submit" className={styles.primary} disabled={busy||!complete}>{busy?'جارٍ الإرسال…':complete?'أرسل التقييم':'اختر النجوم للمعايير الأربعة'}</button>
 </form>;
}
