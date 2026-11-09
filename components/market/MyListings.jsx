'use client';
/* eslint-disable @next/next/no-img-element -- listing covers are 480 px thumbnails; next/image would add nothing. */
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Eye,Heart,MessageCircle,Package,Plus,HandCoins} from 'lucide-react';
import {marketApi,marketSession} from '@/lib/market/clientApi';
import {STATUS_LABELS,formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import styles from './MyListings.module.css';

// What each status allows (the server checks the same rules).
const ACTIONS={draft:[],pending_review:[],active:['sold','reserve'],reserved:['sold','available'],expired:['renew'],sold:[]};
const LABELS={sold:'تم البيع',reserve:'محجوز',available:'إعادته متاحًا',renew:'تجديد 30 يومًا'};
const EDITABLE=['active','reserved','pending_review'];
const daysLeft=value=>{const time=Date.parse(value);return Number.isFinite(time)?Math.max(0,Math.ceil((time-Date.now())/86400000)):null;};

// «إعلاناتي»: the seller's listings and their state, with new messages and offers. Deleting asks
// first whether the item was sold: then it becomes «مباع» (so the buyer can rate the seller).
export default function MyListings(){
 const [items,setItems]=useState(null);
 const [signedOut,setSignedOut]=useState(false);
 const [asking,setAsking]=useState(null);
 const [busy,setBusy]=useState(null);
 const [error,setError]=useState('');
 const load=()=>marketApi('/api/market/mine').then(result=>setItems(result.items)).catch(e=>{setError(e.message);setItems(current=>current||[]);});
 useEffect(()=>{marketSession().then(session=>session?load():setSignedOut(true));},[]);
 const change=async(id,action)=>{
  setBusy(id);setError('');setAsking(null);
  try{await marketApi('/api/market/mine',{method:'POST',body:{id,action}});await load();}
  catch(e){setError(e.message);}
  finally{setBusy(null);}
 };
 if(signedOut)return <p className={styles.empty}>سجّل الدخول لترى إعلاناتك. <Link href="/login?next=/market/mine">تسجيل الدخول</Link></p>;
 if(!items)return <p className={styles.empty} aria-busy="true">جارٍ التحميل…</p>;
 return <>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {!items.length?<p className={styles.empty}>لم تنشر أي إعلان بعد. <Link href="/market/new">أضف إعلانك الأول</Link></p>:
  <ul className={styles.list}>
   {items.map(item=><li key={item.id} className={styles.item} data-status={item.status}>
    <Link href={item.status==='draft'?'/market/new?draft='+item.id:listingPath(item.number)} className={styles.thumb} aria-label={item.title||'مسودة'}>
     {item.cover?<img src={item.cover} alt="" loading="lazy"/>:<Package size={24} aria-hidden="true"/>}
    </Link>
    <div className={styles.body}>
     <div className={styles.top}>
      <span className={styles.status} data-status={item.status}>{STATUS_LABELS[item.status]||item.status}</span>
      {item.status==='reserved'&&item.reserved&&<small>لمشترٍ من محادثاتك</small>}
     </div>
     <strong className={styles.title}>{item.title||'مسودة بلا عنوان'}</strong>
     {item.price!==null&&<span className={styles.price}>{formatPrice(item.price,item.currency)}</span>}
     <span className={styles.meta}>
      {item.publishedAt?'نُشر '+timeAgo(item.publishedAt):'أُنشئ '+timeAgo(item.createdAt)}
      {['active','reserved','sold'].includes(item.status)&&<><span><Eye size={13} aria-hidden="true"/> {item.views}</span><span><Heart size={13} aria-hidden="true"/> {item.saves}</span></>}
     </span>
     {item.status==='pending_review'&&<p className={styles.note}>يراجعه فريق 967 قبل ظهوره للناس.{item.reviewReason?' السبب: '+item.reviewReason:''}</p>}
     {item.status==='active'&&daysLeft(item.expiresAt)!==null&&<p className={styles.note}>{daysLeft(item.expiresAt)>0?'يبقى ظاهرًا '+daysLeft(item.expiresAt)+' يومًا':'انتهت مدته، ويُخفى خلال 3 أيام إن لم تجدده'}</p>}
     {item.status==='expired'&&<p className={styles.note}>لم يعد يظهر في البحث. جدّده ليعود 30 يومًا.</p>}
     {item.askSold&&<div className={styles.question} role="group" aria-label="هل تم البيع؟">
      <p>هل بعت هذا المنتج؟</p>
      <button type="button" className={styles.primary} disabled={busy===item.id} onClick={()=>change(item.id,'sold')}>نعم، بعته</button>
      <button type="button" className={styles.ghost} disabled={busy===item.id} onClick={()=>change(item.id,'keep')}>لا، ما زال متاحًا</button>
     </div>}
     {item.askDeal&&<div className={styles.question} role="group" aria-label="هل تمت الصفقة؟">
      <p>مرّت 3 أيام على الحجز. هل تمت الصفقة؟</p>
      <button type="button" className={styles.primary} disabled={busy===item.id} onClick={()=>change(item.id,'sold')}>نعم، تم البيع</button>
      <button type="button" className={styles.ghost} disabled={busy===item.id} onClick={()=>change(item.id,'available')}>لا، أعده متاحًا</button>
     </div>}
     {(item.chats>0||item.offers>0)&&<Link href={'/messages?tab=market&for='+item.id} className={styles.activity}>
      <MessageCircle size={15} aria-hidden="true"/> {item.chats} محادثة{item.unread>0&&<b>{item.unread} جديدة</b>}
      {item.offers>0&&<><HandCoins size={15} aria-hidden="true"/> {item.offers} عرض{item.pendingOffers>0&&<b>{item.pendingOffers} بانتظارك</b>}</>}
     </Link>}
     {asking===item.id?<div className={styles.confirm} role="group" aria-label="تأكيد الحذف">
      {['active','reserved'].includes(item.status)?<><p>هل بعت المنتج؟</p>
       <button type="button" className={styles.primary} disabled={busy===item.id} onClick={()=>change(item.id,'sold')}>نعم، بعته</button>
       <button type="button" className={styles.danger} disabled={busy===item.id} onClick={()=>change(item.id,'remove')}>لا، احذفه</button></>
      :<><p>حذف هذا الإعلان؟</p><button type="button" className={styles.danger} disabled={busy===item.id} onClick={()=>change(item.id,'remove')}>احذفه</button></>}
      <button type="button" className={styles.ghost} onClick={()=>setAsking(null)}>إلغاء</button>
     </div>:<div className={styles.actions}>
      {item.status==='draft'&&<Link href={'/market/new?draft='+item.id} className={styles.primary}>أكمل المسودة</Link>}
      {EDITABLE.includes(item.status)&&<Link href={'/market/new?edit='+item.id} className={styles.ghost}>تعديل</Link>}
      {(ACTIONS[item.status]||[]).map(action=><button type="button" key={action} className={action==='sold'?styles.primary:styles.ghost} disabled={busy===item.id} onClick={()=>change(item.id,action)}>{LABELS[action]}</button>)}
      <button type="button" className={styles.link} disabled={busy===item.id} onClick={()=>setAsking(item.id)}>حذف</button>
     </div>}
    </div>
   </li>)}
  </ul>}
  <Link href="/market/new" className={styles.add}><Plus size={18} aria-hidden="true"/> أضف إعلانًا</Link>
 </>;
}
