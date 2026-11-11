import {FIGURE_PROFILE_BUCKET,FIGURE_PROFILE_MAX_BYTES,figureProfilePath,validateFigureProfile,emptyFigureProfile} from './figureProfiles.js';
import {RequestValidationError} from './requestSecurity.js';
import {yemenGovernorates,yemeniFigureEras} from './yemeniFigures.js';
import {safeExternalUrl,safeImageUrl} from './media.js';

// Supabase Storage refuses some downloads when several arrive together («429 Too many connections
// issued to the database»: 41 of 200 at 6 at a time, measured 2026-11-11). Those and server errors
// are worth one or two quick retries; a missing file is not.
const transientStorageError=error=>{const status=Number(error?.status??error?.statusCode);return status===429||status>=500||/too many connections|fetch failed|timeout/i.test(error?.message||'');};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function readFigureProfile(db,record,{retries=2,wait=pause}={}){
 const path=figureProfilePath(record);
 let {data,error}=await db.storage.from(FIGURE_PROFILE_BUCKET).download(path);
 for(let attempt=1;error&&attempt<=retries&&transientStorageError(error);attempt++){
  await wait(250*attempt+Math.floor(Math.random()*150));
  ({data,error}=await db.storage.from(FIGURE_PROFILE_BUCKET).download(path));
 }
 if(error){if(Number(error.status??error.statusCode)===404||/Object not found/i.test(error.message||''))return null;throw new RequestValidationError('تعذر تحميل السيرة الموسعة. حاول مجددًا لاحقًا.',503);}
 if(data.size>FIGURE_PROFILE_MAX_BYTES)throw new RequestValidationError('تعذر قراءة ملف السيرة المحفوظ.',503);
 try{return validateFigureProfile(JSON.parse(await data.text()));}catch{throw new RequestValidationError('ملف السيرة المحفوظ غير صالح. يلزم مراجعته قبل التعديل.',503);}
}

// Public figure pages used to download the profile from Storage on every visit. The file name
// contains the record's updated_at, so a given path never changes: a saved edit gets a new path.
// That makes it safe to keep recent profiles in memory (missing ones too), within a size budget.
const PROFILE_CACHE_BUDGET=20*1000*1000;
// After a deploy the cache is empty, and a crawler visiting many figures at once sent too many
// Storage downloads together; at most `parallel` run at a time, and one path is fetched once.
export function createFigureProfileCache({budget=PROFILE_CACHE_BUDGET,read=readFigureProfile,parallel=2}={}){
 const entries=new Map(),pending=new Map();let used=0,running=0;const queue=[];
 const sizeOf=value=>value?JSON.stringify(value).length:16;
 const limited=async task=>{
  if(running>=parallel)await new Promise(resolve=>queue.push(resolve));
  running++;
  try{return await task();}finally{running--;queue.shift()?.();}
 };
 return async(db,record)=>{
  const path=figureProfilePath(record);
  if(entries.has(path)){const hit=entries.get(path);entries.delete(path);entries.set(path,hit);return hit.value&&structuredClone(hit.value);}
  if(!pending.has(path))pending.set(path,limited(()=>read(db,record)).finally(()=>pending.delete(path)));
  const value=await pending.get(path),size=sizeOf(value);
  if(entries.has(path))return value&&structuredClone(value);
  if(size<=budget){
   entries.set(path,{value,size});used+=size;
   for(const [key,entry] of entries){if(used<=budget)break;entries.delete(key);used-=entry.size;}
  }
  return value&&structuredClone(value);
 };
}
export const readPublicFigureProfile=createFigureProfileCache();

export function validateFigureRecord(input){
 const fail=message=>{throw new RequestValidationError(message);};
 const string=(field,max,required=false)=>{const value=input[field]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail('حقل '+field+' غير صالح.');return value.trim();};
 if(!input||typeof input!=='object'||Array.isArray(input))fail('بيانات الشخصية غير صالحة.');
 const slug=string('slug',120,true);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail('الرابط المختصر غير صالح.');
 const governorateId=string('governorate_id',10),governorate=yemenGovernorates.find(item=>item.id===governorateId);
 if(governorateId&&!governorate)fail('المحافظة غير صالحة.');
 if(!yemeniFigureEras.includes(input.era)||typeof input.is_published!=='boolean')fail('الفترة أو حالة النشر غير صالحة.');
 const record={slug,full_name:string('full_name',160,true),known_for:string('known_for',800,true),field:string('field',200,true),governorate_id:governorate?.id||'',governorate_name:governorate?.name||'',era:input.era,short_bio:string('short_bio',150000,true),is_published:input.is_published};
 for(const field of ['birth_year','death_year']){const value=input[field];if(value!==null&&value!==''&&value!==undefined&&(!Number.isInteger(value)||value<500||value>2100))fail('سنة الميلاد أو الوفاة غير صالحة.');record[field]=value===''||value===undefined?null:value;}
 if(record.birth_year&&record.death_year&&record.birth_year>record.death_year)fail('سنة الوفاة تسبق سنة الميلاد.');
 for(const field of ['image_url','image_source_url','website','facebook_url','instagram_url','x_url','youtube_url']){const value=string(field,2048);if(value&&!(field==='image_url'?safeImageUrl(value):safeExternalUrl(value)))fail('رابط غير صالح في بيانات الشخصية.');record[field]=value||null;}
 record.image_credit=string('image_credit',2000);
 if(!Number.isInteger(input.display_order)||input.display_order<0||input.display_order>100000)fail('ترتيب الظهور غير صالح.');record.display_order=input.display_order;
 return record;
}

export async function saveFigureProfile(db,{record:input,profile:inputProfile,revision,role,actorId},clock=Date.now){
 if(!['admin','management'].includes(role))throw new RequestValidationError('لا تملك صلاحية تعديل الشخصيات.',403);
 if(typeof actorId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId))throw new RequestValidationError('تعذر التحقق من مسؤول التعديل.',403);
 const record=validateFigureRecord(input),profile=validateFigureProfile(inputProfile||emptyFigureProfile());
 let current=null;
 if(input.id){
  figureProfilePath({id:input.id,updated_at:new Date(clock()).toISOString()});
  const result=await db.from('yemeni_figures').select('*').eq('id',input.id).maybeSingle();
  if(result.error)throw new RequestValidationError('تعذر التحقق من نسخة الشخصية.',503);
  current=result.data;if(!current)throw new RequestValidationError('الشخصية غير موجودة.',404);
  if(revision!==current.updated_at)throw new RequestValidationError('عُدلت الشخصية في جلسة أخرى. أعد تحميل المحفوظ قبل الحفظ.',409);
 }else if(revision!==null)throw new RequestValidationError('نسخة إنشاء الشخصية غير صالحة.');
 const previousProfile=current?await readFigureProfile(db,current):null;
 const profileChanged=JSON.stringify(previousProfile||emptyFigureProfile())!==JSON.stringify(profile);
 const updated_at=new Date(Math.max(clock(),current?Date.parse(current.updated_at)+1:0)).toISOString();
 const payload={...record,id:current?.id||crypto.randomUUID(),updated_at};
 const path=figureProfilePath(payload);
 // Immutable file first, then an atomic compare-and-swap of the row that selects it.
 // Draft files stay private; a lost writer cannot alter the winning revision's file.
 const upload=await db.storage.from(FIGURE_PROFILE_BUCKET).upload(path,JSON.stringify(profile),{contentType:'application/json',upsert:false});
 if(upload.error)throw new RequestValidationError(Number(upload.error.statusCode)===409?'توجد نسخة أحدث قيد الحفظ. أعد تحميل المحفوظ.':'تعذر حفظ السيرة الموسعة.',Number(upload.error.statusCode)===409?409:503);
 const response=await db.rpc('editorial_service_save',{p_kind:'figure',p_id:payload.id,p_revision:current?.updated_at??null,p_data:payload,p_actor:actorId,p_action:current?'update':'create',p_profile_changed:profileChanged});
 const result={data:response.data?.record,error:response.error};
 if(result.error||!result.data){
  // A transport failure can arrive after the DB committed. Keep its immutable
  // file unless the response proves that this write did not win.
  if(['23505','40001','42501'].includes(result.error?.code)||(!result.error&&!result.data))await db.storage.from(FIGURE_PROFILE_BUCKET).remove([path]).catch(()=>{});
  if(result.error?.code==='42501')throw new RequestValidationError('تغيرت صلاحية التحرير. أعد تسجيل الدخول قبل المحاولة.',403);
  if(['23505','40001'].includes(result.error?.code)||(!result.error&&!result.data))throw new RequestValidationError('تعارض في نسخة الشخصية أو الرابط المختصر. أعد تحميل القائمة.',409);
  const failure=new RequestValidationError('تعذر تأكيد حفظ الشخصية. أعد تحميل المحفوظ قبل المحاولة.',503);
  failure.code=result.error?.code;failure.cause={code:result.error?.code,message:result.error?.message};throw failure;
 }
 return {record:result.data,profile,revision:result.data.updated_at};
}

export async function deleteFigureProfile(db,{id,revision,role,actorId}){
 if(role!=='management')throw new RequestValidationError('حذف الشخصيات متاح لحساب الإدارة فقط.',403);
 if(typeof actorId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId))throw new RequestValidationError('تعذر التحقق من مسؤول التعديل.',403);
 figureProfilePath({id,updated_at:revision});
 const result=await db.rpc('editorial_service_save',{p_kind:'figure',p_id:id,p_revision:revision,p_data:{},p_actor:actorId,p_action:'delete'}),data=result.data?.record,error=result.error;
 if(error?.code==='42501')throw new RequestValidationError('تغيرت صلاحية الإدارة. أعد تسجيل الدخول.',403);
 if(error?.code==='40001')throw new RequestValidationError('تغيرت الشخصية أو حُذفت بالفعل. أعد تحميل القائمة.',409);
 if(error)throw new RequestValidationError('تعذر حذف الشخصية.',503);
 if(!data)throw new RequestValidationError('تغيرت الشخصية أو حُذفت بالفعل. أعد تحميل القائمة.',409);
 // Historical files remain private; public access is always checked against the current row.
 return {ok:true};
}
