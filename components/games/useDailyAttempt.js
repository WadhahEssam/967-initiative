'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {browserMayBeSignedIn,currentSession,whenBrowserDb} from '@/lib/browserSession';
import {dailyGameUrl} from '@/lib/dailyGame';
import {createAccountWatch,shouldReloadOnAuth} from '@/lib/authEvents';
import styles from './DailyAttempt.module.css';
import DailyCountdown from './DailyCountdown';

// The official daily attempt is owned by the server/Postgres, never localStorage.
// Practice rounds remain fully available without signing in.
export default function useDailyAttempt(mode,game,date){
 const [state,setState]=useState({kind:'loading',message:''});
 const pending=useRef(false);
 useEffect(()=>{
  if(mode!=='daily'){setState({kind:'free',message:''});return;}
  let alive=true,authTimer=null;
  const account=createAccountWatch();
  // A visitor who never signed in sees the sign-in notice without loading the account client;
  // signing in (here or in another tab) starts it.
  if(!browserMayBeSignedIn())setState({kind:'login',message:''});
  const stop=whenBrowserDb(db=>{
  const read=async()=>{
   if(alive)setState({kind:'loading',message:''});
   try{
    const {data,error}=await db.auth.getSession();
    account.seen(error?null:data?.session);
    if(error||!data?.session){if(alive)setState({kind:'login',message:''});return;}
    const res=await fetch('/api/games/daily',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
    const json=await res.json();
    if(!alive)return;
    if(res.status===401){setState({kind:'login',message:json.error||''});return;}
    if(!res.ok){setState({kind:'error',message:json.error||'تعذر معرفة حالة المحاولة.'});return;}
    if(json.date!==date){setState({kind:'outdated',message:'بدأ يوم جديد؛ حدّث الصفحة.'});return;}
    if(json.game!==game){setState({kind:'other',date:json.date,game:json.game,message:'تحدي اليوم في لعبة أخرى.'});return;}
    setState({kind:json.used?'used':'ready',nextAt:json.nextAt,message:''});
   }catch{if(alive)setState({kind:'error',message:'تعذر التحقق من المحاولة. حاول بعد التحقق من اتصالك.'});}
  };
  read();
  // Never call Supabase auth methods synchronously inside onAuthStateChange:
  // that event can hold an auth lock; defer follow-up reads to the next tick.
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   if(!shouldReloadOnAuth(account,event,session))return;
   clearTimeout(authTimer);
   authTimer=setTimeout(()=>{if(alive&&!pending.current)read();},0);
  });
  return()=>subscription.unsubscribe();
  });
  return()=>{alive=false;clearTimeout(authTimer);stop();};
 },[mode,game,date]);
 // Claims today's single attempt. The server draws the round and returns its
 // tasks without answers; resolves to that array, or null when not granted.
 async function reserve(){
  if(mode!=='daily'||pending.current||state.kind!=='ready')return null;
  pending.current=true;setState(previous=>({...previous,kind:'reserving'}));
  try{
   const session=await currentSession();
   if(!session){setState({kind:'login',message:''});return null;}
   const data={session};
   const res=await fetch('/api/games/daily',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
    cache:'no-store',body:JSON.stringify({date,game})});
   const json=await res.json();
   if(res.ok&&json.claimed&&Array.isArray(json.tasks)&&json.tasks.length===10){setState({kind:'used',nextAt:json.nextAt,message:''});return json.tasks;}
   if(res.ok&&json.claimed){setState({kind:'error',message:'استُخدمت المحاولة لكن تعذر تحميل أسئلتها. أعد تحميل الصفحة.'});return null;}
   if(json.used){setState({kind:'used',nextAt:json.nextAt,message:json.error});return null;}
   if(res.status===409){setState({kind:'outdated',message:json.error||'بدأ تحدي يوم جديد. حدّث الصفحة.'});return null;}
   setState({kind:res.status===401?'login':'error',message:json.error||'تعذر بدء التحدي.'});
   return null;
  }catch{setState({kind:'error',message:'فشل الاتصال بالخادم؛ لم تتأكد المحاولة. أعد تحميل الصفحة.'});return null;}
  finally{pending.current=false;}
 }
 async function progress(action,step,questionId,choice){
  const session=await currentSession();
  if(!session)throw Error('انتهت الجلسة. سجّل الدخول مجدداً.');
  const data={session};
  const response=await fetch('/api/games/daily/round',{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},
   body:JSON.stringify({action,step,questionId,choice,date})});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'تعذر اعتماد الإجابة.');
  return result;
 }
 return {...state,reserve,progress,canStart:mode!=='daily'||state.kind==='ready'};
}
export function DailyAttemptNotice({daily,mode,date}){
 if(mode!=='daily')return null;
 // Keep the deadline visible even for players who already spent today's attempt.
 const countdown=<DailyCountdown initialDate={date} variant="compact"/>;
 if(daily.kind==='ready')return <>{countdown}<p className={styles.info}>محاولة واحدة فقط اليوم على مستوى حسابك في ألعاب 967. بمجرد الضغط على «ابدأ»، تُستهلك المحاولة حتى لو أغلقت الصفحة. يظهر اسم العرض في لوحة المتصدرين عند اكتمال الجولة.</p></>;
 if(daily.kind==='login')return <>{countdown}<div className={styles.notice} role="status"><strong>سجّل الدخول للمشاركة في تحدي اليوم.</strong><p>يمكنك لعب الجولات الحرة دون حساب. التحدي الرسمي محاولة واحدة لكل حساب يومياً.</p><Link href="/login">تسجيل الدخول</Link></div></>;
 if(daily.kind==='other')return <>{countdown}<div className={styles.notice} role="status"><strong>تحدي اليوم في لعبة أخرى.</strong><p>هناك لعبة رسمية واحدة تتغير يومياً وتكون مشتركة بين جميع المشاركين.</p><Link href={dailyGameUrl(daily.date)}>انتقل إلى تحدي اليوم</Link></div></>;
 if(daily.kind==='used')return <>{countdown}<div className={styles.used} role="status"><strong>استخدمت محاولتك اليومية بالفعل.</strong><p>{daily.message||'يمكنك العودة لتحدي اليوم التالي. الجولات الحرة ما زالت متاحة.'}</p><small>تُفتح محاولة جديدة عند الساعة 00:00 بتوقيت UTC.</small></div></>;
 if(daily.kind==='outdated')return <>{countdown}<div className={styles.notice} role="status"><strong>تغيّر تحدي اليوم.</strong><p>{daily.message}</p><button type="button" onClick={()=>location.reload()}>تحديث الصفحة</button></div></>;
 if(daily.kind==='error')return <>{countdown}<div className={styles.notice} role="alert"><strong>تعذر تفعيل تحدي اليوم.</strong><p>{daily.message}</p><button type="button" onClick={()=>location.reload()}>إعادة المحاولة</button></div></>;
 return <>{countdown}<p role="status" className={styles.loading}>جارٍ التحقق من محاولتك اليومية…</p></>;
}
