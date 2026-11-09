'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Search,Trash2} from 'lucide-react';
import {marketApi,marketSession} from '@/lib/market/clientApi';
import {searchHref} from '@/lib/market/search';
import styles from './Market.module.css';

const MAX=20;

// «بحوثي المحفوظة»: run a saved search again, turn its notifications on or off, or delete it.
export default function SavedSearchesList(){
 const [items,setItems]=useState(null);
 const [signedOut,setSignedOut]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  marketSession().then(session=>{
   if(!session){if(live)setSignedOut(true);return null;}
   return marketApi('/api/market/saved-searches').then(result=>{if(live)setItems(result.items);});
  }).catch(e=>live&&setError(e.message));
  return()=>{live=false;};
 },[]);
 const change=async(id,request,update)=>{
  const before=items;setError('');
  setItems(update);
  try{await marketApi('/api/market/saved-searches',request);}catch(e){setItems(before);setError(e.message);}
 };
 if(signedOut)return <p className={styles.empty}>سجّل الدخول لترى بحوثك المحفوظة. <Link href="/login?next=/market/saved-searches">تسجيل الدخول</Link></p>;
 if(error&&!items)return <p className={styles.empty} role="alert">{error}</p>;
 if(!items)return <p className={styles.empty} aria-busy="true">جارٍ التحميل…</p>;
 if(!items.length)return <p className={styles.empty}>لا توجد بحوث محفوظة. ابحث عمّا تريد ثم اضغط «احفظ هذا البحث» ليصلك إشعار عند نزول إعلان مطابق. <Link href="/market/search">ابدأ البحث</Link></p>;
 return <>
  {error&&<p className={styles.inlineError} role="alert">{error}</p>}
  <p className={styles.savedCount}>{items.length} من {MAX}</p>
  <ul className={styles.savedList}>
   {items.map(item=><li key={item.id} className={styles.savedItem}>
    <Link href={searchHref(item.filters)} className={styles.savedLabel}><Search size={16} aria-hidden="true"/>{item.label}</Link>
    <label className={styles.switch}>
     <input type="checkbox" checked={item.notify} onChange={event=>{const notify=event.target.checked;change(item.id,{method:'PATCH',body:{id:item.id,notify}},list=>list.map(row=>row.id===item.id?{...row,notify}:row));}}/>
     <span>إشعار بالجديد</span>
    </label>
    <button type="button" className={styles.favouriteRemove} aria-label={'حذف البحث «'+item.label+'»'} onClick={()=>change(item.id,{method:'DELETE',body:{id:item.id}},list=>list.filter(row=>row.id!==item.id))}><Trash2 size={16}/></button>
   </li>)}
  </ul>
 </>;
}
