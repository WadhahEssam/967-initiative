import 'server-only';
import {randomUUID} from 'node:crypto';
import {createMemo} from './serverMemo.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {recomputeAfterEntry} from './priceConsensusServer.js';
import {authorizeEditorRequest} from './adminAuthorization.js';
import {addAccess,hasAccess,listAccess,removeAccess} from './accessLists.js';
import {RequestValidationError} from './requestSecurity.js';
import {RATE_CURRENCIES,RATE_REGIONS,dailySeries,latestRates,validateRateEntry} from './exchangeRates.js';

// Rates of the last 31 days are enough for the latest prices and the 30-day charts.
const HISTORY_DAYS=31;
const COLUMNS='id,batch_id,recorded_at,region,currency,buy,sell,note,hidden';
const missingTable=error=>['42P01','PGRST205'].includes(error?.code);

async function readRecentRows(db,{includeHidden=false}={}){
 if(!db)return [];
 let query=db.from('exchange_rates').select(COLUMNS).gte('recorded_at',new Date(Date.now()-HISTORY_DAYS*864e5).toISOString()).order('recorded_at',{ascending:false}).limit(3000);
 if(!includeHidden)query=query.eq('hidden',false);
 const {data,error}=await query;
 if(missingTable(error))return [];
 if(error){recordOperationalEvent('database_failure',{source:'exchange_rates'});throw Error('تعذر تحميل أسعار الصرف.');}
 return data||[];
}

// What the public page and the home tile show. Read at most once a minute however many people
// visit; a save clears it at once. If a read fails, the last good copy serves for up to an hour.
const publicMemo=createMemo({ttlMs:60e3,staleMs:60*60e3});
export function getPublicRates(db){
 return publicMemo(async()=>{
  const rows=await readRecentRows(db);
  const latest=latestRates(rows),series={};
  for(const region of RATE_REGIONS)for(const currency of RATE_CURRENCIES)series[region.id+':'+currency.id]=dailySeries(rows,region.id,currency.id,30);
  const publicRow=row=>({region:row.region,currency:row.currency,buy:Number(row.buy),sell:Number(row.sell),recorded_at:row.recorded_at,note:row.note||''});
  return {latest:Object.fromEntries(Object.entries(latest).map(([k,row])=>[k,publicRow(row)])),series};
 });
}
export const invalidatePublicRates=()=>publicMemo.clear();

// Editors, and the people management added as rates reporters, may enter rates.
export async function authorizeRatesRequest(request,db){
 const auth=await authorizeEditorRequest(request,db,{allowMember:true});
 if(auth.role)return {...auth,reporter:false};
 if(!await hasAccess(db,'exchange_rate_reporters',auth.user.id))throw new RequestValidationError('إدخال الأسعار متاح لمن أضافته الإدارة فقط.',403);
 return {...auth,reporter:true};
}

// The entry form: the latest rates to start from, and the recent entries (with hidden ones).
export async function readRatesWorkspace(db){
 const rows=await readRecentRows(db,{includeHidden:true});
 const batches=[];
 for(const row of rows){
  let batch=batches.find(item=>item.id===row.batch_id);
  if(!batch){batch={id:row.batch_id,recorded_at:row.recorded_at,note:row.note||'',hidden:row.hidden,rates:[]};batches.push(batch);}
  batch.rates.push({region:row.region,currency:row.currency,buy:Number(row.buy),sell:Number(row.sell)});
 }
 return {latest:latestRates(rows),batches:batches.slice(0,15)};
}

export async function saveRates(db,{input,actorId}){
 const {latest}=await readRatesWorkspace(db);
 const {rates,note}=validateRateEntry(input,latest);
 const batchId=randomUUID(),recordedAt=new Date().toISOString();
 const {error}=await db.from('exchange_rates').insert(rates.map(rate=>({...rate,batch_id:batchId,recorded_at:recordedAt,note:note||null,entered_by:actorId})));
 if(error){recordOperationalEvent('database_failure',{source:'exchange_rates'});throw Error('تعذر حفظ الأسعار.');}
 invalidatePublicRates();
 await recomputeAfterEntry(db,'rate');
 return {batchId,recordedAt,saved:rates.length};
}

// A wrong entry is hidden (never deleted); the one before it shows again.
export async function setBatchHidden(db,{batchId,hidden,actorId}){
 if(typeof batchId!=='string'||!/^[0-9a-f-]{36}$/i.test(batchId))throw new RequestValidationError('معرّف الإدخال غير صالح.');
 const {data,error}=await db.from('exchange_rates').update(hidden?{hidden:true,hidden_by:actorId,hidden_at:new Date().toISOString()}:{hidden:false,hidden_by:null,hidden_at:null}).eq('batch_id',batchId).select('id');
 if(error)throw Error('تعذر تحديث الإدخال.');
 if(!data?.length)throw new RequestValidationError('لم يُعثر على الإدخال.',404);
 invalidatePublicRates();
 await recomputeAfterEntry(db,'rate',{reset:true});
 return {updated:data.length};
}

// Management: who may enter rates. Accounts are found by email among existing members.
export const listReporters=db=>listAccess(db,'exchange_rate_reporters');
export const addReporter=(db,input)=>addAccess(db,'exchange_rate_reporters',input);
export const removeReporter=(db,input)=>removeAccess(db,'exchange_rate_reporters',input);
