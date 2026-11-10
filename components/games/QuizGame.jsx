'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import GameSignupInvite from './GameSignupInvite';
import {useFunnelStep} from '@/components/analytics/funnel';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,BookOpen,CheckCircle2,Flame,Medal,RotateCcw,Share2,Target,Trophy,Zap,XCircle} from 'lucide-react';
import {buildQuizRound,scoreRound,gameLevels,quizCategories,difficultyLabels} from '@/lib/gameEngine';
import styles from './QuizGame.module.css';
import {roundDuration} from '@/lib/gameClock';
import useQuestionTimer from './useQuestionTimer';
import {TimeControls,GameTimer} from './TimeControls';
import useDailyAttempt,{DailyAttemptNotice} from './useDailyAttempt';
import {readPracticeSeen,rememberPracticeTasks} from '@/lib/practiceRotation';
import FriendInviteAction from './FriendInviteAction';
import friendStyles from './FriendInviteAction.module.css';

const STORAGE_KEY='967-games-progress-v1';
const emptyStats={plays:0,correct:0,points:0,best:0,dailyDate:'',dailyBest:0};
function readStats(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!x||typeof x!=='object')return emptyStats;
  return Object.fromEntries(Object.keys(emptyStats).map(key=>[key,typeof x[key]===typeof emptyStats[key]?x[key]:emptyStats[key]]));
 }catch{return emptyStats;}
}
export default function QuizGame({questions,date,initialMode='practice'}){
 const [mode,setMode]=useState(initialMode);
 const [seconds,setSeconds]=useState(15),[runId,setRunId]=useState(0);
 const [starting,setStarting]=useState(false);
 const [verifying,setVerifying]=useState(false),[verified,setVerified]=useState(false);
 const [clockReady,setClockReady]=useState(false),[readyPending,setReadyPending]=useState(false);
 const [serverStartedAt,setServerStartedAt]=useState(null),[officialVerdict,setOfficialVerdict]=useState(null);
 const [syncError,setSyncError]=useState(''),[officialResult,setOfficialResult]=useState(null);
 const [officialRaw,setOfficialRaw]=useState(0);
 const daily=useDailyAttempt(mode,'quiz',date);
 const [category,setCategory]=useState('all'),[difficulty,setDifficulty]=useState('all');
 const [round,setRound]=useState([]),[step,setStep]=useState(0),[picked,setPicked]=useState(null),[answers,setAnswers]=useState([]),[result,setResult]=useState(null);
 const [stats,setStats]=useState(emptyStats),[shareNote,setShareNote]=useState('');
 const questionTitleRef=useRef(null),playRef=useRef(null);
 useEffect(()=>{setStats(readStats());},[]);
 const filtered=questions.filter(q=>(category==='all'||q.category===category)&&(difficulty==='all'||q.difficulty===Number(difficulty)));
 const canStart=(mode==='daily'?questions.length>=1:filtered.length>=1)&&daily.canStart;
 const current=round[step];
 // Daily answers are only known after the server has committed the choice.
 const revealed=picked!==null&&(mode!=='daily'||verified);
 const duration=roundDuration(mode,seconds);
 // Conversion counters: a round started and a round finished (once per run).
 useFunnelStep('game_start',round.length>0,'quiz:'+mode+':'+runId);
 useFunnelStep('game_done',Boolean(result),'quiz:'+mode+':'+runId);
 const timer=useQuestionTimer({seconds:duration,token:runId+':'+step,startTime:mode==='daily'?serverStartedAt:null,active:round.length>0&&!result&&picked===null&&!verifying&&(mode!=='daily'||clockReady),onExpire:()=>choose(-1,true)});
 // Align the timer AND question before the first paint after each transition.
 // The global page may use smooth scrolling; never animate while the clock runs.
 useLayoutEffect(()=>{
  if(!round.length||result||!playRef.current)return;
  const play=playRef.current;
  const root=document.documentElement;
  const previous=root.style.scrollBehavior;
  root.style.scrollBehavior='auto';
  try{play.scrollIntoView({block:'start',behavior:'instant'});}
  catch{play.scrollIntoView({block:'start',behavior:'auto'});}
  root.style.scrollBehavior=previous;
  questionTitleRef.current?.focus({preventScroll:true});
 },[runId,step,round.length,result]);
 useEffect(()=>{
  if(mode==='daily'&&round.length&&picked===null&&!result&&!clockReady&&!readyPending&&!syncError)markReady();
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on round state; re-running on markReady identity would restart the official timer
 },[mode,round.length,step,picked,result,clockReady,readyPending,syncError]);
 async function markReady(){
  if(!round[step])return;
  setReadyPending(true);setSyncError('');
  try{const status=await daily.progress('ready',step,round[step].id,null);setServerStartedAt(status.startedAt);setClockReady(true);}
  catch(error){setSyncError(error.message||'تعذر بدء مؤقت السؤال.');}
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
  }else{
   list=buildQuizRound(questions,{mode,category,difficulty,seed:'practice-'+Date.now()+'-'+Math.random(),seen:readPracticeSeen('quiz')});
   if(!list.length)return;
   rememberPracticeTasks('quiz',list.map(task=>task.id));
  }
  setRunId(id=>id+1);setRound(list);setStep(0);setPicked(null);setAnswers([]);setResult(null);setShareNote('');setVerified(false);setSyncError('');setOfficialResult(null);setOfficialRaw(0);setClockReady(false);setServerStartedAt(null);setOfficialVerdict(null);
 }
 async function verifyAnswer(index,questionId,atStep){
  setVerifying(true);setSyncError('');
  try{
   const response=await daily.progress('answer',atStep,questionId,index===-1?null:index);
   if(response.task)setRound(previous=>previous.map((q,i)=>i===atStep?{...q,...response.task}:q));
   setOfficialRaw(previous=>previous+response.points);
   setOfficialVerdict(response.correct);
   if(response.finished)setOfficialResult({score:response.score,correct:response.correctCount});
   setVerified(true);
  }catch(error){setSyncError(error.message||'تعذر اعتماد الإجابة.');}
  finally{setVerifying(false);}
 }
 function choose(index,timedOut=false){
  if(picked!==null||verifying||!current||(!timedOut&&!timer.claim()))return;
  setPicked(index);setAnswers(previous=>[...previous,index]);setOfficialVerdict(null);
  setVerified(mode!=='daily');
  if(mode==='daily')verifyAnswer(index,current.id,step);
 }
 async function next(){
  if(picked===null||verifying||(mode==='daily'&&!verified))return;
  if(step+1<round.length){
   if(mode==='daily'){
    setVerifying(true);setSyncError('');
    try{await daily.progress('next',step,current.id,null);}
    catch(error){setSyncError(error.message||'تعذر بدء السؤال التالي.');setVerifying(false);return;}
    setVerifying(false);setVerified(false);setClockReady(false);setServerStartedAt(null);setOfficialVerdict(null);
   }
   setStep(v=>v+1);setPicked(null);return;
  }
  const summary=scoreRound(round,answers);
  setResult(summary);
  const before=readStats();
  const after={
   plays:before.plays+1,correct:before.correct+summary.correct,points:before.points+summary.total,
   best:Math.max(before.best,summary.total),dailyDate:mode==='daily'?date:before.dailyDate,
   dailyBest:mode==='daily'?Math.max(before.dailyDate===date?before.dailyBest:0,summary.total):before.dailyBest,
  };
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(after));}catch{/* Browser storage is optional. */}
  setStats(after);
 }
 function switchMode(nextMode){setMode(nextMode);setRound([]);setResult(null);setPicked(null);setAnswers([]);setShareNote('');setSyncError('');setVerified(false);setOfficialResult(null);setOfficialRaw(0);setClockReady(false);setServerStartedAt(null);setOfficialVerdict(null);}
 async function share(){
  const title='تحدي ألعاب 967';
  const shareText='حققت '+result.correct+' من '+round.length+' في اختبار معرفتي باليمن! هل تتفوق على نتيجتي؟';
  const url=location.origin+'/games/quiz'+(mode==='daily'?'?mode=daily':'');
  try{
   if(navigator.share){await navigator.share({title,text:shareText,url});setShareNote('تم فتح خيارات المشاركة.');}
   else if(navigator.clipboard){await navigator.clipboard.writeText(shareText+' '+url);setShareNote('نُسخ رابط التحدي ونتيجتك.');}
   else setShareNote('شارك هذا الرابط: '+url);
  }catch(error){if(error?.name!=='AbortError')setShareNote('انسخ الرابط يدوياً: '+url);}
 }
 const answerNumber=(mode==='daily'&&officialResult?officialResult.correct:(result?.correct||0));
 return <section className={styles.wrapper} aria-label="لعبة اختبر معرفتك باليمن">
  <div className="container">
   {!round.length&&<div className={styles.setup}>
    <div className={styles.setupMain}>
     <span className={styles.kicker}><Target size={16}/> SELECT MODE / اختر طور اللعب</span>
     <h2>جاهز للتحدي؟</h2>
     <p>اختر نوع الجولة والوقت المتاح لكل سؤال. ينتهي الوقت عند الإجابة ويبدأ من جديد عند الانتقال إلى السؤال التالي.</p>
     <div className={styles.modes} role="group" aria-label="نوع التحدي">
      <button type="button" aria-pressed={mode==='practice'} className={mode==='practice'?styles.active:''} onClick={()=>switchMode('practice')} disabled={starting}><BookOpen size={17}/> جولة حرة</button>
      <button type="button" aria-pressed={mode==='daily'} className={mode==='daily'?styles.active:''} onClick={()=>switchMode('daily')} disabled={starting}><Flame size={17}/> تحدي اليوم</button>
     </div>
     {mode==='practice'?<div className={styles.filters}>
      <label>المجال<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">جميع المجالات</option>{Object.entries(quizCategories).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
      <label>الصعوبة<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="all">جميع المستويات</option>{Object.entries(difficultyLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
     </div>:<p className={styles.dailyNote}>تحدي {date} (UTC): الأسئلة وترتيبها ثابتة، والوقت 7 ثوانٍ لكل سؤال غير قابلة للتغيير.</p>}
     <TimeControls mode={mode} seconds={seconds} onChange={setSeconds}/>
     <DailyAttemptNotice daily={daily} mode={mode} date={date}/>
     <div className={friendStyles.actionRow}>
    <button type="button" className={styles.primary} onClick={start} disabled={!canStart||starting}>{starting?'جارٍ حجز المحاولة…':canStart?'ابدأ الجولة':mode==='daily'?'تحدي اليوم غير متاح لبدء محاولة جديدة':'لا توجد أسئلة منشورة لهذا الاختيار'} <ArrowLeft size={18}/></button>
    <FriendInviteAction game="quiz" seconds={seconds} disabled={starting}/>
   </div>
     <p className={styles.privacy}>الجولة الحرة بلا تسجيل؛ يتطلب تحدي اليوم حساباً موثقاً ومحاولة واحدة فقط. نتائج الجولات الحرة محلية، أما تحدي اليوم فيُوثّق على الخادم ويظهر في لوحة المتصدرين.</p>
    </div>
    <aside className={styles.profile}>
     <span className={styles.profileIcon}><Medal size={37}/></span>
     <span className={styles.profileEyebrow}>PLAYER PROFILE / ملف اللاعب</span>
     <h3>{gameLevels(stats.correct)}</h3>
     <div className={styles.stats}><div><strong>{stats.plays}</strong><span>جولة مكتملة</span></div><div><strong>{stats.correct}</strong><span>إجابة صحيحة</span></div><div><strong>{stats.best}</strong><span>أفضل نقاط</span></div></div>
     <p>تظهر الإحصاءات على هذا المتصفح فقط، ولا تتم مزامنتها مع حسابك.</p>
     {stats.dailyDate===date&&<span className={styles.dailyBest}>أفضل نتيجة محلية لهذا اليوم (غير موثقة): {stats.dailyBest} نقطة</span>}
    </aside>
   </div>}
   {!!round.length&&!result&&<div className={styles.play} ref={playRef}>
    <div className={styles.playHeader}><span>{mode==='daily'?'تحدي اليوم':'اختبر معرفتك'}</span><strong>السؤال {step+1} من {round.length}</strong><span className={styles.playScore}><Zap size={15} fill="currentColor" aria-hidden="true"/>{mode==='daily'?officialRaw:scoreRound(round.slice(0,step),answers.slice(0,step)).total} XP</span></div>
    <div className={styles.progress} role="progressbar" aria-label="التقدم في الأسئلة" aria-valuemin={0} aria-valuemax={round.length} aria-valuenow={step+1}><span style={{width:((step+1)/round.length*100)+'%'}}/></div>
    <GameTimer remaining={timer.remaining} duration={duration} paused={picked!==null}/>
    <div className={styles.questionStage} key={current.id}>
    <div className={styles.questionMeta}><span>{quizCategories[current.category]}</span><span>المستوى: {difficultyLabels[current.difficulty]}</span></div>
    <h2 ref={questionTitleRef} tabIndex={-1}>{current.question}</h2>
    <div className={styles.options} role="group" aria-label="خيارات الإجابة">
     {current.options.map((option,index)=>{
      const selected=picked===index,right=revealed&&current.correct===index,wrong=selected&&revealed&&picked!==current.correct;
      return <button type="button" key={index} disabled={picked!==null||verifying} aria-pressed={selected} className={[styles.option,right?styles.right:'',wrong?styles.wrong:''].join(' ')} onClick={()=>choose(index)}>
       <span className={styles.optionLetter}>{['أ','ب','ج','د'][index]}</span><span>{option}</span>{right&&<CheckCircle2 size={20}/>} {wrong&&<XCircle size={20}/>}
      </button>;
     })}
    </div>
    {revealed&&<div className={styles.explanation} role="status">
     <strong>{picked===-1?'انتهى الوقت!':picked===current.correct?'إجابة صحيحة!':'إجابة غير صحيحة'}{picked===current.correct?' أحسنت.':''}</strong>
     {picked!==current.correct&&<p>الإجابة الصحيحة: <b>{current.options[current.correct]}</b></p>}
     {mode==='daily'&&verified&&picked===current.correct&&officialVerdict===false&&<p role="alert">إجابتك صحيحة، لكنها وصلت بعد انتهاء المهلة الرسمية، فلم تُحتسب في الترتيب.</p>}
     <p>{current.explanation}</p>
     <a href={current.source.url} target="_blank" rel="noopener noreferrer">المصدر: {current.source.title} <ArrowLeft size={14}/></a>
    </div>}
    </div>
    {(verifying||readyPending)&&<p className={styles.syncError} role="status">{readyPending?'جارٍ تشغيل المؤقت الرسمي…':'جارٍ توثيق الإجابة…'}</p>}
    {syncError&&<p className={styles.syncError} role="alert">{syncError} <button type="button" onClick={()=>picked===null?markReady():!verified?verifyAnswer(picked,current.id,step):next()}>إعادة المحاولة</button></p>}
    <div className={styles.playActions}><button type="button" className={styles.secondary} onClick={()=>{setRound([]);setPicked(null);setAnswers([]);}}><ArrowRight size={16}/> إنهاء الجولة</button><button type="button" className={styles.primary} onClick={next} disabled={picked===null||verifying||(mode==='daily'&&!verified)}>{step===round.length-1?'عرض النتيجة':'السؤال التالي'} <ArrowLeft size={18}/></button></div>
   </div>}
   {result&&<div className={styles.finish} role="status">
    <div className={styles.finishSparks} aria-hidden="true"><span>✦</span><span>◆</span><span>✦</span></div>
    <span className={styles.finishIcon}><Trophy size={44}/></span>
    <span className={styles.kicker}>QUEST COMPLETE / اكتملت الجولة</span>
    <h2>{result.correct===round.length?'أحسنت! جميع الإجابات صحيحة.':result.correct>=round.length/2?'جولة جيدة! واصل الاستكشاف.':'كل جولة فرصة لتعرف اليمن أكثر.'}</h2>
    <div className={styles.resultGrid}><div><strong>{answerNumber} / {round.length}</strong><span>إجابات صحيحة</span></div><div><strong>{mode==='daily'?officialResult?.score??'—':result.total}</strong><span>{mode==='daily'?'النقاط الرسمية / 1000':'نقاط هذه الجولة'}</span></div><div><strong>{stats.best}</strong><span>أفضل نتيجة على الجهاز</span></div></div>
    <p>{mode==='daily'?'تم حفظ نتيجتك الرسمية في Supabase. يمكنك مشاهدة ترتيبك في المنافسة الموحدة.':'يمكنك العودة للأسئلة أو بدء جولة أخرى. النتيجة محفوظة في متصفحك.'}</p>
   {mode!=='daily'&&<GameSignupInvite/>}
    {mode==='daily'&&<Link href="/games/leaderboard" className={styles.primary}>شاهد لوحة المتصدرين <Trophy size={17}/></Link>}
    <div className={styles.finishActions}><button type="button" className={styles.primary} onClick={()=>{setRound([]);setResult(null);setPicked(null);setAnswers([]);}}>ابدأ جولة أخرى <RotateCcw size={18}/></button><button type="button" className={styles.secondary} onClick={share}>شارك التحدي <Share2 size={17}/></button><Link href="/games" className={styles.secondary}>جميع الألعاب <ArrowRight size={17}/></Link></div>
    {shareNote&&<p className={styles.shareNote} role="status">{shareNote}</p>}
   </div>}
  </div>
 </section>;
}
