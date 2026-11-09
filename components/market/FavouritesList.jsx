'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Package,Trash2} from 'lucide-react';
import ListingCard from './ListingCard';
import {marketApi,marketSession} from '@/lib/market/clientApi';
import {formatPrice} from '@/lib/market/format';
import styles from './Market.module.css';

const STATE_LABELS={sold:'مباع',expired:'منتهي',gone:'لم يعد متاحًا'};

// «المفضلة»: saved listings, newest first. Sold and expired ones stay with a label, with an
// available listing like them underneath when there is one.
export default function FavouritesList(){
 const [items,setItems]=useState(null);
 const [signedOut,setSignedOut]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  marketSession().then(session=>{
   if(!session){if(live)setSignedOut(true);return null;}
   return marketApi('/api/market/favourites').then(result=>{if(live)setItems(result.items);});
  }).catch(e=>live&&setError(e.message));
  return()=>{live=false;};
 },[]);
 const remove=async listingId=>{
  const before=items;
  setItems(list=>list.filter(item=>item.listing.id!==listingId));
  try{await marketApi('/api/market/favourites',{method:'DELETE',body:{listingId}});}catch(e){setItems(before);setError(e.message);}
 };
 if(signedOut)return <p className={styles.empty}>سجّل الدخول لترى الإعلانات التي حفظتها. <Link href="/login?next=/market/favourites">تسجيل الدخول</Link></p>;
 if(error&&!items)return <p className={styles.empty} role="alert">{error}</p>;
 if(!items)return <p className={styles.empty} aria-busy="true">جارٍ التحميل…</p>;
 if(!items.length)return <p className={styles.empty}>لم تحفظ أي إعلان بعد. اضغط على القلب في صفحة أي إعلان لتجده هنا. <Link href="/market">تصفح السوق</Link></p>;
 return <>
  {error&&<p className={styles.inlineError} role="alert">{error}</p>}
  <ul className={styles.favourites}>
   {items.map(item=><li key={item.listing.id} className={styles.favourite}>
    <div className={styles.favouriteCard}>
     {item.linkable?<ListingCard listing={item.listing}/>:<div className={styles.card} aria-disabled="true">
      <span className={styles.cardImage}>
       {/* eslint-disable-next-line @next/next/no-img-element */}
       {item.listing.cover?<img src={item.listing.cover} alt="" loading="lazy"/>:<Package size={34} aria-hidden="true"/>}
       <span className={styles.badgeSold}>{STATE_LABELS[item.state]}</span>
      </span>
      <span className={styles.cardBody}><strong className={styles.cardPrice}>{formatPrice(item.listing.price,item.listing.currency)}</strong><span className={styles.cardTitle}>{item.listing.title}</span></span>
     </div>}
     <button type="button" className={styles.favouriteRemove} onClick={()=>remove(item.listing.id)} aria-label={'إزالة «'+item.listing.title+'» من المفضلة'}><Trash2 size={16}/></button>
    </div>
    {item.state!=='available'&&item.linkable&&<small className={styles.favouriteState}>{STATE_LABELS[item.state]}</small>}
    {item.alternative&&<div className={styles.alternative}><small>إعلان مشابه متاح</small><ListingCard listing={item.alternative}/></div>}
   </li>)}
  </ul>
 </>;
}
