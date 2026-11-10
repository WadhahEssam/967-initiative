'use client';

import {useState} from 'react';
import LoginLink from '@/components/LoginLink';
import Link from 'next/link';
import {ArrowLeft,Check,Copy,ExternalLink,Link2,Swords,Users} from 'lucide-react';
import {currentSession} from '@/lib/browserSession';
import styles from './FriendInviteAction.module.css';

/** Create a friend duel right beside the normal start button of any of the nine games. */
export default function FriendInviteAction({game,seconds=15,disabled=false}){
 const [creating,setCreating]=useState(false);
 const [created,setCreated]=useState(null);
 const [error,setError]=useState('');
 const [copyState,setCopyState]=useState('');

 async function create(){
  if(creating||disabled)return;
  setCreating(true);setError('');setCreated(null);setCopyState('');
  try{
   const data={session:await currentSession()};
   if(!data.session?.access_token)throw Error('سجّل الدخول بحسابك المؤكد لإنشاء تحدٍّ خاص.');
   const response=await fetch('/api/games/friends',{
    method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({game,seconds})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'تعذر إنشاء التحدي.');
   if(typeof result.url!=='string'||!/^\/games\/friends\/[0-9a-f-]{36}$/i.test(result.url))throw Error('تعذر إنشاء رابط صالح.');
   setCreated({url:result.url,seconds});
  }catch(e){setError(e.message||'تعذر إنشاء التحدي. حاول مرة أخرى.');}
  finally{setCreating(false);}
 }

 async function copy(){
  if(!created)return;
  const url=new URL(created.url,location.origin).href;
  try{await navigator.clipboard.writeText(url);setCopyState('تم نسخ الرابط؛ أرسله إلى صديقك.');}
  catch{setCopyState('انسخ الرابط التالي يدويًا: '+url);}
 }
 async function share(){
  if(!created)return;
  const url=new URL(created.url,location.origin).href;
  try{
   if(navigator.share)await navigator.share({title:'تحدّاني في ألعاب 967',text:'هل يمكنك التفوق عليّ في الأسئلة نفسها؟',url});
   else await copy();
  }catch(e){if(e?.name!=='AbortError')await copy();}
 }

 return <>
  <button type="button" className={styles.friendButton} disabled={creating||disabled} onClick={create}>
   <Swords size={19}/>{creating?'جارٍ إنشاء المواجهة…':'تحدَّ صديقًا'} <ArrowLeft size={17}/>
  </button>
  {error&&<p className={styles.error} role="alert">{error} {error.includes('الدخول')&&<LoginLink>تسجيل الدخول</LoginLink>}</p>}
  {created&&<section className={styles.invite} aria-label="رابط تحدي الصديق" role="status">
   <div className={styles.inviteHeading}><span className={styles.inviteIcon}><Users size={23}/></span>
    <div><strong>التحدي جاهز! أرسل الرابط لصديقك</strong>
     <p>10 أسئلة متطابقة · {created.seconds} ثانية لكل سؤال · لاعبان فقط · محاولة واحدة لكل حساب.</p>
    </div>
   </div>
   <div className={styles.linkBox} dir="ltr"><Link2 size={16}/><span>{typeof window==='undefined'?created.url:new URL(created.url,location.origin).href}</span></div>
   <div className={styles.inviteActions}>
    <button type="button" onClick={copy}><Copy size={16}/> نسخ الرابط</button>
    <button type="button" onClick={share}><ExternalLink size={16}/> مشاركة</button>
    <Link href={created.url} className={styles.open}><Check size={16}/> افتح التحدي وانتظر صديقك <ArrowLeft size={16}/></Link>
   </div>
   {copyState&&<p className={styles.copyNote}>{copyState}</p>}
  </section>}
 </>;
}
