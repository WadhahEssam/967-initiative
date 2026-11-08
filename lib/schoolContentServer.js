import 'server-only';
import {schoolStaffPreview} from './schoolStageAccess.js';
import {SCHOOL_COURSES} from './schoolCatalog.js';
import {RequestValidationError} from './requestSecurity.js';
import {createVersionedMemo} from './serverMemo.js';
import {SCHOOL_SLUG,SCHOOL_FIXED_SLUGS,validateSchoolEditorial,chooseSchoolQuestions} from './schoolContent.js';
const error=(message,status=400)=>{throw new RequestValidationError(message,status);};
export async function requireSchoolEditor(db,user){
 if(!db||!user?.id||!(await schoolStaffPreview(db,user)))error('إدارة المدرسة متاحة للمحررين المخولين فقط.',403);
}
const table={course:'school_editor_courses',stage:'school_editor_stages',question:'school_editor_questions'};
const validateLocation=(kind,slug,stageIndex,id)=>{
 if(!table[kind]||!SCHOOL_SLUG.test(slug))error('مسار غير صالح.');
 if(kind!=='course'&&(!Number.isInteger(stageIndex)||stageIndex<0||stageIndex>11))error('المحطة غير صالحة.');
 if(kind==='question'&&(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))error('معرف السؤال غير صالح.');
};
function recordQuery(db,kind,slug,stageIndex,id){
 let q=db.from(table[kind]).select('*').eq(kind==='course'?'slug':'course_slug',slug);
 if(kind!=='course')q=q.eq('stage_index',stageIndex);
 if(kind==='question')q=q.eq('id',id);
 return q;
}
export async function schoolStudioOverview(db,user){
 await requireSchoolEditor(db,user);
 const result=await Promise.all([
  db.from(table.course).select('*').order('slug'),
  db.from(table.stage).select('*').order('course_slug').order('stage_index'),
  db.from(table.question).select('*').order('course_slug').order('stage_index').order('created_at'),
  db.from('school_editor_audit').select('id,actor_id,entity,entity_key,action,changed_at').order('changed_at',{ascending:false}).limit(60)
 ]);
 if(result.some(x=>x.error))error('تعذر تحميل محتوى المدرسة.',503);
 return {courses:result[0].data||[],stages:result[1].data||[],questions:result[2].data||[],audit:result[3].data||[],
  builtIn:SCHOOL_COURSES.map(c=>({slug:c.slug,stages:c.stages.map(s=>({
   index:s.index,title:s.title,subtitle:s.subtitle,intro:s.intro,tips:s.tips||[]
  }))}))};
}
export async function saveSchoolContent(db,user,body){
 await requireSchoolEditor(db,user);
 const {kind,action,slug,stageIndex,id,version}=body||{};
 validateLocation(kind,slug,stageIndex,id);
 if(!['save','publish'].includes(action))error('إجراء غير معروف.');
 if(!Number.isInteger(version)||version<0||version>9999999)error('رقم النسخة غير صالح.');
 const {data:current,error:loadError}=await recordQuery(db,kind,slug,stageIndex,id).maybeSingle();
 if(loadError)error('تعذر تحميل المسودة.',503);
 const isNew=!current;
 if(action==='save'){
  let doc;try{doc=validateSchoolEditorial(kind,body.draft);}catch(e){error(e.message);}
  if(isNew){
   if(version!==0)error('حدّث المحتوى أولًا.',409);
   if(kind!=='course'){
    const {data:parent}=await db.from(table.course).select('slug').eq('slug',slug).maybeSingle();
    if(!parent)error('أنشئ المسار أولًا.');
   }
   if(kind==='question'){
    const {data:parent}=await db.from(table.stage).select('stage_index').eq('course_slug',slug).eq('stage_index',stageIndex).maybeSingle();
    if(!parent)error('أنشئ المحطة أولًا.');
   }
   const row={draft:doc,updated_by:user.id};
   if(kind==='course')row.slug=slug;
   else{row.course_slug=slug;row.stage_index=stageIndex;if(kind==='question')row.id=id;}
   const {data:saved,error:writeError}=await db.from(table[kind]).insert(row).select('version').single();
   if(writeError?.code==='23505')error('العنصر موجود بالفعل؛ حدّث الصفحة.',409);
   if(writeError||!saved)error('تعذر إنشاء المسودة.',503);
   return {version:saved.version,action:'created'};
  }
  if(current.version!==version)error('قام محرر آخر بتعديل المحتوى؛ حدّث الصفحة.',409);
  const {data:saved,error:writeError}=await db.from(table[kind])
   .update({draft:doc,version:version+1,updated_by:user.id,updated_at:new Date().toISOString()})
   .eq(kind==='course'?'slug':kind==='stage'?'stage_index':'id',kind==='course'?slug:kind==='stage'?stageIndex:id)
   .eq(kind==='course'?'slug':'course_slug',slug).eq('version',version)
   .select('version').maybeSingle();
  if(writeError)error('تعذر حفظ المسودة.',503);
  if(!saved)error('تغيّرت النسخة؛ حدّث الصفحة.',409);
  return {version:saved.version,action:'saved'};
 }
 if(isNew)error('احفظ مسودة أولًا.',404);
 if(current.version!==version)error('تغيّرت النسخة؛ حدّث الصفحة.',409);
 if(kind==='stage'&&!SCHOOL_FIXED_SLUGS.includes(slug)){
  // Only card lessons can be played since phase 8, so an old-format stage cannot be published.
  if(current.draft?.format!==2)error('انشر المحطة بصيغة البطاقات: حوّلها إلى درس بطاقات أولًا.');
  if(stageIndex>0){
   const {data:previous,error:priorError}=await db.from(table.stage).select('published')
    .eq('course_slug',slug).eq('stage_index',stageIndex-1).maybeSingle();
   if(priorError)error('تعذر التحقق من ترتيب المحطات.',503);
   if(!previous?.published)error('انشر المحطة السابقة أولًا.');
  }
 }
 if(kind==='course'&&!SCHOOL_FIXED_SLUGS.includes(slug)){
  const {count,error:countError}=await db.from(table.stage).select('stage_index',{head:true,count:'exact'})
   .eq('course_slug',slug).not('published','is',null);
  if(countError)error('تعذر فحص المحطات.',503);
  if(count<1)error('انشر محطة واحدة على الأقل قبل نشر المسار.');
  const {data:first,error:firstError}=await db.from(table.stage).select('published')
   .eq('course_slug',slug).eq('stage_index',0).maybeSingle();
  if(firstError)error('تعذر فحص المحطة الأولى.',503);
  if(!first?.published)error('انشر المحطة الأولى قبل نشر المسار.');
 }
 let query=db.from(table[kind]).update({published:current.draft,published_version:current.version,updated_by:user.id,updated_at:new Date().toISOString()})
   .eq(kind==='course'?'slug':'course_slug',slug).eq('version',version);
 if(kind!=='course')query=query.eq('stage_index',stageIndex);
 if(kind==='question')query=query.eq('id',id);
 const {data:saved,error:writeError}=await query.select('published_version').maybeSingle();
 if(writeError)error('تعذر نشر المحتوى.',503);
 if(!saved)error('تغيّرت النسخة؛ حدّث الصفحة.',409);
 invalidatePublishedSchoolContent();
 return {version,action:'published'};
}
// Published school content (15 courses, 180 lessons, about 1.4 MB) changes only when something is
// published, yet the dashboard read every lesson on each call (the home page asks for it for every
// signed-in visitor) and every course, lesson and hub page read whole courses. It is now kept in
// memory: every 60 s a tiny query (published-row counts and latest updated_at of both tables)
// decides whether to read it again, and it is read again at least every 30 minutes. Publishing in
// the studio clears it at once; the publish script and drafts touch updated_at, so they show within
// a minute. If Supabase fails, the last copy is served for up to an hour.
// Callers get copies, so a page that adds data to a lesson cannot change the cache.
const publishedContentMemo=createVersionedMemo({checkMs:60*1000,maxAgeMs:30*60*1000,staleMs:60*60*1000});
export function invalidatePublishedSchoolContent(){publishedContentMemo.clear();}
async function publishedContentVersion(db){
 const latest=name=>db.from(table[name]).select('updated_at',{count:'exact'}).not('published','is',null).order('updated_at',{ascending:false}).limit(1);
 const [courses,stages]=await Promise.all([latest('course'),latest('stage')]);
 if(courses.error||stages.error)error('تعذر تحميل المسارات.',503);
 return courses.count+'@'+(courses.data?.[0]?.updated_at||'')+'|'+stages.count+'@'+(stages.data?.[0]?.updated_at||'');
}
async function loadPublishedContent(db){
 const version=await publishedContentVersion(db);
 const [courses,stages]=await Promise.all([
  db.from(table.course).select('slug,published').not('published','is',null).order('slug'),
  db.from(table.stage).select('course_slug,stage_index,published').not('published','is',null).order('course_slug').order('stage_index').limit(2000),
 ]);
 if(courses.error)error('تعذر عرض المسارات.',503);
 if(stages.error)error('تعذر تحميل المحطات.',503);
 const bySlug={};
 for(const row of stages.data||[])(bySlug[row.course_slug]||=[]).push({index:row.stage_index,...row.published});
 return {value:{catalog:(courses.data||[]).map(x=>({slug:x.slug,...x.published})),stages:bySlug},version};
}
const publishedContent=db=>publishedContentMemo({version:()=>publishedContentVersion(db),load:()=>loadPublishedContent(db)});
export async function publishedSchoolCatalog(db){
 return structuredClone((await publishedContent(db)).catalog);
}
export async function publishedSchoolStage(db,slug,index){
 const stage=(await publishedContent(db)).stages[slug]?.find(x=>x.index===index);
 if(!stage)return null;
 const {index:_index,...published}=stage;
 return structuredClone(published);
}
export async function publishedSchoolStages(db,slug){
 return structuredClone((await publishedContent(db)).stages[slug]||[]);
}
// Lesson list without lesson content: what maps, hubs and the dashboard show.
export async function publishedSchoolStageList(db,slug){
 return ((await publishedContent(db)).stages[slug]||[]).map(s=>({index:s.index,title:s.title,subtitle:s.subtitle||'',format:s.format===2?2:1,template:s.template||null,minutes:Number.isInteger(s.minutes)?s.minutes:null}));
}
export async function publishedSchoolBank(db,slug,index,attemptNo,fallback=null){
 const {data,error:loadError}=await db.from(table.question).select('id,published')
  .eq('course_slug',slug).eq('stage_index',index).not('published','is',null).order('created_at').limit(200);
 if(loadError)error('تعذر تحميل الأسئلة.',503);
 if((data||[]).length<6){
  if(fallback)return fallback();
  error('المحطة تحتاج ستة أسئلة منشورة.',503);
 }
 const bank=chooseSchoolQuestions(data,attemptNo);
 if(!fallback)return bank;
 // Preserve the original hands-on Musnad composition and Arud scansion.
 // Editorial choices replace only multiple-choice questions in legacy courses.
 const original=fallback();
 let next=0;
 return original.map(question=>question.kind==='choice'?bank[(next++)%bank.length]:question);
}
