import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {ArrowLeft,Banknote,ShoppingBasket} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate,sectionIsVisible} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {getPublicFoodPrices} from '@/lib/foodPricesServer';
import {FOOD_REGIONS,foodFreshness} from '@/lib/foodPrices';
import {RATE_REGIONS,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'الخدمات',description:'معلومات عملية من 967: أسعار الصرف اليومية وأسعار المواد الأساسية في صنعاء وعدن.',path:'/services'});

export default async function ServicesPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('services',settings))notFound();
 const db=serverDb(),showFood=sectionIsVisible('foodPrices',settings.pageVisibility);
 const [data,food]=await Promise.all([getPublicRates(db).catch(()=>null),showFood?getPublicFoodPrices(db).catch(()=>null):null]);
 const flour=FOOD_REGIONS.map(region=>({region,row:food?.prices?.[region.id+':wheat_flour']?.latest})).filter(item=>item.row&&foodFreshness(item.row.recorded_at)!=='expired');
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
   {showFood&&<Link className={styles.card} href="/services/food-prices">
    <span className={styles.cardIcon}><ShoppingBasket size={22} aria-hidden="true"/></span>
    <h2>أسعار المواد الأساسية</h2>
    <p>الدقيق والأرز والسكر والزيت والخضار واللحوم والغاز والوقود في صنعاء وعدن، أسبوعيًا.</p>
    {flour.length>0&&<span className={styles.cardFigures}>{flour.map(({region,row})=><span key={region.id}>كيس الدقيق في {region.name}: <strong>{formatNumber(row.price)}</strong></span>)}</span>}
    <span className={styles.cardGo}>افتح الأسعار <ArrowLeft size={16} aria-hidden="true"/></span>
   </Link>}
  </div>
 </div>;
}
