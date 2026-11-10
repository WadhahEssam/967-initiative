import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {AlertTriangle,ArrowDown,ArrowUp,Clock3} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {getPublicFoodPrices} from '@/lib/foodPricesServer';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {FOOD_GROUPS,FOOD_ITEMS,FOOD_REGIONS,daysOld,foodFreshness,foodKey,inDollars,priceChange,unitPrice} from '@/lib/foodPrices';
import {formatRateTime,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'أسعار المواد الأساسية في صنعاء وعدن',description:'أسعار الدقيق والأرز والسكر والزيت والخضار واللحوم والغاز والوقود في صنعاء وعدن، تُحدَّث أسبوعيًا، مع ما يعادلها بالدولار.',path:'/services/food-prices'});

const money=value=>formatNumber(value,{maximumFractionDigits:value<100?2:0});
const ago=days=>days<=1?'منذ يوم':days===2?'منذ يومين':days<=10?'منذ '+days+' أيام':'منذ '+days+' يومًا';

function Cell({pair,item,region,rates,now}){
 if(!pair?.latest||foodFreshness(pair.latest.recorded_at,now)==='expired')return <td className={styles.foodEmpty}><span aria-label="لا يوجد سعر حديث">—</span></td>;
 const {price,recorded_at}=pair.latest,per=unitPrice(item.id,price),usd=inDollars(region.id,price,rates),change=priceChange(pair);
 const stale=foodFreshness(recorded_at,now)==='stale';
 const percent=change===null?0:Math.round(change*100);
 const Icon=percent>0?ArrowUp:ArrowDown;
 return <td data-stale={stale||undefined}>
  <span className={styles.foodPrice}>{money(price)}</span>
  {percent!==0&&<small className={percent>0?styles.up:styles.down} title="مقارنة بالقراءة السابقة"><Icon size={12} aria-hidden="true"/> {Math.abs(percent)}%<span className="sr-only">{percent>0?' ارتفاع':' انخفاض'} عن القراءة السابقة</span></small>}
  {per&&<small>{per.unit} {money(per.value)}</small>}
  {usd!==null&&<small>≈ {formatNumber(usd,{maximumFractionDigits:usd<10?2:1})} دولار</small>}
  {stale&&<small className={styles.foodStale}>{ago(daysOld(recorded_at,now))}</small>}
 </td>;
}

export default async function FoodPricesPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('foodPrices',settings))notFound();
 const db=serverDb();
 const [data,rateData]=await Promise.all([getPublicFoodPrices(db).catch(()=>null),getPublicRates(db).catch(()=>null)]);
 const now=Date.now(),rates=usableRates(rateData?.latest||{},now);
 const shown=Object.values(data?.prices||{}).map(pair=>pair.latest).filter(row=>foodFreshness(row.recorded_at,now)!=='expired');
 const newest=shown.length?new Date(Math.max(...shown.map(row=>Date.parse(row.recorded_at)))).toISOString():null;
 const stale=shown.some(row=>foodFreshness(row.recorded_at,now)==='stale');
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services">الخدمات</Link> / أسعار المواد الأساسية</span>
   <h1>أسعار المواد الأساسية</h1>
   <p>أسعار الغذاء والغاز والوقود في صنعاء وعدن، بالوحدة التي يشتري بها الناس. الأسعار بالريال اليمني، ولا تُقارن مباشرة بين المدينتين لاختلاف العملة المتداولة في كل منهما؛ للمقارنة انظر ما يعادلها بالدولار.</p>
   {newest&&<span className={styles.updated}><Clock3 size={15} aria-hidden="true"/> آخر تحديث: <strong>{formatRateTime(newest,{weekday:'long',day:'numeric',month:'long'})}</strong></span>}
  </header>
  {!data&&<p className={styles.notice} data-tone="warning" role="alert"><AlertTriangle size={18} aria-hidden="true"/> تعذر تحميل الأسعار الآن. أعد المحاولة بعد قليل.</p>}
  {data&&!newest&&<p className={styles.notice} role="status"><Clock3 size={18} aria-hidden="true"/> لا توجد أسعار محدثة خلال الأسابيع الثلاثة الماضية. نعرض السعر فقط حين يكون حديثًا، حتى لا يُبنى قرار على رقم قديم.</p>}
  {stale&&<p className={styles.notice} data-tone="warning" role="status"><AlertTriangle size={18} aria-hidden="true"/> بعض الأسعار مضى عليها أكثر من أسبوع، ومكتوب تحتها متى سُجّلت.</p>}
  {newest&&<div className={styles.foodWrap}>
   <table className={styles.food}>
    <caption className="sr-only">أسعار المواد الأساسية بالريال اليمني في صنعاء وعدن</caption>
    <thead><tr><th scope="col">المادة</th>{FOOD_REGIONS.map(region=><th key={region.id} scope="col">{region.name}</th>)}</tr></thead>
    {FOOD_GROUPS.map(group=><tbody key={group.id}>
     <tr className={styles.foodGroup}><th scope="rowgroup" colSpan={FOOD_REGIONS.length+1}>{group.name}</th></tr>
     {FOOD_ITEMS.filter(item=>item.group===group.id).map(item=><tr key={item.id}>
      <th scope="row">{item.name}<small>{item.unit}</small></th>
      {FOOD_REGIONS.map(region=><Cell key={region.id} pair={data.prices[foodKey(region.id,item.id)]} item={item} region={region} rates={rates} now={now}/>)}
     </tr>)}
    </tbody>)}
   </table>
  </div>}
  <aside className={styles.about} aria-labelledby="food-about">
   <h2 id="food-about">عن هذه الأسعار</h2>
   <ul>
    <li>يجمعها فريق 967 أسبوعيًا من أسواق صنعاء وعدن، وهي أسعار استرشادية وليست نشرة رسمية؛ قد يختلف السعر بين محل وآخر.</li>
    <li>السهم بجانب السعر يقارنه بالقراءة السابقة. ما يعادله بالدولار محسوب بسعر صرف اليوم في المدينة نفسها، وسعر الكيلو أو اللتر محسوب من سعر الكيس أو الدبة.</li>
    <li>يظهر تنبيه إذا مضى على السعر أكثر من أسبوع، ويُخفى بعد ثلاثة أسابيع.</li>
   </ul>
   <p>رأيت سعرًا مختلفًا؟ <Link href={'/contribute?type='+encodeURIComponent('تصحيح معلومة')}>أخبرنا</Link>. وتجد <Link href="/services/exchange-rates">أسعار الصرف اليومية</Link> في الخدمات.</p>
  </aside>
 </div>;
}
