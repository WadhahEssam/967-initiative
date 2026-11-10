'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {resultSharePath} from '@/lib/resultShare';
import GameSignupInvite from './GameSignupInvite';
import {trackFunnel,useFunnelStep} from '@/components/analytics/funnel';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,Flame,Play,RotateCcw,Share2,Target,Trophy,XCircle,Zap} from 'lucide-react';
import {extraGameBuilders,extraGameTypes} from '@/lib/extraGames';
import {questionPoints} from '@/lib/gameEngine';
import {roundDuration,localStartTime} from '@/lib/gameClock';
import useQuestionTimer from './useQuestionTimer';
import {TimeControls,GameTimer} from './TimeControls';
import useDailyAttempt,{DailyAttemptNotice,useLeaveWarning} from './useDailyAttempt';
import {ExtraBoard} from './ExtraBoards';
import {readPracticeSeen,rememberPracticeTasks} from '@/lib/practiceRotation';
import FriendInviteAction from './FriendInviteAction';
import friendStyles from './FriendInviteAction.module.css';
import styles from './ArcadeChallenge.module.css';
import extra from './ExtraArcade.module.css';

const storedKey=game=>'967-extra-'+game+'-progress-v1';
const blank={plays:0,best:0,correct:0};
const getStored=game=>{
 try{const value=JSON.parse(localStorage.getItem(storedKey(game))||'null');
  return value&&typeof value==='object'?{plays:Number(value.plays)||0,best:Number(value.best)||0,correct:Number(value.correct)||0}:blank;}
 catch{return blank;}
};
const normalize=s=>String(s||'').trim().replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي');
function correctChoice(game,task,choice){
 if(choice===null)return false;
 if(game==='connect')return Array.isArray(choice)&&choice.length===task.correct.length&&task.correct.every((x,i)=>x===choice[i]);
 if(game==='yemenword')return normalize(choice)===normalize(task.answer);
 return choice===task.correct;
}
const questionTitles={
 who:'من هذه الشخصية اليمنية؟',bigger:'أيهما أكبر؟',connect:'اربط كل عنصر بالمعلومة الصحيحة',
 yemenword:'ركّب الإجابة اليمنية من الحروف',object:'ما هذا الشيء في الصورة؟'
};

export default function ExtraArcadeChallenge({game,date,initialMode='practice'}){
 const meta=extraGameTypes[game];
 const [mode,setMode]=useState(initialMode),[seconds,setSeconds]=useState(15);
 const [starting,setStarting]=useState(false),[verifying,setVerifying]=useState(false);
 const [clockReady,setClockReady]=useState(false),[readyPending,setReadyPending]=useState(false);
 const [serverStartedAt,setServerStartedAt]=useState(null);
 const [syncError,setSyncError]=useState(''),[verified,setVerified]=useState(false);
 const [officialResult,setOfficialResult]=useState(null);
 const daily=useDailyAttempt(mode,game,date);
 const [tasks,setTasks]=useState([]),[runId,setRunId]=useState(0),[index,setIndex]=useState(0);
 const [answer,setAnswer]=useState(null),[records,setRecords]=useState([]),[finished,setFinished]=useState(false);
 const [mediaReady,setMediaReady]=useState(game!=='object');
 const [stats,setStats]=useState(blank),[shareNote,setShareNote]=useState('');
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
 const task=tasks[index];
 const revealed=answer!==null&&(mode!=='daily'||verified);
 const duration=roundDuration(mode,seconds);
 const active=!!task&&!finished&&answer===null&&mediaReady&&!verifying&&(mode!=='daily'||clockReady);
 useLeaveWarning(mode==='daily'&&tasks.length>0&&!finished);
 // Conversion counters: a round started and a round finished (once per run).
 useFunnelStep('game_start',tasks.length>0,game+':'+mode+':'+runId);
 useFunnelStep('game_done',finished,game+':'+mode+':'+runId);
 const timer=useQuestionTimer({seconds:duration,token:runId+':'+index,active,
  startTime:mode==='daily'?serverStartedAt:null,onExpire:()=>submit(null,true)});
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on task id; the task object is replaced when its answer is revealed
 useEffect(()=>{if(task&&!finished)titleRef.current?.focus({preventScroll:true});},[index,task?.id,finished]);
 useEffect(()=>{
  if(mode==='daily'&&task&&mediaReady&&!finished&&!answer&&!clockReady&&!readyPending&&!syncError)markReady();
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on task id and round state; re-running on markReady/task identity would restart the official timer
 },[mode,task?.id,index,mediaReady,finished,answer,clockReady,readyPending,syncError]);
 async function markReady(){
  const current=tasks[index];
  if(!current||readyPending||mode!=='daily')return;
  setReadyPending(true);setSyncError('');
  try{
   const state=await daily.progress('ready',index,current.id,null);
   setServerStartedAt(localStartTime(state.startedAt,state.serverNow));
   setClockReady(true);
  }catch(e){setSyncError(e.message||'تعذر بدء توقيت السؤال الرسمي.');}
  finally{setReadyPending(false);}
 }
 async function start(){
  if(starting)return;
  let list;
  if(mode==='daily'){
   // The official round comes from the server without answers.
   setStarting(true);
   list=await daily.reserve();
   setStarting(false);
   if(!list)return;
   if(list.resume){resumeRound(list.resume);return;}
  }else{
   list=extraGameBuilders[game]({mode,date,seed:'practice-'+Date.now()+'-'+Math.random(),seen:readPracticeSeen(game)});
   if(list.length!==10)return;
   rememberPracticeTasks(game,list.map(task=>task.id));
  }
  answerLocked.current=false;
  setTasks(list);setRunId(i=>i+1);setIndex(0);setAnswer(null);setRecords([]);setFinished(false);
  setMediaReady(game!=='object');setClockReady(false);setServerStartedAt(null);
  setSyncError('');setVerified(false);setOfficialResult(null);setShareNote('');
 }
 // Continue an unfinished official round (see QuizGame): answered steps keep verdict and reveal.
 function resumeRound(saved){
  const list=saved.tasks.map((task,i)=>saved.reveals[i]?{...task,...saved.reveals[i]}:task);
  const kept=saved.answers.map(answer=>({correct:answer.correct,points:answer.points,choice:null,timedOut:false}));
  const review=saved.phase==='review'&&kept.length>saved.step;
  answerLocked.current=review;
  setTasks(list);setRunId(i=>i+1);setIndex(saved.step);setAnswer(review?kept[saved.step]:null);setRecords(kept);setFinished(false);
  setMediaReady(game!=='object');setClockReady(false);setServerStartedAt(null);
  setSyncError('');setVerified(review);setOfficialResult(null);setShareNote('');
 }
 async function verifyAnswer(value,taskId,step){
  setVerifying(true);setSyncError('');
  try{
   const response=await daily.progress('answer',step,taskId,value);
   if(response.task)setTasks(previous=>previous.map((item,i)=>i===step?{...item,...response.task}:item));
   setAnswer(prev=>prev?{...prev,correct:response.correct,points:response.points}:prev);
   setRecords(prev=>prev.map((item,i)=>i===step?{...item,correct:response.correct,points:response.points}:item));
   if(response.finished)setOfficialResult({score:response.score,correct:response.correctCount});
   setVerified(true);
  }catch(e){setSyncError(e.message||'تعذر توثيق الإجابة.');}
  finally{setVerifying(false);}
 }
 function submit(value,timedOut=false){
  if(answerLocked.current||!task||finished)return;
  if(!timedOut&&!timer.claim())return;
  answerLocked.current=true;
  // Daily tasks carry no answer until the server reveals it with its verdict.
  const correct=!timedOut&&mode!=='daily'&&correctChoice(game,task,value);
  const lastBreak=records.slice().reverse().findIndex(r=>!r.correct);
  const streak=lastBreak===-1?records.length:lastBreak;
  const points=questionPoints(task,correct,streak);
  const item={correct,points,choice:value,timedOut};
  setAnswer(item);setRecords(previous=>[...previous,item]);
  setVerified(mode!=='daily');
  if(mode==='daily')verifyAnswer(value,task.id,index);
 }
 async function next(){
  if(!answer||verifying||(mode==='daily'&&!verified))return;
  if(index+1<tasks.length){
   if(mode==='daily'){
    setVerifying(true);setSyncError('');
    try{await daily.progress('next',index,task.id,null);}
    catch(e){setSyncError(e.message||'تعذر الانتقال إلى المهمة التالية.');setVerifying(false);return;}
    setVerifying(false);
   }
   answerLocked.current=false;
   setAnswer(null);setVerified(false);setClockReady(false);setServerStartedAt(null);
   setMediaReady(game!=='object');
   setIndex(x=>x+1);
  }else{
   const total=records.reduce((s,r)=>s+r.points,0);
   const correct=records.filter(r=>r.correct).length;
   const previous=getStored(game);
   const updated={plays:previous.plays+1,correct:previous.correct+correct,best:Math.max(previous.best,total)};
   try{localStorage.setItem(storedKey(game),JSON.stringify(updated));}catch{}
   setStats(updated);setFinished(true);
  }
 }
 function reset(){
  setTasks([]);setIndex(0);setRecords([]);setAnswer(null);setFinished(false);
  setClockReady(false);setServerStartedAt(null);setVerified(false);setOfficialResult(null);
  setSyncError('');setShareNote('');answerLocked.current=false;
 }
 async function share(){
  const score=mode==='daily'?officialResult?.score??0:total;
  // A result link: its page and preview image show the score as a challenge (app/share/result).
  const url=location.origin+(resultSharePath({kind:'game',game,score:correctCount,total:tasks.length,daily:mode==='daily'})||'/games/'+game);
  trackFunnel('share_click',game);
  const message='حققت '+score+' نقطة في «'+meta.title+'» ضمن ألعاب 967. هل تتفوق عليّ؟';
  try{
   if(navigator.share)await navigator.share({title:'ألعاب 967',text:message,url});
   else if(navigator.clipboard){await navigator.clipboard.writeText(message+' '+url);setShareNote('تم نسخ رابط المشاركة.');}
   else setShareNote(url);
  }catch(e){if(e?.name!=='AbortError')setShareNote('شارك الرابط: '+url);}
 }
 const total=records.reduce((s,r)=>s+r.points,0);
 const correctCount=mode==='daily'&&officialResult?officialResult.correct:records.filter(r=>r.correct).length;
 return <section className={styles.wrapper} aria-label={meta.title}><div className="container">
  {!tasks.length&&<div className={styles.setup}>
   <span className={styles.kicker}><Target size={17}/> {meta.english} / إعداد الجولة</span>
   <h2>{meta.title}</h2><p>{meta.description} تتكون الجولة من عشر مهام؛ يتوقف الوقت بعد الإجابة حتى تضغط «المهمة التالية».</p>
   <div className={styles.modes} role="group" aria-label="نوع الجولة">
    <button type="button" aria-pressed={mode==='practice'} disabled={starting} onClick={()=>setMode('practice')}>جولة حرة</button>
    <button type="button" aria-pressed={mode==='daily'} disabled={starting} onClick={()=>setMode('daily')}><Flame size={17}/> تحدي اليوم</button>
   </div>
   <TimeControls mode={mode} seconds={seconds} onChange={setSeconds}/>
   <DailyAttemptNotice daily={daily} mode={mode} date={date}/>
   {mode==='daily'&&<p className={styles.dailyNote}>تحدي {date} بتوقيت UTC · محاولة واحدة لكل حساب · 7 ثوانٍ ثابتة لكل مهمة · النتائج موثقة على الخادم.</p>}
   <div className={friendStyles.actionRow}>
    <button type="button" className={styles.primary} disabled={starting||!daily.canStart} onClick={start}>
    <Play size={17}/>{starting?'جارٍ حجز المحاولة…':daily.kind==='resume'?'أكمل جولة اليوم':'ابدأ الجولة'}<ArrowLeft size={17}/>
   </button>
    <FriendInviteAction game={game} seconds={seconds} disabled={starting}/>
   </div>
   <aside className={styles.playerStats}><span><Trophy size={18}/> أفضل نتيجة محلية: {stats.best||0} XP</span>
    <span>الجولات المكتملة: {stats.plays||0}</span><span>النتائج الرسمية فقط تدخل لوحة المتصدرين</span></aside>
  </div>}
  {!!tasks.length&&!finished&&<div ref={arenaRef} className={styles.arena}>
   <header className={styles.arenaHeader}><span>{meta.english} / {mode==='daily'?'DAILY':'FREE'}</span>
    <strong>المهمة {index+1} / {tasks.length}</strong><span className={styles.xp}><Zap size={15}/>{total} XP</span></header>
   <div className={styles.progress} role="progressbar" aria-label="تقدم الجولة" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={index+1}>
    <span style={{width:((index+1)/tasks.length*100)+'%'}}/></div>
   <h2 className={styles.taskTitle} ref={titleRef} tabIndex={-1}>{game==='bigger'?task.question:questionTitles[game]}</h2>
   <div key={task.id} className={styles.taskBody}>
    <ExtraBoard game={game} task={task} locked={revealed} onAnswer={submit}
     remaining={timer.remaining} duration={duration} onReady={setMediaReady}/>
   </div>
   {!mediaReady&&<p className={styles.loading} role="status">جارٍ تجهيز الصورة، لن يبدأ المؤقت قبل ظهورها…</p>}
   <GameTimer remaining={timer.remaining} duration={duration} paused={!active}/>
   {revealed&&<div className={[styles.feedback,answer.correct?styles.good:styles.bad].join(' ')} role="status">
    <strong>{answer.timedOut?<><Clock3 size={18}/> انتهى الوقت!</>:answer.correct?<><CheckCircle2 size={18}/> إجابة صحيحة!</>:<><XCircle size={18}/> إجابة غير صحيحة</>}</strong>
    <p>{game==='bigger'?task.options.map(o=>o.name+' '+o.value.toLocaleString('ar')+' '+task.unit).join(' · '):
     game==='connect'?'تم عرض الوصلات الصحيحة أعلى الصفحة.':
     game==='who'?'الشخصية هي '+task.name+'.':
     game==='yemenword'?'الإجابة هي «'+task.answer+'».':'الشيء هو «'+task.answer+'». '+task.hint}</p>
    {task.source&&<a href={task.source} target="_blank" rel="noopener noreferrer">اقرأ المصدر <ArrowLeft size={14}/></a>}
    {answer.correct&&<span className={styles.bonus}>+{answer.points} XP</span>}
   </div>}
   {(verifying||readyPending)&&<p className={styles.loading} role="status">{readyPending?'جارٍ بدء المؤقت الرسمي…':'جارٍ توثيق الإجابة…'}</p>}
   {syncError&&<p className={styles.syncError} role="alert">{syncError}
    <button type="button" onClick={()=>!answer?markReady():!verified?verifyAnswer(answer.choice,task.id,index):next()}>إعادة المحاولة</button></p>}
   <div className={styles.actions}>
    <button type="button" className={styles.secondary} onClick={()=>{if(mode==='daily'&&!confirm('إنهاء الجولة الرسمية الآن ينهي محاولتك لليوم ولا يمكن إعادتها. هل تريد الخروج؟'))return;reset();}}><ArrowRight size={16}/> إنهاء الجولة</button>
    <button type="button" className={styles.primary} disabled={!answer||verifying||(mode==='daily'&&!verified)} onClick={next}>
     {index===tasks.length-1?'عرض النتيجة':'المهمة التالية'} <ArrowLeft size={16}/>
    </button>
   </div>
  </div>}
  {finished&&<div className={styles.result} role="status">
   <span className={styles.victoryIcon}><Trophy size={47}/></span>
   <span className={styles.kicker}>QUEST COMPLETE / اكتمل التحدي</span>
   <h2>{correctCount===10?'علامة كاملة!':correctCount>=7?'نتيجة مميزة!':'جولة جديدة من المعرفة'}</h2>
   <div className={styles.resultStats}>
    <div><strong>{correctCount} / 10</strong><span>إجابات صحيحة</span></div>
    <div><strong>{mode==='daily'?officialResult?.score??'—':total}</strong><span>{mode==='daily'?'نقاط رسمية من 1,000':'نقاط الجولة'}</span></div>
    <div><strong>{stats.best}</strong><span>أفضل نتيجة محلية</span></div>
   </div>
   <p>{mode==='daily'?'نتيجتك محفوظة وموثقة في لوحة المتصدرين الموحدة.':'تُحفظ نتائج الجولات الحرة في هذا المتصفح فقط.'}</p>
   {mode!=='daily'&&<GameSignupInvite/>}
   <div className={styles.actions}>
    {mode==='daily'&&<Link href="/games/leaderboard" className={styles.primary}>لوحة المتصدرين <Trophy size={17}/></Link>}
    <button type="button" className={styles.primary} onClick={reset}><RotateCcw size={17}/> جولة جديدة</button>
    <button type="button" className={styles.secondary} onClick={share}><Share2 size={17}/> مشاركة</button>
    <Link href="/games" className={styles.secondary}>جميع الألعاب <ArrowRight size={17}/></Link>
   </div>
   {shareNote&&<p className={styles.credit}>{shareNote}</p>}
  </div>}
 </div></section>;
}
