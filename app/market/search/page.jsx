import Link from 'next/link';
import {cookies,headers} from 'next/headers';
import {X} from 'lucide-react';
import FilterPanel from '@/components/market/FilterPanel';
import ListingCard from '@/components/market/ListingCard';
import MarketSearchBar from '@/components/market/MarketSearchBar';
import SaveSearchButton from '@/components/market/SaveSearchButton';
import {CONDITIONS,CURRENCIES,findCategory,findSubcategory} from '@/lib/market/catalog';
import {getMarketPlaces,placeChecks,placeNames} from '@/lib/market/places';
import {ALL_YEMEN,PLACE_COOKIE,SORTS,parseFilters,savedFilters,searchHref} from '@/lib/market/search';
import {logSearchMiss,searchListings} from '@/lib/market/searchServer';
import {isBotAgent} from '@/lib/issueDownloads';
import {serverDb} from '@/lib/supabase-server';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const dynamic='force-dynamic';
// Search results change all the time and repeat the listings: kept out of search engines.
export const metadata=pageMetadata({title:'البحث في سوق 967',description:'ابحث في إعلانات سوق 967 حسب الفئة والمحافظة والسعر والحالة.',path:'/market/search',noindex:true});
const PAGE_SIZE=24;

// The filters in use, each with a link that removes it.
function activeFilters(filters,places){
 const where=placeNames(places,filters.gov&&filters.gov!==ALL_YEMEN?filters.gov:null,filters.district||null);
 const currency=CURRENCIES.find(item=>item.value===filters.currency);
 const list=[];
 const add=(label,changes)=>list.push({label,href:searchHref(filters,{...changes,page:1})});
 if(filters.q)add('«'+filters.q+'»',{q:undefined});
 if(filters.category)add(findSubcategory(filters.category,filters.sub)?.label||findCategory(filters.category).label,{category:undefined,sub:undefined});
 if(where.governorate)add(where.district?where.governorate+' · '+where.district:where.governorate,{gov:ALL_YEMEN,district:undefined});
 if(filters.condition)add(CONDITIONS.find(item=>item.value===filters.condition).label,{condition:undefined});
 if(currency){
  const money=value=>Number(value).toLocaleString('en-US')+' '+currency.short;
  const range=filters.min!==undefined&&filters.max!==undefined?money(filters.min)+' – '+money(filters.max):filters.min!==undefined?'من '+money(filters.min):filters.max!==undefined?'حتى '+money(filters.max):currency.label;
  add(range,{currency:undefined,min:undefined,max:undefined});
 }
 return list;
}

export default async function MarketSearch({searchParams}){
 const params=await searchParams;
 const places=await getMarketPlaces();
 const home=(await cookies()).get(PLACE_COOKIE)?.value;
 let filters=parseFilters(params,placeChecks(places),home&&home!==ALL_YEMEN?home:null);
 const db=serverDb();
 const empty={cards:[],more:false};
 let result=db?await searchListings(db,places,filters,{limit:PAGE_SIZE}).catch(()=>empty):empty;
 // Nothing in the visitor's own governorate: look in all of Yemen and say so.
 let widened=null;
 if(!result.cards.length&&filters.fromHome&&db){
  widened=placeNames(places,filters.gov,null).governorate;
  filters={...filters,gov:ALL_YEMEN,fromHome:false};
  result=await searchListings(db,places,filters,{limit:PAGE_SIZE}).catch(()=>empty);
 }
 if(!result.cards.length&&filters.q&&db&&!isBotAgent((await headers()).get('user-agent')))await logSearchMiss(db,places,filters.q);
 const chips=activeFilters(filters,places);
 const saveQuery=new URLSearchParams(Object.entries(savedFilters(filters)).map(([key,value])=>[key,String(value)])).toString();
 const page=filters.page||1;
 const title=filters.q?'نتائج «'+filters.q+'»':findSubcategory(filters.category,filters.sub)?.label||findCategory(filters.category)?.label||'كل الإعلانات';
 return <div className={styles.page}>
  <MarketSearchBar initial={filters.q||''} keep={{category:filters.category,sub:filters.sub,gov:filters.fromHome?undefined:filters.gov,district:filters.district}}/>
  <FilterPanel filters={filters} places={places} activeCount={chips.filter(chip=>!chip.label.startsWith('«')).length}/>
  {chips.length>0&&<ul className={styles.chips} aria-label="الفلاتر المستخدمة">
   {chips.map(chip=><li key={chip.label}><Link href={chip.href} aria-label={'إزالة '+chip.label}>{chip.label}<X size={13} aria-hidden="true"/></Link></li>)}
  </ul>}
  <div className={styles.sectionHead}>
   <h1 className={styles.sectionTitle}>{title}</h1>
   <nav className={styles.sorts} aria-label="الترتيب">{SORTS.map(sort=><Link key={sort.value} href={searchHref(filters,{sort:sort.value,page:1})} aria-current={(filters.sort||'new')===sort.value?'true':undefined}>{sort.label}</Link>)}</nav>
  </div>
  {widened&&<p className={styles.notice}>لا توجد نتائج في {widened}، فهذه نتائج من كل اليمن.</p>}
  {result.cards.length?<div className={styles.grid}>{result.cards.map(item=><ListingCard key={item.id} listing={item}/>)}</div>
   :<div className={styles.empty}>
    <p>لم نجد إعلانات مطابقة{chips.length?'':' بعد'}.</p>
    {chips.length>0&&<p>جرّب كلمات أقل، أو <Link href={filters.q?searchHref({q:filters.q,gov:ALL_YEMEN}):'/market/search?gov='+ALL_YEMEN}>ابحث بلا فلاتر</Link>.</p>}
   </div>}
  {(page>1||result.more)&&<nav className={styles.pager} aria-label="الصفحات">
   {page>1&&<Link href={searchHref(filters,{page:page-1})} rel="prev">السابق</Link>}
   <span>صفحة {page}</span>
   {result.more&&<Link href={searchHref(filters,{page:page+1})} rel="next">التالي</Link>}
  </nav>}
  {saveQuery&&<SaveSearchButton query={saveQuery}/>}
 </div>;
}
