import 'server-only';
import {createMemo} from './serverMemo.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {RequestValidationError} from './requestSecurity.js';
import {REPORT_REGIONS} from './priceReports.js';
import {PRICE_BADGES,cityBoard,earnedPriceBadges,myCityRank,reporterWeek,trustLevel} from './priceIncentives.js';

// «المُبلّغ المحلي», phase 5: the weekly board of reporters per city and a member's own page.
// Silently banned, suspended and leaving members are left out of the public board without any
// sign; on their own page everything looks as usual.

const missingTable=error=>['42P01','PGRST205','42703'].includes(error?.code);
const fail=()=>{recordOperationalEvent('database_failure',{source:'prices'});return Error('تعذر تحميل بيانات المبلّغين.');};

async function weekRows(db,week){
 const {data,error}=await db.from('price_reports').select('user_id,region,agreement,created_at').eq('confirmation',false).not('scored_at','is',null).not('user_id','is',null)
  .gte('created_at',new Date(week.start).toISOString()).lt('created_at',new Date(week.end).toISOString()).limit(20000);
 if(missingTable(error))return null;
 if(error)throw fail();
 return data||[];
}
async function hiddenMembers(db,ids){
 const hidden=new Set();
 for(let index=0;index<ids.length;index+=200){
  const slice=ids.slice(index,index+200);
  const [bans,profiles]=await Promise.all([
   db.from('price_reporters').select('user_id').in('user_id',slice).eq('silent_ban',true),
   db.from('public_profiles').select('user_id,display_name,suspended,deletion_requested_at').in('user_id',slice),
  ]);
  if(bans.error||profiles.error)throw fail();
  for(const row of bans.data||[])hidden.add(row.user_id);
  const seen=new Set();
  for(const row of profiles.data||[]){seen.add(row.user_id);if(row.suspended||row.deletion_requested_at)hidden.add(row.user_id);}
  for(const id of slice)if(!seen.has(id))hidden.add(id);
 }
 return hidden;
}

// The public board: the week's top 10 in each city, with names and badges. Kept 5 minutes.
const boardMemo=createMemo({ttlMs:5*60e3,staleMs:60*60e3});
export function getReportersBoard(db){
 if(!db)return Promise.resolve(null);
 return boardMemo(async()=>{
  const week=reporterWeek();
  const rows=await weekRows(db,week);
  if(rows===null)return null;
  const ids=[...new Set(rows.map(row=>row.user_id))];
  const hidden=await hiddenMembers(db,ids);
  const cities=REPORT_REGIONS.map(region=>({id:region.id,name:region.name,top:cityBoard(rows,region.id,{exclude:hidden}).slice(0,10)}));
  const shown=[...new Set(cities.flatMap(city=>city.top.map(entry=>entry.userId)))];
  const names=new Map(),badges=new Map();
  for(let index=0;index<shown.length;index+=200){
   const slice=shown.slice(index,index+200);
   const [profiles,earned]=await Promise.all([db.from('public_profiles').select('user_id,display_name').in('user_id',slice),db.from('price_reporter_badges').select('user_id,code').in('user_id',slice)]);
   if(profiles.error)throw fail();
   for(const row of profiles.data||[])names.set(row.user_id,row.display_name);
   for(const row of earned.data||[]){if(!badges.has(row.user_id))badges.set(row.user_id,[]);badges.get(row.user_id).push(row.code);}
  }
  // Member ids are not published: names, counts and badges only.
  return {week:{start:new Date(week.start).toISOString(),end:new Date(week.end).toISOString()},cities:cities.map(city=>({...city,top:city.top.map(entry=>({rank:entry.rank,name:names.get(entry.userId)||'عضو في 967',agreeing:entry.agreeing,badges:badges.get(entry.userId)||[]}))}))};
 });
}

// A member's own page: reports sent, the share that agreed, trust level, badges, rank in the city.
// Never the score itself, a report's grade or status, or a ban.
export async function readMyPrices(db,userId){
 const week=reporterWeek();
 const [reporterResult,sentResult,confirmResult,badgeResult,recentResult,rows]=await Promise.all([
  db.from('price_reporters').select('score,reports_total,reports_agreeing,jumps_first').eq('user_id',userId).maybeSingle(),
  db.from('price_reports').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('confirmation',false),
  db.from('price_reports').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('confirmation',true),
  db.from('price_reporter_badges').select('code,earned_at').eq('user_id',userId),
  db.from('price_reports').select('kind,region,item,side,value,confirmation,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(10),
  weekRows(db,week),
 ]);
 for(const result of [reporterResult,sentResult,confirmResult,badgeResult,recentResult])if(result.error){if(missingTable(result.error))throw new RequestValidationError('هذه الصفحة غير متاحة بعد.',404);throw fail();}
 const reporter=reporterResult.data||{score:30,reports_total:0,reports_agreeing:0,jumps_first:0};
 const sent=sentResult.count||0;
 const earned=new Map((badgeResult.data||[]).map(row=>[row.code,row.earned_at]));
 // A badge reached but not saved yet (it is saved when the next report is graded) still shows.
 for(const code of earnedPriceBadges(reporter,sent))if(!earned.has(code))earned.set(code,null);
 let rank=null;
 if(rows?.length){
  const hidden=await hiddenMembers(db,[...new Set(rows.map(row=>row.user_id))]);
  rank=myCityRank(rows,userId,{exclude:hidden});
 }
 return {
  sent,confirmations:confirmResult.count||0,graded:reporter.reports_total,
  agreeingShare:reporter.reports_total?Math.round(reporter.reports_agreeing/reporter.reports_total*100):null,
  level:trustLevel(reporter.score),
  badges:PRICE_BADGES.map(badge=>({...badge,earned:earned.has(badge.code),earnedAt:earned.get(badge.code)||null,progress:badge.code==='city_eye'?Math.min(25,reporter.reports_agreeing):null})),
  rank:rank&&{city:REPORT_REGIONS.find(region=>region.id===rank.region)?.name||'',rank:rank.rank,of:rank.of,agreeing:rank.agreeing},
  recent:(recentResult.data||[]).map(row=>({kind:row.kind,region:row.region,item:row.item,side:row.side,value:Number(row.value),confirmation:row.confirmation,at:row.created_at})),
 };
}
