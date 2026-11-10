'use client';
import {useEffect,useState} from 'react';
import {Ban,Flag} from 'lucide-react';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import {BLOCK_REASONS,REPORT_REASONS} from '@/lib/market/safety';
import Sheet from './Sheet';
import styles from './Safety.module.css';

// Report and block dialogs (spec: «الإبلاغ», «الحظر بين المستخدمين»), in the market's shared sheet
// (focus stays inside, Escape closes, focus returns to the button).
function Dialog({title,onClose,children}){
 return <Sheet open title={title} onClose={onClose}>{children}</Sheet>;
}

function Reasons({list,value,onChange,name}){
 return <fieldset className={styles.reasons}>
  <legend>السبب</legend>
  {list.map(item=><label key={item.key} className={value===item.key?styles.reasonOn:styles.reason}>
   <input type="radio" name={name} value={item.key} checked={value===item.key} onChange={()=>onChange(item.key)}/>{item.label}
  </label>)}
 </fieldset>;
}

// target: listing (listingId) · user (userId) · chat (chatId) · rating (ratingId, by its seller).
export function ReportDialog({target,ids={},onClose,onDone}){
 const [reason,setReason]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 const send=async event=>{
  event.preventDefault();setBusy(true);setError('');
  try{
   if(target==='rating')await marketApi('/api/market/ratings',{method:'POST',body:{action:'report',ratingId:ids.ratingId,reason,note}});
   else await marketApi('/api/market/reports',{method:'POST',body:{target,...ids,reason,note}});
   setDone(true);onDone?.();
  }catch(e){if(e.status===401){location.href=loginHref();return;}setError(e.message);}
  finally{setBusy(false);}
 };
 const what={listing:'الإعلان',user:'المستخدم',chat:'المحادثة',rating:'التقييم'}[target];
 if(done)return <Dialog title="وصل بلاغك" onClose={onClose}>
  <p className={styles.text}>شكرًا لك. يراجع فريق 967 البلاغ ويتخذ الإجراء المناسب. لا يُخبَر الطرف الآخر بأنك أبلغت عنه.</p>
  <div className={styles.actions}><button type="button" className={styles.primary} onClick={onClose}>حسنًا</button></div>
 </Dialog>;
 return <Dialog title={'الإبلاغ عن '+what} onClose={onClose}>
  <form className={styles.form} onSubmit={send}>
   <Reasons list={REPORT_REASONS} value={reason} onChange={setReason} name="report-reason"/>
   <label className={styles.field}>{reason==='other'?'وضّح السبب':'تفاصيل (اختيارية)'}
    <textarea rows={3} maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/>
   </label>
   {target==='chat'&&<p className={styles.hint}>يجوز لفريق 967 الاطلاع على هذه المحادثة للتحقق من البلاغ.</p>}
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <div className={styles.actions}>
    <button type="submit" className={styles.primary} disabled={busy||!reason||(reason==='other'&&note.trim().length<5)}>{busy?'جارٍ الإرسال…':'أرسل البلاغ'}</button>
    <button type="button" className={styles.secondary} onClick={onClose}>إلغاء</button>
   </div>
  </form>
 </Dialog>;
}

// The reason is required and only the team sees it. The other member is not told.
export function BlockDialog({userId,name,chatId=null,onClose,onDone}){
 const [reason,setReason]=useState('');
 const [note,setNote]=useState('');
 const [report,setReport]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const send=async event=>{
  event.preventDefault();setBusy(true);setError('');
  try{
   const result=await marketApi('/api/market/blocks',{method:'POST',body:{action:'block',userId,reason,note,report,chatId}});
   window.dispatchEvent(new Event('967:market-blocks-changed'));
   onDone?.(result);
  }catch(e){if(e.status===401){location.href=loginHref();return;}setError(e.message);setBusy(false);}
 };
 return <Dialog title={'حظر '+(name||'هذا المستخدم')} onClose={onClose}>
  <form className={styles.form} onSubmit={send}>
   <p className={styles.text}>لن يرى أحدكما إعلانات الآخر، ولن تستطيعا المراسلة. تبقى محادثاتكما السابقة مقروءة، وتُلغى العروض والحجوزات القائمة بينكما. لا يُخبَر بأنك حظرته.</p>
   <Reasons list={BLOCK_REASONS} value={reason} onChange={setReason} name="block-reason"/>
   <label className={styles.field}>{reason==='other'?'وضّح السبب':'تفاصيل (اختيارية)'}
    <textarea rows={2} maxLength={500} value={note} onChange={event=>setNote(event.target.value)}/>
   </label>
   <label className={styles.check}><input type="checkbox" checked={report} onChange={event=>setReport(event.target.checked)}/> أبلغ فريق 967 أيضًا</label>
   <p className={styles.hint}>يظهر السبب لفريق 967 فقط. يمكنك إلغاء الحظر لاحقًا من إعدادات الرسائل.</p>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   <div className={styles.actions}>
    <button type="submit" className={styles.danger} disabled={busy||!reason||(reason==='other'&&note.trim().length<5)}>{busy?'جارٍ الحظر…':'احظر'}</button>
    <button type="button" className={styles.secondary} onClick={onClose}>إلغاء</button>
   </div>
  </form>
 </Dialog>;
}

// «إبلاغ» on a listing or a member page. Hidden from the owner; visitors are asked to sign in.
export function ReportButton({target,ids,ownerId,label='إبلاغ',className}){
 const [open,setOpen]=useState(false);
 const [own,setOwn]=useState(false);
 useEffect(()=>{marketSession().then(session=>setOwn(Boolean(session&&session.user.id===ownerId))).catch(()=>{});},[ownerId]);
 if(own)return null;
 const start=async()=>{if(!await marketSession()){location.href=loginHref();return;}setOpen(true);};
 return <>
  <button type="button" className={className||styles.link} onClick={start}><Flag size={14} aria-hidden="true"/> {label}</button>
  {open&&<ReportDialog target={target} ids={ids} onClose={()=>setOpen(false)}/>}
 </>;
}

// «إبلاغ» and «حظر» on a seller page.
export function MemberSafety({userId,name}){
 const [own,setOwn]=useState(true);
 const [dialog,setDialog]=useState(null);
 const [blocked,setBlocked]=useState(false);
 useEffect(()=>{marketSession().then(session=>setOwn(Boolean(session&&session.user.id===userId))).catch(()=>setOwn(false));},[userId]);
 if(own)return null;
 const start=async kind=>{if(!await marketSession()){location.href=loginHref();return;}setDialog(kind);};
 if(blocked)return <p className={styles.hint}>حظرت {name}. يمكنك إلغاء الحظر من <a href="/messages?tab=settings">إعدادات الرسائل</a>.</p>;
 return <div className={styles.memberActions}>
  <button type="button" className={styles.link} onClick={()=>start('report')}><Flag size={14} aria-hidden="true"/> إبلاغ</button>
  <button type="button" className={styles.link} onClick={()=>start('block')}><Ban size={14} aria-hidden="true"/> حظر</button>
  {dialog==='report'&&<ReportDialog target="user" ids={{userId}} onClose={()=>setDialog(null)}/>}
  {dialog==='block'&&<BlockDialog userId={userId} name={name} onClose={()=>setDialog(null)} onDone={()=>{setDialog(null);setBlocked(true);}}/>}
 </div>;
}
