'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,Ban,CheckCircle2,Copy,Flag,MessageCircle,ShieldCheck,UserRound,UserX} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import useAudience from '@/components/debates/useAudience';
import ProfileAvatar from '@/components/design/ProfileAvatar';
import {MEMBER_REPORT_REASONS} from '@/lib/memberProfiles';
import styles from './MemberProfile.module.css';

function joined(value){
 if(!value)return null;
 const date=new Date(value);
 return Number.isNaN(date.getTime())?null:new Intl.DateTimeFormat('ar-u-nu-latn',{year:'numeric',month:'long',timeZone:'UTC'}).format(date);
}
export default function MemberProfile({memberId}){
 const {user,ready}=useAudience();
 const [state,setState]=useState({owner:null,data:null,error:'',loading:true});
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[actionError,setActionError]=useState('');
 const [reportOpen,setReportOpen]=useState(false),[reason,setReason]=useState('harassment'),[detail,setDetail]=useState('');
 const request=useCallback(async(method='GET',payload=null,endpoint='/api/members/'+encodeURIComponent(memberId))=>{
  const db=browserDb();
  if(!db)throw Error('خدمة الحسابات غير متاحة.');
  const {data,error}=await db.auth.getSession();
  if(error||!data.session?.access_token)throw Error('انتهت جلسة تسجيل الدخول.');
  const res=await fetch(endpoint,{method,cache:'no-store',headers:{
   Authorization:'Bearer '+data.session.access_token,...(payload?{'Content-Type':'application/json'}:{})
  },body:payload?JSON.stringify(payload):undefined}).catch(()=>{throw Error('تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.');});
  const response=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(response.error||'تعذر تنفيذ الإجراء.');
  return response;
 },[memberId]);
 useEffect(()=>{
  if(!ready||!user){setState({owner:null,data:null,error:'',loading:false});return;}
  const owner=user.id;let active=true;
  setState({owner,data:null,error:'',loading:true});
  request().then(data=>{if(active)setState({owner,data,error:'',loading:false});})
   .catch(error=>{if(active)setState({owner,data:null,error:error.message,loading:false});});
  return()=>{active=false;};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[ready,user?.id,memberId,request]);
 const valid=ready&&user&&state.owner===user.id;
 const data=valid?state.data:null;
 const member=data?.member;
 const run=async(payload,endpoint=null)=>{
  if(busy)return;
  setBusy(true);setNotice('');setActionError('');
  try{
   const result=await request('POST',payload,endpoint||'/api/members/'+encodeURIComponent(memberId));
   if(payload.action==='report'){
    setReportOpen(false);setDetail('');setNotice('تم إرسال البلاغ إلى الإدارة. المرجع: '+result.reference);
   }else{
    const fresh=await request();
    setState({owner:user.id,data:fresh,error:'',loading:false});
    setNotice(payload.action==='block'?'تم حظر المستخدم ومنع المراسلة.':'تم رفع الحظر.');
    window.dispatchEvent(new Event('967:messages-changed'));
   }
  }catch(error){setActionError(error.message);}
  finally{setBusy(false);}
 };
 const setBlock=()=>{
  if(data.blocked)return run({action:'unblock',target:memberId},'/api/messages');
  if(window.confirm('هل تريد حظر '+member.name+'؟ لن تتمكنا من تبادل الرسائل حتى رفع الحظر.'))
   run({action:'block',target:memberId},'/api/messages');
 };
 const share=async()=>{
  try{await navigator.clipboard.writeText(window.location.href);setNotice('تم نسخ رابط الملف الشخصي.');}
  catch{setActionError('تعذر نسخ الرابط من هذا المتصفح.');}
 };
 return <div className={styles.page} dir="rtl"><div className={styles.wrap}>
  <nav className={styles.breadcrumb}><Link href={member?.is_demo?'/debates/speakers/'+encodeURIComponent(member.speaker_slug):'/messages'}><ArrowRight size={16}/>{member?.is_demo?'المناظرون':'الرسائل'}</Link><span>/ الملف الشخصي</span></nav>
  {!ready?<p className={styles.status}>جارٍ التحقق من الحساب…</p>:!user?
   <section className={styles.gate}><UserRound size={33}/><h1>الملفات الشخصية للأعضاء</h1><p>سجّل الدخول للتعرف على الأعضاء والتواصل معهم.</p><Link className={styles.primary} href={'/login?next='+encodeURIComponent('/members/'+memberId)}>تسجيل الدخول</Link></section>:
   !valid||state.loading?<p className={styles.status}>جارٍ تحميل الملف الشخصي…</p>:
   state.error?<section className={styles.gate}><AlertTriangle size={30}/><h1>تعذر عرض الملف الشخصي</h1><p role="alert">{state.error}</p><Link href="/messages">العودة إلى الرسائل</Link></section>:
   member&&<div className={styles.card}>
    <div className={styles.topBand}><span>{member.is_demo?'ملف مناظر تجريبي':'أعضاء مبادرة 967'}</span><ShieldCheck size={22}/></div>
    <div className={styles.identity}><ProfileAvatar name={member.name} src={member.avatar_url} className={styles.heroAvatar}/>
     <div><h1>{member.name}</h1><p>{member.is_demo?'مشارك في مناظرات 967'+(member.specialty?' · '+member.specialty:''):'عضو في مبادرة 967'+(joined(member.joined_at)?' · منذ '+joined(member.joined_at):'')}</p>
      <span className={styles.visibility}><ShieldCheck size={14}/>{member.is_demo?'ملف للعرض التجريبي، غير مرتبط بحساب دخول':'الملف يعرض معلومات الحساب العامة فقط'}</span></div>
    </div>
    {member.is_demo&&<section className={styles.demoInfo} aria-label="تنبيه الملف التجريبي"><strong>ملف تجريبي — ليس حساب مستخدم حقيقي</strong><p>أنشأنا هذا الملف لعرض المناظر وربطه بمناظرات 967. لا يملك صاحب الاسم حساب دخول مرتبطًا به، ولذلك لا يمكن مراسلته أو حظره أو الإبلاغ عن حسابه من هنا.</p>{member.bio&&<p className={styles.demoBio}>{member.bio}</p>}</section>}
    {notice&&<p className={styles.success} role="status"><CheckCircle2 size={16}/>{notice}</p>}
    {actionError&&<p className={styles.error} role="alert">{actionError}</p>}
    <div className={styles.actions}>
     {data.self?<Link className={styles.primary} href="/account?tab=profile"><UserRound size={18}/> تعديل ملفي</Link>:member.is_demo?<Link className={styles.primary} href={'/debates/speakers/'+encodeURIComponent(member.speaker_slug)}><ArrowRight size={18}/> صفحة المناظر والمناظرات</Link>:<>
      {data.canMessage?<Link className={styles.primary} href={'/messages?to='+encodeURIComponent(memberId)}><MessageCircle size={18}/>{data.hasConversation?'فتح المحادثة':'إرسال رسالة'}</Link>:
       <span className={styles.disabled}><MessageCircle size={17}/> المراسلة غير متاحة حاليًا</span>}
      <button type="button" className={styles.secondary} disabled={busy} onClick={setBlock}>{data.blocked?<><UserRound size={18}/> رفع الحظر</>:<><Ban size={18}/> حظر المستخدم</>}</button>
      <button type="button" className={styles.secondary} onClick={()=>{setReportOpen(o=>!o);setActionError('');}} aria-expanded={reportOpen}><Flag size={18}/> إبلاغ عن الحساب</button>
     </>}
     <button type="button" className={styles.secondary} onClick={share}><Copy size={17}/> نسخ الرابط</button>
    </div>
    {!data.self&&reportOpen&&<form className={styles.report} onSubmit={event=>{event.preventDefault();run({action:'report',reason,detail});}}>
     <h2><Flag size={19}/> إبلاغ الإدارة عن هذا الحساب</h2>
     <p>البلاغ خاص بالإدارة ولا يمنحها الوصول إلى محادثاتك. إذا كان البلاغ عن رسالة معينة، استخدم زر الإبلاغ داخل المحادثة لإرفاق سياقها.</p>
     <label>سبب البلاغ<select value={reason} onChange={event=>setReason(event.target.value)}>{Object.entries(MEMBER_REPORT_REASONS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label>تفاصيل البلاغ<textarea required minLength={10} maxLength={1000} rows={4} value={detail} onChange={event=>setDetail(event.target.value)} placeholder="اشرح ما حدث بشكل واضح…" /></label>
     <div className={styles.reportActions}><button className={styles.primary} disabled={busy||detail.trim().length<10}>{busy?'جارٍ الإرسال…':'إرسال البلاغ'}</button><button type="button" className={styles.secondary} onClick={()=>setReportOpen(false)}>إلغاء</button></div>
    </form>}
    {!member.is_demo&&<p className={styles.footnote}>يمكنك التحكم في ظهور اسمك في البحث العام وبحث الرسائل، والتحكم في استقبال طلبات المحادثة من صفحة الخصوصية.</p>}
   </div>}
 </div></div>;
}
