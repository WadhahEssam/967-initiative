'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BookOpen,Bookmark,Compass,Gamepad2,GraduationCap,LogIn,RefreshCw} from 'lucide-react';
import useAudience from '@/components/debates/useAudience';
import {loadBrowserDb,whenBrowserDb} from '@/lib/browserSession';
import {dailyGameUrl,utcDay} from '@/lib/dailyGame';
import {readingListItem} from '@/lib/readingList';
import {usePageVisibility} from '@/components/PageVisibilityProvider';
import styles from './HomeSmartStart.module.css';

const empty=()=>({school:{status:'loading'},games:{status:'loading'},reading:{status:'loading'}});
const safeSchoolHref=href=>typeof href==='string'&&/^\/school\/(?:writing|nature|logic|civic|courses)(?:\/|$)/.test(href)?href:'/school/dashboard';

function Status({value}){
 if(value?.status==='loading')return <span className={styles.status} role="status">جارٍ تحميل نشاطك…</span>;
 if(value?.status==='error')return <span className={styles.status}>تعذر تحميل البيانات الآن</span>;
 return null;
}

// membersOnly: the home's shortcuts already give guests the same doors (learn,
// play, explore), so guests get only the one-line sign-in hint here and members
// get their full "continue" panel.
export default function HomeSmartStart({initialDate,knowledgeHref='/search',membersOnly=false}){
 const {user,ready,error:authError}=useAudience();
 const {isVisible}=usePageVisibility();
 const [day,setDay]=useState(initialDate);
 const [revision,setRevision]=useState(0);
 const [storedCards,setCards]=useState(()=>({userId:null,...empty()}));
 // Never display an earlier account's private summary during a session switch.
 const cards=storedCards.userId===user?.id?storedCards:empty();

 // Use the same UTC day as official games. An open tab must not keep yesterday's link.
 useEffect(()=>{
  const update=()=>setDay(utcDay());
  update();
  const timer=setInterval(update,60000);
  document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
 },[]);

 useEffect(()=>{
  if(!ready||!user)return;
  let cancelled=false;
  const controller=new AbortController();
  setCards({userId:user.id,...empty()});
  const update=(name,status,value)=>{if(!cancelled)setCards(old=>old.userId===user.id?{...old,[name]:{status,value}}:old);};
  const load=async(name,path,token)=>{
   try{
    const response=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Unable to load member summary');
    const value=await response.json();
    update(name,'ready',value);
   }catch{if(!controller.signal.aborted)update(name,'error',null);}
  };
  (async()=>{
   try{
    const db=await loadBrowserDb();
    if(!db)throw Error('Auth unavailable');
    const {data,error}=await db.auth.getSession();
    if(error||!data?.session?.access_token)throw Error('Missing session');
    if(cancelled)return;
    const token=data.session.access_token;
    await Promise.all([
     ...(isVisible('/school')?[load('school','/api/school/dashboard',token)]:[]),
     ...(isVisible('/games')?[load('games','/api/games/my-overview',token)]:[]),
     load('reading','/api/account/workspace',token),
    ]);
   }catch{
    for(const name of ['school','games','reading'])update(name,'error',null);
   }
  })();
  return()=>{cancelled=true;controller.abort();};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[ready,user?.id,day,revision,isVisible]);

 useEffect(()=>whenBrowserDb(db=>{
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||event==='SIGNED_IN')
    setCards(old=>old.userId&&old.userId!==session?.user?.id?{userId:null,...empty()}:old);
  });
  return()=>subscription.unsubscribe();
 }),[]);

 const showSchool=isVisible('/school');
 const showGames=isVisible('/games');
 const reading=cards.reading;
 const saved=reading.status==='ready'&&Array.isArray(reading.value?.saved)
  ?reading.value.saved.map(readingListItem).filter(item=>item&&isVisible(item.href)):[];
 const latestSaved=saved[0];
 const school=cards.school;
 const summary=school.status==='ready'?school.value:null;
 const completed=Number(summary?.totals?.completedStages)||0;
 const total=Number(summary?.totals?.stages)||0;
 const resume=summary?.resume;
 const schoolHref=isVisible(safeSchoolHref(resume?.stage?.href))?safeSchoolHref(resume?.stage?.href):'/school';
 const games=cards.games;
 const daily=games.status==='ready'&&games.value?.date===day?games.value.daily:null;
 const gameHref=dailyGameUrl(day);

 const signInHint=<p className={styles.hint}><LogIn size={15} aria-hidden="true"/>{authError?'تعذر التحقق من الجلسة. يمكنك تسجيل الدخول مجددًا.':'سجّل الدخول لتظهر لك متابعة التعلم ومحفوظات حسابك.'}<Link href="/login">تسجيل الدخول <ArrowLeft size={14} aria-hidden="true"/></Link></p>;
 if(membersOnly&&!ready)return null;
 if(membersOnly&&!user)return <div className={styles.guestHint}>{signInHint}</div>;
 return <section className={styles.section} aria-labelledby="home-start-title">
  <div className={styles.heading}>
   <div>
    <span className={styles.eyebrow}>مساحتك في 967</span>
    <h2 id="home-start-title">{!ready?'اختَر خطوتك التالية':user?'أكمل من حيث توقفت':'من أين تحب أن تبدأ؟'}</h2>
    <p>{!ready?'نجمع لك طرقًا واضحة للبدء.':user?'تعلم، أو عُد إلى محفوظاتك، أو شارك في تحدي اليوم.':'تعلّم شيئًا جديدًا، واستكشف اليمن، أو جرّب تحديًا قصيرًا.'}</p>
   </div>
   {user&&<Link className={styles.accountLink} href="/account">حسابي <ArrowLeft size={16} aria-hidden="true"/></Link>}
  </div>

  {!ready?<div className={styles.grid} role="status" aria-busy="true"><span className="sr-only">جارٍ التحقق من حالة الحساب</span>{[0,1,2].map(index=><div key={index} className={styles.skeleton} aria-hidden="true"/>)}</div>
  :user?<div className={styles.grid}>
   {showSchool&&<article className={styles.card}>
    <span className={styles.icon} data-kind="school"><GraduationCap size={23} aria-hidden="true"/></span>
    <div className={styles.cardCopy}>
     <span className={styles.cardCategory}>مدرسة 967</span>
     <h3>{school.status==='ready'?(resume?(completed?'تابع رحلتك التعليمية':'ابدأ أول محطة'):'راجع ما تعلمته'):'تعلم على مهل'}</h3>
     {school.status==='ready'?<>
      <p>{resume?resume.course+' — '+(resume.stage?.title||'المحطة التالية'):'يمكنك الرجوع إلى مساراتك ومراجعة ما أنجزته.'}</p>
      {total>0&&<div className={styles.progress} role="progressbar" aria-label="تقدّمك في مدرسة 967" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total,completed)}><span style={{width:Math.min(100,Math.round(completed/total*100))+'%'}}/></div>}
      {total>0&&<small>{completed} من {total} محطة مكتملة</small>}
     </>:<Status value={school}/>}
    </div>
    <Link className={styles.action} href={school.status==='ready'&&resume?schoolHref:'/school/dashboard'}>{school.status==='ready'&&resume?'تابع التعلم':'رحلتي التعليمية'} <ArrowLeft size={16} aria-hidden="true"/></Link>
   </article>}

   <article className={styles.card}>
    <span className={styles.icon} data-kind="reading"><Bookmark size={23} aria-hidden="true"/></span>
    <div className={styles.cardCopy}>
     <span className={styles.cardCategory}>القراءة لاحقًا</span>
     <h3>{latestSaved?'عُد إلى ما حفظته':'مكتبتك الخاصة'}</h3>
     {reading.status==='ready'?<p>{latestSaved?latestSaved.title:'لم تحفظ موادًا في حسابك بعد. يمكنك حفظ المقالات والملفات للعودة إليها.'}</p>:<Status value={reading}/>}
    </div>
    <Link className={styles.action} href={latestSaved?.href||'/read-later'}>{latestSaved?'افتح المادة المحفوظة':'قائمة القراءة'} <ArrowLeft size={16} aria-hidden="true"/></Link>
   </article>

   {showGames&&<article className={styles.card}>
    <span className={styles.icon} data-kind="games"><Gamepad2 size={23} aria-hidden="true"/></span>
    <div className={styles.cardCopy}>
     <span className={styles.cardCategory}>ألعاب 967</span>
     <h3>{daily?.finished?'أنجزت تحدي اليوم':daily?.used?'محاولة اليوم بدأت':'تحدي اليوم ينتظرك'}</h3>
     {games.status==='ready'?<p>{daily?.finished?'نتيجتك موثقة. يمكنك مشاهدة ترتيبك أو تجربة الألعاب الحرة.':daily?.used?'لقد بدأت محاولتك الرسمية اليوم. افتح اللعبة لاستكمالها إن كانت متاحة.':'محاولة رسمية واحدة يوميًا، وتتجدد عند منتصف الليل بتوقيت UTC.'}</p>:<Status value={games}/>}
    </div>
    <Link className={styles.action} href={daily?.finished?'/games/leaderboard':gameHref}>{daily?.finished?'لوحة المتصدرين':daily?.used?'العودة إلى التحدي':'ابدأ التحدي'} <ArrowLeft size={16} aria-hidden="true"/></Link>
   </article>}
  </div>:<div className={styles.grid}>
   {showSchool&&<Link className={styles.guestCard} href="/school"><span className={styles.icon} data-kind="school"><GraduationCap size={23} aria-hidden="true"/></span><span className={styles.guestCopy}><strong>ابدأ بالتعلم</strong><small>دروس تفاعلية من الكتابة إلى العلوم والتفكير</small></span><ArrowLeft size={18} aria-hidden="true"/></Link>}
   <Link className={styles.guestCard} href={isVisible(knowledgeHref)?knowledgeHref:'/search'}><span className={styles.icon} data-kind="reading"><Compass size={23} aria-hidden="true"/></span><span className={styles.guestCopy}><strong>اكتشف اليمن</strong><small>تاريخ وشخصيات وخرائط وبيانات موثقة</small></span><ArrowLeft size={18} aria-hidden="true"/></Link>
   {showGames?<Link className={styles.guestCard} href="/games"><span className={styles.icon} data-kind="games"><Gamepad2 size={23} aria-hidden="true"/></span><span className={styles.guestCopy}><strong>جرّب ألعاب 967</strong><small>تعلم بطريقة ممتعة، واستكشف التحديات اليومية</small></span><ArrowLeft size={18} aria-hidden="true"/></Link>:isVisible('/contribute')&&<Link className={styles.guestCard} href="/contribute"><span className={styles.icon} data-kind="games"><BookOpen size={23} aria-hidden="true"/></span><span className={styles.guestCopy}><strong>شارك في المبادرة</strong><small>تعرف على فرص التواصل والمساهمة</small></span><ArrowLeft size={18} aria-hidden="true"/></Link>}
  </div>}

  {ready&&!user&&signInHint}
  {ready&&user&&[cards.school,cards.reading,cards.games].some(card=>card.status==='error')&&<div className={styles.retry}><span>بعض بيانات حسابك غير متاحة مؤقتًا.</span><button type="button" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/> إعادة المحاولة</button></div>}
 </section>;
}
