'use client';
import {useCallback,useEffect,useState} from 'react';
import LoginLink from '@/components/LoginLink';
import {currentSession} from '@/lib/browserSession';
import {formatNumber} from '@/lib/format';
import {countOf} from '@/lib/arabicCount';
import {formatRateTime} from '@/lib/exchangeRates';
import {FOOD_GROUPS,FOOD_ITEMS,FOOD_REGIONS,foodItem,foodKey,foodRegionName} from '@/lib/foodPrices';
import styles from './Services.module.css';

const ENDPOINT='/api/services/food-prices/entry';
async function call(method,body){
 const session=await currentSession();
 if(!session)return {status:401,json:{}};
 const response=await fetch(ENDPOINT,{method,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,json:await response.json().catch(()=>({}))};
}
const fillFrom=latest=>Object.fromEntries(FOOD_REGIONS.flatMap(region=>FOOD_ITEMS.map(item=>{
 const row=latest?.[foodKey(region.id,item.id)];
 return [foodKey(region.id,item.id),row?String(Number(row.price)):''];
})));
const emptyForm=()=>fillFrom({});

// The weekly entry: starts from the last prices, so only what changed is edited. A move above
// 25% asks for confirmation; a wrong entry can be hidden (never deleted).
export default function FoodEntry(){
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
   setState({kind:'ready',...json});setForm(fillFrom(json.latest));
  }catch{setState({kind:'error',message:'تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.'});}
 },[]);
 useEffect(()=>{load();},[load]);
 async function save(confirmLargeChange=false){
  setBusy(true);setMessage(null);
  try{
   const prices=Object.entries(form).map(([key,price])=>{const [region,item]=key.split(':');return {region,item,price};});
   const {status,json}=await call('POST',{prices,note,confirmLargeChange});
   if(status===409&&json.moves){setMoves(json.moves);setMessage({tone:'warning',text:json.error});return;}
   if(status!==200)return setMessage({tone:'error',text:json.error||'تعذر حفظ الأسعار.'});
   setMoves(null);setNote('');setMessage({tone:'ok',text:'حُفظت الأسعار ('+formatNumber(json.saved)+')، وتظهر للزوار متى كانت صفحة «أسعار المواد الأساسية» مفعّلة.'});
   await load();
  }catch{setMessage({tone:'error',text:'تعذر الاتصال؛ لم تُحفظ الأسعار. أعد المحاولة.'});}
  finally{setBusy(false);}
 }
 async function toggle(batch){
  if(!batch.hidden&&!confirm('إخفاء هذا الإدخال؟ ستعود الأسعار التي قبله.'))return;
  const {status,json}=await call('PATCH',{batchId:batch.id,hidden:!batch.hidden});
  if(status!==200)return setMessage({tone:'error',text:json.error||'تعذر تحديث الإدخال.'});
  await load();
 }
 if(state.kind==='loading')return <p role="status">جارٍ التحميل…</p>;
 if(state.kind==='login')return <p className={styles.message} data-tone="warning">سجّل الدخول بالحساب المخوّل بإدخال الأسعار. <LoginLink href="/login">تسجيل الدخول</LoginLink></p>;
 if(state.kind==='denied')return <p className={styles.message} data-tone="error">{state.message||'حسابك غير مخوّل بإدخال الأسعار.'} اطلب من إدارة 967 إضافة حسابك.</p>;
 if(state.kind==='error')return <p className={styles.message} data-tone="error" role="alert">{state.message} <button type="button" className={styles.secondary} onClick={load}>إعادة المحاولة</button></p>;
 const set=(key,value)=>{setMoves(null);setForm(previous=>({...previous,[key]:value}));};
 const filled=Object.values(form).filter(value=>String(value).trim()).length;
 return <div className={styles.entry}>
  <div className={styles.actions}>
   <button type="button" className={styles.secondary} onClick={()=>{setMoves(null);setForm(fillFrom(state.latest));}}>املأ بآخر الأسعار</button>
   <button type="button" className={styles.secondary} onClick={()=>{setMoves(null);setForm(emptyForm());}}>أفرغ الخانات</button>
  </div>
  <form className={styles.entry} onSubmit={event=>{event.preventDefault();save(false);}}>
   {FOOD_GROUPS.map(group=><fieldset key={group.id} className={styles.entryCity}>
    <legend className="sr-only">{group.name}</legend>
    <h2>{group.name}</h2>
    <div className={styles.entryRow} aria-hidden="true"><span/>{FOOD_REGIONS.map(region=><span key={region.id} className={styles.entryHead}>{region.name}</span>)}</div>
    {FOOD_ITEMS.filter(item=>item.group===group.id).map(item=><div key={item.id} className={styles.entryRow}>
     <span>{item.name}<small>{item.unit}</small></span>
     {FOOD_REGIONS.map(region=>{
      const key=foodKey(region.id,item.id),last=state.latest?.[key];
      return <label key={region.id} className={styles.field}>
       <input inputMode="decimal" autoComplete="off" value={form[key]||''} onChange={event=>set(key,event.target.value)} aria-label={'سعر '+item.name+' ('+item.unit+') في '+region.name}/>
       {last&&<small>{formatRateTime(last.recorded_at,{day:'numeric',month:'short'})}</small>}
      </label>;
     })}
    </div>)}
   </fieldset>)}
   <label className={styles.field}>ملاحظة (اختياري)<input maxLength={200} value={note} onChange={event=>setNote(event.target.value)} placeholder="مثل: أسعار سوق شميلة، أو سوق الشيخ عثمان"/></label>
   <div className={styles.saveBar}>
   {message&&<p className={styles.message} data-tone={message.tone} role={message.tone==='error'?'alert':'status'}>{message.text}</p>}
   <div className={styles.actions}>
    {moves?<>
     <button type="button" className={styles.primary} disabled={busy} onClick={()=>save(true)}>{busy?'جارٍ الحفظ…':'نعم، الأرقام صحيحة'}</button>
     <button type="button" className={styles.secondary} onClick={()=>{setMoves(null);setMessage(null);}}>سأراجعها</button>
    </>:<button className={styles.primary} disabled={busy||!filled}>{busy?'جارٍ الحفظ…':'احفظ وانشر الأسعار ('+formatNumber(filled)+')'}</button>}
   </div>
   </div>
  </form>
  <section aria-labelledby="food-history">
   <h2 id="food-history" style={{font:'700 var(--t-size-h3)/1.4 var(--t-text)',margin:'0 0 8px'}}>آخر الإدخالات</h2>
   {state.batches?.length?<ul className={styles.history}>{state.batches.map(batch=><li key={batch.id} data-hidden={batch.hidden}>
    <time dateTime={batch.recorded_at}>{formatRateTime(batch.recorded_at,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</time>
    <span>{countOf(batch.prices.length,'price')}</span>
    {batch.note&&<span>«{batch.note}»</span>}
    <button type="button" onClick={()=>toggle(batch)}>{batch.hidden?'إظهار':'إخفاء'}</button>
    <details className={styles.batchDetails}><summary>الأرقام</summary>
     <ul>{batch.prices.map(entry=><li key={entry.region+entry.item}>{foodItem(entry.item)?.name||entry.item} ({foodRegionName(entry.region)}): {formatNumber(entry.price)}</li>)}</ul>
    </details>
   </li>)}</ul>:<p>لا توجد إدخالات بعد.</p>}
  </section>
 </div>;
}
