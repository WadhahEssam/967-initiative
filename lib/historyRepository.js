import {historyStarter,historyEras,historyKinds} from './yemenHistory.js';
import {HISTORY_COMPARISON_FIELD_KEYS} from './historyComparisons.js';
import {RequestValidationError} from './requestSecurity.js';

export const HISTORY_CATALOG_KEY='yemen_history_catalog_v1';
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const validSlug=slug=>typeof slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=90;
const validUrl=url=>{try{const value=new URL(url);return ['https:','http:'].includes(value.protocol)&&!value.username&&!value.password&&url.length<=800;}catch{return false;}};


export function validateHistoryComparison(value,sources,kind='state'){
 if(value===undefined)return undefined; // Legacy editor overrides are backward compatible.
 if(kind!=='state')return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestValidationError('ملف المقارنة التاريخية غير صالح.');
 const facts=value.facts===undefined?{}:value.facts;
 if(!facts||typeof facts!=='object'||Array.isArray(facts))throw new RequestValidationError('حقول المقارنة غير صالحة.');
 const allowed=new Set(sources.map(source=>source.url));
 const checked={};
 for(const [key,raw] of Object.entries(facts)){
  if(!HISTORY_COMPARISON_FIELD_KEYS.has(key))throw new RequestValidationError('أحد معايير المقارنة غير معروف.');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new RequestValidationError('بيانات معيار المقارنة غير صالحة.');
  if(raw.text!==undefined&&typeof raw.text!=='string')throw new RequestValidationError('نص معيار المقارنة غير صالح.');
  const value=typeof raw.text==='string'?raw.text.trim():'';
  if(!value)continue;
  if(value.length>500)throw new RequestValidationError('الحد الأقصى لكل معلومة مقارنة هو 500 حرف.');
  const sourceUrl=typeof raw.sourceUrl==='string'?raw.sourceUrl.trim():'';
  if(!sourceUrl||!allowed.has(sourceUrl))throw new RequestValidationError('كل معلومة في المقارنة تحتاج إلى مصدر مدرج في مراجع المادة.');
  checked[key]={text:value,sourceUrl};
 }
 const result={facts:checked};
 if(value.timeline!==undefined&&value.timeline!==null){
  const time=value.timeline;
  if(!time||typeof time!=='object'||Array.isArray(time))throw new RequestValidationError('الفترة الزمنية في المقارنة غير صالحة.');
  const hasFrom=time.from!==''&&time.from!==null&&time.from!==undefined;
  const hasTo=time.to!==''&&time.to!==null&&time.to!==undefined;
  if(hasFrom!==hasTo)throw new RequestValidationError('أدخل بداية الفترة ونهايتها معاً، أو اتركهما فارغتين.');
  if(hasFrom){
   const from=Number(time.from),to=Number(time.to);
   if(!Number.isInteger(from)||!Number.isInteger(to)||from===0||to===0||from< -30000||to>new Date().getUTCFullYear()||from>=to)
    throw new RequestValidationError('الفترة الزمنية غير صالحة؛ يجب أن تسبق البداية النهاية.');
   const label=typeof time.label==='string'?time.label.trim():'';
   const sourceUrl=typeof time.sourceUrl==='string'?time.sourceUrl.trim():'';
   if(!label||label.length>180||!allowed.has(sourceUrl))
    throw new RequestValidationError('حدّد وصف الفترة ومصدرها من مراجع المادة.');
   result.timeline={from,to,label,sourceUrl};
  }
 }
 return result;
}

export function validateHistoryEntry(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!validSlug(input.slug))throw new RequestValidationError('رابط المادة التاريخية غير صالح.');
 if(!Object.hasOwn(historyKinds,input.kind)||!historyEras.some(e=>e.id===input.era))throw new RequestValidationError('اختر نوع المادة والعصر التاريخي.');
 const title=text(input.title,160),period=text(input.period,180),summary=text(input.summary,700);
 if(!title||!period||summary.length<25||String(input.title).length>160||String(input.summary).length>700)throw new RequestValidationError('العنوان والمدة والملخص مطلوبة ضمن الحدود.');
 const year=Number(input.year);
 if(!Number.isInteger(year)||year< -30000||year>new Date().getUTCFullYear())throw new RequestValidationError('سنة المادة التاريخية غير صالحة أو تقع في المستقبل؛ السالب يعني قبل الميلاد.');
 if(!Array.isArray(input.paragraphs)||input.paragraphs.length<1||input.paragraphs.length>12)throw new RequestValidationError('أضف فقرة واحدة على الأقل (12 فقرة كحد أقصى).');
 const paragraphs=input.paragraphs.map(x=>text(x,3000));
 if(paragraphs.some((x,i)=>!x||x.length!==String(input.paragraphs[i]).trim().length))throw new RequestValidationError('تحقق من طول فقرات المادة.');
 if(!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>12)throw new RequestValidationError('أضف مصدراً موثقاً واحداً على الأقل.');
 const sources=input.sources.map(x=>({title:text(x?.title,200),url:text(x?.url,800)}));
 if(sources.some(x=>!x.title||!validUrl(x.url)))throw new RequestValidationError('عنوان أو رابط أحد المصادر غير صالح.');
 const related=Array.isArray(input.related)?[...new Set(input.related)].slice(0,24):[];
 if(related.some(x=>!validSlug(x)||x===input.slug))throw new RequestValidationError('روابط المواد ذات الصلة غير صالحة.');
 const images=Array.isArray(input.images)?input.images:[];
 if(images.length>8)throw new RequestValidationError('الحد الأقصى ثماني صور لكل مادة.');
 if(input.images!=null&&!Array.isArray(input.images))throw new RequestValidationError('تنسيق معرض الصور غير صحيح.');
 const media=images.map(image=>{
  const file=text(image?.file,220),caption=text(image?.caption,250),credit=text(image?.credit,180),license=text(image?.license,180);
  if(!file||file.includes('..')||/[\\/:?#]/.test(file)||!/^.{1,210}\.(?:jpg|jpeg|png|webp)$/i.test(file)||!caption||!credit||!license)
   throw new RequestValidationError('كل صورة تحتاج اسم ملف صحيحاً من كومنز ووصفاً ومؤلفاً وترخيصاً.');
  return {file,caption,alt:caption,credit,license,kind:'context'};
 });
 if(input.hideImages!=null&&typeof input.hideImages!=='boolean')throw new RequestValidationError('إعداد عرض الصور غير صالح.');
 const governorate=text(input.governorate,10);
 if(governorate&&!/^YE\d{2}$/.test(governorate))throw new RequestValidationError('معرّف المحافظة غير صحيح.');
 if(typeof input.isPublished!=='boolean')throw new RequestValidationError('حدد حالة النشر بشكل صريح.');
 const comparison=validateHistoryComparison(input.comparison,sources,input.kind);
 return {slug:input.slug,title,kind:input.kind,era:input.era,year,period,summary,paragraphs,sources,related,location:text(input.location,120),governorate,figureQuery:text(input.figureQuery,120),certainty:text(input.certainty,150),images:media,hideImages:input.hideImages===true,isPublished:input.isPublished,...(comparison===undefined?{}:{comparison})};
}
export function mergeHistoryCatalog(overrides=[]){
 if(!Array.isArray(overrides))throw new RequestValidationError('نسخة تاريخ اليمن المحفوظة غير صالحة.',503);
 const results=new Map(historyStarter.map(entry=>[entry.slug,entry]));
 for(const override of overrides){
  const item=validateHistoryEntry(override);
  const base=results.get(item.slug);
  // Old CMS records did not have comparison fields: retain verified starter facts.
  if(base?.comparison&&!Object.hasOwn(item,'comparison')){
   const known=new Set(item.sources.map(s=>s.url));
   const facts=Object.fromEntries(Object.entries(base.comparison.facts||{}).filter(([,fact])=>known.has(fact.sourceUrl)));
   const time=base.comparison.timeline;
   results.set(item.slug,{...item,comparison:{facts,...(time&&known.has(time.sourceUrl)?{timeline:time}:{})}});
  }else results.set(item.slug,item);
 }
 return [...results.values()].sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title,'ar'));
}
export function parseHistoryCatalog(row){
 if(!row)return [];
 if(row.value?.version!==1||!Array.isArray(row.value.entries)||row.value.entries.length>500)throw new RequestValidationError('تعذر قراءة أرشيف تاريخ اليمن. لم يُستبدل المحتوى.',503);
 return row.value.entries.map(validateHistoryEntry);
}
export async function readHistoryCatalog(db){
 if(!db)return {entries:mergeHistoryCatalog(),overrides:[],revision:null,exists:false,available:false};
 const {data,error}=await db.from('site_settings').select('key,value,updated_at').eq('key',HISTORY_CATALOG_KEY).maybeSingle();
 if(error)throw new RequestValidationError('تعذر تحميل أرشيف تاريخ اليمن.',503);
 const overrides=parseHistoryCatalog(data);
 return {entries:mergeHistoryCatalog(overrides),overrides,revision:data?.updated_at||null,exists:!!data,available:true};
}
// The catalog is about 1 MB. Public pages used to fetch it on every visit, which used up the Supabase egress quota.
// Public pages now read through this cache: at most once a minute it checks only updated_at (a few bytes),
// and fetches the full catalog only when it has changed. A history-editor save clears it immediately.
// If the check fails, the last good copy is served for up to staleMs.
export function createHistoryCatalogCache({checkMs=60*1000,staleMs=6*60*60*1000,now=()=>Date.now()}={}){
 let cached=null,inflight=null;
 const read=async db=>{
  if(!db)return readHistoryCatalog(db);
  if(cached&&now()-cached.checkedAt<checkMs)return cached.value;
  if(inflight)return inflight;
  inflight=(async()=>{
   try{
    if(cached){
     const {data,error}=await db.from('site_settings').select('updated_at').eq('key',HISTORY_CATALOG_KEY).maybeSingle();
     if(error)throw new RequestValidationError('تعذر تحميل أرشيف تاريخ اليمن.',503);
     if((data?.updated_at||null)===cached.value.revision){cached={...cached,checkedAt:now(),verifiedAt:now()};return cached.value;}
    }
    const value=await readHistoryCatalog(db);
    cached={value,checkedAt:now(),verifiedAt:now()};
    return value;
   }catch(error){
    if(cached&&now()-cached.verifiedAt<staleMs){cached={...cached,checkedAt:now()};return cached.value;}
    throw error;
   }finally{inflight=null;}
  })();
  return inflight;
 };
 read.clear=()=>{cached=null;};
 return read;
}
const publicHistoryCatalog=createHistoryCatalogCache();
export const readPublicHistoryCatalog=db=>publicHistoryCatalog(db);
export function invalidatePublicHistoryCatalog(){publicHistoryCatalog.clear();}
export async function writeHistoryEntry(db,{action,entry,slug,revision,actorId,role}){
 if(!db)throw new RequestValidationError('خدمة التحرير غير مهيأة.',503);
 if(!actorId||!['admin','management'].includes(role))throw new RequestValidationError('صلاحية التحرير غير متوفرة.',403);
 if(revision!==null&&(typeof revision!=='string'||revision.length>60||!Number.isFinite(Date.parse(revision))))throw new RequestValidationError('نسخة الأرشيف غير صالحة.');
 const current=await readHistoryCatalog(db);
 if(revision!==current.revision)throw new RequestValidationError('حُفظت نسخة أحدث. أعد تحميل الأرشيف قبل تعديل المادة.',409);
 const overrides=new Map(current.overrides.map(x=>[x.slug,x]));
 if(action==='save'){
  const item=validateHistoryEntry(entry);
  if(!overrides.has(item.slug)&&current.overrides.length>=480)throw new RequestValidationError('وصل الأرشيف إلى الحد المتاح.',409);
  overrides.set(item.slug,item);
 }else if(action==='delete'){
  if(role!=='management')throw new RequestValidationError('حذف المواد متاح لحساب الإدارة فقط.',403);
  if(!validSlug(slug))throw new RequestValidationError('رابط المادة غير صالح.');
  if(historyStarter.some(x=>x.slug===slug))throw new RequestValidationError('لا يمكن حذف المادة الأساسية؛ استخدم إخفاء النشر.',400);
  if(!overrides.has(slug))throw new RequestValidationError('المادة غير موجودة.',404);
  overrides.delete(slug);
 }else throw new RequestValidationError('عملية غير معروفة.');
 const stamp=new Date(Math.max(Date.now(),current.revision?Date.parse(current.revision)+1:0)).toISOString();
 const record={key:HISTORY_CATALOG_KEY,value:{version:1,entries:[...overrides.values()],editedBy:actorId,editedAt:stamp},updated_at:stamp};
 const query=current.exists?db.from('site_settings').update(record).eq('key',HISTORY_CATALOG_KEY).eq('updated_at',revision):db.from('site_settings').insert(record);
 const {data,error}=await query.select('updated_at').maybeSingle();
 if(error?.code==='23505'||error?.code==='40001'||(!error&&!data))throw new RequestValidationError('تعارض تحرير؛ أعد تحميل النسخة المنشورة.',409);
 if(error)throw new RequestValidationError('تعذر حفظ المادة. لم يتم تأكيد التحديث.',503);
 invalidatePublicHistoryCatalog();
 return {entries:mergeHistoryCatalog([...overrides.values()]),revision:data.updated_at};
}
