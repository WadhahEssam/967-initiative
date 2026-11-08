import NextLink from 'next/link';
import {History} from 'lucide-react';
import {formatDayMonth} from '@/lib/onThisDay';
import styles from './OnThisDay.module.css';

// «في مثل هذا اليوم»: one dated event from the history texts, under the greeting.
export default function OnThisDay({result}){
 const item=result?.items?.[0];
 if(!item)return null;
 const label=result.exact?'في مثل هذا اليوم':'هذا الأسبوع في تاريخ اليمن';
 const href='/yemen-history/'+encodeURIComponent(item.slug);
 return <section className={styles.band} aria-labelledby="on-this-day-title">
  <span className={styles.icon} aria-hidden="true"><History size={20} strokeWidth={1.8}/></span>
  <div className={styles.body}>
   <p className={styles.kicker}><span id="on-this-day-title">{label}</span> · <time>{formatDayMonth(item)} {item.year}م</time></p>
   <h2 className={styles.title}><NextLink href={href}>{item.title}</NextLink></h2>
   <p className={styles.text}>{item.sentence}</p>
  </div>
  <NextLink href={href} className={styles.more} aria-label={'اقرأ القصة: '+item.title}>اقرأ القصة</NextLink>
 </section>;
}
