import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {isSameOrigin,readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {officialCorrect,officialPoints,validateOfficialChoice,OFFICIAL_ANSWER_WINDOW_MS} from '@/lib/dailyVerifiedScore';
import {syncPlayerAchievements} from '@/lib/gameAchievementRepository.js';
import {dailyAttemptDateOpen} from '@/lib/dailyAttemptIntegrity';
import {requireEligibleGameProfile} from '@/lib/gamePlayerEligibility';
const respond=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store, private'}});
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request){
 try{
  if(!isSameOrigin(request))throw new RequestValidationError('طلب غير مسموح.',403);
  const db=serverDb();
  if(!db)throw new RequestValidationError('خدمة النتائج غير متاحة.',503);
  const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1];
  if(!token)throw new RequestValidationError('سجّل الدخول أولاً.',401);
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user||!user.email_confirmed_at||user.is_anonymous)throw new RequestValidationError('حساب غير مصرح به.',401);
  if(user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new RequestValidationError('هذا الحساب موقوف عن المشاركة.',403);
  await requireEligibleGameProfile(db,user);
  const body=await readJsonObject(request,1200);
  if(!['answer','next','ready'].includes(body.action)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isInteger(body.step)||body.step<0||body.step>=10)throw new RequestValidationError('بيانات الجولة غير صالحة.');
  // The UTC challenge ends at 00:00 UTC, not 24 hours after a late start.
  // In particular a previous day's unfinished round must not continue to
  // award points in the next day's official competition.
  if(!dailyAttemptDateOpen(body.date))throw new RequestValidationError('انتهى تحدي اليوم السابق عند منتصف الليل UTC. حدّث الصفحة للمشاركة في اليوم الجديد.',409);
  const {data:attempt,error:readError}=await db.from('game_daily_attempts').select('*')
   .eq('user_id',user.id).eq('challenge_date',body.date).maybeSingle();
  if(readError)throw new RequestValidationError('تعذر قراءة المحاولة.',503);
  if(!attempt||!Array.isArray(attempt.question_bank)||attempt.question_bank.length!==10||!Array.isArray(attempt.answers))throw new RequestValidationError('محاولة رسمية غير موجودة.',404);
  if(Date.now()-Date.parse(attempt.started_at)>86400000)throw new RequestValidationError('انتهت صلاحية الجولة القديمة.',409);
  const step=body.step;
  if(body.action==='ready'){
   if(attempt.phase!=='question'||attempt.step_index!==step||attempt.answers.length!==step
    ||attempt.question_bank[step]?.id!==body.questionId)throw new RequestValidationError('السؤال غير جاهز.',409);
   if(attempt.question_started_at)return respond({ok:true,step,startedAt:attempt.question_started_at,serverNow:new Date().toISOString()});
   const now=new Date().toISOString();
   const {data,error}=await db.from('game_daily_attempts')
    .update({question_started_at:now}).eq('id',attempt.id).eq('phase','question')
    .eq('step_index',step).is('question_started_at',null)
    .select('question_started_at').maybeSingle();
   if(error)throw new RequestValidationError('تعذر تفعيل مؤقت السؤال.',503);
   if(!data){
    const {data:current}=await db.from('game_daily_attempts').select('question_started_at')
     .eq('id',attempt.id).maybeSingle();
    if(!current?.question_started_at)throw new RequestValidationError('تعذر تفعيل مؤقت السؤال.',409);
    return respond({ok:true,step,startedAt:current.question_started_at,serverNow:new Date().toISOString()});
   }
   return respond({ok:true,step,startedAt:data.question_started_at,serverNow:new Date().toISOString()});
  }
  if(body.action==='next'){
   // Repeated retries cannot reset a running question timer.
   if(attempt.phase==='question'&&attempt.step_index===step+1)return respond({ok:true,step:step+1});
   if(attempt.phase!=='review'||attempt.step_index!==step||step>=9)throw new RequestValidationError('لا يمكن بدء المهمة التالية الآن.',409);
   const {data,error}=await db.from('game_daily_attempts')
    .update({phase:'question',step_index:step+1,question_started_at:null})
    .eq('id',attempt.id).eq('phase','review').eq('step_index',step)
    .select('step_index').maybeSingle();
   if(error)throw new RequestValidationError('تعذر بدء المهمة التالية.',503);
   if(!data)throw new RequestValidationError('بدأت المهمة التالية بالفعل؛ حدّث الحالة.',409);
   return respond({ok:true,step:step+1});
  }
  if(!validateOfficialChoice(attempt.game_type,body.choice))throw new RequestValidationError('خيار إجابة غير صالح.');
  if(step<attempt.answers.length){
   const saved=attempt.answers[step];
   return respond({ok:true,step,correct:!!saved.correct,points:saved.points||0,task:attempt.question_bank[step]?.reveal??null,finished:attempt.phase==='finished',
    score:attempt.phase==='finished'?attempt.score:null,correctCount:attempt.phase==='finished'?attempt.correct_count:null});
  }
  if(attempt.phase!=='question'||attempt.step_index!==step||attempt.answers.length!==step)throw new RequestValidationError('ترتيب الإجابات غير صالح.',409);
  const task=attempt.question_bank[step];
  if(body.questionId!==task.id)throw new RequestValidationError('تغيرت بيانات التحدي؛ لا يمكن اعتماد الإجابة.',409);
  if(!attempt.question_started_at)throw new RequestValidationError('يجب بدء مؤقت السؤال أولاً.',409);
  const elapsed=Date.now()-Date.parse(attempt.question_started_at);
  const correct=elapsed>=0&&elapsed<=OFFICIAL_ANSWER_WINDOW_MS&&officialCorrect(attempt.game_type,task.key,body.choice);
  const streak=attempt.answers.slice().reverse().findIndex(x=>!x.correct);
  const streakBefore=streak===-1?attempt.answers.length:streak;
  const points=correct?(100+20*(task.difficulty-1)+Math.min(5,streakBefore)*10):0;
  const answers=[...attempt.answers,{correct,points}];
  const finished=step===9;
  const totals=finished?officialPoints(attempt.question_bank,answers):null;
  const update={answers,phase:finished?'finished':'review',...finished?{
   score_raw:totals.scoreRaw,score:totals.score,correct_count:totals.correctCount,finished_at:new Date().toISOString()
  }:{}};
  const {data,error}=await db.from('game_daily_attempts').update(update)
   .eq('id',attempt.id).eq('phase','question').eq('step_index',step)
   .select('id').maybeSingle();
  if(error)throw new RequestValidationError('تعذر توثيق الإجابة.',503);
  if(!data)throw new RequestValidationError('تم إرسال إجابة أخرى. أعد تحميل الحالة.',409);
  // The verified result is already committed. Badge persistence is idempotent;
  // a temporary badge-system failure must never invalidate the completed attempt.
  if(finished){
   try{await syncPlayerAchievements(db,user.id);}
   catch(e){console.error('Achievement awarding deferred until next profile read',e?.name||'unknown');}
  }
  // The answer is committed, so the full task (solution, explanation, source)
  // can now be shown to this player.
  return respond({ok:true,step,correct,points,task:task.reveal??null,finished,score:totals?.score??null,
   correctCount:totals?.correctCount??null});
 }catch(error){
  if(error instanceof RequestValidationError)return respond({error:error.message},error.status);
  console.error('Verified daily answer failure',error?.name||'unknown');
  return respond({error:'تعذر توثيق النتيجة. حاول مجدداً.'},503);
 }
}
