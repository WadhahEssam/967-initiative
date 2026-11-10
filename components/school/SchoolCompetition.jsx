'use client';
import {useCallback,useEffect,useState} from 'react';
import {countOf} from '@/lib/arabicCount';
import {Award,BookOpenCheck,CalendarCheck,Flame,GraduationCap,LockKeyhole,Medal,PenLine,Route,ShieldCheck,Sparkles,Target,Trophy,Waves} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import styles from '@/app/school/dashboard/dashboard.module.css';
const icons={sparkles:Sparkles,route:Route,target:Target,'graduation-cap':GraduationCap,'book-open-check':BookOpenCheck,'pen-line':PenLine,award:Award,waves:Waves,medal:Medal,flame:Flame,'calendar-check':CalendarCheck,trophy:Trophy};
async function schoolBoardRequest(method,period,body){
 const db=browserDb(),{data,error}=await db?.auth.getSession()||{};
 if(error||!data?.session?.access_token)throw Error('يرجى تسجيل الدخول مجددًا.');
 const res=await fetch('/api/school/leaderboard'+(method==='GET'?'?period='+period:''),{
  method,cache:'no-store',headers:{
   Authorization:'Bearer '+data.session.access_token,
   ...(method==='POST'?{'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})
 });
 const response=await res.json();
 if(!res.ok)throw Error(response.error||'تعذر تشغيل المنافسة.');
 return response;
}
export default function SchoolCompetition({achievements}){
 const [period,setPeriod]=useState('week');
 const [board,setBoard]=useState(null);
 const [nickname,setNickname]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const refresh=useCallback(async(current)=>{
  const result=await schoolBoardRequest('GET',current);
  setBoard(result);setNickname(result.myProfile.nickname||'');
 },[]);
 useEffect(()=>{
  let alive=true;
  async function load(){
   setLoading(true);setError('');
   try{
    const result=await schoolBoardRequest('GET',period);
    if(!alive)return;
    setBoard(result);setNickname(result.myProfile.nickname||'');
   }catch(e){if(alive)setError(e.message||'تعذر تحميل الترتيب.');}
   finally{if(alive)setLoading(false);}
  }
  load();return()=>{alive=false;};
 },[period]);
 async function participate(optedIn){
  if(busy)return;
  setBusy(true);setError('');
  try{
   await schoolBoardRequest('POST',period,{action:'participation',optedIn,nickname:optedIn?nickname:undefined});
   await refresh(period);
  }catch(e){setError(e.message||'تعذر حفظ المشاركة.');}
  finally{setBusy(false);}
 }
 return <div className={styles.competition}>
  <section aria-labelledby="school-achievements-title">
   <div className={styles.competitionHeader}><Award size={26}/><div><h2 id="school-achievements-title">إنجازاتي وشاراتي</h2><p>تُمنح تلقائيًا عند تحقق شروطها في نتائج التعلم الموثقة.</p></div></div>
   <p className={styles.achievementProgress}>{achievements.earned} من {achievements.total} شارة مكتسبة</p>
   <div className={styles.achievementGrid}>{achievements.badges.map(b=>{
    const Icon=icons[b.icon]||Award;
    return <article key={b.id} className={[styles.achievement,b.earned?styles.achievementEarned:styles.achievementLocked].join(' ')}>
     <div className={styles.achievementIcon}>{b.earned?<Icon size={24} aria-hidden="true"/>:<LockKeyhole size={23} aria-hidden="true"/>}</div>
     <div><strong>{b.title}</strong><p>{b.description}</p></div>
    </article>;
   })}</div>
  </section>
  <section className={styles.leaderboardWrap} aria-labelledby="school-leaderboard-title">
   <div className={styles.competitionHeader}><Trophy size={26}/><div><h2 id="school-leaderboard-title">لوحة المتصدرين</h2><p>المنافسة اختيارية، والنتائج من نقاط XP المكتسبة لأول مرة فقط.</p></div></div>
   <div className={styles.periodTabs} role="group" aria-label="فترة الترتيب">
    <button type="button" className={period==='week'?styles.periodSelected:styles.periodTab} aria-pressed={period==='week'} onClick={()=>setPeriod('week')}>هذا الأسبوع</button>
    <button type="button" className={period==='month'?styles.periodSelected:styles.periodTab} aria-pressed={period==='month'} onClick={()=>setPeriod('month')}>هذا الشهر</button>
   </div>
   <p className={styles.leaderboardInfo}>يبدأ الأسبوع يوم الاثنين، والشهر في اليوم الأول، وفق توقيت UTC. إعادة المحطات لا تضيف نقاط منافسة.</p>
   {loading?<p role="status" className={styles.leaderboardEmpty}>جارٍ تحميل الترتيب…</p>:
    board?.entries?.length?<ol className={styles.leaderboardList}>{board.entries.map((entry,i)=>{
     const mine=board.myProfile.optedIn&&entry.nickname===board.myProfile.nickname;
     return <li key={entry.nickname+'-'+i} className={[styles.leaderboardEntry,mine?styles.leaderboardMine:''].join(' ')}>
      <span className={styles.leaderboardRank} dir="ltr">#{entry.rank}</span>
      <strong>{entry.nickname}{mine?' (أنت)':''}</strong>
      <span className={styles.leaderboardPoints} dir="ltr">{entry.xp} XP<small>{countOf(entry.stages,'lesson')}</small></span>
     </li>;
    })}</ol>:<p className={styles.leaderboardEmpty}>لا توجد نقاط تنافسية منشورة لهذه الفترة حتى الآن.</p>}
   <div className={styles.participationPanel}>
    <h3>{board?.myProfile.optedIn?'أنت مشارك في المنافسة':'المشاركة في الترتيب اختيارية'}</h3>
    <p>{board?.myProfile.optedIn?'يظهر اسم العرض الذي اخترته فقط، ويمكنك إخفاؤه من الترتيب في أي وقت.':'لا يظهر اسمك أو نقاطك للطلاب إلا بعد اختيار المشاركة باسم عرض عام. يمكن إيقاف المشاركة في أي وقت.'}</p>
    {board?.myProfile.optedIn?<button type="button" className={styles.leaveCompetition} disabled={busy} onClick={()=>participate(false)}>إلغاء المشاركة وإخفاء اسمي</button>:
     <form className={styles.participationForm} onSubmit={e=>{e.preventDefault();participate(true);}}>
      <input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="اسم العرض (ليس اسمك الحقيقي)" aria-label="اسم العرض في لوحة المتصدرين" minLength={2} maxLength={24} autoComplete="off" required/>
      <button type="submit" disabled={busy||loading}>{busy?'جارٍ الحفظ…':'انضم للمنافسة'}</button>
     </form>}
    <div className={styles.privacyLabel}><ShieldCheck size={17}/> لا نعرض البريد الإلكتروني أو رقم الحساب، ولن تدخل الترتيب دون موافقتك.</div>
    {error&&<p className={styles.participationError} role="alert">{error}</p>}
   </div>
  </section>
 </div>;
}
