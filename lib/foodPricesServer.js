import 'server-only';
import {randomUUID} from 'node:crypto';
import {createMemo} from './serverMemo.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {logPriceAction,recomputeAfterEntry} from './priceConsensusServer.js';
import {RequestValidationError} from './requestSecurity.js';
import {latestFoodPrices,validateFoodEntry} from './foodPrices.js';

// Four months of entries are enough for the latest price and the one before it.
const HISTORY_DAYS=120;
const COLUMNS='id,batch_id,recorded_at,region,item,price,note,hidden';
const missingTable=error=>['42P01','PGRST205'].includes(error?.code);

async function readRecentRows(db,{includeHidden=false}={}){
 if(!db)return [];
 let query=db.from('food_prices').select(COLUMNS).gte('recorded_at',new Date(Date.now()-HISTORY_DAYS*864e5).toISOString()).order('recorded_at',{ascending:false}).limit(6000);
 if(!includeHidden)query=query.eq('hidden',false);
 const {data,error}=await query;
 if(missingTable(error))return [];
 if(error){recordOperationalEvent('database_failure',{source:'food_prices'});throw Error('تعذر تحميل أسعار المواد.');}
 return data||[];
}

// The entry's note is public: it tells readers where a batch of prices came from.
const publicRow=row=>row&&({price:Number(row.price),recorded_at:row.recorded_at,note:row.note||''});

// What the public page and the services hub show. Read at most once a minute however many
// people visit; a save clears it at once. If a read fails, the last good copy serves for an hour.
const publicMemo=createMemo({ttlMs:60e3,staleMs:60*60e3});
export function getPublicFoodPrices(db){
 return publicMemo(async()=>{
  const pairs=latestFoodPrices(await readRecentRows(db));
  return {prices:Object.fromEntries(Object.entries(pairs).map(([k,pair])=>[k,{latest:publicRow(pair.latest),previous:publicRow(pair.previous)}]))};
 });
}
export const invalidatePublicFoodPrices=()=>publicMemo.clear();

// The entry form: the latest prices to start from, and the recent entries (with hidden ones).
export async function readFoodWorkspace(db){
 const rows=await readRecentRows(db,{includeHidden:true});
 const batches=[],byId=new Map();
 for(const row of rows){
  let batch=byId.get(row.batch_id);
  if(!batch){
   if(batches.length>=15)continue;
   batch={id:row.batch_id,recorded_at:row.recorded_at,note:row.note||'',hidden:row.hidden,prices:[]};
   byId.set(row.batch_id,batch);batches.push(batch);
  }
  batch.prices.push({region:row.region,item:row.item,price:Number(row.price)});
 }
 const latest=Object.fromEntries(Object.entries(latestFoodPrices(rows)).map(([k,pair])=>[k,{price:Number(pair.latest.price),recorded_at:pair.latest.recorded_at}]));
 return {latest,batches};
}

export async function saveFoodPrices(db,{input,actorId}){
 const {latest}=await readFoodWorkspace(db);
 const {prices,note}=validateFoodEntry(input,latest);
 const batchId=randomUUID(),recordedAt=new Date().toISOString();
 const {error}=await db.from('food_prices').insert(prices.map(entry=>({...entry,batch_id:batchId,recorded_at:recordedAt,note:note||null,entered_by:actorId})));
 if(error){recordOperationalEvent('database_failure',{source:'food_prices'});throw Error(missingTable(error)?'جدول أسعار المواد غير مُنشأ بعد.':'تعذر حفظ الأسعار.');}
 invalidatePublicFoodPrices();
 await logPriceAction(db,{actorId,action:'anchor_price',target:'food:'+batchId,after:{prices,note:note||null}}).catch(()=>{});
 await recomputeAfterEntry(db,'food');
 return {batchId,recordedAt,saved:prices.length};
}

// A wrong entry is hidden (never deleted); the prices before it show again.
export async function setFoodBatchHidden(db,{batchId,hidden,actorId}){
 if(typeof batchId!=='string'||!/^[0-9a-f-]{36}$/i.test(batchId))throw new RequestValidationError('معرّف الإدخال غير صالح.');
 const {data,error}=await db.from('food_prices').update(hidden?{hidden:true,hidden_by:actorId,hidden_at:new Date().toISOString()}:{hidden:false,hidden_by:null,hidden_at:null}).eq('batch_id',batchId).select('id');
 if(error)throw Error('تعذر تحديث الإدخال.');
 if(!data?.length)throw new RequestValidationError('لم يُعثر على الإدخال.',404);
 invalidatePublicFoodPrices();
 await logPriceAction(db,{actorId,action:hidden?'hide_anchor':'show_anchor',target:'food:'+batchId}).catch(()=>{});
 await recomputeAfterEntry(db,'food',{reset:true});
 return {updated:data.length};
}
