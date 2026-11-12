import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {AlertTriangle,ArrowDown,ArrowUp,Clock3,Minus} from 'lucide-react';
import RateConverter from '@/components/services/RateConverter';
import RateTrend from '@/components/services/RateTrend';
import Sparkline from '@/components/services/Sparkline';
import {PriceActions} from '@/components/services/PriceReport';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {getPriceBoard,getPriceWeek} from '@/lib/priceConsensusServer';
import {CONFIDENCE,basisText,mergeRates,rangeText} from '@/lib/priceReports';
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

// Members' reports behind the price: confidence, «بناءً على… · آخر تحديث…», and the range.
function Community({info,now}){
 if(!info)return null;
 const level=CONFIDENCE[info.confidence],range=rangeText(info,formatNumber);
 return <p className={styles.community}>
  {level&&<span className={styles.confidence} data-level={info.confidence} title={level.hint}>{level.label}</span>}
  <span>{basisText(info,now)}</span>
  {range&&<span>{range}</span>}
 </p>;
}

export default async function ExchangeRatesPage(){
 const settings=await getSiteSettings();
 const access=await sectionAccess('services',settings);
 if(!access)notFound();
 const db=serverDb();
 const [data,board,week]=await Promise.all([getPublicRates(db).catch(()=>null),getPriceBoard(db).catch(()=>null),getPriceWeek(db).catch(()=>null)]);
 // The price members' reports settled on where there is one, the team's entry otherwise.
 const now=Date.now(),rates=usableRates(mergeRates(data?.latest||{},board),now);
 const times=Object.values(rates).map(row=>Date.parse(row.recorded_at));
 const newest=times.length?new Date(Math.max(...times)).toISOString():null;
 const stale=Object.values(rates).some(row=>rateFreshness(row.recorded_at,now)==='stale');
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
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
     // The small chart: the last 7 days of the price shown, once members' reports are on.
     const recent=week?.['rate:'+region.id+':USD:sell'],spark=recent?.length>=2?{points:recent,days:7}:{points:series,days:30};
     return <section key={region.id} className={styles.cityCard} style={{'--city':CITY_HUE[region.id]}} aria-labelledby={'rates-'+region.id}>
      <div className={styles.cityHead}><h2 id={'rates-'+region.id}>{region.name}</h2>{rows[0]&&<Freshness at={rows[0].row.recorded_at} now={now}/>}</div>
      <p className={styles.boardHint}>{region.hint}</p>
      {dollar?<div className={styles.headline}>
       <div>
        <span className={styles.headlineLabel}>الدولار · سعر البيع</span>
        <p className={styles.bigFigure}><strong>{formatNumber(dollar.sell)}</strong> <span>ريال</span></p>
        <Change series={series} row={dollar}/>
       </div>
       <Sparkline className={styles.spark} points={spark.points} label={'اتجاه سعر الدولار في '+region.name+' خلال '+(spark.days===7?'7 أيام':'30 يومًا')}/>
      </div>:null}
      {dollar&&<Community info={dollar.community} now={now}/>}
      {board&&<PriceActions kind="rate" region={region.id} item="USD" regionName={region.name}/>}
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
    <li>يجمعها فريق 967 يوميًا من صرّافين في صنعاء وعدن، ويُكملها بلاغات الأعضاء. السعر المعروض هو وسيط البلاغات المتقاربة، ولا يتغير ببلاغ واحد مهما كان رقمه. وهي أسعار استرشادية وليست نشرة رسمية.</li>
    <li>قد يختلف السعر الفعلي قليلًا بين محل وآخر وخلال اليوم نفسه.</li>
    <li>يظهر تحذير إذا مضى على السعر أكثر من يوم، ويُخفى بعد يومين.</li>
   </ul>
   {board?<p>رأيت سعرًا مختلفًا؟ اضغط «السعر مختلف» تحت سعر مدينتك. وتعرّف على <Link href="/services/reporters">أفضل المبلّغين هذا الأسبوع</Link>.</p>:<p>رأيت سعرًا مختلفًا؟ <Link href={'/contribute?type='+encodeURIComponent('تصحيح معلومة')}>أخبرنا</Link>.</p>}
  </aside>
 </div>;
}
