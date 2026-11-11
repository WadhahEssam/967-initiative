'use client';
import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import styles from './Market.module.css';

// Swipeable photos (CSS scroll-snap, no library) with a «1/6» counter; arrows on screens with a
// mouse. Phones get the 800px «medium» size (about a third of «full»). The first photo loads first
// (it is what the buyer looks at); the others load as they come into view. `children` sit over the photos (back, save, share).
export default function ListingGallery({images,title,children}){
 const track=useRef(null);
 const frame=useRef(0);
 const [index,setIndex]=useState(0);
 if(!images?.length)return <div className={styles.galleryEmpty}>{children}</div>;
 const onScroll=()=>{
  cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{const el=track.current;if(el)setIndex(Math.round(Math.abs(el.scrollLeft)/el.clientWidth));});
 };
 const go=to=>{const el=track.current;if(!el)return;const next=Math.max(0,Math.min(images.length-1,to));const dir=getComputedStyle(el).direction==='rtl'?-1:1;el.scrollTo({left:dir*next*el.clientWidth,behavior:'smooth'});};
 return <div className={styles.gallery}>
  <div ref={track} className={styles.galleryTrack} onScroll={onScroll} tabIndex={0} role="region" aria-roledescription="معرض صور" aria-label={'صور '+title}
   onKeyDown={event=>{if(event.key==='ArrowLeft'){event.preventDefault();go(index+1);}if(event.key==='ArrowRight'){event.preventDefault();go(index-1);}}}>
   {images.map((image,i)=><figure key={image.id} className={styles.slide}>
    {/* A blurred copy of the same photo fills the bars around a photo of another shape. It uses the
        very same file as the photo (same srcset and sizes), so the browser downloads it once and
        both appear together. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={styles.slideBackdrop} src={'/api/market/img/'+image.id+'/medium'} srcSet={'/api/market/img/'+image.id+'/medium 800w, /api/market/img/'+image.id+'/full 1280w'} sizes="(min-width: 900px) 600px, 100vw" alt="" aria-hidden="true" loading={i===0?'eager':'lazy'} decoding="async"/>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={'/api/market/img/'+image.id+'/medium'} srcSet={'/api/market/img/'+image.id+'/medium 800w, /api/market/img/'+image.id+'/full 1280w'} sizes="(min-width: 900px) 600px, 100vw" alt={i===0?title:title+' — صورة '+(i+1)} width={image.w} height={image.h} loading={i===0?'eager':'lazy'} fetchPriority={i===0?'high':undefined} decoding="async"/>
   </figure>)}
  </div>
  {children}
  {images.length>1&&<>
   <span className={styles.counter} aria-live="polite">{index+1}/{images.length}</span>
   <div className={styles.dots} aria-hidden="true">{images.map((image,i)=><span key={image.id} data-on={i===index||undefined}/>)}</div>
   {index>0&&<button type="button" className={styles.galleryPrev} onClick={()=>go(index-1)} aria-label="الصورة السابقة"><ChevronRight size={22}/></button>}
   {index<images.length-1&&<button type="button" className={styles.galleryNext} onClick={()=>go(index+1)} aria-label="الصورة التالية"><ChevronLeft size={22}/></button>}
  </>}
 </div>;
}
