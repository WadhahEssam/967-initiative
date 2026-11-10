import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {AlertTriangle,ArrowDown,ArrowUp,Clock3,Minus} from 'lucide-react';
import RateConverter from '@/components/services/RateConverter';
import RateTrend from '@/components/services/RateTrend';
import Sparkline from '@/components/services/Sparkline';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {RATE_CURRENCIES,RATE_REGIONS,adenDay,formatRateDay,formatRateTime,rateFreshness,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'أسعار الصرف اليوم في صنعاء وعدن',description:'سعر الدولار والريال السعودي مقابل الريال اليمني في صنعاء وعدن، يُحدَّث يوميًا، مع حاسبة للصرف وتقدير الحوالات بين المدينتين.',path:'/services/exchange-rates'});

// «محدث اليوم 9:30 ص» in green, or «منذ يوم» in amber when the rate is a day old.
function Freshness({at,now}){
 const stale=rateFreshness(at,now)==='stale';
 return <span className={styles.fresh} data-stale={stale||undefined}><i aria-hidden="true"/>{stale?'منذ '+formatRateTime(at,{weekday:'long',hour:'numeric',minute:'2-digit'}):'محدث '+formatRateTime(at,{hour:'numeric',minute:'2-digit'})}</span>;
}
const CITY_HUE={sanaa:'var(--c-teal)',aden:'var(--c-indigo)'};

// How the last sell price moved since the previous recorded day.
function Change({series,row}){
 const today=adenDay(row.recorded_at),before=[...series].reverse().find(point=>point.day<today);
 if(!before)return null;
 const diff=Math.round((row.sell-before.sell)*100)/100,since=adenDay(new Date(Date.parse(row.recorded_at)-864e5).toISOString())===before.day?'عن أمس':'منذ '+formatRateDay(before.day);
 if(!diff)return <small className={styles.flat}><Minus size={12} aria-hidden="true"/> دون تغيير {since}</small>;
 const Icon=diff>0?ArrowUp:ArrowDown;
 return <small className={diff>0?styles.up:styles.down}><Icon size={12} aria-hidden="true"/> {diff>0?'ارتفع':'انخفض'} {formatNumber(Math.abs(diff))} {since}</small>;
}

export default async function ExchangeRatesPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('services',settings))notFound();
 const data=await getPublicRates(serverDb()).catch(()=>null);
 const now=Date.now(),rates=usableRates(data?.latest||{},now);
 const times=Object.values(rates).map(row=>Date.parse(row.recorded_at));
 const newest=times.length?new Date(Math.max(...times)).toISOString():null;
 const stale=Object.values(rates).some(row=>rateFreshness(row.recorded_at,now)==='stale');
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services">الخدمات</Link> / أسعار الصرف</span>
   <h1>أسعار الصرف اليوم</h1>
   <p>سعر الدولار والريال السعودي مقابل الريال اليمني في صنعاء وعدن، كما يتداوله الصرّافون. يختلف السعر بين المدينتين لاختلاف العملة المتداولة في كل منهما.</p>
   {newest&&<span className={styles.updated}><Clock3 size={15} aria-hidden="true"/> آخر تحديث: <strong>{formatRateTime(newest)}</strong> بتوقيت اليمن</span>}
  </header>
  {!data&&<p className={styles.notice} data-tone="warning" role="alert"><AlertTriangle size={18} aria-hidden="true"/> تعذر تحميل الأسعار الآن. أعد المحاولة بعد قليل.</p>}
  {data&&!newest&&<p className={styles.notice} role="status"><Clock3 size={18} aria-hidden="true"/> لا توجد أسعار محدثة خلال اليومين الماضيين. نعرض السعر فقط حين يكون حديثًا، حتى لا يُبنى قرار على رقم قديم.</p>}
  {stale&&<p className={styles.notice} data-tone="warning" role="status"><AlertTriangle size={18} aria-hidden="true"/> بعض الأسعار مضى عليها أكثر من يوم. تأكد من السعر لدى الصرّاف قبل التعامل.</p>}
  {newest&&<>
   <div className={styles.boards}>
    {RATE_REGIONS.map(region=>{
     const rows=RATE_CURRENCIES.map(currency=>({currency,row:rates[region.id+':'+currency.id]})).filter(item=>item.row);
     const dollar=rates[region.id+':USD'],series=data.series[region.id+':USD']||[];
     return <section key={region.id} className={styles.cityCard} style={{'--city':CITY_HUE[region.id]}} aria-labelledby={'rates-'+region.id}>
      <div className={styles.cityHead}><h2 id={'rates-'+region.id}>{region.name}</h2>{rows[0]&&<Freshness at={rows[0].row.recorded_at} now={now}/>}</div>
      <p className={styles.boardHint}>{region.hint}</p>
      {dollar?<div className={styles.headline}>
       <div>
        <span className={styles.headlineLabel}>الدولار · سعر البيع</span>
        <p className={styles.bigFigure}><strong>{formatNumber(dollar.sell)}</strong> <span>ريال</span></p>
        <Change series={series} row={dollar}/>
       </div>
       <Sparkline className={styles.spark} points={series} label={'اتجاه سعر الدولار في '+region.name+' خلال 30 يومًا'}/>
      </div>:null}
      {rows.length?<table className={styles.rates}>
       <thead><tr><th scope="col">العملة</th><th scope="col">شراء<small>يدفعه لك الصرّاف</small></th><th scope="col">بيع<small>تدفعه أنت</small></th></tr></thead>
       <tbody>{rows.map(({currency,row})=><tr key={currency.id}>
        <th scope="row">{currency.name}</th>
        <td>{formatNumber(row.buy)}</td>
        <td>{formatNumber(row.sell)}{currency.id!=='USD'&&<Change series={data.series[region.id+':'+currency.id]||[]} row={row}/>}</td>
       </tr>)}</tbody>
      </table>:<p className={styles.missing}>لا يوجد سعر محدث لهذه المدينة حاليًا.</p>}
     </section>;
    })}
   </div>
   {rates['sanaa:USD']&&rates['aden:USD']&&<p className={styles.insight}><strong>100 دولار</strong> تساوي اليوم نحو <strong>{formatNumber(Math.round(rates['sanaa:USD'].buy*100))}</strong> ريال في صنعاء، و<strong>{formatNumber(Math.round(rates['aden:USD'].buy*100))}</strong> ريال في عدن.</p>}
   <section className={styles.section} aria-labelledby="rates-calculator">
    <h2 id="rates-calculator">حاسبة الصرف والحوالات</h2>
    <p>احسب ما ستحصل عليه بأسعار اليوم. «شراء» هو ما يدفعه الصرّاف لك مقابل عملتك، و«بيع» هو ما تدفعه أنت لتشتري منه.</p>
    <RateConverter rates={rates}/>
   </section>
  </>}
  {data&&<section className={styles.section} aria-labelledby="rates-trend">
   <h2 id="rates-trend">الدولار خلال 30 يومًا</h2>
   <p>سعر بيع الدولار في آخر قراءة من كل يوم. لكل مدينة رسمها لأن الفرق بين السعرين كبير.</p>
   <div className={styles.trends}>{RATE_REGIONS.map(region=><RateTrend key={region.id} title={'سعر الدولار في '+region.name} points={data.series[region.id+':USD']||[]}/>)}</div>
  </section>}
  <aside className={styles.about} aria-labelledby="rates-about">
   <h2 id="rates-about">عن هذه الأسعار</h2>
   <ul>
    <li>يجمعها فريق 967 يوميًا من صرّافين في صنعاء وعدن، وهي أسعار استرشادية وليست نشرة رسمية.</li>
    <li>قد يختلف السعر الفعلي قليلًا بين محل وآخر وخلال اليوم نفسه.</li>
    <li>يظهر تحذير إذا مضى على السعر أكثر من يوم، ويُخفى بعد يومين.</li>
   </ul>
   <p>رأيت سعرًا مختلفًا؟ <Link href={'/contribute?type='+encodeURIComponent('تصحيح معلومة')}>أخبرنا</Link>.</p>
  </aside>
 </div>;
}
