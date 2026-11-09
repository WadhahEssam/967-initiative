'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {HandCoins,MessageCircle,Settings2,Share2,X} from 'lucide-react';
import {whatsappLink} from '@/lib/market/format';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import FavouriteButton from './FavouriteButton';
import OfferForm from './OfferForm';
import styles from './Market.module.css';
import chatStyles from './MarketChats.module.css';

// Buttons fixed at the bottom of the listing: message, price offer (negotiable listings only),
// WhatsApp (when the seller chose it), favourite and share. The seller sees «إدارة إعلانك» instead.
export default function ListingContactBar({listingId,sellerId,title,price,amount,currency,whatsapp,negotiable,url,closed=false}){
 const [note,setNote]=useState('');
 const [own,setOwn]=useState(false);
 const [offering,setOffering]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{marketSession().then(session=>setOwn(Boolean(session&&session.user.id===sellerId))).catch(()=>{});},[sellerId]);
 const flash=text=>{setNote(text);setTimeout(()=>setNote(''),2500);};
 const share=async()=>{
  const text=title+' — '+price;
  try{if(navigator.share){await navigator.share({title,text,url});return;}}catch{return;}
  try{await navigator.clipboard.writeText(url);flash('نُسخ رابط الإعلان');}catch{flash(url);}
 };
 const chatHref='/messages?tab=market&listing='+listingId;
 const message=async()=>{location.href=await marketSession()?chatHref:'/login?next='+encodeURIComponent(chatHref);};
 const openOffer=async()=>{if(!await marketSession()){location.href=loginHref();return;}setError('');setOffering(true);};
 const sendOffer=async(value,text)=>{
  setBusy(true);setError('');
  try{const result=await marketApi('/api/market/chats',{method:'POST',body:{action:'offer',listingId,amount:value,note:text}});location.href='/messages?tab=market&chat='+result.chatId;}
  catch(e){setError(e.message);setBusy(false);}
 };
 return <>
  <div className={styles.contactBar}>
   {note&&<span className={styles.toast} role="status">{note}</span>}
   {own?<Link href="/market/mine" className={styles.contactPrimary}><Settings2 size={18} aria-hidden="true"/> إدارة إعلانك</Link>:<>
    {closed?<span className={styles.contactClosed}>تم بيع هذا الإعلان</span>:<button type="button" className={styles.contactPrimary} onClick={message}><MessageCircle size={18} aria-hidden="true"/> مراسلة</button>}
    {negotiable&&<button type="button" className={styles.contactSecondary} onClick={openOffer}><HandCoins size={18} aria-hidden="true"/> عرض سعر</button>}
    {whatsapp&&<a className={styles.contactWhatsapp} href={whatsappLink(whatsapp,'مرحبًا، بخصوص إعلانك في سوق 967: '+title+' '+url)} target="_blank" rel="noopener noreferrer">واتساب</a>}
    <FavouriteButton listingId={listingId} onNote={flash}/>
   </>}
   <button type="button" className={styles.contactIcon} onClick={share} aria-label="مشاركة الإعلان"><Share2 size={18}/></button>
  </div>
  {offering&&<div className={chatStyles.dialog} role="dialog" aria-modal="true" aria-labelledby="offer-title" onClick={event=>{if(event.target===event.currentTarget)setOffering(false);}}>
   <div className={chatStyles.dialogBox}>
    <div className={chatStyles.dialogHead}><h2 id="offer-title">عرض سعر</h2><button type="button" onClick={()=>setOffering(false)} aria-label="إغلاق"><X size={18}/></button></div>
    <OfferForm price={amount} currency={currency} busy={busy} error={error} onSubmit={sendOffer} onCancel={()=>setOffering(false)}/>
   </div>
  </div>}
 </>;
}
