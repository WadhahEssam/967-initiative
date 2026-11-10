'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,Clock3,Crown,Flame,Medal,RefreshCw,ShieldCheck,Trophy,Zap} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import styles from '@/app/games/leaderboard/leaderboard.module.css';
import MemberLink from '@/components/members/MemberLink';

const periods=[{id:'daily',label:'اليوم'},{id:'weekly',label:'الأسبوع'},{id:'monthly',label:'الشهر'},{id:'all',label:'كل الوقت'}];
const format=n=>Number(n||0).toLocaleString('ar');
function Badges({items=[]}){return items.length?<div className={styles.badges}>{items.map(b=><span key={b}><Medal size={13}/>{b}</span>)}</div>:null;}
export default function Leaderboard(){
 const [period,setPeriodState]=useState('daily'),[loading,setLoading]=useState(true);
 // The tab can be linked to (?period=weekly); changing it keeps the address in step.
 useEffect(()=>{const wanted=new URLSearchParams(location.search).get('period');if(periods.some(p=>p.id===wanted))setPeriodState(wanted);},[]);
 const setPeriod=next=>{setPeriodState(next);const p=new URLSearchParams(location.search);if(next==='daily')p.delete('period');else p.set('period',next);history.replaceState(history.state,'',location.pathname+(p.size?'?'+p:'')+location.hash);};
 const [data,setData]=useState(null),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  (async()=>{
   setLoading(true);setError('');setSelected(null);
   try{
    const db=browserDb();
    let token='';
    try{const {data:session}=await db?.auth.getSession()||{};token=session?.session?.access_token||'';}catch{}
    const response=await fetch('/api/games/leaderboard?period='+period,{cache:'no-store',
     headers:token?{Authorization:'Bearer '+token}:{}});
    const payload=await response.json();
    if(!response.ok)throw Error(payload.error||'تعذر تحميل النتائج.');
    if(active)setData(payload);
   }catch(e){if(active){setError(e.message||'تعذر تحميل الترتيب.');setData(null);}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[period,refresh]);
 const leaders=data?.top||[],podium=[leaders[1],leaders[0],leaders[2]];
 const name=periods.find(p=>p.id===period)?.label||'';
 return <section className={styles.section} aria-label="نتائج المتصدرين"><div className="container">
  <div className={styles.toolbar}>
   <div><span className={styles.kicker}>LEADERBOARD / الترتيب الرسمي</span><h2>أبطال {name}</h2></div>
   <button type="button" className={styles.refresh} onClick={()=>setRefresh(x=>x+1)} disabled={loading}><RefreshCw size={17}/> تحديث</button>
  </div>
  <div className={styles.tabs} role="group" aria-label="فترة الترتيب">
   {periods.map(p=><button type="button" key={p.id} className={p.id===period?styles.active:''} aria-pressed={p.id===period} onClick={()=>setPeriod(p.id)}>{p.label}</button>)}
  </div>
  {loading?<div className={styles.message} role="status"><Clock3 size={22}/> جارٍ تحميل نتائج المتصدرين…</div>
  :error?<div className={styles.message} role="alert">{error} <button type="button" onClick={()=>setRefresh(x=>x+1)}>إعادة المحاولة</button></div>
  :<div>
   <div className={styles.summary}>
    <div><strong>{format(data?.participants)}</strong><span>لاعبًا في الترتيب</span></div>
    <div><strong>{format(data?.completed)}</strong><span>تحديًا مكتملًا</span></div>
    <div><strong>1,000</strong><span>الحد الأعلى لنقاط اليوم</span></div>
   </div>
   {leaders.length===0?<div className={styles.empty}><Trophy size={48}/><h3>لا توجد نتائج موثقة لهذه الفترة بعد.</h3><p>يمكنك أن تكون أول المتصدرين. شارك في تحدي اليوم الرسمي بحسابك المسجل.</p><Link href="/games">اذهب إلى الألعاب <ArrowLeft size={17}/></Link></div>
   :<>
    <div className={styles.podium}>
     {podium.map((player,index)=>player?<div key={index} className={[styles.podiumCard,index===1?styles.champion:''].join(' ')}>
      <span className={styles.rankIcon}>{index===1?<Crown size={28}/>:<Medal size={25}/>}</span>
      <MemberLink id={player.member_id} name={player.name} className={styles.playerIdentity}/>
      {player.isMe&&<span className={styles.meLabel}>أنت</span>}
      <strong className={styles.points} dir="ltr">{format(player.score)} XP</strong>
      <span className={styles.rankNumber}>المركز {format(player.rank)}</span>
      <small>{format(player.played)} تحديات مكتملة</small>
      <button type="button" className={styles.playerStatsButton} onClick={()=>setSelected(player)}>عرض الإحصاءات</button>
     </div>:<div key={index} className={styles.placeholder} aria-hidden="true"/>)}
    </div>
    <div className={styles.rankTable}>
     <div className={styles.tableHead}><span>الترتيب</span><span>اللاعب</span><span>التحديات</span><span>النقاط</span></div>
     {leaders.slice(3).map((player,index)=><div key={index} className={[styles.rankRow,player.isMe?styles.myRow:''].join(' ')}>
      <strong>#{format(player.rank)}</strong>
      <span className={styles.rowPlayer}><MemberLink id={player.member_id} name={player.name}/>{player.isMe&&<b className={styles.meLabel}>أنت</b>}</span>
      <button type="button" className={styles.playerStatsButton} onClick={()=>setSelected(player)} aria-label={'عرض إحصاءات '+player.name}>{format(player.played)} <small>تحديات</small></button>
      <strong dir="ltr">{format(player.score)} XP</strong>
     </div>)}
    </div>
   </>}
   <div className={styles.bottom}>
    {data?.mine?<div className={styles.myRank}><div><span className={styles.kicker}>YOUR RANK / ترتيبك</span><h3>المركز #{format(data.mine.rank)}</h3><p>{data.mine.name} · {format(data.mine.played)} تحديات مكتملة</p><Badges items={data.mine.awards.badges}/></div><strong dir="ltr">{format(data.mine.score)} XP</strong></div>
    :<p className={styles.notice}>لرؤية ترتيبك الخاص، سجّل الدخول وأكمل تحديًا رسميًا في هذه الفترة. الجولات الحرة لا تدخل المنافسة.</p>}
    <p className={styles.notice}><ShieldCheck size={17}/> تُقبل نتائج تحدي اليوم المكتمل فقط. تُحسب النقاط على مقياس موحد من 1,000، والتعادل في النقاط يمنح نفس المركز. يبدأ اليوم الجديد عند منتصف الليل بتوقيت UTC.</p>
   </div>
   {selected&&<div className={styles.profileOverlay} role="presentation" onClick={()=>setSelected(null)}>
    <div className={styles.profileCard} role="dialog" aria-modal="true" aria-label={'إحصائيات '+selected.name} onClick={e=>e.stopPropagation()}>
     <button type="button" onClick={()=>setSelected(null)} className={styles.close}>إغلاق ×</button>
     <div className={styles.profileHeader}><MemberLink id={selected.member_id} name={selected.name}/><div><h3>{selected.name}</h3><p>المركز #{format(selected.rank)} · {name}</p></div></div>
     <div className={styles.profileStats}><div><strong>{format(selected.score)}</strong><small>النقاط</small></div><div><strong>{format(selected.played)}</strong><small>تحديات مكتملة</small></div><div><strong>{format(selected.correct)}</strong><small>إجابات صحيحة</small></div><div><strong>{format(selected.awards.streak)}</strong><small>سلسلة الأيام</small></div></div>
     <Badges items={selected.awards.badges}/>
     <p className={styles.notice}><CheckCircle2 size={15}/> جميع النتائج المعروضة رسمية وتم احتسابها على الخادم.</p>
    </div>
   </div>}
  </div>}
 </div></section>;
}
