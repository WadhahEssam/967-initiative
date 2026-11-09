'use client';
import {useState} from 'react';
import {HandCoins,MessageCircle,Share2} from 'lucide-react';
import {whatsappLink} from '@/lib/market/format';
import styles from './Market.module.css';

// Buttons fixed at the bottom of the listing: message, price offer (negotiable listings only),
// WhatsApp (when the seller chose it) and share. Messaging and offers arrive in the next phase.
export default function ListingContactBar({title,price,whatsapp,negotiable,url}){
 const [note,setNote]=useState('');
 const share=async()=>{
  const text=title+' — '+price;
  try{if(navigator.share){await navigator.share({title,text,url});return;}}catch{return;}
  try{await navigator.clipboard.writeText(url);setNote('نُسخ رابط الإعلان');}catch{setNote(url);}
  setTimeout(()=>setNote(''),2500);
 };
 return <div className={styles.contactBar}>
  {note&&<span className={styles.toast} role="status">{note}</span>}
  <button type="button" className={styles.contactPrimary} disabled title="قريبًا"><MessageCircle size={18} aria-hidden="true"/> مراسلة</button>
  {negotiable&&<button type="button" className={styles.contactSecondary} disabled title="قريبًا"><HandCoins size={18} aria-hidden="true"/> عرض سعر</button>}
  {whatsapp&&<a className={styles.contactWhatsapp} href={whatsappLink(whatsapp,'مرحبًا، بخصوص إعلانك في سوق 967: '+title+' '+url)} target="_blank" rel="noopener noreferrer">واتساب</a>}
  <button type="button" className={styles.contactIcon} onClick={share} aria-label="مشاركة الإعلان"><Share2 size={18}/></button>
 </div>;
}
