'use client';
import {useState} from 'react';
import Link from 'next/link';
import {SlidersHorizontal} from 'lucide-react';
import {CATEGORIES,CONDITIONS,CURRENCIES,findCategory} from '@/lib/market/catalog';
import {ALL_YEMEN,SORTS} from '@/lib/market/search';
import styles from './Market.module.css';

// Filters of the search page, in a fold that opens on phones. A plain GET form: the choices go in
// the address, so a search can be shared, saved and reloaded. Districts follow the governorate;
// the price range appears once a currency is chosen (prices are only comparable in one currency).
export default function FilterPanel({filters,places,activeCount=0}){
 const [category,setCategory]=useState(filters.category||'');
 const [gov,setGov]=useState(filters.gov||ALL_YEMEN);
 const [currency,setCurrency]=useState(filters.currency||'');
 const subs=findCategory(category)?.subcategories||[];
 const districts=gov&&gov!==ALL_YEMEN?places.districts.filter(item=>item.governorateId===gov):[];
 return <details className={styles.filters}>
  <summary><SlidersHorizontal size={16} aria-hidden="true"/> الفلاتر والترتيب{activeCount>0&&<b>{activeCount}</b>}</summary>
  <form action="/market/search" method="get" className={styles.filterForm}>
   {filters.q&&<input type="hidden" name="q" value={filters.q}/>}
   <label><span>الفئة</span><select name="category" value={category} onChange={event=>setCategory(event.target.value)}>
    <option value="">كل الفئات</option>{CATEGORIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
   </select></label>
   {subs.length>1&&<label><span>القسم</span><select name="sub" defaultValue={filters.sub||''} key={category}>
    <option value="">كل الأقسام</option>{subs.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
   </select></label>}
   <label><span>المحافظة</span><select name="gov" value={gov} onChange={event=>setGov(event.target.value)}>
    <option value={ALL_YEMEN}>كل اليمن</option>{places.governorates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   {districts.length>0&&<label><span>المديرية</span><select name="district" defaultValue={filters.district||''} key={gov}>
    <option value="">كل المديريات</option>{districts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>}
   <label><span>الحالة</span><select name="condition" defaultValue={filters.condition||''}>
    <option value="">أي حالة</option>{CONDITIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
   </select></label>
   <label><span>العملة</span><select name="currency" value={currency} onChange={event=>setCurrency(event.target.value)}>
    <option value="">أي عملة</option>{CURRENCIES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
   </select></label>
   {currency&&<div className={styles.priceRange}>
    <label><span>السعر من</span><input name="min" inputMode="numeric" dir="ltr" defaultValue={filters.min??''} placeholder="0"/></label>
    <label><span>إلى</span><input name="max" inputMode="numeric" dir="ltr" defaultValue={filters.max??''} placeholder="بلا حد"/></label>
   </div>}
   <label><span>الترتيب</span><select name="sort" defaultValue={filters.sort||'new'}>
    {SORTS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
   </select></label>
   <div className={styles.filterActions}>
    <button type="submit" className={styles.add}>عرض النتائج</button>
    <Link href={filters.q?'/market/search?q='+encodeURIComponent(filters.q)+'&gov='+ALL_YEMEN:'/market/search?gov='+ALL_YEMEN} className={styles.filterReset}>مسح الفلاتر</Link>
   </div>
  </form>
 </details>;
}
