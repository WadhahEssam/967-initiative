'use client';
import {useState} from 'react';
import {offerSuggestions} from '@/lib/market/chat';
import {formatPrice} from '@/lib/market/format';
import styles from './MarketChats.module.css';

// A price offer: ready-made amounts (5, 10 or 15% below the price) or the buyer's own, and an
// optional note. `counter` turns it into the seller's counter-price (no ready-made amounts).
export default function OfferForm({price,currency,onSubmit,onCancel,busy=false,error='',counter=false,minimum=null}){
 const [amount,setAmount]=useState('');
 const [note,setNote]=useState('');
 const suggestions=counter?[]:offerSuggestions(price);
 return <form className={styles.offerForm} onSubmit={event=>{event.preventDefault();onSubmit(amount,note);}}>
  <p className={styles.offerPrice}>{counter?'عرض المشتري: '+formatPrice(minimum,currency)+' · ':''}سعر الإعلان: <strong>{formatPrice(price,currency)}</strong></p>
  {suggestions.length>0&&<div className={styles.offerChips} role="group" aria-label="مبالغ مقترحة">
   {suggestions.map(item=><button type="button" key={item.percent} aria-pressed={String(item.amount)===amount} onClick={()=>setAmount(String(item.amount))}>
    {formatPrice(item.amount,currency)}<small>أقل {item.percent}%</small>
   </button>)}
  </div>}
  <label className={styles.offerField}><span>{counter?'السعر المقابل':'مبلغ عرضك'}</span>
   <input inputMode="decimal" dir="ltr" value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0" required aria-invalid={Boolean(error)||undefined}/>
  </label>
  {!counter&&<label className={styles.offerField}><span>رسالة مع العرض (اختيارية)</span>
   <textarea rows={2} maxLength={300} value={note} onChange={event=>setNote(event.target.value)} placeholder="مثال: أستطيع المعاينة اليوم مساءً"/>
  </label>}
  {error&&<p className={styles.formError} role="alert">{error}</p>}
  {!counter&&<p className={styles.offerHint}>لا يُقبل عرض أقل من نصف السعر. ينتهي العرض بعد 48 ساعة إن لم يرد البائع، وقبوله اتفاق مبدئي غير ملزم.</p>}
  <div className={styles.offerActions}>
   <button type="submit" className={styles.primary} disabled={busy||!amount}>{busy?'جارٍ الإرسال…':counter?'أرسل السعر المقابل':'أرسل العرض'}</button>
   {onCancel&&<button type="button" className={styles.ghost} onClick={onCancel}>إلغاء</button>}
  </div>
 </form>;
}
