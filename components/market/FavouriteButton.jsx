'use client';
import {useEffect,useState} from 'react';
import {Heart} from 'lucide-react';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import styles from './Market.module.css';

// Save a listing to «المفضلة». Visitors are sent to sign in and come back to the listing.
export default function FavouriteButton({listingId,onNote}){
 const [saved,setSaved]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true;
  marketSession().then(session=>session&&marketApi('/api/market/favourites?listing='+encodeURIComponent(listingId)))
   .then(result=>{if(live&&result)setSaved(Boolean(result.saved));}).catch(()=>{});
  return()=>{live=false;};
 },[listingId]);
 const toggle=async()=>{
  if(busy)return;
  if(!await marketSession()){location.href=loginHref();return;}
  const next=!saved;
  setSaved(next);setBusy(true);
  try{
   await marketApi('/api/market/favourites',{method:next?'POST':'DELETE',body:{listingId}});
   onNote?.(next?'حُفظ في المفضلة':'أُزيل من المفضلة');
  }catch(error){setSaved(!next);onNote?.(error.message);}
  finally{setBusy(false);}
 };
 return <button type="button" className={saved?styles.favouriteOn:styles.contactIcon} onClick={toggle} aria-pressed={saved} aria-label={saved?'إزالة من المفضلة':'حفظ في المفضلة'}>
  <Heart size={18} fill={saved?'currentColor':'none'} aria-hidden="true"/>
 </button>;
}
