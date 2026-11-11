import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {ArrowLeft,Banknote,ListChecks,ShoppingBasket} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionIsVisible} from '@/lib/pageVisibility';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {getPublicFoodPrices} from '@/lib/foodPricesServer';
import {FOOD_REGIONS,foodFreshness} from '@/lib/foodPrices';
import {RATE_REGIONS,formatRateTime,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'الخدمات',description:'معلومات عملية من 967: أسعار الصرف اليومية وأسعار المواد الأساسية في صنعاء وعدن.',path:'/services'});

const CITY_HUE={sanaa:'var(--c-teal)',aden:'var(--c-indigo)'};

export default async function ServicesPage(){
 const settings=await getSiteSettings();
 const access=await sectionAccess('services',settings);
 if(!access)notFound();
 const db=serverDb(),preview=access==='preview',showFood=preview||sectionIsVisible('foodPrices',settings.pageVisibility),showGuides=preview||sectionIsVisible('transactions',settings.pageVisibility);
 const [data,food]=await Promise.all([getPublicRates(db).catch(()=>null),showFood?getPublicFoodPrices(db).catch(()=>null):null]);
 const flour=FOOD_REGIONS.map(region=>({region,row:food?.prices?.[region.id+':wheat_flour']?.latest})).filter(item=>item.row&&foodFreshness(item.row.recorded_at)!=='expired');
 const rates=usableRates(data?.latest||{});
 const dollar=RATE_REGIONS.map(region=>({region,row:rates[region.id+':USD']})).filter(item=>item.row);
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
  <header className={styles.head}>
   <span className={styles.kicker}>الخدمات</span>
   <h1>خدمات يومية</h1>
   <p>معلومات عملية تحتاجها في يومك في صنعاء وعدن، محدثة ومذكور وقت تحديثها.</p>
  </header>
  {dollar.length>0&&<section className={styles.today} aria-labelledby="today-title">
   <h2 id="today-title">اليوم</h2>
   <div className={styles.todayGrid}>
    {dollar.map(({region,row})=><Link key={region.id} href="/services/exchange-rates" className={styles.todayTile} style={{'--city':CITY_HUE[region.id]}}>
     <span>الدولار في {region.name}</span>
     <strong>{formatNumber(row.sell)}</strong>
     <small>ريال · {formatRateTime(row.recorded_at,{hour:'numeric',minute:'2-digit'})}</small>
    </Link>)}
    {flour.map(({region,row})=><Link key={'flour-'+region.id} href="/services/food-prices" className={styles.todayTile} style={{'--city':CITY_HUE[region.id]}}>
     <span>كيس الدقيق في {region.name}</span>
     <strong>{formatNumber(row.price)}</strong>
     <small>ريال · {formatRateTime(row.recorded_at,{day:'numeric',month:'long'})}</small>
    </Link>)}
   </div>
  </section>}
  <div className={styles.cards}>
   <Link className={styles.card} href="/services/exchange-rates" style={{'--hue':'var(--c-teal)','--hue-soft':'var(--c-teal-soft)'}}>
    <span className={styles.cardIcon}><Banknote size={24} aria-hidden="true"/></span>
    <h2>أسعار الصرف</h2>
    <p>سعر الدولار والريال السعودي في صنعاء وعدن يوميًا، مع حاسبة للصرف وتقدير الحوالات بين المدينتين.</p>
    <span className={styles.cardTags}><span>يومي</span><span>حاسبة</span><span>حوالات</span></span>
    <span className={styles.cardGo}>افتح أسعار الصرف <ArrowLeft size={16} aria-hidden="true"/></span>
   </Link>
   {showFood&&<Link className={styles.card} href="/services/food-prices" style={{'--hue':'var(--c-amber)','--hue-soft':'var(--c-amber-soft)'}}>
    <span className={styles.cardIcon}><ShoppingBasket size={24} aria-hidden="true"/></span>
    <h2>أسعار المواد الأساسية</h2>
    <p>الدقيق والأرز والسكر والزيت والخضار واللحوم والغاز والوقود، مع المقارنة بالدولار بين المدينتين.</p>
    <span className={styles.cardTags}><span>أسبوعي</span><span>22 مادة</span><span>سلة أساسية</span></span>
    <span className={styles.cardGo}>افتح الأسعار <ArrowLeft size={16} aria-hidden="true"/></span>
   </Link>}
   {showGuides&&<Link className={styles.card} href="/transactions" style={{'--hue':'var(--c-violet)','--hue-soft':'var(--c-violet-soft)'}}>
    <span className={styles.cardIcon}><ListChecks size={24} aria-hidden="true"/></span>
    <h2>دليل المعاملات</h2>
    <p>الأوراق المطلوبة والخطوات بالترتيب لأشهر المعاملات الحكومية، في صنعاء وعدن.</p>
    <span className={styles.cardTags}><span>خطوة بخطوة</span><span>قائمة أوراق</span></span>
    <span className={styles.cardGo}>افتح الدليل <ArrowLeft size={16} aria-hidden="true"/></span>
   </Link>}
  </div>
 </div>;
}
