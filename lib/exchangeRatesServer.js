import 'server-only';
import {randomUUID} from 'node:crypto';
import {createMemo} from './serverMemo.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {authorizeEditorRequest} from './adminAuthorization.js';
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
 const {data,error}=await db.from('exchange_rate_reporters').select('user_id').eq('user_id',auth.user.id).maybeSingle();
 if(error&&!missingTable(error))throw new RequestValidationError('تعذر التحقق من الصلاحيات.',503);
 if(!data)throw new RequestValidationError('إدخال أسعار الصرف متاح لمن أضافته الإدارة فقط.',403);
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
 return {batchId,recordedAt,saved:rates.length};
}

// A wrong entry is hidden (never deleted); the one before it shows again.
export async function setBatchHidden(db,{batchId,hidden,actorId}){
 if(typeof batchId!=='string'||!/^[0-9a-f-]{36}$/i.test(batchId))throw new RequestValidationError('معرّف الإدخال غير صالح.');
 const {data,error}=await db.from('exchange_rates').update(hidden?{hidden:true,hidden_by:actorId,hidden_at:new Date().toISOString()}:{hidden:false,hidden_by:null,hidden_at:null}).eq('batch_id',batchId).select('id');
 if(error)throw Error('تعذر تحديث الإدخال.');
 if(!data?.length)throw new RequestValidationError('لم يُعثر على الإدخال.',404);
 invalidatePublicRates();
 return {updated:data.length};
}

// Management: who may enter rates. Accounts are found by email among existing members.
export async function listReporters(db){
 const {data,error}=await db.from('exchange_rate_reporters').select('user_id,created_at').order('created_at');
 if(error)throw missingTable(error)?new RequestValidationError('جدول مدخلي الأسعار غير مُنشأ بعد.',503):Error('reporters');
 const people=await Promise.all((data||[]).map(async row=>{
  const {data:found}=await db.auth.admin.getUserById(row.user_id);
  return {userId:row.user_id,email:found?.user?.email||'',name:found?.user?.user_metadata?.full_name||found?.user?.user_metadata?.display_name||'',created_at:row.created_at};
 }));
 return people;
}
async function findUserByEmail(db,email){
 for(let page=1;page<=20;page++){
  const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
  if(error)throw Error('تعذر البحث عن الحساب.');
  const found=data.users.find(user=>user.email?.toLowerCase()===email);
  if(found)return found;
  if(data.users.length<1000)return null;
 }
 return null;
}
export async function addReporter(db,{email,actorId}){
 const address=typeof email==='string'?email.trim().toLowerCase():'';
 if(!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(address))throw new RequestValidationError('أدخل بريدًا إلكترونيًا صحيحًا.');
 const user=await findUserByEmail(db,address);
 if(!user)throw new RequestValidationError('لا يوجد حساب بهذا البريد. اطلب من الشخص إنشاء حساب في الموقع أولًا.',404);
 if(!user.email_confirmed_at)throw new RequestValidationError('هذا الحساب لم يؤكد بريده بعد.');
 const {error}=await db.from('exchange_rate_reporters').upsert({user_id:user.id,added_by:actorId},{onConflict:'user_id'});
 if(error)throw Error('تعذر إضافة الحساب.');
 return {userId:user.id};
}
export async function removeReporter(db,{userId}){
 if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId))throw new RequestValidationError('معرّف الحساب غير صالح.');
 const {error}=await db.from('exchange_rate_reporters').delete().eq('user_id',userId);
 if(error)throw Error('تعذر إزالة الحساب.');
 return {removed:true};
}
