import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {ArrowLeft,Banknote} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {RATE_REGIONS,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'الخدمات',description:'معلومات عملية يومية من 967: أسعار الصرف في صنعاء وعدن مع حاسبة للصرف والحوالات.',path:'/services'});

export default async function ServicesPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('services',settings))notFound();
 const data=await getPublicRates(serverDb()).catch(()=>null);
 const rates=usableRates(data?.latest||{});
 const dollar=RATE_REGIONS.map(region=>({region,row:rates[region.id+':USD']})).filter(item=>item.row);
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}>الخدمات</span>
   <h1>خدمات يومية</h1>
   <p>معلومات عملية تحتاجها في يومك، محدثة ومذكور وقت تحديثها.</p>
  </header>
  <div className={styles.cards}>
   <Link className={styles.card} href="/services/exchange-rates">
    <span className={styles.cardIcon}><Banknote size={22} aria-hidden="true"/></span>
    <h2>أسعار الصرف</h2>
    <p>سعر الدولار والريال السعودي في صنعاء وعدن، مع حاسبة للصرف والحوالات.</p>
    {dollar.length>0&&<span className={styles.cardFigures}>{dollar.map(({region,row})=><span key={region.id}>الدولار في {region.name}: <strong>{formatNumber(row.sell)}</strong></span>)}</span>}
    <span className={styles.cardGo}>افتح الأسعار <ArrowLeft size={16} aria-hidden="true"/></span>
   </Link>
  </div>
 </div>;
}
