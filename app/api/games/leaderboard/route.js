import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {utcDay} from '@/lib/dailyGame';
import {stableHash} from '@/lib/gameEngine';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export const dynamic='force-dynamic';
export const runtime='nodejs';
const periods=new Set(['daily','weekly','monthly','all']);
function periodStart(period,today){
 const d=new Date(today+'T00:00:00Z');
 if(period==='weekly')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 if(period==='monthly')d.setUTCDate(1);
 return d.toISOString().slice(0,10);
}
function awards(rows){
 const dates=[...new Set(rows.map(x=>x.date))].sort().reverse();
 let streak=0;
 for(let i=0;i<dates.length;i++){
  if(i&&Math.round((Date.parse(dates[i-1])-Date.parse(dates[i]))/86400000)!==1)break;
  streak++;
 }
 const perfect=rows.some(x=>x.correct===10);
 const count=rows.length;
 const mapRounds=rows.filter(x=>x.type==='map').length;
 return {played:count,streak,perfect,
  badges:[...(perfect?['علامة كاملة']:[]),...(streak>=7?['7 أيام متتالية']:[]),...(mapRounds>=20?['مستكشف اليمن']:[]),...(count>=30?['30 تحديًا']:[]),...(count>=100?['المخضرم · 100 تحدٍ']:[])]};
}

// The ranking is the same for everyone, so it is computed at most every 45 s per period (and
// shared by requests arriving together) instead of reading every finished attempt on each visit.
// Only the viewer's own place is looked up per request.
const RANK_TTL_MS=45000;
const ranked=new Map(),computing=new Map();
async function rankedPeriod(db,period,today){
 const key=period+'|'+today,cached=ranked.get(key);
 if(cached&&Date.now()-cached.at<RANK_TTL_MS)return cached.value;
 if(!computing.has(key))computing.set(key,computeRanking(db,period,today).then(value=>{
  ranked.set(key,{at:Date.now(),value});
  for(const old of ranked.keys())if(!old.endsWith('|'+today))ranked.delete(old);
  return value;
 }).finally(()=>computing.delete(key)));
 return computing.get(key);
}
async function computeRanking(db,period,today){
 const start=periodStart(period,today);
 const rows=[];
 for(let page=0;page<100;page++){
  let query=db.from('game_daily_attempts').select('user_id,challenge_date,game_type,score,correct_count,finished_at')
   .eq('phase','finished').order('challenge_date',{ascending:false}).range(page*1000,(page+1)*1000-1);
  if(period!=='all')query=query.gte('challenge_date',start);
  if(period==='daily')query=query.eq('challenge_date',today);
  const {data,error}=await query;
  if(error)throw Error('Leaderboard query failed');
  rows.push(...data);
  if(data.length<1000)break;
  if(page===99)throw Error('Leaderboard pagination limit reached');
 }
 const groups=new Map();
 for(const entry of rows){
  const key=entry.user_id;
  const p=groups.get(key)||{id:key,score:0,correct:0,played:0,latest:entry.finished_at,rows:[]};
  p.score+=entry.score;p.correct+=entry.correct_count;p.played++;
  p.rows.push({date:entry.challenge_date,correct:entry.correct_count,type:entry.game_type});
  groups.set(key,p);
 }
 const ids=[...groups.keys()];
 const profiles=new Map();
 for(let i=0;i<ids.length;i+=200){
  const {data,error}=await db.from('public_profiles').select('user_id,display_name,suspended,deletion_requested_at')
   .in('user_id',ids.slice(i,i+200));
  if(error)throw Error('Leaderboard profiles failed');
  data.forEach(p=>profiles.set(p.user_id,p));
 }
 const entries=[...groups.values()].filter(p=>{
  const profile=profiles.get(p.id);
  return !profile||(!profile.suspended&&!profile.deletion_requested_at);
 }).sort((a,b)=>b.score-a.score||b.correct-a.correct||a.latest.localeCompare(b.latest));
 let rank=0,previous=null;
 const ordered=entries.map((e,index)=>{
  if(e.score!==previous){rank=index+1;previous=e.score;}
  const profile=profiles.get(e.id);
  const name=(profile?.display_name||'').trim().slice(0,40)||('لاعب 967 · '+stableHash(e.id).toString(36).slice(0,5));
  const badges=awards(e.rows);
  if(rank===1&&period==='daily')badges.badges.unshift('ملك اليوم');
  if(rank===1&&period==='weekly')badges.badges.unshift('بطل الأسبوع');
  return {...e,rank,name,awards:badges};
 });
 return {ordered,participants:entries.length,completed:rows.length};
}

export async function GET(request){
 try{
  const period=new URL(request.url).searchParams.get('period')||'daily';
  if(!periods.has(period))return json({error:'فترة غير معروفة.'},400);
  const db=serverDb();
  if(!db)return json({error:'خدمة الترتيب غير متاحة.'},503);
  const today=utcDay();
  const {ordered,participants,completed}=await rankedPeriod(db,period,today);
  let viewer=null,signedIn=false;
  const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1];
  if(token){
   const {data}=await db.auth.getUser(token);
   if(data?.user){signedIn=true;viewer=ordered.find(x=>x.id===data.user.id)||null;}
  }
  // A member link is exposed only to an authenticated viewer, never to guests.
  const publicEntry=({id,rows,latest,...rest})=>({...rest,...(signedIn?{member_id:id}:{})});
  return json({period,today,top:ordered.slice(0,100).map(e=>({...publicEntry(e),isMe:viewer?.id===e.id})),
   mine:viewer?publicEntry(viewer):null,participants,completed});
 }catch(error){
  console.error('Leaderboard read error',error?.name||'unknown');
  return json({error:'تعذر تحميل لوحة المتصدرين.'},503);
 }
}
