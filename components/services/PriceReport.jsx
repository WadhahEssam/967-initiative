'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check,CheckCircle2,PenLine,UserPlus} from 'lucide-react';
import Sheet from '@/components/market/Sheet';
import LoginLink from '@/components/LoginLink';
import {currentSession} from '@/lib/browserSession';
import {RATE_CURRENCIES,RATE_REGIONS} from '@/lib/exchangeRates';
import {FOOD_GROUPS,FOOD_ITEMS} from '@/lib/foodPrices';
import {SIGNUP_PROMPT} from '@/lib/priceReports';
import styles from './Services.module.css';

// «المُبلّغ المحلي» in the browser: «السعر صحيح» (one tap) and «السعر مختلف» (a short form).
// Visitors who are not signed in are invited to sign up. After sending, members only ever see a
// thank-you: never whether their report counted.

const ENDPOINT='/api/services/price-reports';
const CITY_KEY='967-price-city',DEVICE_KEY='967-device-id';
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
// A random id kept in this browser, so several accounts on one phone count as one person.
// The server stores only a keyed hash of it.
function deviceId(){
 let id=read(DEVICE_KEY);
 if(!id||!/^[0-9a-f]{32}$/.test(id)){
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  id=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');write(DEVICE_KEY,id);
 }
 return id;
}
async function send(body){
 const session=await currentSession();
 if(!session)return {status:401,json:{}};
 try{
  const response=await fetch(ENDPOINT,{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({...body,device:deviceId()})});
  return {status:response.status,json:await response.json().catch(()=>({}))};
 }catch{return {status:0,json:{error:'تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.'}};}
}

function SignupPrompt(){
 return <div className={styles.signupPrompt}>
  <UserPlus size={28} aria-hidden="true"/>
  <p>{SIGNUP_PROMPT}</p>
  <div className={styles.reportButtons}>
   <LoginLink href="/register" className={styles.primaryButton}>أنشئ حسابًا</LoginLink>
   <LoginLink href="/login" className={styles.secondaryButton}>لدي حساب</LoginLink>
  </div>
 </div>;
}

function Done({message,onClose}){
 return <div className={styles.reportDone} role="status">
  <CheckCircle2 size={30} aria-hidden="true"/>
  <p>{message}</p>
  <button type="button" className={styles.secondaryButton} onClick={onClose}>تم</button>
 </div>;
}

// Cloudflare Turnstile, only when the site has a key (as on the contact form).
function Human({onToken}){
 const box=useRef(null),widget=useRef(null);
 const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
 useEffect(()=>{
  if(!key)return;
  let active=true;
  const render=()=>{if(active&&box.current&&window.turnstile&&widget.current===null)widget.current=window.turnstile.render(box.current,{sitekey:key,action:'price_report',callback:onToken,'expired-callback':()=>onToken('')});};
  let script=document.querySelector('script[data-turnstile]');
  if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.turnstile='1';document.body.appendChild(script);}
  if(window.turnstile)render();else script.addEventListener('load',render);
  return()=>{active=false;script.removeEventListener('load',render);if(widget.current!==null&&window.turnstile)window.turnstile.remove(widget.current);widget.current=null;};
 },[key,onToken]);
 return key?<div ref={box} className={styles.human}/>:null;
}

function ReportForm({kind,region,item,onSent}){
 const id=useId();
 const [city,setCity]=useState(region||read(CITY_KEY)||RATE_REGIONS[0].id);
 const [thing,setThing]=useState(item||(kind==='rate'?'USD':FOOD_ITEMS[0].id));
 const [side,setSide]=useState('sell');
 const [value,setValue]=useState('');
 const [source,setSource]=useState('');
 const [website,setWebsite]=useState('');
 const [token,setToken]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const food=kind==='food'?FOOD_ITEMS.find(entry=>entry.id===thing):null;
 async function submit(event){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');
  write(CITY_KEY,city);
  const {status,json}=await send({action:'report',kind,region:city,item:thing,side:kind==='rate'?side:'price',value,source,website,turnstile:token});
  setBusy(false);
  if(status===401)return onSent({signup:true});
  if(status===200)return onSent({message:json.message});
  setError(json.error||'تعذر الإرسال الآن. حاول بعد قليل.');
 }
 return <form className={styles.reportForm} onSubmit={submit} noValidate>
  <label className={styles.reportField}><span>المدينة</span>
   <select value={city} onChange={event=>setCity(event.target.value)}>{RATE_REGIONS.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
  </label>
  {kind==='rate'?<>
   <fieldset className={styles.reportField}><legend>العملة</legend>
    <div className={styles.choice}>{RATE_CURRENCIES.map(entry=><button key={entry.id} type="button" aria-pressed={thing===entry.id} onClick={()=>setThing(entry.id)}>{entry.short}</button>)}</div>
   </fieldset>
   <fieldset className={styles.reportField}><legend>أي سعر؟</legend>
    <div className={styles.sideChoice}>
     <label><input type="radio" name={id+'side'} checked={side==='buy'} onChange={()=>setSide('buy')}/><span><b>شراء</b><small>ما يدفعه لك الصرّاف</small></span></label>
     <label><input type="radio" name={id+'side'} checked={side==='sell'} onChange={()=>setSide('sell')}/><span><b>بيع</b><small>ما تدفعه أنت للصرّاف</small></span></label>
    </div>
   </fieldset>
  </>:<label className={styles.reportField}><span>المادة</span>
   <select value={thing} onChange={event=>setThing(event.target.value)}>{FOOD_GROUPS.map(group=><optgroup key={group.id} label={group.name}>{FOOD_ITEMS.filter(entry=>entry.group===group.id).map(entry=><option key={entry.id} value={entry.id}>{entry.name} ({entry.unit})</option>)}</optgroup>)}</select>
  </label>}
  <label className={styles.reportField}><span>السعر بالريال{food?' · '+food.unit:''}</span>
   <input inputMode="decimal" autoComplete="off" dir="ltr" required value={value} onChange={event=>setValue(event.target.value)} placeholder={kind==='rate'?'مثل 535':'مثل 9500'}/>
  </label>
  <label className={styles.reportField}><span>المصدر <small>(اختياري)</small></span>
   <input maxLength={120} value={source} onChange={event=>setSource(event.target.value)} placeholder={kind==='rate'?'اسم الصرّاف أو الحي':'اسم السوق أو المحل'}/>
  </label>
  <label className={styles.trap} aria-hidden="true">موقعك<input tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label>
  <Human onToken={setToken}/>
  {error&&<p className={styles.formError} role="alert">{error}</p>}
  <button type="submit" className={styles.primaryButton} disabled={busy}>{busy?'جارٍ الإرسال…':'أرسل البلاغ'}</button>
 </form>;
}

// The sheet: «السعر مختلف» opens the form; «السعر صحيح» sends at once and shows the thanks.
// `details` (optional) is shown on top, e.g. the food item's price and basis.
export function PriceSheet({open,onClose,kind,region,item,title,details,start='choose'}){
 const router=useRouter();
 const [view,setView]=useState(start);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!open)return;setError('');setMessage('');
  if(start==='choose'){setView('choose');return;}
  let live=true;
  currentSession().then(session=>{if(!live)return;if(!session)setView('signup');else if(start==='confirm')confirm();else setView('report');});
  return()=>{live=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,start]);
 async function confirm(){
  setBusy(true);setView('busy');setError('');
  const {status,json}=await send({action:'confirm',kind,region,item});
  setBusy(false);
  if(status===401)return setView('signup');
  if(status===200){setMessage(json.message);setView('done');router.refresh();return;}
  setError(json.error||'تعذر الإرسال الآن. حاول بعد قليل.');setView('choose');
 }
 async function report(){const session=await currentSession();setView(session?'report':'signup');}
 const sent=result=>{if(result.signup)return setView('signup');setMessage(result.message);setView('done');router.refresh();};
 return <Sheet open={open} onClose={onClose} title={title}>
  {details}
  {view==='choose'&&<div className={styles.reportChoose}>
   {error&&<p className={styles.formError} role="alert">{error}</p>}
   <div className={styles.reportButtons}>
    <button type="button" className={styles.primaryButton} onClick={confirm} disabled={busy}><Check size={17} aria-hidden="true"/> السعر صحيح</button>
    <button type="button" className={styles.secondaryButton} onClick={report}><PenLine size={17} aria-hidden="true"/> السعر مختلف</button>
   </div>
  </div>}
  {view==='busy'&&<p className={styles.reportBusy} role="status">جارٍ الإرسال…</p>}
  {view==='signup'&&<SignupPrompt/>}
  {view==='report'&&<ReportForm kind={kind} region={region} item={item} onSent={sent}/>}
  {view==='done'&&<Done message={message} onClose={onClose}/>}
 </Sheet>;
}

// The two buttons under a city's price on the rates page.
export function PriceActions({kind,region,item,regionName}){
 const [open,setOpen]=useState(null);
 return <>
  <div className={styles.priceActions}>
   <button type="button" onClick={()=>setOpen('confirm')}><Check size={16} aria-hidden="true"/> السعر صحيح</button>
   <button type="button" onClick={()=>setOpen('report')}><PenLine size={16} aria-hidden="true"/> السعر مختلف</button>
  </div>
  <PriceSheet open={Boolean(open)} start={open||'choose'} onClose={()=>setOpen(null)} kind={kind} region={region} item={item} title={open==='report'?'أبلغ عن السعر في '+regionName:'سعر الدولار في '+regionName}/>
 </>;
}
