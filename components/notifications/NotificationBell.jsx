'use client';
import Link from 'next/link';
import {Bell,CheckCheck,ChevronLeft,MessageCircle,X} from 'lucide-react';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {fetchNotifications,markNotification,markNotificationsRead} from './notificationClient';
import NotificationList from './NotificationList';
import {noticeCountLabel} from '@/lib/unifiedNotifications';
import styles from './Notifications.module.css';

const when=value=>{
 const date=new Date(value||'');
 if(!Number.isFinite(date.getTime()))return '';
 return new Intl.DateTimeFormat('ar-u-nu-latn',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
};

// The latest private conversation, always shown (even with nothing new): it opens the messages.
function LatestMessage({latest,count,onOpen}){
 const href=latest?'/messages?conversation='+encodeURIComponent(latest.id):'/messages';
 return <section className={styles.messagesBlock} aria-label="الرسائل الخاصة">
  <div className={styles.messagesHead}><strong><MessageCircle size={16} aria-hidden="true"/> الرسائل الخاصة</strong>{count>0&&<span className={styles.messagesNew}>{noticeCountLabel(count)} جديدة</span>}</div>
  <Link href={href} className={styles.latestMessage} data-unread={latest?.unread>0||undefined} onClick={onOpen}>
   {latest?<>
    {/* eslint-disable-next-line @next/next/no-img-element -- a 36px avatar */}
    <span className={styles.latestAvatar} aria-hidden="true">{latest.avatar?<img src={latest.avatar} alt="" width={36} height={36}/>:latest.name.trim().charAt(0)}</span>
    <span className={styles.latestText}>
     <span className={styles.latestTop}><strong>{latest.name}</strong>{latest.at&&<time dateTime={latest.at}>{when(latest.at)}</time>}</span>
     <span className={styles.latestExcerpt}>{latest.request?'طلب محادثة: ':''}{latest.excerpt||'افتح المحادثة'}</span>
    </span>
    {latest.unread>0&&<i className={styles.dot} aria-label="غير مقروءة"/>}
   </>:<span className={styles.latestText}><strong>لا توجد محادثات بعد</strong><span className={styles.latestExcerpt}>افتح الرسائل الخاصة</span></span>}
   <ChevronLeft size={16} aria-hidden="true" className={styles.latestGo}/>
  </Link>
  <Link href="/messages" className={styles.allMessages} onClick={onOpen}>كل الرسائل</Link>
 </section>;
}

export default function NotificationBell({userId,onNavigate,messages={count:0,latest:null}}){
 const router=useRouter();
 const host=useRef(null),trigger=useRef(null),pending=useRef(false),versionRef=useRef(0);
 const [open,setOpen]=useState(false),[data,setData]=useState({count:0,markable_count:0,items:[]});
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!userId||pending.current||document.visibilityState!=='visible')return;
  pending.current=true;
  const version=versionRef.current;
  try{
   const response=await fetchNotifications();
   if(version===versionRef.current){
    setData({count:response.count||0,markable_count:response.markable_count||0,items:response.items||[]});
    setError('');
   }
  }catch(e){if(version===versionRef.current&&(e.status===401||e.status===403))setData({count:0,markable_count:0,items:[]});}
  finally{pending.current=false;setLoading(false);}
 },[userId]);
 useEffect(()=>{
  versionRef.current++;pending.current=false;
  setData({count:0,markable_count:0,items:[]});setOpen(false);
  if(!userId)return;
  setLoading(true);
  void refresh();
  const timer=window.setInterval(refresh,60000);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',refresh);
  window.addEventListener('967:notifications-changed',refresh);
  window.addEventListener('967:messages-changed',refresh);
  document.addEventListener('visibilitychange',visible);
  return()=>{
   window.clearInterval(timer);window.removeEventListener('focus',refresh);
   window.removeEventListener('967:notifications-changed',refresh);
   window.removeEventListener('967:messages-changed',refresh);
   document.removeEventListener('visibilitychange',visible);
  };
 },[userId,refresh]);
 useEffect(()=>{
  if(!open)return;
  const dismiss=e=>{if(!host.current?.contains(e.target))setOpen(false);};
  const key=e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key);};
 },[open]);
 const view=item=>{
  setOpen(false);onNavigate?.();
  // Marking a preview as read never marks private messages as read.
  if(item.unread&&item.source!=='message')
   void markNotification(item.source,item.source_id,item.source_ids).catch(()=>{});
  router.push(item.href);
 };
 const mark=item=>{
  if(busy)return;
  setBusy(true);setError('');
  markNotification(item.source,item.source_id,item.source_ids)
   .then(()=>{setData(state=>({...state,count:Math.max(0,state.count-1),markable_count:Math.max(0,state.markable_count-1),
    items:state.items.map(n=>n.id===item.id?{...n,unread:false}:n)}));})
   .catch(e=>setError(e.message))
   .finally(()=>{setBusy(false);void refresh();});
 };
 const markAll=()=>{
  if(busy)return;
  setBusy(true);setError('');
  markNotificationsRead().then(()=>refresh()).catch(e=>setError(e.message)).finally(()=>setBusy(false));
 };
 // Messages have their own block on top; the list below holds the other notifications.
 const others=data.items.filter(item=>item.source!=='message');
 const messageNotices=data.items.filter(item=>item.source==='message'&&item.unread).length;
 const otherCount=Math.max(0,data.count-messageNotices);
 const total=otherCount+(Number(messages.count)||0);
 return <div ref={host} className={styles.bellHost}>
  <button type="button" ref={trigger} className={'ed-tool ed-tool-icon '+styles.bellButton}
   aria-label={total?'الإشعارات والرسائل: '+total+' جديدة':'الإشعارات والرسائل'}
   aria-expanded={open} aria-haspopup="dialog" aria-controls="notifications-preview"
   title="الإشعارات والرسائل" onClick={()=>{setOpen(v=>!v);if(!open){onNavigate?.();void refresh();}}}>
   <Bell size={20} aria-hidden="true"/>
   {total>0&&<span className={styles.bellCount} aria-hidden="true">{noticeCountLabel(total)}</span>}
  </button>
  {open&&<section id="notifications-preview" className={styles.popover} role="dialog" aria-label="الرسائل والإشعارات">
   <header className={styles.popoverHeader}><strong>الرسائل والإشعارات</strong>
    <button type="button" aria-label="إغلاق" className={styles.closeButton} onClick={()=>setOpen(false)}><X size={18}/></button>
   </header>
   <div className={styles.popoverBody}>
   <LatestMessage latest={messages.latest} count={messages.count} onOpen={()=>{setOpen(false);onNavigate?.();}}/>
   <div className={styles.noticesHead}><strong><Bell size={16} aria-hidden="true"/> الإشعارات</strong><span>{otherCount?noticeCountLabel(otherCount)+' جديدة':'لا جديد'}</span></div>
   {error&&<p className={styles.error} role="alert">{error}</p>}
   {loading&&!data.items.length?<p className={styles.message}>جارٍ تحميل الإشعارات…</p>:
    <NotificationList items={others} compact onOpen={view} onRead={mark} disabled={busy}/>}
   </div>
   <footer className={styles.popoverFooter}>
    <Link href="/notifications" onClick={()=>{setOpen(false);onNavigate?.();}}>عرض جميع الإشعارات</Link>
    {data.markable_count>0&&
     <button type="button" disabled={busy} onClick={markAll}><CheckCheck size={15}/> تحديد المقروء</button>}
   </footer>
  </section>}
 </div>;
}
