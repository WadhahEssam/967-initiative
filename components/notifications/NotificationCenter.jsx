'use client';
import Link from 'next/link';
import {ArrowRight,Bell,CheckCheck,RefreshCw,SlidersHorizontal,ShieldCheck} from 'lucide-react';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import useAudience from '@/components/debates/useAudience';
import {fetchNotifications,markNotification,markNotificationsRead,updateNotificationPreference} from './notificationClient';
import NotificationList from './NotificationList';
import {NOTIFICATION_CATEGORIES,noticeCategoryLabel,noticeCountLabel} from '@/lib/unifiedNotifications';
import LoadingState from '@/components/LoadingState';
import styles from './Notifications.module.css';

export default function NotificationCenter(){
 const {user,ready}=useAudience(),router=useRouter();
 const [category,setCategory]=useState('all'),[items,setItems]=useState([]);
 const [page,setPage]=useState(1),[count,setCount]=useState(0),[total,setTotal]=useState(0),[markableCount,setMarkableCount]=useState(0);
 const [hasMore,setHasMore]=useState(false),[busy,setBusy]=useState(false),[marketEnabled,setMarketEnabled]=useState(false);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const [preferences,setPreferences]=useState(null),[preferencesOpen,setPreferencesOpen]=useState(false);
 const [savingKey,setSavingKey]=useState(null),[savedMessage,setSavedMessage]=useState('');
 const seq=useRef(0);
 const load=useCallback(async(nextPage=1,append=false)=>{
  const version=++seq.current;
  setLoading(true);setError('');
  try{
   const response=await fetchNotifications({mode:'list',category,page:nextPage});
   if(version!==seq.current)return;
   setItems(previous=>{
    if(!append)return response.items||[];
    const keys=new Set(previous.map(item=>item.id));
    return [...previous,...(response.items||[]).filter(item=>!keys.has(item.id))];
   });
   setPage(nextPage);setCount(response.count||0);setTotal(response.total||0);setMarkableCount(response.markable_count||0);setMarketEnabled(Boolean(response.market_enabled));
   setPreferences(response.preferences||null);
   setHasMore(Boolean(response.hasMore));
  }catch(e){if(version===seq.current)setError(e.message);}
  finally{if(version===seq.current)setLoading(false);}
 },[category]);
 useEffect(()=>{
  const guard=seq;guard.current++;setItems([]);setPage(1);setHasMore(false);setCount(0);setMarkableCount(0);
  if(!user){setPreferences(null);return;}
  if(typeof window!=='undefined'&&window.location.hash==='#notification-settings')setPreferencesOpen(true);
  void load(1,false);
  return()=>{guard.current++;};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[user?.id,category,load]);
 const mark=async item=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   await markNotification(item.source,item.source_id,item.source_ids);
   setItems(current=>current.map(n=>n.id===item.id?{...n,unread:false}:n));
   setCount(n=>Math.max(0,n-1));setMarkableCount(n=>Math.max(0,n-1));
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 const openItem=item=>{
  if(item.unread&&item.source!=='message')void markNotification(item.source,item.source_id,item.source_ids).catch(()=>{});
  router.push(item.href);
 };
 const markAll=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{await markNotificationsRead();await load(1,false);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const savePreference=async(key,enabled)=>{
  if(savingKey||!preferences)return;
  setSavingKey(key);setError('');setSavedMessage('');
  try{
   await updateNotificationPreference(key,enabled);
   setPreferences(previous=>({...previous,[key]:enabled}));
   setSavedMessage('تم حفظ إعداد الإشعارات.');
   await load(1,false);
  }catch(e){setError(e.message);}
  finally{setSavingKey(null);}
 };
 const preferenceRows=[
  {key:'messages',title:'الرسائل الخاصة',detail:'إشعارات المحادثات والطلبات الجديدة، وكذلك صوت الرسالة.'},
  {key:'tasks',title:'مركز المهام',detail:'التكليفات والردود والمواعيد والتغييرات في المهام.'},
  {key:'replies',title:'الردود على تعليقاتك',detail:'تنبيه عندما يرد عضو على تعليقك في مناظرة.'},
  {key:'debates',title:'تحديثات مشاركات المناظرات',detail:'الموافقة أو الرفض وتحديث حالة السؤال أو المقترح.'},
  {key:'new_debates',title:'الإعلان عن مناظرات جديدة',detail:'أرسل لي إشعارًا عند نشر مناظرة جديدة. لن تُرسل إشعارات عن مناظرات سابقة.'}
 ];
 if(!ready)return <section className={styles.page}><LoadingState title="نجهّز مركز الإشعارات…" description="نتحقق من حسابك ونرتّب أحدث التنبيهات."/></section>;
 if(!user)return <section className={styles.page}><div className={styles.guest}><Bell size={32}/><h1>إشعارات 967</h1><p>سجّل الدخول لمتابعة تحديثات حسابك ومهامك ورسائلك.</p><Link href="/login?next=%2Fnotifications">تسجيل الدخول</Link></div></section>;
 return <section className={styles.page}>
  <Link href="/account" className={styles.back}><ArrowRight size={17}/> حسابي</Link>
  <div className={styles.pageHeading}><div><span>حسابك في 967</span><h1><Bell size={26}/> مركز الإشعارات</h1>
   <p>الرسائل والمهام والمناظرات وتحديثات الحساب في مكان واحد.</p></div>
   <div className={styles.pageActions}>
    <button type="button" onClick={()=>setPreferencesOpen(open=>!open)} aria-expanded={preferencesOpen} aria-controls="notification-settings"><SlidersHorizontal size={17}/> إعدادات الإشعارات</button>
    <button type="button" onClick={()=>load(1,false)} disabled={busy||loading}><RefreshCw size={17}/> تحديث</button>
    <button type="button" onClick={markAll} disabled={busy||loading||markableCount===0}><CheckCheck size={17}/> تحديد الإشعارات كمقروءة</button>
   </div>
  </div>
  {preferencesOpen&&<section id="notification-settings" className={styles.preferences} aria-label="إعدادات الإشعارات">
   <header><div><h2>التحكم بالإشعارات</h2><p>اختر الأنواع التي تريد ظهورها في مركز الإشعارات. يمكنك تغييرها في أي وقت.</p></div><SlidersHorizontal size={20} aria-hidden="true"/></header>
   <div className={styles.preferenceRows}>
    {preferenceRows.map(row=><label key={row.key} className={styles.preferenceRow}>
     <span><strong>{row.title}</strong><small>{row.detail}</small></span>
     <input type="checkbox" checked={preferences?.[row.key]!==false}
      onChange={event=>void savePreference(row.key,event.target.checked)}
      disabled={!preferences||Boolean(savingKey)} aria-label={'تفعيل '+row.title}/>
    </label>)}
   </div>
   <p className={styles.mandatoryNotice}><ShieldCheck size={17} aria-hidden="true"/> تنبيهات الحساب والأمان المهمة تبقى مفعّلة دائمًا. تعطيل فئة لا يمسح الرسائل أو المهام نفسها.</p>
   {savedMessage&&<p className={styles.savedSettings} role="status">{savedMessage}</p>}
  </section>}
  <div className={styles.centerShell}>
   <header className={styles.centerHeader}><strong>{count?noticeCountLabel(count)+' إشعارات جديدة':'لا توجد إشعارات جديدة'}</strong>
    <span>{total} في القسم الحالي</span></header>
   <nav className={styles.filters} aria-label="تصفية الإشعارات">
    {NOTIFICATION_CATEGORIES.filter(key=>key!=='market'||marketEnabled||category==='market').map(key=><button key={key} type="button" onClick={()=>setCategory(key)}
     aria-pressed={category===key} data-active={category===key||undefined}>{noticeCategoryLabel[key]}</button>)}
   </nav>
   {error&&<p className={styles.error} role="alert">{error} <button type="button" onClick={()=>load(page,false)}>إعادة المحاولة</button></p>}
   {loading&&!items.length?<p className={styles.message} role="status">جارٍ تحميل الإشعارات…</p>:
    <NotificationList items={items} onOpen={openItem} onRead={mark} disabled={busy}/>}
   {hasMore&&<div className={styles.more}><button type="button" onClick={()=>load(page+1,true)}
     disabled={loading||busy}>{loading?'جارٍ التحميل…':'عرض إشعارات أقدم'}</button></div>}
  </div>
  <p className={styles.footnote}>يُجمع تكرار الردود على التعليق نفسه، وتحديثات النقاش في المهمة نفسها. وتبقى الرسائل الخاصة مجمعة حسب المحادثة؛ لا تُعد الرسالة مقروءة حتى تفتح المحادثة. إشعارات المهام متاحة لأعضاء الفريق المخولين فقط.</p>
 </section>;
}
