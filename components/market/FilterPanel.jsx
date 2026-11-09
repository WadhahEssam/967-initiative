'use client';
import {useState} from 'react';
import Link from 'next/link';
import {SlidersHorizontal} from 'lucide-react';
import {CATEGORIES,CONDITIONS,CURRENCIES,findCategory} from '@/lib/market/catalog';
import {ALL_YEMEN,SORTS} from '@/lib/market/search';
import Sheet from './Sheet';
import ui from './ui.module.css';
import styles from './Market.module.css';

// «الفلاتر»: one button that opens a sheet, so the results stay on screen. A plain GET form: the
// choices go in the address, so a search can be shared, saved and reloaded. Districts follow the
// governorate; the price range appears once a currency is chosen (prices compare in one currency).
export default function FilterPanel({filters,places,activeCount=0}){
 const [open,setOpen]=useState(false);
 const [category,setCategory]=useState(filters.category||'');
 const [gov,setGov]=useState(filters.gov||ALL_YEMEN);
 const [currency,setCurrency]=useState(filters.currency||'');
 const subs=findCategory(category)?.subcategories||[];
 const districts=gov&&gov!==ALL_YEMEN?places.districts.filter(item=>item.governorateId===gov):[];
 const select=(label,props,options,key)=><label key={key} className={ui.field}><span>{label}</span><select className={ui.input} {...props}>{options}</select></label>;
 return <>
  <button type="button" className={activeCount?styles.filterButtonOn:styles.filterButton} onClick={()=>setOpen(true)} aria-haspopup="dialog">
   <SlidersHorizontal size={17} aria-hidden="true"/> الفلاتر{activeCount>0&&<b>{activeCount}</b>}
  </button>
  <Sheet open={open} title="الفلاتر والترتيب" onClose={()=>setOpen(false)}>
   <form action="/market/search" method="get" className={styles.filterForm}>
    {filters.q&&<input type="hidden" name="q" value={filters.q}/>}
    {select('الفئة',{name:'category',value:category,onChange:event=>setCategory(event.target.value)},<><option value="">كل الفئات</option>{CATEGORIES.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</>)}
    {subs.length>1&&select('القسم',{name:'sub',defaultValue:filters.sub||''},<><option value="">كل الأقسام</option>{subs.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</>,'sub-'+category)}
    {select('المحافظة',{name:'gov',value:gov,onChange:event=>setGov(event.target.value)},<><option value={ALL_YEMEN}>كل اليمن</option>{places.governorates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</>)}
    {districts.length>0&&select('المديرية',{name:'district',defaultValue:filters.district||''},<><option value="">كل المديريات</option>{districts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</>,'district-'+gov)}
    {select('الحالة',{name:'condition',defaultValue:filters.condition||''},<><option value="">أي حالة</option>{CONDITIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</>)}
    {select('العملة',{name:'currency',value:currency,onChange:event=>setCurrency(event.target.value)},<><option value="">أي عملة</option>{CURRENCIES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</>)}
    {currency&&<div className={styles.priceRange}>
     <label className={ui.field}><span>السعر من</span><input className={ui.input} name="min" inputMode="numeric" dir="ltr" defaultValue={filters.min??''} placeholder="0"/></label>
     <label className={ui.field}><span>إلى</span><input className={ui.input} name="max" inputMode="numeric" dir="ltr" defaultValue={filters.max??''} placeholder="بلا حد"/></label>
    </div>}
    {select('الترتيب',{name:'sort',defaultValue:filters.sort||'new'},SORTS.map(item=><option key={item.value} value={item.value}>{item.label}</option>))}
    <div className={styles.filterActions}>
     <button type="submit" className={`${ui.button} ${ui.primary} ${ui.large}`}>عرض النتائج</button>
     <Link href={filters.q?'/market/search?q='+encodeURIComponent(filters.q)+'&gov='+ALL_YEMEN:'/market/search?gov='+ALL_YEMEN} className={ui.textButton} onClick={()=>setOpen(false)}>مسح الفلاتر</Link>
    </div>
   </form>
  </Sheet>
 </>;
}
