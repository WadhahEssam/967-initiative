'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {marketApi,marketSession} from '@/lib/market/clientApi';
import styles from './Safety.module.css';

// Spec: a member does not see the listings of someone they blocked or who blocked them. Market
// pages are the same for everyone (cached), so the signed-in browser asks which of the sellers on
// the page to hide: cards marked data-seller disappear, and a listing or seller page
// (data-seller-page) is replaced with a neutral note.
const checked=new Set(),hidden=new Set();
export const BLOCKS_CHANGED='967:market-blocks-changed';

export default function MarketBlockFilter(){
 const pathname=usePathname();
 const [pageHidden,setPageHidden]=useState(false);
 useEffect(()=>{
  let stopped=false,timer=null,me=null;
  const apply=()=>{
   let page=false;
   for(const node of document.querySelectorAll('[data-seller]')){
    const hide=hidden.has(node.dataset.seller);
    if(node.hasAttribute('data-seller-page')){if(hide){node.style.display='none';page=true;}}
    else node.style.display=hide?'none':'';
   }
   setPageHidden(page);
  };
  const run=async()=>{
   if(!me){const session=await marketSession().catch(()=>null);if(!session||stopped)return;me=session.user.id;}
   const ids=[...new Set([...document.querySelectorAll('[data-seller]')].map(node=>node.dataset.seller))].filter(id=>id&&id!==me&&!checked.has(id)).slice(0,200);
   if(ids.length){
    const result=await marketApi('/api/market/blocks?sellers='+ids.join(',')).catch(()=>null);
    if(stopped||!result)return;
    ids.forEach(id=>checked.add(id));(result.hidden||[]).forEach(id=>hidden.add(id));
   }
   apply();
  };
  const later=()=>{clearTimeout(timer);timer=setTimeout(run,250);};
  const reset=()=>{checked.clear();hidden.clear();for(const node of document.querySelectorAll('[data-seller]'))node.style.display='';later();};
  run();
  // Lists that load in the browser (favourites, «more») add cards later.
  const observer=new MutationObserver(later);
  observer.observe(document.body,{childList:true,subtree:true});
  addEventListener(BLOCKS_CHANGED,reset);
  return ()=>{stopped=true;clearTimeout(timer);observer.disconnect();removeEventListener(BLOCKS_CHANGED,reset);};
 },[pathname]);
 if(!pageHidden)return null;
 return <div className={styles.unavailable} role="status">
  <h1>هذه الصفحة غير متاحة</h1>
  <p>لا يمكنك عرض هذا المحتوى.</p>
  <Link href="/market">العودة إلى السوق</Link>
 </div>;
}
