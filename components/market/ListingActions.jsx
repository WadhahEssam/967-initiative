'use client';
import {useState} from 'react';
import {ArrowRight,Share2} from 'lucide-react';
import FavouriteButton from './FavouriteButton';
import styles from './Market.module.css';

// Over the listing photos, like other market apps: back on one side; save and share on the other.
export default function ListingActions({listingId,title,price,url}){
 const [note,setNote]=useState('');
 const flash=text=>{setNote(text);setTimeout(()=>setNote(''),2500);};
 const back=()=>{if(history.length>1&&document.referrer.startsWith(location.origin))history.back();else location.href='/market';};
 const share=async()=>{
  try{if(navigator.share){await navigator.share({title,text:title+' — '+price,url});return;}}catch{return;}
  try{await navigator.clipboard.writeText(url);flash('نُسخ رابط الإعلان');}catch{flash(url);}
 };
 return <div className={styles.photoActions}>
  <button type="button" className={styles.photoButton} onClick={back} aria-label="رجوع"><ArrowRight size={20} aria-hidden="true"/></button>
  <span className={styles.photoActionsEnd}>
   <button type="button" className={styles.photoButton} onClick={share} aria-label="مشاركة الإعلان"><Share2 size={19} aria-hidden="true"/></button>
   <FavouriteButton listingId={listingId} onNote={flash} className={styles.photoButton} onClassName={styles.photoButtonOn}/>
  </span>
  <span className={styles.toast} role="status" aria-live="polite">{note}</span>
 </div>;
}
