'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import GuidesEditor from './GuidesEditor';
import {inlineContentRequest} from '@/lib/inlineContentClient';
import styles from './Transactions.module.css';

// Admin tab «دليل المعاملات»: the same editor as /transactions/studio, and (for management) the
// accounts allowed to write and check guides without being editors.
export default function GuidesAdminPanel({db}){
 const [people,setPeople]=useState({kind:'loading'});
 const [email,setEmail]=useState('');
 const [message,setMessage]=useState(null);
 const load=useCallback(async()=>{
  try{const result=await inlineContentRequest(db,'/api/admin/transaction-guide-editors');setPeople({kind:'ready',...result});}
  catch(error){setPeople({kind:'error',message:error.message});}
 },[db]);
 useEffect(()=>{load();},[load]);
 async function add(event){
  event.preventDefault();setMessage(null);
  try{await inlineContentRequest(db,'/api/admin/transaction-guide-editors',{method:'POST',body:{email}});setEmail('');setMessage({tone:'ok',text:'أُضيف الحساب. يحرر الأدلة من صفحة التحرير.'});load();}
  catch(error){setMessage({tone:'error',text:error.message});}
 }
 async function remove(person){
  if(!confirm('إزالة صلاحية تحرير الأدلة من '+(person.email||'هذا الحساب')+'؟'))return;
  try{await inlineContentRequest(db,'/api/admin/transaction-guide-editors',{method:'DELETE',body:{userId:person.userId}});load();}
  catch(error){setMessage({tone:'error',text:error.message});}
 }
 return <div className={styles.editor}>
  <header>
   <h1 style={{margin:0}}>دليل المعاملات</h1>
   <p>الأدلة تُكتب مسودة، ثم «بانتظار التحقق»، وتُنشر بعد التحقق منها. صفحة التحرير المستقلة: <Link href="/transactions/studio">/transactions/studio</Link>. يظهر الدليل للزوار بعد تفعيل «دليل المعاملات» من «صفحات الموقع».</p>
  </header>
  <GuidesEditor/>
  <section className={styles.panel} aria-labelledby="guide-editors">
   <h2 id="guide-editors" style={{margin:0}}>محررو الأدلة</h2>
   <p className={styles.help}>حسابات تستطيع كتابة الأدلة والتحقق منها فقط، دون أي صلاحية أخرى في لوحة التحرير.</p>
   {people.kind==='loading'&&<p role="status">جارٍ التحميل…</p>}
   {people.kind==='error'&&<p className={styles.message} data-tone="error">{people.message}</p>}
   {people.kind==='ready'&&<>
    {people.editors.length?<ul className={styles.guideList}>{people.editors.map(person=><li key={person.userId} className={styles.personRow}>
     <span>{person.name||'—'}</span><span dir="ltr">{person.email}</span>
     {people.canManage&&<button type="button" className={styles.secondary} onClick={()=>remove(person)}>إزالة</button>}
    </li>)}</ul>:<p className={styles.help}>لا يوجد محررو أدلة بعد. المحررون يستطيعون التحرير دائمًا.</p>}
    {people.canManage?<form onSubmit={add} className={styles.inline}>
     <label className={styles.field} style={{flex:'1 1 240px'}}>بريد الحساب<input type="email" dir="ltr" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
     <button className={styles.primary} style={{alignSelf:'end'}}>أضف</button>
    </form>:<p className={styles.help}>إضافة محرري الأدلة متاحة لحسابات الإدارة.</p>}
   </>}
   {message&&<p className={styles.message} data-tone={message.tone} role="status">{message.text}</p>}
  </section>
 </div>;
}
