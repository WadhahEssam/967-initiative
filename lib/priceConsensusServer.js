import 'server-only';
import {recordOperationalEvent} from './operationalEvents.js';
import {createMemo} from './serverMemo.js';
import {RATE_CURRENCIES,RATE_REGIONS} from './exchangeRates.js';
import {FOOD_ITEMS,FOOD_REGIONS} from './foodPrices.js';
import {LONG_WINDOW_MS,PRICE_KINDS,computeConsensus,consensusConfidence} from './priceConsensus.js';
import {SETTLE_MS,applyScore,newReporter,scoreReport} from './priceReputation.js';

// «المُبلّغ المحلي»: works out the price of every city and item of one kind from the stored state,
// the latest editor entries and the last 24 hours of reports, and saves what changed.
// Everything is read in four queries per kind, not per item, to keep the load on Supabase low.

export function priceInstruments(kind){
 if(kind==='rate')return RATE_REGIONS.flatMap(region=>RATE_CURRENCIES.flatMap(currency=>['buy','sell'].map(side=>({kind,region:region.id,item:currency.id,side}))));
 if(kind==='food')return FOOD_REGIONS.flatMap(region=>FOOD_ITEMS.map(item=>({kind,region:region.id,item:item.id,side:'price'})));
 throw Error('unknown price kind');
}
export const instrumentKey=row=>[row.kind,row.region,row.item,row.side].join(':');
const missingTable=error=>['42P01','PGRST205'].includes(error?.code);
const ms=value=>value?Date.parse(value):null;
const iso=value=>Number.isFinite(value)?new Date(value).toISOString():null;
const fail=()=>{recordOperationalEvent('database_failure',{source:'prices'});return Error('تعذر حساب الأسعار.');};
class MissingTables extends Error{}
const check=({data,error})=>{if(missingTable(error))throw new MissingTables();if(error)throw fail();return data||[];};

// The latest visible editor entry of each instrument, within the time it may still be shown.
async function readOfficial(db,kind,now){
 const since=new Date(now-PRICE_KINDS[kind].expiredMs).toISOString(),official=new Map();
 if(kind==='rate'){
  const rows=check(await db.from('exchange_rates').select('region,currency,buy,sell,recorded_at').eq('hidden',false).gte('recorded_at',since).order('recorded_at',{ascending:false}).limit(500));
  for(const row of rows)for(const side of ['buy','sell']){
   const key=instrumentKey({kind,region:row.region,item:row.currency,side});
   if(!official.has(key))official.set(key,{value:Number(row[side]),at:ms(row.recorded_at)});
  }
 }else{
  const rows=check(await db.from('food_prices').select('region,item,price,recorded_at').eq('hidden',false).gte('recorded_at',since).order('recorded_at',{ascending:false}).limit(3000));
  for(const row of rows){
   const key=instrumentKey({kind,region:row.region,item:row.item,side:'price'});
   if(!official.has(key))official.set(key,{value:Number(row.price),at:ms(row.recorded_at)});
  }
 }
 return official;
}

async function readReports(db,kind,now){
 return check(await db.from('price_reports').select('id,user_id,region,item,side,value,confirmation,device_hash,connection_hash,status,created_at').eq('kind',kind).gte('created_at',new Date(now-LONG_WINDOW_MS).toISOString()).not('user_id','is',null).order('created_at',{ascending:false}).limit(5000));
}

async function readReporters(db,userIds){
 const reporters=new Map();
 for(let index=0;index<userIds.length;index+=200){
  const rows=check(await db.from('price_reporters').select('user_id,score,silent_ban,anchor').in('user_id',userIds.slice(index,index+200)));
  for(const row of rows)reporters.set(row.user_id,{score:Number(row.score),banned:row.silent_ban,anchor:row.anchor});
 }
 return reporters;
}

const toState=row=>row&&row.value!==null?{value:Number(row.value),changedAt:ms(row.changed_at),officialAt:ms(row.official_at),anchored:row.anchored,lastActivityAt:ms(row.last_activity_at)}:null;
const sameRow=(a,b)=>['value','low','high','report_count','anchored','reason','changed_at','official_at','last_activity_at'].every(field=>{
 const x=a?.[field],y=b?.[field];
 if(['changed_at','official_at','last_activity_at'].includes(field))return ms(x)===ms(y);
 if(['value','low','high'].includes(field))return (x===null||x===undefined?null:Number(x))===(y===null||y===undefined?null:Number(y));
 return (x??null)===(y??null);
});

// One recomputation at a time in this server process (both kinds share reporters' scores), so two
// reports arriving together cannot save over each other.
let queue=Promise.resolve();
function serialize(kind,task){
 const run=queue.then(task,task);
 queue=run.catch(()=>{});
 return run;
}

/**
 * Recomputes every price of one kind and saves the changes.
 * reset: start from the editor entries again instead of the stored state (after an entry is
 * hidden, or when an editor asks for it).
 */
export function recomputePrices(db,kind,{reset=false,now=Date.now()}={}){
 return serialize(kind,async()=>{
  if(!db)return {changed:0};
  try{
   const [stored,official,reports]=await Promise.all([
    db.from('price_consensus').select('*').eq('kind',kind).then(check),
    readOfficial(db,kind,now),
    readReports(db,kind,now),
   ]);
   const reporters=await readReporters(db,[...new Set(reports.map(row=>row.user_id))]);
   const storedBy=new Map(stored.map(row=>[instrumentKey(row),row]));
   const reportsBy=new Map();
   for(const row of reports){
    const key=instrumentKey({kind,region:row.region,item:row.item,side:row.side});
    if(!reportsBy.has(key))reportsBy.set(key,[]);
    reportsBy.get(key).push({id:row.id,userId:row.user_id,value:Number(row.value),at:ms(row.created_at),confirmation:row.confirmation,device:row.device_hash,connection:row.connection_hash,status:row.status});
   }
   const upserts=[],history=[],statusChanges=new Map(),prices=new Map();
   for(const instrument of priceInstruments(kind)){
    const key=instrumentKey(instrument),previous=storedBy.get(key),list=reportsBy.get(key)||[];
    const result=computeConsensus({kind,current:reset?null:toState(previous),official:official.get(key)||null,reports:list,reporters,now});
    if(result.value!==null)prices.set(key,result.value);
    if(result.value===null&&!previous)continue;
    const row={...instrument,value:result.value,low:result.low,high:result.high,report_count:result.count,anchored:result.anchored,reason:result.reason||previous?.reason||null,changed_at:iso(result.changedAt),official_at:iso(result.officialAt),last_activity_at:iso(result.lastActivityAt),computed_at:new Date(now).toISOString()};
    if(!sameRow(row,previous))upserts.push(row);
    if(result.value!==null&&result.value!==(previous?.value===null||previous?.value===undefined?null:Number(previous.value)))history.push({...instrument,value:result.value,low:result.low,high:result.high,report_count:result.count,reason:result.reason||'consensus',first_report_id:result.jump?.firstReportId??null,recorded_at:new Date(now).toISOString()});
    for(const report of list){
     const status=result.statuses[report.id];
     if(status&&status!==report.status){if(!statusChanges.has(status))statusChanges.set(status,[]);statusChanges.get(status).push(report.id);}
    }
   }
   if(upserts.length)check(await db.from('price_consensus').upsert(upserts,{onConflict:'kind,region,item,side'}).select('item'));
   if(history.length)check(await db.from('price_consensus_history').insert(history).select('id'));
   for(const [status,ids] of statusChanges)for(let index=0;index<ids.length;index+=500)check(await db.from('price_reports').update({status}).in('id',ids.slice(index,index+500)).select('id'));
   if(upserts.length)invalidatePriceBoard();
   // Grading never blocks the price: if it fails (or its columns are not there yet), the price is
   // saved and the reports are graded on a later recomputation.
   let graded=0;
   try{graded=await settleReports(db,kind,prices,now);}catch{recordOperationalEvent('database_failure',{source:'prices'});}
   return {changed:history.length,saved:upserts.length,graded};
  }catch(error){
   if(error instanceof MissingTables)return {changed:0,missing:true};
   throw error;
  }
 });
}

// Grades the reports that have settled (lib/priceReputation.js) against the price shown now, and
// moves their reporters' scores. Oldest first, so the daily gain cap applies in order. Reports
// older than a week that never had a price to compare with are left ungraded.
const REPORTER_COLUMNS='user_id,score,reports_total,reports_agreeing,silent_ban,ban_reason,banned_at,anchor,daily_gain,gain_day,jumps_first,anchor_miss_streak';
async function settleReports(db,kind,prices,now){
 const rows=check(await db.from('price_reports').select('id,user_id,region,item,side,value,confirmation,status,created_at').eq('kind',kind).is('scored_at',null).not('user_id','is',null)
  .lte('created_at',new Date(now-SETTLE_MS[kind]).toISOString()).gte('created_at',new Date(now-7*864e5).toISOString()).order('created_at').limit(1000));
 if(!rows.length)return 0;
 const jumps=new Map();
 for(let index=0;index<rows.length;index+=200){
  const found=check(await db.from('price_consensus_history').select('first_report_id,value').eq('kind',kind).eq('reason','jump').in('first_report_id',rows.slice(index,index+200).map(row=>row.id)));
  for(const row of found)jumps.set(row.first_report_id,Number(row.value));
 }
 const userIds=[...new Set(rows.map(row=>row.user_id))],reporters=new Map();
 for(let index=0;index<userIds.length;index+=200){
  for(const row of check(await db.from('price_reporters').select(REPORTER_COLUMNS).in('user_id',userIds.slice(index,index+200))))reporters.set(row.user_id,{...row,score:Number(row.score),daily_gain:Number(row.daily_gain)});
 }
 const changed=new Set(),grades=new Map();
 for(const row of rows){
  const price=prices.get(instrumentKey({kind,region:row.region,item:row.item,side:row.side}));
  if(!(price>0))continue;
  const jumpValue=jumps.get(row.id);
  const graded=scoreReport({kind,value:Number(row.value),confirmation:row.confirmation,status:row.status,price,jump:jumpValue?{first:true,held:Math.abs(price-jumpValue)/jumpValue<=PRICE_KINDS[kind].holdBeyond}:null});
  if(!graded)continue;
  const result=applyScore(reporters.get(row.user_id)||newReporter(row.user_id),graded,{confirmation:row.confirmation,at:now});
  reporters.set(row.user_id,result.reporter);changed.add(row.user_id);
  if(result.anchorAlert)console.warn(JSON.stringify({event:'price_anchor_alert',kind,at:new Date(now).toISOString()}));
  const group=result.applied+'|'+graded.agreement;
  if(!grades.has(group))grades.set(group,[]);
  grades.get(group).push(row.id);
 }
 if(changed.size){
  const stamp=new Date(now).toISOString();
  check(await db.from('price_reporters').upsert([...changed].map(id=>{const row=reporters.get(id);return {user_id:id,score:row.score,reports_total:row.reports_total,reports_agreeing:row.reports_agreeing,silent_ban:row.silent_ban,ban_reason:row.ban_reason,banned_at:row.banned_at,daily_gain:row.daily_gain,gain_day:row.gain_day,jumps_first:row.jumps_first,anchor_miss_streak:row.anchor_miss_streak,updated_at:stamp};}),{onConflict:'user_id'}).select('user_id'));
  for(const [group,ids] of grades){
   const [delta,agreement]=group.split('|');
   for(let index=0;index<ids.length;index+=500)check(await db.from('price_reports').update({scored_at:stamp,score_delta:Number(delta),agreement}).in('id',ids.slice(index,index+500)).select('id'));
  }
 }
 return [...grades.values()].reduce((sum,ids)=>sum+ids.length,0);
}

// After an editor saves or hides an entry. The entry itself is already saved: a failure here is
// logged and the public pages keep working from the editor entries.
export async function recomputeAfterEntry(db,kind,{reset=false}={}){
 try{return await recomputePrices(db,kind,{reset});}
 catch{recordOperationalEvent('database_failure',{source:'prices'});return null;}
}

// What the pages show: every computed price with how many people it rests on, its range and how
// fresh it is. Read at most once a minute however many people visit; a recomputation clears it.
// null when the tables do not exist yet, so the pages keep showing the editor entries.
// Nothing here says which reports counted or who reported.
const boardMemo=createMemo({ttlMs:60e3,staleMs:60*60e3});
export function getPriceBoard(db){
 if(!db)return Promise.resolve(null);
 return boardMemo(async()=>{
  const {data,error}=await db.from('price_consensus').select('kind,region,item,side,value,low,high,report_count,anchored,changed_at,last_activity_at');
  if(missingTable(error))return null;
  if(error)throw fail();
  const now=Date.now(),board={};
  for(const row of data||[]){
   if(row.value===null)continue;
   const state={value:Number(row.value),count:row.report_count,anchored:row.anchored,changedAt:ms(row.changed_at),lastActivityAt:ms(row.last_activity_at)};
   board[instrumentKey(row)]={value:state.value,low:row.low===null?null:Number(row.low),high:row.high===null?null:Number(row.high),count:row.report_count,lastActivityAt:state.lastActivityAt,confidence:consensusConfidence(state,row.kind,now)};
  }
  return board;
 });
}
export const invalidatePriceBoard=()=>boardMemo.clear();
