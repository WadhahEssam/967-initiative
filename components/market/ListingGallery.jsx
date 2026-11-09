'use client';
import {useRef,useState} from 'react';
import styles from './Market.module.css';

// Swipeable photos (CSS scroll-snap, no library) with a «1/6» counter. Only the first photo loads
// at once; the others load as they come into view.
export default function ListingGallery({images,title}){
 const track=useRef(null);
 const [index,setIndex]=useState(0);
 if(!images?.length)return null;
 const onScroll=()=>{const el=track.current;if(!el)return;setIndex(Math.round(Math.abs(el.scrollLeft)/el.clientWidth));};
 const go=to=>{const el=track.current;if(!el)return;const dir=getComputedStyle(el).direction==='rtl'?-1:1;el.scrollTo({left:dir*to*el.clientWidth,behavior:'smooth'});};
 return <div className={styles.gallery}>
  <div ref={track} className={styles.galleryTrack} onScroll={onScroll} tabIndex={0} aria-label={'صور '+title}>
   {images.map((image,i)=><figure key={image.id} className={styles.slide}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={'/api/market/img/'+image.id+'/full'} alt={i===0?title:title+' — صورة '+(i+1)} width={image.w} height={image.h} loading={i===0?'eager':'lazy'} decoding="async"/>
   </figure>)}
  </div>
  {images.length>1&&<>
   <span className={styles.counter} aria-live="polite">{index+1}/{images.length}</span>
   <div className={styles.dots}>{images.map((image,i)=><button type="button" key={image.id} aria-label={'الصورة '+(i+1)} aria-current={i===index} onClick={()=>go(i)}/>)}</div>
  </>}
 </div>;
}
