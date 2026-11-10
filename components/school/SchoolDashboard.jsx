'use client';
import {useEffect,useState} from 'react';
import LoginLink from '@/components/LoginLink';
import Link from 'next/link';
import {ArrowLeft,BookOpenCheck,CheckCircle2,GraduationCap,RefreshCw,ShieldCheck,Target,Zap,Flame,Brain,CalendarCheck,Settings2} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import styles from '@/app/school/dashboard/dashboard.module.css';
import SchoolCompetition from './SchoolCompetition';
import MobileFold from '@/components/mobile/MobileFold';
import {createAccountWatch,shouldReloadOnAuth} from '@/lib/authEvents';

export default function SchoolDashboard(){
 const [state,setState]=useState({kind:'loading',data:null,message:''});
 const [revision,setRevision]=useState(0);
 const [goalBusy,setGoalBusy]=useState(false);
 const [goalError,setGoalError]=useState('');
 async function setDailyGoal(dailyGoal){
  if(goalBusy)return;
  setGoalBusy(true);setGoalError('');
  try{
   const db=browserDb(),{data}=await db?.auth.getSession()||{};
   if(!data?.session?.access_token)throw Error('يرجى تسجيل الدخول مجددًا.');
   const response=await fetch('/api/school/dashboard',{method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
    body:JSON.stringify({action:'goal',dailyGoal})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'تعذر حفظ الهدف.');
   setState(old=>old.kind==='ready'?{...old,data:{...old.data,habits:{
    ...old.data.habits,dailyGoal:result.dailyGoal,
    reachedGoal:old.data.habits.todayCount>=result.dailyGoal,
    todayProgress:Math.min(100,Math.round(old.data.habits.todayCount/result.dailyGoal*100))
   }}}:old);
  }catch(e){setGoalError(e.message||'تعذر حفظ الهدف.');}
  finally{setGoalBusy(false);}
 }
 useEffect(()=>{
  let alive=true;
  let latest=0;
  let timer;
  async function refresh(){
   const call=++latest;
   try{
    const db=browserDb();
    const {data,error}=await db?.auth.getSession()||{};
    if(!alive||call!==latest)return;
    if(error)throw new Error('تعذر التحقق من تسجيل الدخول.');
    const token=data?.session?.access_token;
    if(!token){setState({kind:'guest',data:null,message:''});return;}
    setState({kind:'loading',data:null,message:''});
    const response=await fetch('/api/school/dashboard',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
    const value=await response.json();
    if(!alive||call!==latest)return;
    if(response.status===401){setState({kind:'guest',data:null,message:''});return;}
    if(!response.ok)throw new Error(value.error||'تعذر قراءة التقدم التعليمي.');
    setState({kind:'ready',data:value,message:''});
   }catch(error){
    if(alive&&call===latest)setState({kind:'error',data:null,message:error.message||'تعذر الاتصال بالخادم.'});
   }
  }
  refresh();
  const db=browserDb();
  const account=createAccountWatch();
  db?.auth.getSession().then(({data})=>account.seen(data.session)).catch(()=>{});
  // Reload when the account changes, not on the initial event or hourly token refreshes.
  const sub=db?.auth.onAuthStateChange((event,session)=>{
   if(!shouldReloadOnAuth(account,event,session))return;
   account.seen(session);
   clearTimeout(timer);
   timer=setTimeout(()=>{if(alive)refresh();},0);
  }).data.subscription;
  return()=>{alive=false;latest++;clearTimeout(timer);sub?.unsubscribe();};
 },[revision]);
 const {kind,data,message}=state;
 return <section className={styles.dashboard} aria-label="لوحة تقدم الطالب"><div className="container">
  {kind==='loading'&&<div className={styles.notice} role="status"><RefreshCw size={20} aria-hidden="true"/> جارٍ تحميل تقدمك التعليمي…</div>}
  {kind==='guest'&&<div className={styles.notice}>
   <GraduationCap size={27} aria-hidden="true"/><div><strong>سجّل الدخول لتظهر رحلتك</strong><p>تقدمك ونتائجك لا تظهر إلا في حسابك. يمكنك استكشاف المسارات قبل التسجيل.</p></div>
   <LoginLink className={styles.action}>تسجيل الدخول <ArrowLeft size={17}/></LoginLink>
  </div>}
  {kind==='error'&&<div className={styles.notice} role="alert"><p>{message}</p><button type="button" className={styles.action} onClick={()=>setRevision(x=>x+1)}>إعادة المحاولة <RefreshCw size={17}/></button></div>}
  {kind==='ready'&&data&&<>
   {data.resume?<div className={styles.resume}>
    <div><span>أكمل من حيث توقفت</span><h2>{data.resume.course}</h2><p>{data.resume.stage?.title||'المحطة التالية'} — المحطة {(data.resume.stage?.index??0)+1}</p>
    {data.resume.hasActiveAttempt&&<small>لديك محاولة نشطة؛ ستُستعاد عند فتح المحطة.</small>}</div>
    <Link href={data.resume.stage?.href||'/school/writing'}>تابع التعلّم <ArrowLeft size={18}/></Link>
   </div>:<div className={styles.resume}><div><span>أنجزت المسارات المتاحة</span><h2>أكملت جميع المحطات!</h2><p>يمكنك الرجوع إلى أي مسار لإعادة التدريب.</p></div><Link href="/school/writing">استعرض المسارات <ArrowLeft size={18}/></Link></div>}
   <section className={styles.xpPanel} aria-labelledby="xp-title">
    <div className={styles.xpHeading}>
     <span className={styles.xpIcon}><Zap size={23} aria-hidden="true"/></span>
     <div><span className={styles.xpEyebrow}>نقاط خبرة موثقة</span><h2 id="xp-title">مستواك في مدرسة 967</h2></div>
     <span className={styles.levelPill}>المستوى {data.xp.level}</span>
    </div>
    <div className={styles.xpNumbers}><strong dir="ltr">{data.xp.total.toLocaleString('en-US')} XP</strong><span>{data.xp.neededToNext} نقطة للمستوى {data.xp.level+1}</span></div>
    <div className={styles.xpTrack} role="progressbar" aria-label="التقدم إلى المستوى التالي" aria-valuemin={data.xp.currentLevelStart} aria-valuemax={data.xp.nextLevelAt} aria-valuenow={data.xp.total}><span style={{width:data.xp.percent+'%'}}/></div>
    <p>تحصل على 100 XP عند اجتياز محطة جديدة لأول مرة. إعادة المحاولة لا تمنح نقاطًا إضافية.</p>
   </section>
   <div className={styles.stats}>
    <div className={styles.stat}><span><CheckCircle2 size={17}/> محطات مكتملة</span><strong dir="ltr">{data.totals.completedStages} / {data.totals.stages}</strong></div>
    <div className={styles.stat}><span><BookOpenCheck size={17}/> مسارات مكتملة</span><strong dir="ltr">{data.totals.finishedCourses} / {data.totals.courses}</strong></div>
    <div className={styles.stat}><span><Target size={17}/> محاولات مصححة</span><strong dir="ltr">{data.totals.submittedAttempts}</strong></div>
   </div>
   <div className={styles.titleRow}><div><span>مساراتي</span><h2>تقدّمك في كل مسار</h2></div><p>النجاح في المحطة وحده هو الذي يحسبها مكتملة. الإعادة لا تمحو إنجازك.</p></div>
   <div className={styles.courses}>{data.courses.map(course=><article key={course.slug} className={styles.course}>
    <div className={styles.courseTop}><span>{course.category}</span><span>{course.finished?'مكتمل':'قيد التعلّم'}</span></div>
    <h3>{course.title}</h3><p>{course.description}</p><div className={styles.courseXp}><Zap size={16} aria-hidden="true"/><strong dir="ltr">{course.xp} XP</strong><span>من المحطات المتقنة</span></div>
    <div className={styles.progressLabel}><strong>{course.completed} من {course.total} محطة</strong><span dir="ltr">{course.percent}%</span></div>
    <div className={styles.track} role="progressbar" aria-label={'تقدم '+course.title} aria-valuemin={0} aria-valuemax={course.total} aria-valuenow={course.completed}><span style={{width:course.percent+'%'}}/></div>
    <div className={styles.courseFoot}><span>{course.attempts} محاولات مصححة</span>
     <Link href={course.nextStage?.href||course.href}>{course.finished?'راجع المسار':'المحطة '+((course.nextStage?.index??0)+1)} <ArrowLeft size={17}/></Link></div>
   </article>)}</div>
   <div className={styles.habitGrid}>
    <section className={styles.habitCard} aria-labelledby="daily-goal-title">
     <div className={styles.habitHeading}><CalendarCheck size={23}/><h2 id="daily-goal-title">هدفي اليومي</h2></div>
     <p>اختر عدد المحطات المختلفة التي تريد التدرب عليها يوميًا.</p>
     <div className={styles.goalChoices} role="group" aria-label="اختر عدد المحطات اليومي">
      {[1,2,3].map(goal=><button key={goal} type="button" disabled={goalBusy} aria-pressed={data.habits.dailyGoal===goal}
       className={data.habits.dailyGoal===goal?styles.goalSelected:styles.goalChoice} onClick={()=>setDailyGoal(goal)}>{goal} {goal===1?'محطة':'محطات'}</button>)}
     </div>
     <div className={styles.habitProgressLabel}><strong>{data.habits.todayCount} / {data.habits.dailyGoal}</strong><span>{data.habits.reachedGoal?'حققت هدف اليوم':'استمر في التعلم'}</span></div>
     <div className={styles.habitTrack} role="progressbar" aria-label="إنجاز الهدف اليومي" aria-valuemin={0} aria-valuemax={data.habits.dailyGoal} aria-valuenow={Math.min(data.habits.todayCount,data.habits.dailyGoal)}><span style={{width:data.habits.todayProgress+'%'}}/></div>
     {goalError&&<p role="alert">{goalError}</p>}
    </section>
    <section className={styles.habitCard} aria-labelledby="streak-title">
     <div className={styles.habitHeading}><Flame size={24}/><h2 id="streak-title">استمرارية التعلم</h2></div>
     <div className={styles.streakNumber}><strong>{data.habits.streak}</strong><span>يومًا متتاليًا</span></div>
     <p>يُحسب يوم التعلم بعد تصحيح اختبار واحد على الأقل، حتى لو لم تنجح فيه. لا عقوبة عند الانقطاع.</p>
     <small>تُحسب الأيام بمنتصف الليل بتوقيت UTC لضمان اتساق النتائج عبر الأجهزة.</small>
    </section>
   </div>
   {data.staffPreview&&<div className={styles.staffNotice}><ShieldCheck size={21} aria-hidden="true"/><p>يمكن للإدارة معاينة المحطات بحرية. تظل الإحصاءات أدناه مبنية على نتائج حسابك الفعلية، ولا تُحتسب المعاينة تقدّمًا.</p><Link className={styles.action} href="/school/studio"><Settings2 size={18}/> إدارة المدرسة</Link></div>}
   <MobileFold title={'مراجعة الأخطاء ('+data.review.length+')'}>
   <section className={styles.reviewSection} aria-labelledby="review-title">
    <div className={styles.reviewHeading}><Brain size={23}/><div><h2 id="review-title">راجع ما أخطأت فيه</h2><p>أسئلة من محاولات مصححة فقط؛ تختفي من المراجعة إذا أجبت عنها إجابة صحيحة لاحقًا.</p><Link className={styles.action} href="/school/review">مراجعة اليوم: 5 بطاقات</Link></div></div>
    {data.review.length?<div className={styles.reviewGrid}>{data.review.map(item=><article className={styles.reviewItem} key={item.id}>
     <span>{data.courses.find(course=>course.slug===item.course)?.title||item.course} · المحطة {item.stage+1}</span>
     <h3>{item.prompt}</h3>{item.context&&<p className={styles.reviewContext}>{item.context}</p>}
     <p><strong>التصحيح:</strong> {item.answer}</p><p>{item.explanation}</p>
     <Link href={item.href}>أعد التدريب <ArrowLeft size={16}/></Link>
    </article>)}</div>:<p className={styles.reviewEmpty}>لا توجد أسئلة تحتاج إلى مراجعة من نتائجك الأخيرة.</p>}
   </section>
   </MobileFold>
   <MobileFold title="الإنجازات ولوحة المتصدرين">
    <SchoolCompetition achievements={data.achievements}/>
   </MobileFold>
   <p className={styles.footnote}>تعرض هذه اللوحة تقدم الدروس الحالي. نقاط الخبرة تُحتسب من النجاحات الموثقة دون تكرار. الإنجازات والمنافسة الاختيارية متاحة الآن. النقاط الأسبوعية والشهرية لا تزيد عند تكرار المحطات. لا توجد شهادات إتمام.</p>
  </>}
 </div></section>;
}
