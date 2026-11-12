'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpLeft,BadgeCheck,Trophy} from 'lucide-react';
import LoginLink from '@/components/LoginLink';
import {currentSession} from '@/lib/browserSession';
import {formatNumber} from '@/lib/format';
import {formatRateTime} from '@/lib/exchangeRates';
import {describeInstrument,timesText} from '@/lib/priceReports';
import {BadgeCards} from './PriceBadges';
import styles from './Services.module.css';

// «مساهماتي في الأسعار» (in «أنت»): reports sent, the share that agreed, trust level, badges, and
// rank in the city this week. It shows the member's own record only, never a grade per report or
// a status, so it looks the same for everyone.
export default function MyPrices(){
 const [state,setState]=useState({kind:'loading'});
 useEffect(()=>{
  let live=true;
  (async()=>{
   const session=await currentSession();
   if(!live)return;
   if(!session)return setState({kind:'guest'});
   try{
    const response=await fetch('/api/account/prices',{cache:'no-store',headers:{Authorization:'Bearer '+session.access_token}});
    const json=await response.json().catch(()=>({}));
    if(live)setState(response.ok?{kind:'ready',...json}:{kind:'error',message:json.error||'تعذر تحميل مساهماتك الآن.'});
   }catch{if(live)setState({kind:'error',message:'تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.'});}
  })();
  return()=>{live=false;};
 },[]);
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/account">حسابي</Link> / مساهماتي في الأسعار</span>
   <h1>مساهماتي في الأسعار</h1>
   <p>ما أضفته لمعرفة السعر الحقيقي في مدينتك: بلاغاتك، ومدى توافقها مع السعر الذي ثبت، وشاراتك.</p>
  </header>
  {state.kind==='loading'&&<p role="status" className={styles.missing}>جارٍ التحميل…</p>}
  {state.kind==='guest'&&<p className={styles.notice}>سجّل الدخول لترى مساهماتك. <LoginLink href="/login">تسجيل الدخول</LoginLink></p>}
  {state.kind==='error'&&<p className={styles.notice} data-tone="warning" role="alert">{state.message}</p>}
  {state.kind==='ready'&&<>
   <div className={styles.myStats}>
    <div><strong>{formatNumber(state.sent)}</strong><span>بلاغًا أرسلته</span></div>
    <div><strong>{state.agreeingShare===null?'—':state.agreeingShare+'%'}</strong><span>نسبة المتوافق منها</span></div>
    <div><strong className={styles.myLevel}><BadgeCheck size={20} aria-hidden="true"/> {state.level.label}</strong><span>مستوى الثقة</span></div>
    <div><strong>{state.rank?.rank?formatNumber(state.rank.rank):'—'}</strong><span>{state.rank?.city?'ترتيبك في '+state.rank.city+' هذا الأسبوع':'ترتيبك هذا الأسبوع'}</span></div>
   </div>
   {state.agreeingShare===null&&state.sent>0&&<p className={styles.tapHint}>تُحسب نسبة التوافق بعد ساعات من كل بلاغ، حين يتضح السعر الذي ثبت.</p>}
   {state.level.next&&<p className={styles.tapHint}>يرتفع مستوى ثقتك كلما جاءت بلاغاتك قريبة من السعر الذي ثبت. المستوى التالي: «{state.level.next}».</p>}
   <section className={styles.section} aria-labelledby="my-badges">
    <h2 id="my-badges">الشارات</h2>
    <BadgeCards badges={state.badges}/>
   </section>
   <section className={styles.section} aria-labelledby="my-recent">
    <h2 id="my-recent">آخر بلاغاتك</h2>
    {state.recent.length?<ul className={styles.history}>{state.recent.map((row,index)=><li key={index}>
     <time>{formatRateTime(row.at,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</time>
     <span>{row.confirmation?'تأكيد · ':''}{describeInstrument(row)}</span><strong>{formatNumber(row.value)}</strong>
    </li>)}</ul>:<p className={styles.missing}>لم ترسل بلاغًا بعد. ابدأ من <Link href="/services/exchange-rates">أسعار الصرف</Link> أو <Link href="/services/food-prices">أسعار المواد</Link>.</p>}
   </section>
   <p className={styles.section}><Link href="/services/reporters" className={styles.secondaryButton} style={{display:'inline-flex',flex:'0 1 auto'}}><Trophy size={16} aria-hidden="true"/> أفضل المبلّغين هذا الأسبوع <ArrowUpLeft size={15} aria-hidden="true"/></Link></p>
   {state.confirmations>0&&<p className={styles.tapHint}>وأكّدت الأسعار {timesText(state.confirmations)}.</p>}
  </>}
 </div>;
}
