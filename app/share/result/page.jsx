import {notFound} from 'next/navigation';
import Link from '@/components/SiteLink';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {parseResultShare,resultShareImagePath,resultShareQuery} from '@/lib/resultShare';
import {describeResult} from '@/lib/resultShareServer';
import ShareArrival from './ShareArrival';
import styles from './result.module.css';

export const dynamic='force-dynamic';

// Where a shared result link lands: the result as a challenge, and one tap to try it.
async function load(searchParams){
 const result=parseResultShare(await searchParams);
 if(!result)return null;
 const settings=await getSiteSettings();
 if(!sectionGate(result.kind==='game'?'games':'school',settings))return null;
 const card=await describeResult(result);
 return card?{result,card}:null;
}

export async function generateMetadata({searchParams}){
 const loaded=await load(searchParams);
 if(!loaded)return pageMetadata({title:'نتيجة في 967',path:'/share/result',noindex:true});
 const {result,card}=loaded;
 return pageMetadata({title:card.title,description:card.description,path:'/share/result?'+resultShareQuery(result),image:resultShareImagePath(result),noindex:true});
}

export default async function SharedResultPage({searchParams}){
 const loaded=await load(searchParams);
 if(!loaded)notFound();
 const {result,card}=loaded;
 return <div className={styles.page} style={{'--result-accent':card.accent}}>
  <ShareArrival kind={result.kind==='game'?result.game:result.course}/>
  <article className={styles.card}>
   <span className={styles.kicker}>{card.kicker}</span>
   <p className={styles.score} dir="ltr">{card.art.text}</p>
   <p className={styles.scoreLabel}>{card.art.label}</p>
   <h1>{card.title}</h1>
   <p className={styles.subtitle}>{card.subtitle}</p>
   <p className={styles.challenge}>{card.challenge}</p>
   <div className={styles.actions}>
    <Link className={styles.primary} href={card.cta.href}>{card.cta.label}</Link>
    <Link className={styles.secondary} href={card.more.href}>{card.more.label}</Link>
   </div>
  </article>
 </div>;
}
