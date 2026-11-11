'use client';
import {useEffect,useState} from 'react';
const KEY='967-analytics-opt-out';
export default function AnalyticsPrivacyControls(){
 const [choice,setChoice]=useState(null);
 useEffect(()=>{try{setChoice(localStorage.getItem(KEY)==='1');}catch{setChoice(true);}},[]);
 function toggle(){
  const next=!choice;
  // Stopping also forgets this browser's random visitor and visit ids.
  try{if(next){localStorage.setItem(KEY,'1');localStorage.removeItem('967-visitor');localStorage.removeItem('967-visit');}else localStorage.removeItem(KEY);setChoice(next);}
  catch{setChoice(true);}
 }
 return <section className="container" aria-labelledby="privacy-analytics" style={{paddingBlock:'20px 40px'}}>
  <div style={{padding:'24px',border:'1px solid var(--line)',borderRadius:'12px',background:'var(--surface)'}}>
   <h2 id="privacy-analytics" style={{fontSize:'23px'}}>إحصاءات الزيارات وخصوصيتك</h2>
   <p style={{lineHeight:1.9,fontSize:'14px'}}>نحصي زيارات الموقع بأنفسنا، دون أي خدمة خارجية ودون ملفات تعريف الارتباط، لنعرف ما يفيد الزوار وما يحتاج تحسينًا. يحفظ متصفحك رقمًا عشوائيًا لا يدل على شخصك، نعرف به أن زيارتين جاءتا من الجهاز نفسه. ونحفظ معه رابط الصفحة دون أي نص بحث، والمدة التي كانت فيها ظاهرة، ونوع الجهاز ونظامه، ومصدر الزيارة بشكل عام (بحث Google أو واتساب أو فيسبوك مثلًا). لا نحفظ عنوان IP، ولا ما تكتبه، ولا نربط هذه الأرقام بحسابك. تظهر الأرقام مجمّعة لإدارة الموقع فقط. ويحترم النظام إشارة منع التتبع في متصفحك.</p>
   <p style={{lineHeight:1.9,fontSize:'13px'}}>يمكنك إيقاف العدّ من هذا المتصفح، فيُحذف معه الرقم العشوائي. يُحفظ اختيارك في هذا الجهاز فقط.</p>
   {choice===null?<p role="status">جارٍ قراءة تفضيل الخصوصية…</p>:<button type="button" onClick={toggle} className="btn btn-outline" aria-pressed={choice} style={{minHeight:'44px'}}>{choice?'إعادة السماح بالعدّ':'إيقاف العدّ على هذا الجهاز'}</button>}
   {choice!==null&&<p role="status" style={{fontSize:'12px',color:'var(--muted)',marginTop:'10px'}}>{choice?'العدّ متوقف في هذا المتصفح.':'العدّ مفعّل؛ يمكنك إيقافه في أي وقت.'}</p>}
  </div>
 </section>;
}
