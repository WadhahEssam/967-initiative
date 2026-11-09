'use client';
import {useEffect,useState} from 'react';
import {Flag,MessageSquareReply} from 'lucide-react';
import {marketApi,marketSession} from '@/lib/market/clientApi';
import {MIN_RATINGS_SHOWN,RATING_CRITERIA,starsText} from '@/lib/market/ratings';
import {timeAgo} from '@/lib/market/format';
import styles from './Ratings.module.css';

// A seller's ratings. Visitors see them once there are three; the seller always sees theirs, and
// can reply once to each and report an abusive one.
export default function RatingList({sellerId,initial=[],count=0}){
 const [ratings,setRatings]=useState(initial);
 const [owner,setOwner]=useState(false);
 const [open,setOpen]=useState(null);
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  marketSession().then(session=>{
   if(session?.user.id!==sellerId)return;
   setOwner(true);
   marketApi('/api/market/ratings?mine=1').then(result=>setRatings(result.ratings)).catch(()=>{});
  });
 },[sellerId]);
 const act=async(rating,action)=>{
  setBusy(true);setError('');
  try{
   const body=action==='reply'?{action,ratingId:rating.id,reply:text}:{action,ratingId:rating.id,reason:text};
   const result=await marketApi('/api/market/ratings',{method:'POST',body});
   setRatings(list=>list.map(item=>item.id!==rating.id?item:action==='reply'?{...item,reply:result.rating.reply,repliedAt:result.rating.replied_at}:{...item,reported:true}));
   setOpen(null);setText('');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 if(!owner&&count<MIN_RATINGS_SHOWN)return <p className={styles.notice}>{count?'تظهر التقييمات بعد اكتمال 3 تقييمات على الأقل.':'لم يُقيَّم هذا البائع بعد.'}</p>;
 if(!ratings.length)return <p className={styles.notice}>لا توجد تقييمات بعد.</p>;
 return <>
  {owner&&count<MIN_RATINGS_SHOWN&&<p className={styles.notice}>هذه تقييماتك. تظهر للناس بعد اكتمال 3 تقييمات.</p>}
  <ul className={styles.list}>
   {ratings.map(rating=><li key={rating.id} className={styles.rating}>
    <div className={styles.ratingHead}>
     <span className={styles.starsText} aria-label={rating.overall+' من 5'}>{starsText(rating.overall)}</span>
     <strong>{rating.buyerName}</strong>
     <small>{timeAgo(rating.createdAt)}{rating.listingTitle?' · '+rating.listingTitle:''}</small>
    </div>
    <dl className={styles.scores}>{RATING_CRITERIA.map(item=><div key={item.key}><dt>{item.label}</dt><dd>{rating.scores[item.key]}/5</dd></div>)}</dl>
    {rating.comment&&<p className={styles.commentText}>{rating.comment}</p>}
    {rating.reply&&<div className={styles.reply}><strong>رد البائع</strong><p>{rating.reply}</p></div>}
    {owner&&<div className={styles.actions}>
     {!rating.reply&&<button type="button" className={styles.link} onClick={()=>{setOpen({id:rating.id,action:'reply'});setText('');}}><MessageSquareReply size={15} aria-hidden="true"/> رد</button>}
     {!rating.reported?<button type="button" className={styles.link} onClick={()=>{setOpen({id:rating.id,action:'report'});setText('');}}><Flag size={15} aria-hidden="true"/> إبلاغ</button>:<small>أُبلغ عنه، ويراجعه فريق 967.</small>}
    </div>}
    {open?.id===rating.id&&<form className={styles.inlineForm} onSubmit={event=>{event.preventDefault();act(rating,open.action);}}>
     <textarea rows={2} maxLength={open.action==='reply'?600:300} value={text} onChange={event=>setText(event.target.value)} placeholder={open.action==='reply'?'ردّك العلني على هذا التقييم (مرة واحدة)':'لماذا ترى هذا التقييم مسيئًا؟'} aria-label={open.action==='reply'?'الرد':'سبب الإبلاغ'}/>
     {error&&<p className={styles.error} role="alert">{error}</p>}
     <div><button type="submit" className={styles.primary} disabled={busy||!text.trim()}>{open.action==='reply'?'انشر الرد':'أرسل البلاغ'}</button><button type="button" className={styles.secondary} onClick={()=>setOpen(null)}>إلغاء</button></div>
    </form>}
   </li>)}
  </ul>
 </>;
}
