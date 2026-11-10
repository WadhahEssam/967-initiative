'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import RatesEntry from './RatesEntry';
import FoodEntry from './FoodEntry';
import {inlineContentRequest} from '@/lib/inlineContentClient';
import styles from './Services.module.css';

// Admin tab «الأسعار»: the same entry forms as the update pages (daily exchange rates, weekly
// staple prices), and (for management) the accounts allowed to enter prices without being editors.
export default function RatesAdminPanel({db}){
 const [people,setPeople]=useState({kind:'loading'});
 const [email,setEmail]=useState('');
 const [message,setMessage]=useState(null);
 const [form,setForm]=useState('rates');
 const load=useCallback(async()=>{
  try{const result=await inlineContentRequest(db,'/api/admin/exchange-rate-reporters');setPeople({kind:'ready',...result});}
  catch(error){setPeople({kind:'error',message:error.message});}
 },[db]);
 useEffect(()=>{load();},[load]);
 async function add(event){
  event.preventDefault();setMessage(null);
  try{await inlineContentRequest(db,'/api/admin/exchange-rate-reporters',{method:'POST',body:{email}});setEmail('');setMessage({tone:'ok',text:'أُضيف الحساب. يدخل الأسعار من صفحة الإدخال اليومي.'});load();}
  catch(error){setMessage({tone:'error',text:error.message});}
 }
 async function remove(person){
  if(!confirm('إزالة صلاحية إدخال الأسعار من '+(person.email||'هذا الحساب')+'؟'))return;
  try{await inlineContentRequest(db,'/api/admin/exchange-rate-reporters',{method:'DELETE',body:{userId:person.userId}});load();}
  catch(error){setMessage({tone:'error',text:error.message});}
 }
 return <div className={styles.entry}>
  <header>
   <h1 style={{margin:0}}>الأسعار</h1>
   <p>أسعار الصرف يوميًا وأسعار المواد الأساسية أسبوعيًا، لصنعاء وعدن. صفحتا الإدخال المستقلتان للهاتف: <Link href="/services/exchange-rates/update">أسعار الصرف</Link> و<Link href="/services/food-prices/update">المواد الأساسية</Link>. تظهر الصفحتان للزوار بعد تفعيلهما من «صفحات الموقع».</p>
  </header>
  <div className={styles.tabs} role="group" aria-label="نوع الأسعار">
   <button type="button" aria-pressed={form==='rates'} onClick={()=>setForm('rates')}>أسعار الصرف</button>
   <button type="button" aria-pressed={form==='food'} onClick={()=>setForm('food')}>المواد الأساسية</button>
  </div>
  {form==='rates'?<RatesEntry/>:<FoodEntry/>}
  <section className={styles.entryCity} aria-labelledby="rate-reporters">
   <h2 id="rate-reporters">مُدخلو الأسعار</h2>
   <p>حسابات تستطيع إدخال أسعار الصرف وأسعار المواد فقط، دون أي صلاحية أخرى في لوحة التحرير.</p>
   {people.kind==='loading'&&<p role="status">جارٍ التحميل…</p>}
   {people.kind==='error'&&<p className={styles.message} data-tone="error">{people.message}</p>}
   {people.kind==='ready'&&<>
    {people.reporters.length?<ul className={styles.history}>{people.reporters.map(person=><li key={person.userId}>
     <span>{person.name||'—'}</span><span dir="ltr">{person.email}</span>
     {people.canManage&&<button type="button" onClick={()=>remove(person)}>إزالة</button>}
    </li>)}</ul>:<p>لا يوجد مُدخلو أسعار بعد. المحررون يستطيعون الإدخال دائمًا.</p>}
    {people.canManage?<form onSubmit={add} className={styles.actions} style={{marginTop:12}}>
     <label className={styles.field} style={{flex:'1 1 240px'}}>بريد الحساب<input type="email" dir="ltr" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
     <button className={styles.primary} style={{alignSelf:'end'}}>أضف</button>
    </form>:<p>إضافة مُدخلي الأسعار متاحة لحسابات الإدارة.</p>}
   </>}
   {message&&<p className={styles.message} data-tone={message.tone} role="status">{message.text}</p>}
  </section>
 </div>;
}
