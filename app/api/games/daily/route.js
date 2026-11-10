import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {isSameOrigin,readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {utcDay,dailyGameForDate,nextUtcMidnight} from '@/lib/dailyGame';
import {officialQuestionSnapshot} from '@/lib/dailyVerifiedScore';
import {officialDailySeed} from '@/lib/dailyOfficialSeed';
import {friendPublicTask} from '@/lib/friendChallenge';
import {requireEligibleGameProfile} from '@/lib/gamePlayerEligibility';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store, private','Pragma':'no-cache'}});

async function verifiedPlayer(request,db){
 if(!isSameOrigin(request))throw new RequestValidationError('طلب غير مسموح.',403);
 if(!db)throw new RequestValidationError('نظام التحديات الرسمية غير متاح حالياً.',503);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1];
 if(!token)throw new RequestValidationError('سجّل الدخول للمشاركة في تحدي اليوم.',401);
 let result;
 try{result=await db.auth.getUser(token);}catch{throw new RequestValidationError('تعذر التحقق من الحساب.',503);}
 if(result.error||!result.data?.user)throw new RequestValidationError('سجّل الدخول مجدداً للمشاركة.',401);
 const user=result.data.user;
 if(!user.email_confirmed_at||user.is_anonymous)throw new RequestValidationError('أكد البريد الإلكتروني قبل المشاركة في تحدي اليوم.',403);
 if(user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new RequestValidationError('هذا الحساب موقوف.',403);
 await requireEligibleGameProfile(db,user);
 return user;
}
async function handle(request,claim){
 try{
  const db=serverDb();
  const user=await verifiedPlayer(request,db);
  // The client never decides the date or challenge; the server uses UTC only.
  const date=utcDay();
  const game=dailyGameForDate(date);
  const nextAt=nextUtcMidnight(date);
  if(claim){
   const body=await readJsonObject(request,2500);
   if(body.date!==date||body.game!==game)throw new RequestValidationError('بدأ تحدي يوم جديد. حدّث الصفحة لتجربة تحدي اليوم الصحيح.',409);
   // The server alone draws the round (with a secret seed) and returns it
   // without answers; each solution is revealed only after its answer is saved.
   const questionBank=await officialQuestionSnapshot(db,game,date,{dailyKey:officialDailySeed(date)});
   const tasks=questionBank.map(entry=>friendPublicTask(game,entry.reveal));
   const {data,error}=await db.from('game_daily_attempts')
    .insert({user_id:user.id,challenge_date:date,game_type:game,question_bank:questionBank,phase:'question',step_index:0,question_started_at:null})
    .select('challenge_date,game_type,started_at').single();
   if(error?.code==='23505')return respond({error:'استخدمت محاولتك اليوم. يعود التحدي غداً عند 00:00 UTC.',used:true,date,game,nextAt},409);
   if(error){console.error('Daily game claim failure',error.code||'unknown');throw new RequestValidationError('تعذر حجز المحاولة بأمان. لم يبدأ التحدي.',503);}
   return respond({used:true,claimed:true,date,game,nextAt,startedAt:data.started_at,tasks});
  }
  const {data,error}=await db.from('game_daily_attempts')
   .select('challenge_date,game_type,started_at,phase,step_index,answers,question_bank,question_started_at').eq('user_id',user.id).eq('challenge_date',date).maybeSingle();
  if(error)throw new RequestValidationError('تعذر التأكد من محاولتك اليومية. حاول مجدداً.',503);
  // An official round left unfinished (refresh, closed tab, lost connection) can be resumed where
  // it stopped. The tasks come without answers, as on the first claim; answered steps carry the
  // reveal the player already saw. The running question keeps its server start time.
  const resume=data&&data.phase!=='finished'&&Array.isArray(data.question_bank)&&data.question_bank.length===10&&Array.isArray(data.answers)?{
   tasks:data.question_bank.map(entry=>friendPublicTask(data.game_type,entry.reveal)),
   reveals:data.answers.map((_,index)=>data.question_bank[index]?.reveal??null),
   answers:data.answers.map(answer=>({correct:!!answer.correct,points:answer.points||0})),
   step:data.step_index,phase:data.phase,questionStartedAt:data.question_started_at||null,
  }:null;
  return respond({used:!!data,resume,date,game,nextAt,startedAt:data?.started_at||null});
 }catch(error){
  if(error instanceof RequestValidationError)return respond({error:error.message},error.status);
  console.error('Daily game error',error?.name||'unexpected');
  return respond({error:'تعذر التحقق من حالة التحدي. حاول مجدداً.'},503);
 }
}
export const GET=request=>handle(request,false);
export const POST=request=>handle(request,true);
