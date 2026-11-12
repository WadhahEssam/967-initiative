import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {AlertTriangle,Medal,Trophy} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getReportersBoard} from '@/lib/priceIncentivesServer';
import {formatRateTime} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {agreeingText} from '@/lib/priceReports';
import {BadgeIcons} from '@/components/services/PriceBadges';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'أفضل مبلّغي الأسعار هذا الأسبوع',description:'أعضاء 967 الذين ساعدوا الناس في صنعاء وعدن على معرفة السعر الحقيقي للدولار والمواد الأساسية هذا الأسبوع.',path:'/services/reporters'});

const CITY_HUE={sanaa:'var(--c-teal)',aden:'var(--c-indigo)'};

// «لوحة المبلّغين»: the week's best reporters in each city, ranked by reports that agreed with the
// price that held (not by how many they sent).
export default async function ReportersPage(){
 const settings=await getSiteSettings();
 const access=await sectionAccess('services',settings);
 if(!access)notFound();
 const board=await getReportersBoard(serverDb()).catch(()=>undefined);
 if(board===null)notFound();
 const until=board?formatRateTime(new Date(Date.parse(board.week.end)-60e3).toISOString(),{weekday:'long',day:'numeric',month:'long'}):'';
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services">الخدمات</Link> / المبلّغون</span>
   <h1>أفضل المبلّغين هذا الأسبوع</h1>
   <p>أعضاء ساعدوا الناس في مدينتهم على معرفة السعر الحقيقي. الترتيب بعدد البلاغات التي توافقت مع السعر الذي ثبت، لا بعدد البلاغات المرسلة.</p>
   {until&&<span className={styles.updated}><Trophy size={15} aria-hidden="true"/> يبدأ الأسبوع يوم السبت، وينتهي <strong>{until}</strong></span>}
  </header>
  {board===undefined&&<p className={styles.notice} data-tone="warning" role="alert"><AlertTriangle size={18} aria-hidden="true"/> تعذر تحميل اللوحة الآن. أعد المحاولة بعد قليل.</p>}
  {board&&<div className={styles.boards}>{board.cities.map(city=><section key={city.id} className={styles.cityCard} style={{'--city':CITY_HUE[city.id]}} aria-labelledby={'reporters-'+city.id}>
   <div className={styles.cityHead}><h2 id={'reporters-'+city.id}>{city.name}</h2></div>
   {city.top.length?<ol className={styles.reporterBoard}>{city.top.map(entry=><li key={entry.rank} data-rank={entry.rank<=3?entry.rank:undefined}>
    <span className={styles.reporterRank}>{entry.rank<=3?<Medal size={18} aria-label={'المركز '+entry.rank}/>:formatNumber(entry.rank)}</span>
    <span className={styles.reporterName}>{entry.name}<BadgeIcons codes={entry.badges}/></span>
    <span className={styles.reporterCount}>{agreeingText(entry.agreeing)}</span>
   </li>)}</ol>:<p className={styles.missing}>لا يوجد مبلّغون في {city.name} هذا الأسبوع بعد. كن أولهم.</p>}
  </section>)}</div>}
  <aside className={styles.about} aria-labelledby="reporters-about">
   <h2 id="reporters-about">كيف تظهر هنا؟</h2>
   <ul>
    <li>أبلغ عن سعر الصرف أو سعر مادة في مدينتك من صفحة <Link href="/services/exchange-rates">أسعار الصرف</Link> أو <Link href="/services/food-prices">أسعار المواد</Link>.</li>
    <li>يُحتسب البلاغ «متوافقًا» حين يكون قريبًا من السعر الذي ثبت بعد بلاغات الآخرين (في حدود 5%).</li>
    <li>تُحدَّث اللوحة كل بضع دقائق، ويبدأ كل أسبوع من جديد.</li>
   </ul>
   <p>سجلك وشاراتك في <Link href="/account/prices">مساهماتي في الأسعار</Link>.</p>
  </aside>
 </div>;
}
