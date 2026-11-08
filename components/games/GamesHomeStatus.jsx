'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpLeft,CircleCheck,Flame,Medal,ShieldCheck,Trophy,UserRound,CalendarCheck2} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {utcDay} from '@/lib/dailyGame';
import {createAccountWatch,shouldReloadOnAuth,createRefreshThrottle} from '@/lib/authEvents';
import DailyCountdown from './DailyCountdown';
import styles from './GamesHomeStatus.module.css';

/** The games homepage reuses verified server results; it never treats browser XP as official. */
export default function GamesHomeStatus({initialDate}){
 const [state,setState]=useState({kind:'loading',overview:null,rank:null,ranking:false});
 const [revision,setRevision]=useState(0);

 useEffect(()=>{
  let alive=true,sequence=0,authTimer=null,lastDate=utcDay();
  const db=browserDb(),throttle=createRefreshThrottle(),account=createAccountWatch();
  if(!db){setState({kind:'unavailable',overview:null,rank:null,ranking:false});return;}
  const refresh=async()=>{
   const id=++sequence;throttle.mark();
   try{
    const {data,error}=await db.auth.getSession();
    account.seen(error?null:data?.session);
    if(!alive||id!==sequence)return;
    if(error){setState({kind:'unavailable',overview:null,rank:null,ranking:false});return;}
    const token=data?.session?.access_token;
    if(!token){setState({kind:'guest',overview:null,rank:null,ranking:false});return;}
    const response=await fetch('/api/games/my-overview',{
     headers:{Authorization:'Bearer '+token},cache:'no-store'
    });
    if(!alive||id!==sequence)return;
    if(response.status===401){setState({kind:'guest',overview:null,rank:null,ranking:false});return;}
    if(!response.ok)throw Error('Overview unavailable');
    const overview=await response.json();
    if(!alive||id!==sequence)return;
    setState({kind:'ready',overview,rank:null,ranking:overview.stats?.played>0});
    if(overview.stats?.played>0){
     try{
      const scores=await fetch('/api/games/leaderboard?period=all',{
       headers:{Authorization:'Bearer '+token},cache:'no-store'
      });
      if(!scores.ok)throw Error('Leaderboard unavailable');
      const json=await scores.json();
      if(alive&&id===sequence)setState({kind:'ready',overview,rank:json.mine?.rank??null,ranking:false});
     }catch{
      if(alive&&id===sequence)setState({kind:'ready',overview,rank:null,ranking:false});
     }
    }
   }catch{
    if(alive&&id===sequence)setState({kind:'unavailable',overview:null,rank:null,ranking:false});
   }
  };
  refresh();
  // Supabase auth callbacks run while the auth lock is held. Defer reads.
  // Reload when the account changes, not on the initial event or hourly token refreshes.
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   if(!shouldReloadOnAuth(account,event,session))return;
   clearTimeout(authTimer);
   authTimer=setTimeout(()=>{if(alive)refresh();},0);
  });
  // Returning to the tab fires focus and visibilitychange together: reload once a minute at most.
  const onVisible=()=>{if(document.visibilityState==='visible'&&throttle.due())refresh();};
  const onFocus=()=>{if(throttle.due())refresh();};
  const interval=setInterval(()=>{
   const today=utcDay();
   if(today!==lastDate){lastDate=today;refresh();}
  },30_000);
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('focus',onFocus);
  return()=>{
   alive=false;sequence++;
   clearTimeout(authTimer);clearInterval(interval);
   document.removeEventListener('visibilitychange',onVisible);
   window.removeEventListener('focus',onFocus);
   subscription.unsubscribe();
  };
 },[revision]);

 const overview=state.kind==='ready'?{...state.overview,rank:state.rank}:null;
 const stats=overview?.stats;
 const number=x=>Number(x||0).toLocaleString('ar');
 return <div className={styles.hub}>
  <DailyCountdown initialDate={initialDate} playerOverview={overview}/>
  <section className={styles.player} aria-label="ملخص حسابي في ألعاب 967">
   <div className={styles.header}>
    <div className={styles.heading}><span className={styles.headingIcon}><UserRound size={22}/></span>
     <div><span className={styles.eyebrow}>MY ARCADE / إحصائياتي</span><h3>ملفي في ألعاب 967</h3></div>
    </div>
    <div className={styles.headActions}>
     <Link href="/games/achievements" className={styles.headLink}><Medal size={16}/> إنجازاتي وشاراتي</Link>
     {state.kind==='ready'&&<Link href="/games/leaderboard" className={styles.headLink}>عرض الترتيب الكامل <ArrowUpLeft size={17}/></Link>}
    </div>
   </div>
   {state.kind==='ready'?<>
    <div className={styles.stats}>
     <div className={styles.stat}><span className={styles.statTitle}><CalendarCheck2 size={16}/> تحديات مكتملة</span><strong>{number(stats.played)}</strong><small>محاولات رسمية منتهية</small></div>
     <div className={styles.stat}><span className={styles.statTitle}><Medal size={16}/> أفضل نتيجة</span><strong>{number(stats.bestScore)} <em>/ 1000</em></strong><small>أعلى نقاط في تحدٍّ رسمي</small></div>
     <div className={styles.stat}><span className={styles.statTitle}><Trophy size={16}/> ترتيبي العام</span><strong>{state.ranking?'…':state.rank?'#'+number(state.rank):'—'}</strong><small>{state.ranking?'جارٍ حساب ترتيبي':state.rank?'في لوحة المتصدرين':'لا يوجد ترتيب متاح بعد'}</small></div>
     <div className={styles.stat}><span className={styles.statTitle}><Flame size={16}/> سلسلة الأيام</span><strong>{number(stats.streak)} <em>يوم</em></strong><small>أيام رسمية متتالية نشطة</small></div>
    </div>
    <p className={styles.foot}><ShieldCheck size={15}/> الإحصائيات من نتائجك الرسمية الموثقة فقط، ولا تتضمن نقاط الجولات الحرة.
     {stats.played===0&&<> أكمل تحدي اليوم لبدء تسجيل إنجازاتك.</>}</p>
   </>:state.kind==='guest'?<div className={styles.guest}>
    <div><strong>سجّل الدخول لتتابع أداءك</strong><p>شاهد عدد تحدياتك، أفضل نتائجك، ترتيبك، وسلسلة مشاركاتك الرسمية. اللعب الحر متاح دون حساب.</p></div>
    <Link href="/login" className={styles.login}>تسجيل الدخول <ArrowUpLeft size={17}/></Link>
   </div>:state.kind==='unavailable'?<div className={styles.guest}>
    <div><strong>إحصائيات اللاعب غير متاحة مؤقتًا</strong><p>يمكنك متابعة الألعاب الحرة، أو المحاولة مجددًا عندما تتوفر خدمة الحسابات.</p></div>
    <button type="button" className={styles.login} onClick={()=>setRevision(x=>x+1)}>إعادة المحاولة</button>
   </div>:<div className={styles.loading} role="status"><CircleCheck size={18}/> جارٍ التحقق من حسابك وتحميل إحصائياتك الرسمية…</div>}
  </section>
 </div>;
}
