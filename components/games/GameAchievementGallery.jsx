'use client';
import {useEffect,useState} from 'react';
import LoginLink from '@/components/LoginLink';
import Link from 'next/link';
import {ArrowUpLeft,CalendarDays,CheckCircle2,Compass,Crosshair,Crown,Flame,Flag,Gem,LockKeyhole,Map,Medal,RefreshCw,ScrollText,Shapes,Shield,ShieldCheck,Star,Target,Trophy,UsersRound} from 'lucide-react';
import {browserMayBeSignedIn,whenBrowserDb} from '@/lib/browserSession';
import {GAME_ACHIEVEMENTS} from '@/lib/gameAchievements';
import {createAccountWatch,shouldReloadOnAuth} from '@/lib/authEvents';
import styles from './GameAchievementGallery.module.css';

const icons={flag:Flag,compass:Compass,shield:Shield,crown:Crown,target:Target,star:Star,
 crosshair:Crosshair,flame:Flame,calendar:CalendarDays,map:Map,scroll:ScrollText,
 users:UsersRound,shapes:Shapes,gem:Gem};
const format=n=>Number(n||0).toLocaleString('ar');
const dateLabel=value=>{
 if(!value)return '';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('ar',{year:'numeric',month:'short',day:'numeric'}).format(date);
};

function BadgeCard({badge,mini=false}){
 const Icon=icons[badge.icon]||Medal;
 const achieved=!!badge.unlocked;
 const progress=Math.max(0,Math.min(badge.goal,badge.progress||0));
 return <article className={[styles.badge,styles['tier_'+badge.tier],achieved?styles.earned:styles.locked,mini?styles.mini:''].join(' ')}>
  <div className={styles.badgeTop}>
   <span className={styles.symbol} aria-hidden="true"><Icon size={mini?27:34} strokeWidth={1.65}/></span>
   <span className={styles.status}>{achieved?<><CheckCircle2 size={14}/> مكتسبة</>:<><LockKeyhole size={13}/> لم تُكتسب</>}</span>
  </div>
  <span className={styles.category}>{badge.category}</span>
  <h3>{badge.title}</h3>
  <p>{badge.description}</p>
  <div className={styles.badgeFoot}>
   {achieved?<span className={styles.earnedDate}><Trophy size={14}/> <time dateTime={badge.earnedAt}>{dateLabel(badge.earnedAt)||'تم الحصول عليها'}</time></span>:
    <div className={styles.progress}>
     <span>التقدم <strong>{format(progress)} / {format(badge.goal)}</strong></span>
     <div className={styles.track} role="progressbar" aria-label={'تقدم '+badge.title} aria-valuemin={0} aria-valuemax={badge.goal} aria-valuenow={progress}>
      <span style={{width:(100*progress/badge.goal)+'%'}}/>
     </div>
    </div>}
  </div>
 </article>;
}

export default function GameAchievementGallery({preview=false}){
 const [data,setData]=useState(null);
 const [state,setState]=useState('loading');
 const [filter,setFilter]=useState('all');
 const [retry,setRetry]=useState(0);

 useEffect(()=>{
  // A visitor who never signed in sees the guest view without loading the account client;
  // signing in (here or in another tab) starts it.
  if(!browserMayBeSignedIn()){setData(null);setState('guest');}
  return whenBrowserDb(db=>{
  const account=createAccountWatch();
  let alive=true,sequence=0,authTimer=null;
  async function load(){
   const id=++sequence;
   try{
    const {data:auth,error}=await db.auth.getSession();
    account.seen(error?null:auth?.session);
    if(!alive||id!==sequence)return;
    if(error)throw Error('Could not read login');
    const token=auth?.session?.access_token;
    if(!token){setData(null);setState('guest');return;}
    setState('loading');
    const response=await fetch('/api/games/achievements',{
     headers:{Authorization:'Bearer '+token},cache:'no-store'
    });
    if(!alive||id!==sequence)return;
    if(response.status===401){setData(null);setState('guest');return;}
    if(!response.ok)throw Error('Could not load achievements');
    const result=await response.json();
    if(alive&&id===sequence){setData(result);setState('ready');}
   }catch{
    if(alive&&id===sequence){setData(null);setState('unavailable');}
   }
  }
  load();
  // Avoid reading the auth client inside the synchronous auth-state callback.
  // Reload when the account changes, not on the initial event, token refreshes or a same-account SIGNED_IN.
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   if(!shouldReloadOnAuth(account,event,session))return;
   clearTimeout(authTimer);
   authTimer=setTimeout(()=>{if(alive)load();},0);
  });
  const onVisible=()=>{if(document.visibilityState==='visible')load();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   alive=false;sequence++;
   clearTimeout(authTimer);subscription.unsubscribe();
   document.removeEventListener('visibilitychange',onVisible);
  };
  });
 },[retry]);

 const loaded=state==='ready'&&Array.isArray(data?.items);
 const items=loaded?data.items:GAME_ACHIEVEMENTS.map(b=>({...b,progress:0,unlocked:false,earnedAt:null}));
 const count=loaded?data.earned:0;
 const total=items.length;
 const visible=preview
  ?[...items].sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||((b.progress/b.goal)-(a.progress/a.goal))).slice(0,3)
  :items.filter(b=>filter==='earned'?b.unlocked:filter==='locked'?!b.unlocked:true).sort((a,b)=>Number(b.unlocked)-Number(a.unlocked));
 return <section className={[styles.section,preview?styles.preview:''].join(' ')} aria-label="إنجازات ألعاب 967">
  <div className={styles.header}>
   <div className={styles.heading}>
    <span className={styles.medal}><Medal size={24} strokeWidth={1.7}/></span>
    <div><span className={styles.eyebrow}>967 ACHIEVEMENTS</span><h2>{preview?'شاراتي وإنجازاتي':'مجموعة الشارات والإنجازات'}</h2>
     <p>{preview?'مهارات جديدة، وإنجازات تستحق أن تحتفظ بها.':'إنجازات دائمة تُمنح من نتائج تحدياتك اليومية الرسمية الموثقة.'}</p>
    </div>
   </div>
   {preview?<Link href="/games/achievements" className={styles.more}>جميع الإنجازات <ArrowUpLeft size={17}/></Link>:null}
  </div>
  {state==='guest'&&<div className={styles.notice}><LockKeyhole size={17}/>
   <span>سجّل الدخول لعرض شاراتك المكتسبة وحفظ إنجازاتك على حسابك. <LoginLink>تسجيل الدخول</LoginLink></span>
  </div>}
  {state==='unavailable'&&<div className={styles.notice} role="alert"><ShieldCheck size={17}/>
   <span>تعذر تحميل سجل الإنجازات حاليًا.</span><button type="button" onClick={()=>setRetry(v=>v+1)}>إعادة المحاولة <RefreshCw size={14}/></button>
  </div>}
  {state==='loading'&&<p className={styles.wait} role="status">جارٍ تحميل إنجازاتك الرسمية…</p>}
  <div className={styles.summary}>
   <span><Trophy size={17}/> {loaded?<>جمعت <strong>{format(count)} من {format(total)}</strong> شارة</>:'14 شارة تنتظر اكتشافها'}</span>
   <span className={styles.summaryNote}><ShieldCheck size={15}/> توثيق على الخادم · لا تُحسب الجولات الحرة</span>
  </div>
  {loaded&&<div className={styles.mainTrack} role="progressbar" aria-label="نسبة الشارات المكتسبة" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
   <span style={{width:(100*count/total)+'%'}}/>
  </div>}
  {!preview&&<div className={styles.filters} aria-label="تصفية الشارات">
   {[['all','الكل'],['earned','المكتسبة'],['locked','غير المكتسبة']].map(([id,label])=>
    <button type="button" key={id} aria-pressed={filter===id} className={filter===id?styles.active:''} onClick={()=>setFilter(id)}>{label}</button>)}
  </div>}
  {visible.length?<div className={styles.grid}>
   {visible.map(item=><BadgeCard key={item.code} badge={item} mini={preview}/>)}
  </div>:<div className={styles.empty}>لا توجد شارات في هذا القسم بعد. شارك في تحدي اليوم لكسب أول شارة!</div>}
  {!preview&&<p className={styles.rule}><ShieldCheck size={15}/> تُمنح الشارات تلقائيًا بعد التحقق من الإجابات على الخادم، وتظل محفوظة في حسابك. بعض الشارات تحتاج إلى مشاركات متعددة على أيام مختلفة.</p>}
 </section>;
}
