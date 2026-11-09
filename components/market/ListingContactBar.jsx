'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {HandCoins,MessageCircle,Settings2} from 'lucide-react';
import {whatsappLink} from '@/lib/market/format';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import OfferForm from './OfferForm';
import Sheet from './Sheet';
import ui from './ui.module.css';
import styles from './Market.module.css';

// WhatsApp's mark (simple-icons, CC0), so the button reads at a glance without words.
const WhatsAppMark=()=><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41"/></svg>;

// The bar at the bottom of a listing, within thumb reach: one clear main action («مراسلة»), the
// price offer for negotiable listings, and WhatsApp when the seller chose it. Saving and sharing
// sit on the photos. The seller sees «إدارة إعلانك» instead.
export default function ListingContactBar({listingId,sellerId,title,amount,currency,whatsapp,negotiable,url,closed=false}){
 const [own,setOwn]=useState(false);
 const [offering,setOffering]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{marketSession().then(session=>setOwn(Boolean(session&&session.user.id===sellerId))).catch(()=>{});},[sellerId]);
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
   {own?<Link href="/market/mine" className={`${ui.button} ${ui.primary} ${ui.large} ${styles.contactMain}`}><Settings2 size={18} aria-hidden="true"/> إدارة إعلانك</Link>
   :closed?<span className={styles.contactClosed}>تم بيع هذا الإعلان</span>:<>
    <button type="button" className={`${ui.button} ${ui.primary} ${ui.large} ${styles.contactMain}`} onClick={message}><MessageCircle size={19} aria-hidden="true"/> مراسلة</button>
    {negotiable&&<button type="button" className={`${ui.button} ${ui.secondary} ${ui.large} ${styles.contactOffer}`} onClick={openOffer}><HandCoins size={19} aria-hidden="true"/> عرض سعر</button>}
    {whatsapp&&<a className={`${ui.button} ${ui.whatsapp} ${ui.large} ${styles.contactWhatsapp}`} href={whatsappLink(whatsapp,'مرحبًا، بخصوص إعلانك في سوق 967: '+title+' '+url)} target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب"><WhatsAppMark/></a>}
   </>}
  </div>
  <Sheet open={offering} title="عرض سعر" onClose={()=>setOffering(false)}>
   <OfferForm price={amount} currency={currency} busy={busy} error={error} onSubmit={sendOffer} onCancel={()=>setOffering(false)}/>
  </Sheet>
 </>;
}
