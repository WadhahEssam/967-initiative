'use client';
import {useCallback,useEffect,useState} from 'react';
import LoginLink from '@/components/LoginLink';
import {currentSession} from '@/lib/browserSession';
import {formatNumber} from '@/lib/format';
import {RATE_CURRENCIES,RATE_REGIONS,currencyName,formatRateTime,regionName} from '@/lib/exchangeRates';
import styles from './Services.module.css';

const ENDPOINT='/api/services/exchange-rates/entry';
async function call(method,body){
 const session=await currentSession();
 if(!session)return {status:401,json:{}};
 const response=await fetch(ENDPOINT,{method,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,json:await response.json().catch(()=>({}))};
}
const emptyForm=latest=>Object.fromEntries(RATE_REGIONS.flatMap(region=>RATE_CURRENCIES.map(currency=>{
 const row=latest?.[region.id+':'+currency.id];
 return [region.id+':'+currency.id,{buy:row?String(Number(row.buy)):'',sell:row?String(Number(row.sell)):''}];
})));

// The daily entry: the form starts from the last rates, so only what changed is edited.
// A move above 10% asks for confirmation; a wrong entry can be hidden (never deleted).
export default function RatesEntry(){
 const [state,setState]=useState({kind:'loading'});
 const [form,setForm]=useState({});
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState(null);
 const [moves,setMoves]=useState(null);
 const load=useCallback(async()=>{
  try{
   const {status,json}=await call('GET');
   if(status===401)return setState({kind:'login'});
   if(status===403)return setState({kind:'denied',message:json.error});
   if(status!==200)return setState({kind:'error',message:json.error||'تعذر تحميل الأسعار.'});
   setState({kind:'ready',...json});setForm(emptyForm(json.latest));
  }catch{setState({kind:'error',message:'تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.'});}
 },[]);
 useEffect(()=>{load();},[load]);
 async function save(confirmLargeChange=false){
  setBusy(true);setMessage(null);
  try{
   const rates=Object.entries(form).map(([key,value])=>{const [region,currency]=key.split(':');return {region,currency,buy:value.buy,sell:value.sell};});
   const {status,json}=await call('POST',{rates,note,confirmLargeChange});
   if(status===409&&json.moves){setMoves(json.moves);setMessage({tone:'warning',text:json.error});return;}
   if(status!==200)return setMessage({tone:'error',text:json.error||'تعذر حفظ الأسعار.'});
   setMoves(null);setNote('');setMessage({tone:'ok',text:'حُفظت الأسعار، وتظهر للزوار متى كان قسم «الخدمات» مفعّلًا.'});
   await load();
  }catch{setMessage({tone:'error',text:'تعذر الاتصال؛ لم تُحفظ الأسعار. أعد المحاولة.'});}
  finally{setBusy(false);}
 }
 async function toggle(batch){
  if(!batch.hidden&&!confirm('إخفاء هذا الإدخال؟ سيعود الموقع إلى السعر الذي قبله.'))return;
  const {status,json}=await call('PATCH',{batchId:batch.id,hidden:!batch.hidden});
  if(status!==200)return setMessage({tone:'error',text:json.error||'تعذر تحديث الإدخال.'});
  await load();
 }
 if(state.kind==='loading')return <p role="status">جارٍ التحميل…</p>;
 if(state.kind==='login')return <p className={styles.message} data-tone="warning">سجّل الدخول بالحساب المخوّل بإدخال الأسعار. <LoginLink href="/login">تسجيل الدخول</LoginLink></p>;
 if(state.kind==='denied')return <p className={styles.message} data-tone="error">{state.message||'حسابك غير مخوّل بإدخال الأسعار.'} اطلب من إدارة 967 إضافة حسابك.</p>;
 if(state.kind==='error')return <p className={styles.message} data-tone="error" role="alert">{state.message} <button type="button" className={styles.secondary} onClick={load}>إعادة المحاولة</button></p>;
 const set=(key,field,value)=>{setMoves(null);setForm(previous=>({...previous,[key]:{...previous[key],[field]:value}}));};
 return <div className={styles.entry}>
  <form className={styles.entry} onSubmit={event=>{event.preventDefault();save(false);}}>
   {RATE_REGIONS.map(region=><fieldset key={region.id} className={styles.entryCity}>
    <legend className="sr-only">أسعار {region.name}</legend>
    <h2>{region.name}</h2>
    {RATE_CURRENCIES.map(currency=>{
     const key=region.id+':'+currency.id,last=state.latest?.[key];
     return <div key={key} className={styles.entryRow}>
      <span>{currency.short}{last&&<small>آخر إدخال: {formatRateTime(last.recorded_at,{weekday:'short',hour:'numeric',minute:'2-digit'})}</small>}</span>
      <label className={styles.field}>شراء<input inputMode="decimal" autoComplete="off" value={form[key]?.buy||''} onChange={event=>set(key,'buy',event.target.value)} aria-label={'سعر شراء '+currency.short+' في '+region.name}/></label>
      <label className={styles.field}>بيع<input inputMode="decimal" autoComplete="off" value={form[key]?.sell||''} onChange={event=>set(key,'sell',event.target.value)} aria-label={'سعر بيع '+currency.short+' في '+region.name}/></label>
     </div>;
    })}
   </fieldset>)}
   <label className={styles.field}>ملاحظة (اختياري)<input maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder="مثل: أسعار الظهر، أو اسم السوق"/></label>
   {message&&<p className={styles.message} data-tone={message.tone} role={message.tone==='error'?'alert':'status'}>{message.text}</p>}
   <div className={styles.actions}>
    {moves?<>
     <button type="button" className={styles.primary} disabled={busy} onClick={()=>save(true)}>{busy?'جارٍ الحفظ…':'نعم، الأرقام صحيحة'}</button>
     <button type="button" className={styles.secondary} onClick={()=>{setMoves(null);setMessage(null);}}>سأراجعها</button>
    </>:<button className={styles.primary} disabled={busy}>{busy?'جارٍ الحفظ…':'احفظ وانشر الأسعار'}</button>}
   </div>
  </form>
  <section aria-labelledby="rates-history">
   <h2 id="rates-history" style={{font:'700 var(--t-size-h3)/1.4 var(--t-text)',margin:'0 0 8px'}}>آخر الإدخالات</h2>
   {state.batches?.length?<ul className={styles.history}>{state.batches.map(batch=><li key={batch.id} data-hidden={batch.hidden}>
    <time dateTime={batch.recorded_at}>{formatRateTime(batch.recorded_at,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</time>
    {batch.rates.map(rate=><span key={rate.region+rate.currency}>{currencyName(rate.currency)} {regionName(rate.region)}: {formatNumber(rate.buy)} / {formatNumber(rate.sell)}</span>)}
    {batch.note&&<span>«{batch.note}»</span>}
    <button type="button" onClick={()=>toggle(batch)}>{batch.hidden?'إظهار':'إخفاء'}</button>
   </li>)}</ul>:<p>لا توجد إدخالات بعد.</p>}
  </section>
 </div>;
}
