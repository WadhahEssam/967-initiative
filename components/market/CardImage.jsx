'use client';
/* eslint-disable @next/next/no-img-element -- covers are already 480px WebP thumbnails. */
import {useEffect,useRef,useState} from 'react';

// A listing photo that loads only when its card is about to scroll into view. Browsers' own lazy
// loading starts far too early on slow connections (thousands of pixels ahead), so on a market page
// most thumbnails were fetched before anyone scrolled. The first cards (`eager`) load at once.
export default function CardImage({src,eager=false,priority=false}){
 const ref=useRef(null);
 const [near,setNear]=useState(eager);
 useEffect(()=>{
  if(near||!ref.current)return;
  if(!('IntersectionObserver' in window)){setNear(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect();}},{rootMargin:'300px 0px'});
  observer.observe(ref.current);
  return ()=>observer.disconnect();
 },[near]);
 return <img ref={ref} src={near?src:undefined} alt="" decoding="async" loading={eager?'eager':'lazy'} fetchPriority={priority?'high':undefined}/>;
}
