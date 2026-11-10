import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {AlertTriangle,ArrowDown,ArrowUp,Clock3,ShoppingBasket} from 'lucide-react';
import FoodBoard from '@/components/services/FoodBoard';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getPublicFoodPrices} from '@/lib/foodPricesServer';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {FOOD_BASKET,FOOD_GROUPS,FOOD_ITEMS,FOOD_REGIONS,basketCost,daysOld,foodFreshness,foodItem,foodKey,foodRegionName,inDollars,priceChange,topMoves,unitPrice} from '@/lib/foodPrices';
import {formatRateTime,usableRates} from '@/lib/exchangeRates';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'أسعار المواد الأساسية في صنعاء وعدن',description:'أسعار الدقيق والأرز والسكر والزيت والخضار واللحوم والغاز والوقود في صنعاء وعدن، تُحدَّث أسبوعيًا، مع ما يعادلها بالدولار.',path:'/services/food-prices'});

const ago=days=>days<=1?'منذ يوم':days===2?'منذ يومين':days<=10?'منذ '+days+' أيام':'منذ '+days+' يومًا';
const CITY_HUE={sanaa:'var(--c-teal)',aden:'var(--c-indigo)'};

export default async function FoodPricesPage(){
 const settings=await getSiteSettings();
 const access=await sectionAccess('foodPrices',settings);
 if(!access)notFound();
 const db=serverDb();
 const [data,rateData]=await Promise.all([getPublicFoodPrices(db).catch(()=>null),getPublicRates(db).catch(()=>null)]);
 const now=Date.now(),rates=usableRates(rateData?.latest||{},now);
 // Only prices still within three weeks are shown, compared or added up.
 const pairs=Object.fromEntries(Object.entries(data?.prices||{}).filter(([,pair])=>pair.latest&&foodFreshness(pair.latest.recorded_at,now)!=='expired'));
 const latest=Object.fromEntries(Object.entries(pairs).map(([key,pair])=>[key,pair.latest]));
 const shown=Object.values(latest);
 const newest=shown.length?new Date(Math.max(...shown.map(row=>Date.parse(row.recorded_at)))).toISOString():null;
 const stale=shown.some(row=>foodFreshness(row.recorded_at,now)==='stale');
 const rows=FOOD_ITEMS.map(item=>({id:item.id,name:item.name,unit:item.unit,group:item.group,cells:Object.fromEntries(FOOD_REGIONS.map(region=>{
  const pair=pairs[foodKey(region.id,item.id)];
  if(!pair)return [region.id,null];
  const {price,recorded_at}=pair.latest,isStale=foodFreshness(recorded_at,now)==='stale';
  return [region.id,{price,per:unitPrice(item.id,price),usd:inDollars(region.id,price,rates),change:priceChange(pair),stale:isStale,ago:isStale?ago(daysOld(recorded_at,now)):''}];
 }))}));
 const baskets=FOOD_REGIONS.map(region=>({region,cost:basketCost(latest,region.id,rates)})).filter(item=>item.cost);
 const maxBasket=Math.max(...baskets.map(item=>item.cost.dollars||0));
 const moves=topMoves(pairs);
 const canUseDollars=FOOD_REGIONS.some(region=>rates[region.id+':USD']);
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services">الخدمات</Link> / أسعار المواد الأساسية</span>
   <h1>أسعار المواد الأساسية</h1>
   <p>أسعار الغذاء والغاز والوقود في صنعاء وعدن، بالوحدة التي يشتري بها الناس. الريال مختلف القيمة بين المدينتين، فقارن بالدولار.</p>
   {newest&&<span className={styles.updated}><Clock3 size={15} aria-hidden="true"/> آخر تحديث: <strong>{formatRateTime(newest,{weekday:'long',day:'numeric',month:'long'})}</strong></span>}
  </header>
  {!data&&<p className={styles.notice} data-tone="warning" role="alert"><AlertTriangle size={18} aria-hidden="true"/> تعذر تحميل الأسعار الآن. أعد المحاولة بعد قليل.</p>}
  {data&&!newest&&<p className={styles.notice} role="status"><Clock3 size={18} aria-hidden="true"/> لا توجد أسعار محدثة خلال الأسابيع الثلاثة الماضية. نعرض السعر فقط حين يكون حديثًا، حتى لا يُبنى قرار على رقم قديم.</p>}
  {stale&&<p className={styles.notice} data-tone="warning" role="status"><AlertTriangle size={18} aria-hidden="true"/> بعض الأسعار مضى عليها أكثر من أسبوع، ومكتوب تحتها متى سُجّلت.</p>}
  {newest&&<>
   {(baskets.length>0||moves.length>0)&&<div className={styles.foodSummary}>
    {baskets.length>0&&<section className={styles.basket} aria-labelledby="basket-title">
     <h2 id="basket-title"><ShoppingBasket size={20} aria-hidden="true"/> كلفة سلة أساسية</h2>
     <ul className={styles.basketBars}>{baskets.map(({region,cost})=><li key={region.id} style={{'--city':CITY_HUE[region.id]}}>
      <span className={styles.basketCity}>{region.name}</span>
      <span className={styles.basketBar}><i style={{inlineSize:cost.dollars&&maxBasket?Math.max(8,cost.dollars/maxBasket*100)+'%':'100%'}}/></span>
      <span className={styles.basketValue}>{cost.dollars!==null?<strong>${formatNumber(cost.dollars,{maximumFractionDigits:0})}</strong>:null}<small>{formatNumber(Math.round(cost.rials))} ريال</small></span>
     </li>)}</ul>
     <details className={styles.basketWhat}><summary>ما في السلة؟</summary><p>{FOOD_BASKET.map(entry=>entry.label).join('، ')}. المقارنة بالدولار بسعر صرف اليوم في كل مدينة.</p></details>
    </section>}
    {moves.length>0&&<section className={styles.moves} aria-labelledby="moves-title">
     <h2 id="moves-title">أبرز التغيرات</h2>
     <ul>{moves.map(move=>{const Icon=move.change>0?ArrowUp:ArrowDown;return <li key={move.region+move.item} data-dir={move.change>0?'up':'down'}>
      <Icon size={15} aria-hidden="true"/><span><strong>{foodItem(move.item).name}</strong> في {foodRegionName(move.region)}</span><b dir="ltr">{move.change>0?'+':'−'}{Math.round(Math.abs(move.change)*100)}%</b>
     </li>;})}</ul>
     <p className={styles.movesNote}>مقارنة بالقراءة السابقة لكل مادة.</p>
    </section>}
   </div>}
   <FoodBoard groups={FOOD_GROUPS} regions={FOOD_REGIONS.map(({id,name})=>({id,name}))} rows={rows} canUseDollars={canUseDollars}/>
  </>}
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
