'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {resultSharePath} from '@/lib/resultShare';
import GameSignupInvite from './GameSignupInvite';
import {trackFunnel,useFunnelStep} from '@/components/analytics/funnel';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,Flame,Play,RotateCcw,Share2,Target,Trophy,XCircle,Zap} from 'lucide-react';
import {buildPlaceChallenges,buildTimelineChallenges,buildMapChallenges,gameTypes,isTimelineCorrect} from '@/lib/arcadeChallenges';
import {questionPoints} from '@/lib/gameEngine';
import {roundDuration} from '@/lib/gameClock';
import useQuestionTimer from './useQuestionTimer';
import {TimeControls,GameTimer} from './TimeControls';
import useDailyAttempt,{DailyAttemptNotice} from './useDailyAttempt';
import {PlaceBoard,TimelineBoard,MapBoard} from './ArcadeBoards';
import {readPracticeSeen,rememberPracticeTasks} from '@/lib/practiceRotation';
import FriendInviteAction from './FriendInviteAction';
import friendStyles from './FriendInviteAction.module.css';
import styles from './ArcadeChallenge.module.css';

const builders={place:buildPlaceChallenges,timeline:buildTimelineChallenges,map:buildMapChallenges};
function getStored(game){
 try{const x=JSON.parse(localStorage.getItem('967-game-'+game+'-progress-v1')||'null');return x&&typeof x==='object'?x:{plays:0,best:0,correct:0};}
 catch{return {plays:0,best:0,correct:0};}
}
export default function ArcadeChallenge({game,date,initialMode='practice'}){
 const [mode,setMode]=useState(initialMode),[seconds,setSeconds]=useState(15);
 const [starting,setStarting]=useState(false);
 const [verifying,setVerifying]=useState(false),[verified,setVerified]=useState(false);
 const [clockReady,setClockReady]=useState(false),[readyPending,setReadyPending]=useState(false);
 const [serverStartedAt,setServerStartedAt]=useState(null);
 const [syncError,setSyncError]=useState(''),[officialResult,setOfficialResult]=useState(null);
 const daily=useDailyAttempt(mode,game,date);
 const [tasks,setTasks]=useState([]),[runId,setRunId]=useState(0),[index,setIndex]=useState(0);
 const [answer,setAnswer]=useState(null),[records,setRecords]=useState([]),[finished,setFinished]=useState(false);
 const [ready,setReady]=useState(game==='timeline');
 const [mapData,setMapData]=useState(null),[mapError,setMapError]=useState('');
 const [mapAttempt,setMapAttempt]=useState(0);
 const [stats,setStats]=useState({plays:0,best:0,correct:0}),[shareStatus,setShareStatus]=useState('');
 const answerLocked=useRef(false),titleRef=useRef(null),arenaRef=useRef(null);
 // Like the quiz: bring the arena to the top for each task, instantly (the clock is running).
 useLayoutEffect(()=>{
  if(!tasks.length||finished||!arenaRef.current)return;
  const root=document.documentElement,previous=root.style.scrollBehavior;
  root.style.scrollBehavior='auto';
  try{arenaRef.current.scrollIntoView({block:'start',behavior:'instant'});}catch{arenaRef.current.scrollIntoView({block:'start'});}
  root.style.scrollBehavior=previous;
 // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll only when a round starts or the task changes
 },[runId,index,tasks.length,finished]);
 useEffect(()=>{setStats(getStored(game));},[game]);
 useEffect(()=>{
  if(game!=='map')return;
  let mounted=true;
  fetch('/data/yemen-map/yemen-boundaries.json').then(res=>{if(!res.ok)throw Error();return res.json();})
  .then(result=>{if(mounted){setMapData(result);setMapError('');}}).catch(()=>{if(mounted)setMapError('تعذر تحميل بيانات خريطة اليمن. يمكنك إعادة المحاولة.');});
  return ()=>{mounted=false;};
 },[game,mapAttempt]);
 const task=tasks[index];
 const revealed=answer!==null&&(mode!=='daily'||verified);
 const duration=roundDuration(mode,seconds);
 const isActive=tasks.length>0&&!finished&&answer===null&&ready&&!verifying&&(mode!=='daily'||clockReady);
 // Conversion counters: a round started and a round finished (once per run).
 useFunnelStep('game_start',tasks.length>0,game+':'+mode+':'+runId);
 useFunnelStep('game_done',finished,game+':'+mode+':'+runId);
 const timer=useQuestionTimer({seconds:duration,token:runId+':'+index,active:isActive,startTime:mode==='daily'?serverStartedAt:null,onExpire:()=>submitAnswer(null,true)});
 useEffect(()=>{if(tasks.length&&!finished)titleRef.current?.focus({preventScroll:true});},[index,finished,tasks.length]);
 useEffect(()=>{
  if(mode==='daily'&&task&&ready&&!finished&&!answer&&!clockReady&&!readyPending&&!syncError)markReady();
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on task id and round state; re-running on markReady/task identity would restart the official timer
 },[mode,task?.id,index,ready,finished,answer,clockReady,readyPending,syncError]);
 async function markReady(){
  if(mode!=='daily'||!tasks[index])return;
  setReadyPending(true);setSyncError('');
  try{const status=await daily.progress('ready',index,tasks[index].id,null);setServerStartedAt(status.startedAt);setClockReady(true);}
  catch(error){setSyncError(error.message||'تعذر بدء مؤقت السؤال.');}
  finally{setReadyPending(false);}
 }
 async function start(){
  if(starting)return;
  let tasksNow;
  if(mode==='daily'){
   // The official round comes from the server without answers.
   setStarting(true);
   tasksNow=await daily.reserve();
   setStarting(false);
   if(!tasksNow)return;
  }else{
   tasksNow=builders[game]({mode,date,seed:'free-'+Date.now()+'-'+Math.random(),seen:readPracticeSeen(game)});
   if(!tasksNow.length)return;
   rememberPracticeTasks(game,tasksNow.map(task=>task.id));
  }
  answerLocked.current=false;
  setRunId(x=>x+1);setTasks(tasksNow);setIndex(0);setRecords([]);setAnswer(null);
  setReady(game==='timeline'||(game==='map'&&Boolean(mapData)));
  setFinished(false);setShareStatus('');setVerified(false);setSyncError('');setOfficialResult(null);setClockReady(false);setServerStartedAt(null);
 }
 async function verifyAnswer(value,taskId,step){
  setVerifying(true);setSyncError('');
  try{
   const response=await daily.progress('answer',step,taskId,value);
   if(response.task)setTasks(previous=>previous.map((item,i)=>i===step?{...item,...response.task}:item));
   setAnswer(previous=>previous?{...previous,correct:response.correct,points:response.points}:previous);
   setRecords(previous=>previous.map((record,i)=>i===step?{...record,correct:response.correct,points:response.points}:record));
   if(response.finished)setOfficialResult({score:response.score,correct:response.correctCount});
   setVerified(true);
  }catch(error){setSyncError(error.message||'تعذر توثيق الإجابة.');}
  finally{setVerifying(false);}
 }
 function submitAnswer(value,timedOut=false){
  if(answerLocked.current||!tasks.length||finished)return;
  if(!timedOut&&!timer.claim())return;
  answerLocked.current=true;
  const taskNow=tasks[index];
  // Daily tasks carry no answer until the server reveals it with its verdict.
  const correct=timedOut||mode==='daily'?false:game==='place'?value===taskNow.correct:game==='map'?value===taskNow.regionId:isTimelineCorrect(taskNow.events,value);
  const streak=records.slice().reverse().findIndex(r=>!r.correct);
  const points=questionPoints(taskNow,correct,streak===-1?records.length:streak);
  const record={correct,points,choice:value,timedOut};
  setAnswer(record);
  setRecords(prev=>[...prev,record]);
  setVerified(mode!=='daily');
  if(mode==='daily')verifyAnswer(value,taskNow.id,index);
 }
 async function next(){
  if(!answer||verifying||(mode==='daily'&&!verified))return;
  if(index+1<tasks.length){
   if(mode==='daily'){
    setVerifying(true);setSyncError('');
    try{await daily.progress('next',index,task.id,null);}
    catch(error){setSyncError(error.message||'تعذر الانتقال إلى المهمة التالية.');setVerifying(false);return;}
    setVerifying(false);
   }
   answerLocked.current=false;setVerified(false);setClockReady(false);setServerStartedAt(null);
   setReady(game==='timeline'||(game==='map'&&Boolean(mapData)));
   setAnswer(null);setIndex(i=>i+1);
  }else{
   const total=records.reduce((sum,r)=>sum+r.points,0),correct=records.filter(r=>r.correct).length;
   const old=getStored(game),updated={plays:(old.plays||0)+1,correct:(old.correct||0)+correct,best:Math.max(old.best||0,total)};
   try{localStorage.setItem('967-game-'+game+'-progress-v1',JSON.stringify(updated));}catch{}
   setStats(updated);setFinished(true);
  }
 }
 function reset(){setTasks([]);setIndex(0);setRecords([]);setAnswer(null);setFinished(false);answerLocked.current=false;setShareStatus('');setSyncError('');setVerified(false);setOfficialResult(null);setClockReady(false);setServerStartedAt(null);}
 async function share(){
  const total=records.reduce((sum,r)=>sum+r.points,0);
  // A result link: its page and preview image show the score as a challenge (app/share/result).
  const url=location.origin+(resultSharePath({kind:'game',game,score:mode==='daily'&&officialResult?officialResult.correct:correctCount,total:tasks.length,daily:mode==='daily'})||'/games/'+game);
  trackFunnel('share_click',game);
  const text='حصلت على '+total+' نقطة في «'+gameTypes[game].title+'» ضمن ألعاب 967. هل تتفوق عليّ؟';
  try{if(navigator.share)await navigator.share({title:'ألعاب 967',text,url});
   else if(navigator.clipboard){await navigator.clipboard.writeText(text+' '+url);setShareStatus('تم نسخ رابط المشاركة ونتيجتك.');}
   else setShareStatus('رابط التحدي: '+url);
  }catch(e){if(e?.name!=='AbortError')setShareStatus('شارك الرابط: '+url);}
 }
 const total=records.reduce((sum,r)=>sum+r.points,0);
 const correctCount=records.filter(r=>r.correct).length;
 return <section className={styles.wrapper} aria-label={gameTypes[game].title}><div className="container">
  {!tasks.length&&<div className={styles.setup}>
   <span className={styles.kicker}><Target size={17}/> GAME SETUP / إعداد التحدي</span>
   <h2>اختر سرعتك. وانطلق.</h2><p>{gameTypes[game].description} كل جولة تحتوي على عشر مهام، وبعد اختيار الإجابة يتوقف الوقت حتى تضغط «التالي».</p>
   <div className={styles.modes} role="group" aria-label="نوع الجولة">
    <button type="button" aria-pressed={mode==='practice'} onClick={()=>setMode('practice')} disabled={starting}>جولة حرة</button>
    <button type="button" aria-pressed={mode==='daily'} onClick={()=>setMode('daily')} disabled={starting}><Flame size={17}/> تحدي اليوم</button>
   </div>
   <TimeControls mode={mode} seconds={seconds} onChange={setSeconds}/>
   <DailyAttemptNotice daily={daily} mode={mode} date={date}/>
   {mode==='daily'&&<p className={styles.dailyNote}>تحدي {date} بتوقيت UTC: المهام وترتيبها موحدة لهذا اليوم، والمهلة 7 ثوانٍ لكل مهمة.</p>}
   {game==='map'&&mapError&&<div role="alert" className={styles.mapFailure}>{mapError}<button type="button" onClick={()=>{setMapError('');setMapAttempt(x=>x+1);}}>إعادة التحميل</button></div>}
   <div className={friendStyles.actionRow}>
    <button type="button" className={styles.primary} disabled={starting||!daily.canStart||(game==='map'&&!mapData)} onClick={start}><Play size={18}/> {starting?'جارٍ حجز المحاولة…':'ابدأ التحدي'} <ArrowLeft size={18}/></button>
    <FriendInviteAction game={game} seconds={seconds} disabled={starting}/>
   </div>
   <aside className={styles.playerStats}><span><Trophy size={18}/> أفضل نتيجة: {stats.best||0} XP</span><span>الجولات المكتملة: {stats.plays||0}</span><span>النتائج الرسمية فقط تظهر في لوحة المتصدرين</span></aside>
  </div>}
  {!!tasks.length&&!finished&&<div ref={arenaRef} className={styles.arena}>
   <header className={styles.arenaHeader}><span>{gameTypes[game].english} <span> / {mode==='daily'?'DAILY':'FREE'}</span></span><strong>المهمة {index+1} / {tasks.length}</strong><span className={styles.xp}><Zap size={15}/> {total} XP</span></header>
   <div className={styles.progress} role="progressbar" aria-label="تقدم الجولة" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={index+1}><span style={{width:((index+1)/tasks.length*100)+'%'}}/></div>
   <h2 ref={titleRef} tabIndex={-1} className={styles.taskTitle}>{game==='place'?'ما اسم المكان في الصورة؟':game==='timeline'?'رتّب الأحداث من الأقدم إلى الأحدث':'أين تقع محافظة '+task.name+'؟'}</h2>
   <div className={styles.taskBody} key={task.id}>
    {game==='place'&&<PlaceBoard task={task} locked={revealed} onAnswer={submitAnswer} onReady={setReady}/>}
    {game==='timeline'&&<TimelineBoard task={task} locked={revealed} onAnswer={submitAnswer}/>}
    {game==='map'&&<MapBoard task={task} locked={revealed} onAnswer={submitAnswer} data={mapData} selectedId={answer?.choice}/>}
   </div>
   {!ready&&<p className={styles.loading} role="status">{game==='place'?'جاري تجهيز الصورة… يبدأ الوقت عند ظهورها.':'جاري تجهيز الخريطة…'}</p>}
   <GameTimer remaining={timer.remaining} duration={duration} paused={!isActive}/>
   {revealed&&<div className={[styles.feedback,answer.correct?styles.good:styles.bad].join(' ')} role="status">
    <strong>{answer.timedOut?<><Clock3 size={18}/> انتهى الوقت!</>:answer.correct?<><CheckCircle2 size={18}/> إجابة صحيحة!</>:<><XCircle size={18}/> إجابة غير صحيحة</>}</strong>
    {game==='place'&&<p>المكان هو <b>{task.answer}</b>. {task.hint}</p>}
    {game==='timeline'&&<p>تم عرض الترتيب الصحيح للأحداث مع السنوات أسفلها.</p>}
    {game==='map'&&<p>الموقع الصحيح هو محافظة <b>{task.name}</b>، والمكان مُلوّن بالأخضر على الخريطة.</p>}
    {game==='place'&&<p className={styles.credit}>الصورة: {task.photo.credit} · {task.photo.license} — <a href={task.photo.page} target="_blank" rel="noopener noreferrer">صفحة الصورة وحقوقها</a></p>}
    <a href={game==='place'?task.source:game==='map'?task.source:task.events[0].source} target={game==='map'||game==='timeline'?'_self':'_blank'} rel="noopener noreferrer">اقرأ المزيد عن الموضوع <ArrowLeft size={14}/></a>
    {answer.correct&&<span className={styles.bonus}>+{answer.points} XP</span>}
   </div>}
   {(verifying||readyPending)&&<p className={styles.loading} role="status">{readyPending?'جارٍ تفعيل توقيت السؤال الرسمي…':'جارٍ توثيق الإجابة على الخادم…'}</p>}
   {syncError&&<p className={styles.syncError} role="alert">{syncError} <button type="button" onClick={()=>!answer?markReady():!verified?verifyAnswer(answer.choice,task.id,index):next()}>إعادة المحاولة</button></p>}
   <div className={styles.actions}><button type="button" className={styles.secondary} onClick={reset}><ArrowRight size={16}/> إنهاء الجولة</button>
    <button type="button" className={styles.primary} disabled={!answer||verifying||(mode==='daily'&&!verified)} onClick={next}>{index+1===tasks.length?'عرض النتيجة':'المهمة التالية'} <ArrowLeft size={17}/></button></div>
  </div>}
  {finished&&<div className={styles.result} role="status">
   <span className={styles.victoryIcon}><Trophy size={49}/></span>
   <span className={styles.kicker}>QUEST COMPLETE / اكتمل التحدي</span>
   <h2>{correctCount===tasks.length?'أنت خبير حقيقي!':correctCount>=6?'نتيجة رائعة!':'تحدٍ جديد في انتظارك'}</h2>
   <div className={styles.resultStats}><div><strong>{correctCount} / {tasks.length}</strong><span>إجابات صحيحة</span></div><div><strong>{mode==='daily'?officialResult?.score??'—':total}</strong><span>{mode==='daily'?'النقاط الرسمية / 1000':'نقاط الجولة'}</span></div><div><strong>{stats.best}</strong><span>أفضل نتيجة محلية</span></div></div>
   <p>{mode==='daily'?'نتيجتك موثقة ومحفوظة في حسابك؛ تدخل تلقائياً في الترتيب الرسمي الموحد.':'انتهت الجولة. الإجابات الخاطئة أو التي انتهى وقتها لا تحصل على نقاط.'}</p>
   {mode!=='daily'&&<GameSignupInvite/>}
   {mode==='daily'&&<Link className={styles.secondary} href="/games/leaderboard">شاهد ترتيبك في لوحة المتصدرين <Trophy size={16}/></Link>}
   <div className={styles.actions}><button className={styles.primary} type="button" onClick={reset}><RotateCcw size={18}/> جولة جديدة</button><button className={styles.secondary} type="button" onClick={share}><Share2 size={17}/> مشاركة</button><Link className={styles.secondary} href="/games">جميع الألعاب <ArrowRight size={17}/></Link></div>
   {shareStatus&&<p role="status" className={styles.credit}>{shareStatus}</p>}
  </div>}
 </div></section>;
}
