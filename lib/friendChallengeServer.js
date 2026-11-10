import 'server-only';
import {RequestValidationError} from './requestSecurity.js';
import {requireEligibleGameProfile} from './gamePlayerEligibility.js';
import {questionPoints,stableHash} from './gameEngine.js';
import {officialQuizIdsToday} from './dailyOfficialSeed.js';
import {utcDay} from './dailyGame.js';
import {createFriendTasks,FRIEND_GAMES,FRIEND_SECONDS,validFriendId,friendPublicTask,validFriendChoice,friendAnswerCorrect,friendScore,friendGameTitle} from './friendChallenge.js';

const problem=(message,status=400)=>{throw new RequestValidationError(message,status);};
const challengeTable='game_friend_challenges',playerTable='game_friend_players';
export async function friendPlayerAuth(request,db){
 if(!db)problem('خدمة التحديات الخاصة غير متاحة الآن.',503);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1];
 if(!token)problem('سجّل الدخول لتنشئ تحديًا أو تشارك فيه.',401);
 const {data,error}=await db.auth.getUser(token);
 const user=data?.user;
 if(error||!user||user.is_anonymous)problem('سجّل الدخول مجددًا للمتابعة.',401);
 if(!user.email_confirmed_at)problem('أكد بريدك الإلكتروني لتشارك في تحديات الأصدقاء.',403);
 if(user.banned_until&&Date.parse(user.banned_until)>Date.now())problem('هذا الحساب موقوف.',403);
 await requireEligibleGameProfile(db,user);
 return user;
}
export async function createFriendChallenge(db,user,body){
 if(!FRIEND_GAMES.includes(body.game)||!FRIEND_SECONDS.includes(body.seconds))
  problem('اختر لعبة ومدة زمنية صالحتين.');
 // Bound link creation to protect content generation and DB from abuse.
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error:limitError}=await db.from(challengeTable)
  .select('id',{count:'exact',head:true}).eq('created_by',user.id).gte('created_at',since);
 if(limitError)problem('تعذر التحقق من حد إنشاء التحديات.',503);
 if(count>=6)problem('يمكنك إنشاء ستة تحديات خاصة خلال 24 ساعة. جرّب لاحقًا.',429);
 let bank;
 try{
  const excludeIds=body.game==='quiz'?await officialQuizIdsToday(db,utcDay()):[];
  bank=await createFriendTasks(db,body.game,crypto.randomUUID(),{excludeIds});
 }
 catch{problem('تعذر تجهيز الأسئلة لهذا التحدي. حاول لاحقًا.',503);}
 const {data:match,error}=await db.from(challengeTable).insert({
  created_by:user.id,game_type:body.game,seconds:body.seconds,question_bank:bank
 }).select('id').single();
 if(error||!match)problem('تعذر إنشاء التحدي الخاص.',503);
 const {error:joinError}=await db.from(playerTable).insert({
  challenge_id:match.id,user_id:user.id,slot:1
 });
 if(joinError){
  await db.from(challengeTable).delete().eq('id',match.id).eq('created_by',user.id);
  problem('تعذر إنشاء مقعد اللاعب الأول.',503);
 }
 return {id:match.id,url:'/games/friends/'+match.id};
}
export async function loadFriendMatch(db,id){
 if(!validFriendId(id))problem('رابط التحدي غير صالح.',404);
 const {data:match,error}=await db.from(challengeTable)
  .select('id,created_by,game_type,seconds,question_bank,expires_at,created_at').eq('id',id).maybeSingle();
 if(error)problem('تعذر تحميل التحدي.',503);
 if(!match)problem('لم نعثر على هذا التحدي.',404);
 const {data:players,error:playerError}=await db.from(playerTable)
  .select('id,user_id,slot,phase,step_index,question_started_at,answers,score,correct_count,finished_at')
  .eq('challenge_id',id).order('slot',{ascending:true});
 if(playerError)problem('تعذر تحميل مشاركات التحدي.',503);
 return {match,players:players||[]};
}
export function currentFriendPlayer(players,userId){return players.find(p=>p.user_id===userId)||null;}
export function friendMatchExpired(match){return Date.parse(match.expires_at)<=Date.now();}
export async function friendMatchPublic(db,user,match,players){
 const me=currentFriendPlayer(players,user.id);
 if(!me&&players.length>=2)problem('هذا التحدي مكتمل ومخصص للاعبين المشاركين فقط.',403);
 const ids=players.map(p=>p.user_id);
 const labels=new Map();
 if(ids.length){
  const {data}=await db.from('public_profiles').select('user_id,display_name,suspended,deletion_requested_at').in('user_id',ids);
  for(const row of data||[]){
   if(!row.suspended&&!row.deletion_requested_at&&row.display_name?.trim())
    labels.set(row.user_id,row.display_name.trim().slice(0,40));
  }
 }
 const publicPlayers=players.map(p=>({
  slot:p.slot,name:labels.get(p.user_id)||'لاعب 967 · '+stableHash(p.user_id).toString(36).slice(0,5),
  isMe:p.user_id===user.id,phase:p.phase,
  finished:p.phase==='finished',
  score:p.phase==='finished'?p.score:null,
  correctCount:p.phase==='finished'?p.correct_count:null
 }));
 const expired=friendMatchExpired(match);
 const task=me&&me.phase!=='finished'?match.question_bank[me.step_index]:null;
 const review=me?.phase==='review';
 return {
  id:match.id,game:match.game_type,title:friendGameTitle(match.game_type),serverNow:new Date().toISOString(),seconds:match.seconds,
  createdAt:match.created_at,expiresAt:match.expires_at,expired,
  isCreator:user.id===match.created_by,joined:!!me,canJoin:!expired&&!me&&players.length===1&&user.id!==match.created_by,
  players:publicPlayers,
  mine:me?{
   slot:me.slot,phase:me.phase,step:me.step_index,answered:me.answers.length,
   startedAt:me.phase==='question'?me.question_started_at:null,
   // Question text is hidden until the server starts the timed window.
   task:me.phase==='question'&&!me.question_started_at?null:friendPublicTask(match.game,task,{reveal:review}),
   last:review?{
    correct:!!me.answers[me.step_index]?.correct,
    points:me.answers[me.step_index]?.points||0
   }:null,
   score:me.phase==='finished'?me.score:null,correctCount:me.phase==='finished'?me.correct_count:null
  }:null
 };
}
export async function friendMatchAction(db,user,id,body){
 const {match,players}=await loadFriendMatch(db,id);
 let me=currentFriendPlayer(players,user.id);
 if(body.action==='join'){
  if(me)return friendMatchPublic(db,user,match,players);
  if(friendMatchExpired(match))problem('انتهت صلاحية رابط التحدي.',410);
  if(players.length!==1||players.some(p=>p.slot===2)||user.id===match.created_by)
   problem('هذا التحدي مخصص للاعبين اثنين فقط، والمقعد الثاني غير متاح.',409);
  const {error}=await db.from(playerTable).insert({
   challenge_id:match.id,user_id:user.id,slot:2
  });
  if(error?.code==='23505')problem('سبق حجز مقعد التحدي. افتح الصفحة مجددًا.',409);
  if(error)problem('تعذر الانضمام إلى التحدي.',503);
  const updated=await loadFriendMatch(db,id);
  return friendMatchPublic(db,user,updated.match,updated.players);
 }
 if(!me)problem('انضم إلى التحدي أولًا.',403);
 if(friendMatchExpired(match))problem('انتهت مهلة إكمال هذا التحدي.',410);
 if(!['ready','answer','next'].includes(body.action))problem('عملية غير معروفة.');
 if(!Number.isInteger(body.step)||body.step!==me.step_index||body.step<0||body.step>9)
  problem('تغيّر تقدم التحدي. أعد تحميل الحالة.',409);
 const task=match.question_bank[me.step_index];
 if(!task||(body.action!=='ready'&&task.id!==body.questionId))problem('معرف السؤال لا يتطابق مع التحدي.',409);
 if(body.action==='ready'){
  if(me.phase!=='question'||me.answers.length!==me.step_index)
   problem('السؤال غير جاهز للتوقيت.',409);
  if(!me.question_started_at){
   const start=new Date().toISOString();
   const {data,error}=await db.from(playerTable).update({question_started_at:start})
    .eq('id',me.id).eq('phase','question').eq('step_index',me.step_index)
    .is('question_started_at',null).select('question_started_at').maybeSingle();
   if(error)problem('تعذر تشغيل توقيت السؤال.',503);
   if(!data){
    const {data:latest}=await db.from(playerTable).select('question_started_at').eq('id',me.id).maybeSingle();
    if(!latest?.question_started_at)problem('تعذر تشغيل توقيت السؤال.',409);
   }
  }
 }else if(body.action==='next'){
  if(me.phase!=='review'||me.answers.length!==me.step_index+1||me.step_index>=9)
   problem('لا يمكن الانتقال قبل توثيق الإجابة.',409);
  const {data,error}=await db.from(playerTable)
   .update({phase:'question',step_index:me.step_index+1,question_started_at:null})
   .eq('id',me.id).eq('phase','review').eq('step_index',me.step_index)
   .select('id').maybeSingle();
  if(error)problem('تعذر الانتقال للسؤال التالي.',503);
  if(!data)problem('تم الانتقال سابقًا، أعد تحميل الحالة.',409);
 }else{
  if(me.phase!=='question'||me.answers.length!==me.step_index||!me.question_started_at)
   problem('شغّل توقيت السؤال قبل تقديم الإجابة.',409);
  if(!validFriendChoice(match.game,body.choice))problem('صيغة الإجابة غير صالحة.');
  const elapsed=Date.now()-Date.parse(me.question_started_at);
  const correct=elapsed>=0&&elapsed<=match.seconds*1000+1200&&
   friendAnswerCorrect(match.game,task,body.choice);
  const lastWrong=me.answers.slice().reverse().findIndex(a=>!a.correct);
  const streak=lastWrong===-1?me.answers.length:lastWrong;
  const points=correct?questionPoints(task,true,streak):0;
  const answers=[...me.answers,{correct,points}];
  const finished=me.step_index===9;
  const totals=finished?friendScore(match.question_bank,answers):null;
  const {data,error}=await db.from(playerTable).update({
   answers,phase:finished?'finished':'review',
   ...(finished?{score:totals.score,correct_count:totals.correctCount,finished_at:new Date().toISOString()}:{})
  }).eq('id',me.id).eq('phase','question').eq('step_index',me.step_index)
   .eq('question_started_at',me.question_started_at).select('id').maybeSingle();
  if(error)problem('تعذر توثيق الإجابة.',503);
  if(!data)problem('تم اعتماد إجابة أخرى للسؤال. حدّث الحالة.',409);
 }
 const updated=await loadFriendMatch(db,id);
 return friendMatchPublic(db,user,updated.match,updated.players);
}
