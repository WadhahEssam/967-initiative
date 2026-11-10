'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Activity,ArrowLeft,BookOpenCheck,ChartNoAxesCombined,Eye,GraduationCap,RefreshCw,SearchX,ShieldCheck} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import useAudience from '@/components/debates/useAudience';
import styles from './AnalyticsDashboard.module.css';

const formats=count=>Number(count||0).toLocaleString('en-US');
const TYPE_NAMES={all:'جميع الأقسام',works:'الأعمال الإعلامية',debates:'المناظرات',issues:'المجلة',indicators:'المؤشرات',figures:'الشخصيات',history:'التاريخ',companies:'الشركات',professionals:'المهنيون',places:'الأماكن',domains:'مجالات الإحصاء'};
const lastDay=s=>s?.slice(5)||s;
function RowBars({items=[],label,title,empty='لا توجد بيانات لهذه الفترة'}){
 const max=Math.max(1,...items.map(x=>x.count));
 return <section className={styles.panel} aria-label={title}><h2>{title}</h2>
  {items.length?<div className={styles.barList}>{items.slice(0,12).map((item,i)=><div className={styles.barRow} key={item.id||i}>
   <div className={styles.barTitle}><span>{label(item)}</span><strong dir="ltr">{formats(item.count)}</strong></div>
   <div className={styles.bar} role="img" aria-label={label(item)+' — '+formats(item.count)}><span style={{width:Math.round(item.count/max*100)+'%'}}/></div>
  </div>)}</div>:<p className={styles.empty}>{empty}</p>}
 </section>;
}

export default function AnalyticsDashboard(){
 const {user,ready}=useAudience();
 const [days,setDays]=useState('30');
 const [revision,setRevision]=useState(0);
 const [state,setState]=useState({owner:null,status:'loading',data:null,error:''});
 useEffect(()=>{
  if(!ready)return;
  if(!user){setState({owner:null,status:'guest',data:null,error:''});return;}
  let active=true;const controller=new AbortController();
  setState({owner:user.id,status:'loading',data:null,error:''});
  (async()=>{
   try{
    const db=browserDb();
    if(!db)throw Error('خدمة الحسابات غير متاحة.');
    const {data,error}=await db.auth.getSession();
    if(error||!data.session?.access_token)throw Error('انتهت الجلسة. سجّل الدخول مجددًا.');
    const response=await fetch('/api/admin/analytics?days='+days,{
     headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:controller.signal
    });
    const body=await response.json();
    if(!response.ok)throw Error(body.error||'تعذر تحميل التحليلات.');
    if(active)setState({owner:user.id,status:'ready',data:body,error:''});
   }catch(error){
    if(active&&!controller.signal.aborted)setState({owner:user.id,status:'error',data:null,error:error.message||'تعذر تحميل التحليلات.'});
   }
  })();
  return()=>{active=false;controller.abort();};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[user?.id,ready,days,revision]);
 const own=state.owner===user?.id?state:{status:'loading',data:null,error:''};
 const data=own.status==='ready'?own.data:null;
 const usage=data?.usage,school=data?.school;
 const daily=usage?.timeline.slice(-14)||[];
 const peak=Math.max(1,...daily.map(x=>x.views));

 return <div className={styles.page}><div className="container">
  <div className={styles.heading}><div><span className={styles.eyebrow}><Activity size={17} aria-hidden="true"/> إدارة 967 / التحليلات</span>
   <h1>تحليلات استخدام الموقع</h1><p>مؤشرات مجمعة تساعد الفريق على معرفة ما يحتاج تحسينًا، دون تتبع هوية الزوار.</p></div>
   <Link className={styles.back} href="/admin">لوحة الإدارة <ArrowLeft size={16} aria-hidden="true"/></Link>
  </div>

  <div className={styles.controls}><label htmlFor="analytics-period">فترة مشاهدات الأقسام
   <select id="analytics-period" value={days} onChange={event=>setDays(event.target.value)}>
    <option value="7">آخر 7 أيام</option><option value="30">آخر 30 يومًا</option><option value="90">آخر 90 يومًا</option>
   </select></label><button type="button" onClick={()=>setRevision(x=>x+1)}><RefreshCw size={17}/> تحديث البيانات</button></div>

  {!ready||own.status==='loading'?<p role="status" className={styles.notice}>جارٍ تحميل التحليلات…</p>:
  own.status==='guest'?<div className={styles.notice}><p>هذه الصفحة للمحررين المعتمدين. سجّل الدخول للمتابعة.</p><Link href="/login">تسجيل الدخول <ArrowLeft size={15}/></Link></div>:
  own.status==='error'?<div className={styles.notice} role="alert"><p>{own.error}</p><button type="button" onClick={()=>setRevision(x=>x+1)}>إعادة المحاولة</button></div>:
  <div className={styles.content}>
   <div className={styles.cards} aria-label="المؤشرات الرئيسية">
    <article><Eye size={22}/><span>مشاهدات الصفحات</span><strong dir="ltr">{formats(usage.pageViews)}</strong><small>إجمالي مشاهدات الأقسام، وليس زوارًا فريدين</small></article>
    <article><SearchX size={22}/><span>عمليات بحث بلا نتائج</span><strong dir="ltr">{formats(usage.searchMisses)}</strong><small>لا تُحفظ كلمات البحث أو بيانات أصحابها</small></article>
    <article><ChartNoAxesCombined size={22}/><span>أقسام تمت زيارتها</span><strong dir="ltr">{formats(usage.sections.length)}</strong><small>أقسام لديها مشاهدات خلال الفترة المحددة</small></article>
    <article><GraduationCap size={22}/><span>محاولات تعليمية في العينة</span><strong dir="ltr">{formats(school.sampleAttempts)}</strong><small>آخر محاولات مصححة؛ مستقلة عن الفترة أعلاه</small></article>
   </div>
   <section className={styles.panel} aria-labelledby="daily-title"><div className={styles.panelHeading}><div><h2 id="daily-title">اتجاه مشاهدات الصفحات</h2><p>آخر {daily.length} يومًا من الفترة المختارة · اليوم بتوقيت UTC</p></div></div>
    <div className={styles.chart} role="img" aria-label={'مشاهدات الصفحات خلال آخر '+daily.length+' يومًا، الأعلى '+formats(peak)}>
     {daily.map(item=><div className={styles.column} key={item.day} title={item.day+': '+formats(item.views)}>
      <strong>{item.views>0?formats(item.views):''}</strong>
      <span className={styles.columnTrack}><span style={{height:(item.views?Math.max(5,Math.round(item.views/peak*100)):0)+'%'}}/></span>
      <small>{lastDay(item.day)}</small>
     </div>)}
    </div>
    <details className={styles.dailyDetails}><summary>عرض القيم اليومية في جدول</summary><div className={styles.tableWrap}>
     <table className={styles.table}><thead><tr><th>التاريخ (UTC)</th><th>المشاهدات</th></tr></thead><tbody>{daily.map(row=><tr key={row.day}><th scope="row">{row.day}</th><td>{formats(row.views)}</td></tr>)}</tbody></table>
    </div></details>
    <p className={styles.help}>القياس يبدأ من تفعيل النظام؛ لا توجد بيانات زيارات تاريخية بأثر رجعي. قد تتأثر العدادات بمنع التتبع أو الطلبات الآلية.</p>
   </section>
   <div className={styles.two}>
    <RowBars items={usage.sections} title="الأقسام الأكثر مشاهدة" label={item=>item.title}/>
    <RowBars items={usage.searches} title="البحث بلا نتائج بحسب التصنيف" label={item=>TYPE_NAMES[item.id]||item.title} empty="لا توجد عمليات بحث بلا نتائج مسجلة."/>
   </div>
   {usage.funnel&&<div className={styles.two}>
    <section className={styles.panel} aria-labelledby="funnel-rates-title"><h2 id="funnel-rates-title">التحويل: من يكمل ما بدأه؟</h2>
     <div className={styles.barList}>{usage.funnel.rates.map(rate=><div className={styles.barRow} key={rate.id}>
      <div className={styles.barTitle}><span>{rate.title}</span><strong dir="ltr">{rate.value===null?'—':rate.value+'%'}</strong></div>
      <div className={styles.bar} role="img" aria-label={rate.title+' — '+(rate.value===null?'لا توجد بيانات':rate.value+'%')}><span style={{width:Math.min(100,rate.value||0)+'%'}}/></div>
     </div>)}</div>
     <p className={styles.help}>عدادات مجمعة بلا هوية، يُحسب كل خطوة مرة واحدة لكل جلسة تصفح. «زائر» و«عضو» تقديريان من وجود جلسة في المتصفح. بدأ القياس في 10 نوفمبر 2026.</p>
    </section>
    <RowBars items={usage.funnel.steps.filter(step=>step.count>0)} title="خطوات التحويل" label={item=>item.title} empty="لم تُسجل خطوات تحويل في هذه الفترة بعد."/>
   </div>}
   <div className={styles.schoolHeading}><span><BookOpenCheck size={21}/> مدرسة 967</span><h2>أين يتقدم الطلاب، وأين يواجهون صعوبة؟</h2><p>تُحسب نسب إكمال المحطات من الطلاب الذين حاولوا اجتيازها داخل العينة، وليس من جميع زوار المدرسة. لا تظهر المجموعات الصغيرة.</p></div>
   <div className={styles.two}>
    <section className={styles.panel}><h2>إكمال المحطات</h2>
     {school.stages.length?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>المسار والمحطة</th><th>الطلاب</th><th>أكملوا</th><th>نسبة الإكمال</th></tr></thead><tbody>
      {school.stages.slice(0,15).map(x=><tr key={x.course+':'+x.stage}><th scope="row">{school.courseNames?.[x.course]||x.course} · {x.stage+1}</th><td>{formats(x.learners)}</td><td>{formats(x.completed)}</td><td>{x.completionRate}%</td></tr>)}
     </tbody></table></div>:<p className={styles.empty}>لا تتوفر بعد محطات بها 5 طلاب مختلفين على الأقل في العينة.</p>}
    </section>
    <section className={styles.panel}><h2>الأسئلة الأكثر خطأً</h2>
     {school.questions.length?<ol className={styles.questions}>{school.questions.map((q,i)=><li key={q.course+':'+q.stage+':'+i}>
      <span>{school.courseNames?.[q.course]||q.course} · المحطة {q.stage+1}</span><strong>{q.prompt}</strong>
      <small>الإجابات الخاطئة: {q.wrong} من {q.asked} · {q.wrongRate}%</small>
     </li>)}</ol>:<p className={styles.empty}>لا توجد أسئلة بها 5 إجابات موثقة على الأقل في العينة.</p>}
    </section>
   </div>
   <aside className={styles.privacy}><ShieldCheck size={21} aria-hidden="true"/><div><strong>حدود الأرقام والخصوصية</strong>
    <p>{data.notes.traffic} {data.notes.school} {data.notes.privacy}</p>
    {school.sampled&&<p>وصلت العينة إلى سقف 3000 محاولة؛ النتائج التعليمية جزئية وليست إحصاءً كاملًا.</p>}
   </div></aside>
  </div>}
 </div></div>;
}
