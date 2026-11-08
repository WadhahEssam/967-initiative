import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {taskRequestDb} from '@/lib/taskServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {safeExternalUrl} from '@/lib/media';
import {invalidateStatCatalog,invalidateDirectoryLists} from '@/lib/data';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const definitions={
 university:{
  table:'universities',rpc:'directory_save_university',
  select:'*,programs:university_programs(*),branches:university_branches(*),sources:university_sources(*)',
  relations:{p_programs:'programs',p_branches:'branches',p_sources:'sources'},
  allowed:['name_ar','summary','governorate','city','address','website','phone','email','logo_url','admission_info','registration_url'],
 },
 medical_center:{
  table:'medical_centers',rpc:'directory_save_medical_center',
  select:'*,specialties:medical_center_specialties(*),services:medical_center_services(*),hours:medical_center_hours(*),branches:medical_center_branches(*),sources:medical_center_sources(*)',
  relations:{p_specialties:'specialties',p_services:'services',p_hours:'hours',p_branches:'branches',p_sources:'sources'},
  allowed:['name_ar','summary','governorate','city','address','website','phone','email','logo_url','booking_url'],
 },
 statistic:{
  table:'stat_indicators',
  select:'id,slug,name,short_description,definition,measurement_method,updated_at',
  allowed:['name','short_description','definition','measurement_method'],
 },
};
const urls=new Set(['website','logo_url','registration_url','booking_url']);
const nullable=new Set(['website','logo_url','registration_url','booking_url','address','city','phone','email','governorate']);
const limits={name_ar:250,name:250,summary:12000,short_description:1500,definition:6000,measurement_method:6000,admission_info:6000};

function inputKind(value){if(!Object.hasOwn(definitions,value))throw new RequestValidationError('هذا النوع غير مدعوم في التحرير السريع.');return definitions[value];}
function inputId(value){if(!UUID.test(String(value||'')))throw new RequestValidationError('معرّف المحتوى غير صالح.');return value;}
function normalizePatch(config,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new RequestValidationError('التغييرات المرسلة غير صالحة.');
 const keys=Object.keys(input);
 if(!keys.length||keys.length>config.allowed.length||keys.some(key=>!config.allowed.includes(key)))throw new RequestValidationError('حقول التحرير غير مسموحة.');
 const patch={};
 for(const key of keys){
  const value=input[key];
  if(typeof value!=='string'||value.length>(limits[key]||2048))throw new RequestValidationError('تحقق من طول ونوع الحقل: '+key);
  const trimmed=value.trim();
  if(['name_ar','name'].includes(key)&&trimmed.length<2)throw new RequestValidationError('الاسم مطلوب.');
  if(urls.has(key)&&trimmed&&!safeExternalUrl(trimmed))throw new RequestValidationError('أدخل رابط HTTP أو HTTPS صحيحاً في '+key);
  if(key==='email'&&trimmed&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))throw new RequestValidationError('البريد الإلكتروني غير صالح.');
  patch[key]=nullable.has(key)?trimmed||null:trimmed;
 }
 return patch;
}
const recordFields={
 university:['stable_key','slug','name_ar','name_en','institution_type','ownership','founded_year','summary','governorate','city','district','address','latitude','longitude','map_url','logo_url','website','phone','email','social_links','admission_info','tuition_info','tuition_as_of','registration_url','languages','study_modes','education_levels','accreditation_status','accrediting_body','operating_status','verification_status','verified_at','is_published'],
 medical_center:['stable_key','official_code','slug','name_ar','name_en','institution_type','ownership','operator_name','summary','governorate','city','district','address','latitude','longitude','map_url','logo_url','website','phone','emergency_phone','email','social_links','booking_url','emergency_available','operating_status','operating_status_as_of','verification_status','verified_at','facility_presence','care_level','access_status','building_status','equipment_status','is_published'],
};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Authorization'}});

async function readItem(db,kind,id){
 const config=definitions[kind];
 const {data,error}=await db.from(config.table).select(config.select).eq('id',id).maybeSingle();
 if(error)throw new RequestValidationError('تعذر تحميل أحدث بيانات العنصر.',503);
 if(!data)throw new RequestValidationError('العنصر غير موجود أو لا يحق لك تحريره.',404);
 return data;
}

async function execute(request,writing){
 try{
  const db=taskRequestDb(request);
  await authorizeEditorRequest(request,db);
  const params=new URL(request.url).searchParams;
  const body=writing?await readJsonObject(request,18000):null;
  const kind=writing?body.kind:params.get('kind');
  const id=inputId(writing?body.id:params.get('id'));
  const config=inputKind(kind);
  if(writing&&!Number.isSafeInteger(body.revision)&&kind!=='statistic')throw new RequestValidationError('رقم نسخة السجل مطلوب.');
  if(writing&&kind==='statistic'&&(typeof body.revision!=='string'||!Number.isFinite(Date.parse(body.revision))))throw new RequestValidationError('تاريخ نسخة المؤشر مطلوب.');
  const item=await readItem(db,kind,id);
  if(!writing)return json({item,revision:kind==='statistic'?item.updated_at:item.revision});
  if((kind==='statistic'?item.updated_at!==body.revision:item.revision!==body.revision))throw new RequestValidationError('تغيرت بيانات العنصر في جلسة أخرى. أعد تحميل أحدث نسخة.',409);
  const patch=normalizePatch(config,body.data);
  if(Object.entries(patch).every(([key,value])=>item[key]===value))return json({ok:true,item});
  if(kind==='statistic'){
   // This table already has editor UPDATE RLS. Both the verified role and the
   // exact previous version must match; never edit values, sources or years here.
   const {data,error}=await db.from('stat_indicators').update(patch).eq('id',id).eq('updated_at',body.revision).select(config.select).maybeSingle();
   if(error)throw new RequestValidationError('تعذر حفظ المؤشر عبر صلاحيات التحرير.',503);
   if(!data)throw new RequestValidationError('تغير المؤشر خلال الحفظ. أعد التحميل.',409);
   invalidateStatCatalog();
   return json({ok:true,item:data});
  }
  // The existing directory RPC enforces the editor role and revision atomically.
  // It expects all related arrays even when the quick editor does not touch
  // programs, medical services or evidence. Preserve every stored source field.
  const record=Object.fromEntries(recordFields[kind].map(key=>[key,Object.hasOwn(patch,key)?patch[key]:item[key]]));
  const relations=Object.fromEntries(Object.entries(config.relations).map(([arg,key])=>[arg,(item[key]||[]).map(row=>{
   const rest={...row};
   for(const field of ['id','university_id','medical_center_id'])delete rest[field];
   return rest;
  })]));
  const {data,error}=await db.rpc(config.rpc,{p_id:id,p_revision:body.revision,p_record:record,...relations,p_origin:'admin:directory'});
  if(error){
   if(error.code==='40001')throw new RequestValidationError('تغير هذا السجل خلال الحفظ. أعد التحميل قبل المحاولة.',409);
   if(error.code==='42501')throw new RequestValidationError('لا تملك صلاحية تعديل هذه المؤسسة.',403);
   throw new RequestValidationError('تعذر حفظ الملف. راجع المراجع والحقول أو افتح المحرر الكامل.',503);
  }
  if(!data?.id)throw new RequestValidationError('لم يؤكد الخادم نتيجة الحفظ. أعد التحميل قبل المحاولة.',503);
  invalidateDirectoryLists();
  return json({ok:true,item:data});
 }catch(error){
  return json({error:error instanceof RequestValidationError?error.message:'تعذر تنفيذ عملية التحرير. أعد تحميل الصفحة للتحقق.'},error instanceof RequestValidationError?error.status:503);
 }
}
export const GET=request=>execute(request,false);
export const POST=request=>execute(request,true);
