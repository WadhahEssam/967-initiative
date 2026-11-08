'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowUpLeft,CalendarDays,CheckCircle2,Clock3,Crown,Flame,LockKeyhole,Medal,Puzzle,RefreshCw,ShieldCheck,Target,Trophy,Zap} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {officialGameWeek} from '@/lib/gameWeeklyMissions';
import {createAccountWatch,shouldReloadOnAuth,createRefreshThrottle} from '@/lib/authEvents';
import styles from './WeeklyArcade.module.css';

const iconMap={calendar:CalendarDays,target:Target,puzzle:Puzzle,zap:Zap};
const fmt=value=>Number(value||0).toLocaleString('ar');
const dateLabel=value=>value?new Intl.DateTimeFormat('ar',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value)):'';
const empty={kind:'loading',data:null};
const requestHeaders=token=>token?{Authorization:'Bearer '+token}:{};

export default function WeeklyArcade(){
 const [missions,setMissions]=useState(empty);
 const [leaders,setLeaders]=useState(empty);
 const [version,setVersion]=useState(0);
 const currentWeek=useRef(officialGameWeek().start);

 useEffect(()=>{
  let alive=true,serial=0,authTimer=null;
  const db=browserDb(),throttle=createRefreshThrottle(),account=createAccountWatch();
  async function refresh(){
   const id=++serial;throttle.mark();
   setMissions(empty);setLeaders(empty);
   let token='';
   try{
    if(db){
     const {data}=await db.auth.getSession();
     account.seen(data?.session);
     token=data?.session?.access_token||'';
    }
   }catch{account.seen(null);/* Guest missions and public weekly rankings remain available. */}
   if(!alive||id!==serial)return;
   const [missionRequest,leaderRequest]=await Promise.allSettled([
    fetch('/api/games/weekly',{cache:'no-store',headers:requestHeaders(token)}),
    fetch('/api/games/leaderboard?period=weekly',{cache:'no-store',headers:requestHeaders(token)})
   ]);
   if(!alive||id!==serial)return;
   if(missionRequest.status==='fulfilled'){
    try{
     if(!missionRequest.value.ok)throw Error('Missions unavailable');
     const data=await missionRequest.value.json();
     if(!Array.isArray(data.missions)||data.missions.length!==3)throw Error('Incomplete missions');
     if(alive&&id===serial)setMissions({kind:'ready',data});
    }catch{if(alive&&id===serial)setMissions({kind:'error',data:null});}
   }else setMissions({kind:'error',data:null});
   if(leaderRequest.status==='fulfilled'){
    try{
     if(!leaderRequest.value.ok)throw Error('Leaderboard unavailable');
     const data=await leaderRequest.value.json();
     if(!Array.isArray(data.top))throw Error('Invalid leaderboard');
     if(alive&&id===serial)setLeaders({kind:'ready',data});
    }catch{if(alive&&id===serial)setLeaders({kind:'error',data:null});}
   }else setLeaders({kind:'error',data:null});
  }
  refresh();
  // Reload when the account changes, not on the initial event or hourly token refreshes.
  const subscription=db?.auth.onAuthStateChange((event,session)=>{
   if(!shouldReloadOnAuth(account,event,session))return;
   clearTimeout(authTimer);
   authTimer=setTimeout(()=>{if(alive)refresh();},0);
  }).data?.subscription;
  // Returning to the tab fires focus and visibilitychange together: reload once a minute at most.
  const onVisible=()=>{if(document.visibilityState==='visible'&&throttle.due())refresh();};
  const onFocus=()=>{if(throttle.due())refresh();};
  const checkWeek=()=>{
   const week=officialGameWeek().start;
   if(week!==currentWeek.current){currentWeek.current=week;refresh();}
  };
  const poll=setInterval(checkWeek,30_000);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   alive=false;serial++;clearTimeout(authTimer);clearInterval(poll);
   subscription?.unsubscribe();
   window.removeEventListener('focus',onFocus);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[version]);

 const payload=missions.data;
 const rankings=leaders.data?.top?.slice(0,3)||[];
 const completed=payload?.completed;
 const visitor=!payload?.authenticated;
 return <section className={styles.section} aria-label="المهمات الأسبوعية ومتصدرون الأسبوع في ألعاب 967">
  <header className={styles.sectionHeader}>
   <div><span className={styles.overline}><Flame size={15}/> WEEKLY ARCADE / 967</span>
    <h2>كل أسبوع <em>تحدٍّ جديد</em></h2>
    <p>ثلاث مهمات تتغير مع بداية كل أسبوع، ومنافسة رسمية لا تتوقف.</p>
   </div>
   <button className={styles.refresh} type="button" onClick={()=>setVersion(v=>v+1)} aria-label="تحديث المهمات والمتصدرين"><RefreshCw size={17}/> تحديث النتائج</button>
  </header>
  <div className={styles.columns}>
   <section className={styles.missionsPanel} aria-labelledby="weekly-missions-title">
    <div className={styles.panelHeader}>
     <span className={styles.panelIcon}><CalendarDays size={24}/></span>
     <div><span className={styles.panelEyebrow}>YOUR WEEKLY MISSIONS</span><h3 id="weekly-missions-title">مهمات الأسبوع</h3></div>
     {completed!==null&&completed!==undefined&&<span className={styles.completion}>{fmt(completed)} / ٣ <Trophy size={15}/></span>}
    </div>
    {payload&&<p className={styles.reset}><Clock3 size={14}/> تتجدد يوم الاثنين <time dateTime={payload.resetsAt}>{dateLabel(payload.resetsAt)}، الساعة 00:00 UTC</time></p>}
    {missions.kind==='loading'?<div className={styles.notice} role="status">جارٍ تحميل المهمات الأسبوعية…</div>:
     missions.kind==='error'?<div className={styles.notice} role="alert">تعذر تحميل المهمات. <button type="button" onClick={()=>setVersion(v=>v+1)}>أعد المحاولة</button></div>:
     <>
      {visitor&&<div className={styles.guestNotice}><LockKeyhole size={17}/>
       <span>سجّل الدخول لعرض تقدمك الرسمي المحفوظ في حسابك. <Link href="/login">تسجيل الدخول</Link></span>
      </div>}
      <div className={styles.missions}>
       {payload.missions.map((mission,index)=>{
        const Icon=iconMap[mission.icon]||Target;
        const hasProgress=Number.isInteger(mission.progress);
        const progress=hasProgress?mission.progress:0;
        const done=mission.completed===true;
        return <article className={[styles.mission,done?styles.done:''].join(' ')} key={mission.id}>
         <span className={styles.missionIcon}><Icon size={23} strokeWidth={1.8}/></span>
         <div className={styles.missionBody}>
          <div className={styles.missionHeading}>
           <span className={styles.missionSerial} dir="ltr">MISSION {String(index+1).padStart(2,'0')} · {mission.kind}</span>
           {done&&<span className={styles.doneLabel}><CheckCircle2 size={13}/> مكتملة</span>}
          </div>
          <h4>{mission.title}</h4>
          <p>{mission.description}</p>
          <div className={styles.missionProgress}>
           <span>{hasProgress?fmt(progress):'—'} / {fmt(mission.goal)}</span>
           <span>{done?'تم الإنجاز':visitor?'سجّل الدخول لتتبع التقدم':'التقدم الرسمي'}</span>
          </div>
          <div className={styles.track} role={hasProgress?'progressbar':undefined} aria-label={'تقدم مهمة '+mission.title}
           aria-valuemin={hasProgress?0:undefined} aria-valuemax={hasProgress?mission.goal:undefined}
           aria-valuenow={hasProgress?progress:undefined}>
           <span style={{width:(100*progress/mission.goal)+'%'}}/>
          </div>
         </div>
        </article>;
       })}
      </div>
      {completed===3&&<p className={styles.completeAll}><Trophy size={17}/> أحسنت! أنجزت مهمات الأسبوع الثلاث. تبدأ مجموعة جديدة الاثنين القادم.</p>}
      <div className={styles.missionFooter}>
       <ShieldCheck size={16}/><span>يُحسب التقدم من تحديات اليوم المكتملة والموثقة فقط، دون زيادة نقاط لوحة المتصدرين.</span>
       <Link href={payload.dailyHref||'/games'}>تحدي اليوم <ArrowUpLeft size={16}/></Link>
      </div>
     </>}
   </section>
   <section className={styles.leadersPanel} aria-labelledby="weekly-leaders-title">
    <div className={styles.panelHeader}>
     <span className={styles.panelIcon}><Crown size={25}/></span>
     <div><span className={styles.panelEyebrow}>TOP 3 / THIS WEEK</span><h3 id="weekly-leaders-title">نجوم الأسبوع</h3></div>
    </div>
    <p className={styles.leadersDescription}>أقوى ثلاثة لاعبين هذا الأسبوع بناءً على نتائج التحدي الرسمية.</p>
    {leaders.kind==='loading'?<div className={styles.notice} role="status">جارٍ تحميل المتصدرين…</div>:
     leaders.kind==='error'?<div className={styles.notice} role="alert">ترتيب الأسبوع غير متاح الآن. <button type="button" onClick={()=>setVersion(v=>v+1)}>تحديث</button></div>:
     rankings.length?<>
      <ol className={styles.podium}>
       {rankings.map((player,index)=><li className={[styles.player,styles['player'+index]].join(' ')} key={index}>
        <span className={styles.place} aria-label={'الترتيب '+player.rank}>{index===0?<Crown size={24}/>:<Medal size={23}/>}<small>#{fmt(player.rank)}</small></span>
        <span className={styles.avatar} aria-hidden="true">{player.name?.trim().slice(0,1)||'٩'}</span>
        <span className={styles.playerInfo}><strong>{player.name}{player.isMe&&<span className={styles.me}>أنت</span>}</strong><small>{fmt(player.played)} تحدٍّ مكتمل</small></span>
        <span className={styles.score} dir="ltr"><strong>{fmt(player.score)}</strong><small>XP</small></span>
       </li>)}
      </ol>
      <p className={styles.leaderFoot}><ShieldCheck size={15}/> نتائج أسبوعية موثقة تتجدد عند بداية الأسبوع بالتوقيت العالمي.</p>
     </>:<div className={styles.emptyLeaders}><Trophy size={39}/><strong>المراكز الثلاثة بانتظار أبطالها</strong><p>لا توجد نتائج رسمية مكتملة هذا الأسبوع حتى الآن.</p></div>}
    <Link className={styles.allRankings} href="/games/leaderboard">عرض الترتيب الأسبوعي الكامل <ArrowUpLeft size={19}/></Link>
   </section>
  </div>
 </section>;
}
