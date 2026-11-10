import 'server-only';
import {createMemo} from './serverMemo.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {authorizeEditorRequest} from './adminAuthorization.js';
import {RequestValidationError} from './requestSecurity.js';
import {addAccess,hasAccess,listAccess,removeAccess} from './accessLists.js';
import {validateGuide} from './transactionGuides.js';

const COLUMNS='id,slug,title,summary,audience,category,status,variants,sources,verified_at,verified_by,editor_note,updated_at,published_at';
const missingTable=error=>['42P01','PGRST205'].includes(error?.code);

export const guideFromRow=row=>row&&({
 id:row.id,slug:row.slug,title:row.title,summary:row.summary||'',audience:row.audience||'',category:row.category,status:row.status,
 variants:row.variants||{},sources:row.sources||[],verifiedAt:row.verified_at||null,verifiedBy:row.verified_by||'',
 editorNote:row.editor_note||'',updatedAt:row.updated_at,publishedAt:row.published_at,
});
// Visitors never see the editors' note or who checked by name.
const publicGuide=guide=>{const {editorNote:_note,verifiedBy:_by,...rest}=guide;return rest;};

// Published guides, read at most once a minute however many people visit; a save clears it.
const publishedMemo=createMemo({ttlMs:60e3,staleMs:60*60e3});
export function getPublishedGuides(db){
 return publishedMemo(async()=>{
  if(!db)return [];
  const {data,error}=await db.from('transaction_guides').select(COLUMNS).eq('status','published').order('title');
  if(missingTable(error))return [];
  if(error){recordOperationalEvent('database_failure',{source:'transaction_guides'});throw Error('تعذر تحميل دليل المعاملات.');}
  return (data||[]).map(row=>publicGuide(guideFromRow(row)));
 });
}
export async function getPublishedGuide(db,slug){
 return (await getPublishedGuides(db)).find(guide=>guide.slug===slug)||null;
}
export const invalidatePublishedGuides=()=>publishedMemo.clear();

// Editors, and the people management added as guide editors, may write and check guides.
export async function authorizeGuidesRequest(request,db){
 const auth=await authorizeEditorRequest(request,db,{allowMember:true});
 if(auth.role)return {...auth,guideEditor:false};
 if(!await hasAccess(db,'transaction_guide_editors',auth.user.id))throw new RequestValidationError('تحرير دليل المعاملات متاح لمن أضافته الإدارة فقط.',403);
 return {...auth,guideEditor:true};
}

export async function listGuidesForEditor(db){
 const {data,error}=await db.from('transaction_guides').select(COLUMNS).order('updated_at',{ascending:false});
 if(error)throw missingTable(error)?new RequestValidationError('جدول دليل المعاملات غير مُنشأ بعد.',503):Error('guides');
 return (data||[]).map(guideFromRow);
}

// Creates a guide (no id) or updates one. Nothing is deleted: unpublishing moves it back to draft.
export async function saveGuide(db,{id,input,actorId}){
 const guide=validateGuide(input);
 const row={slug:guide.slug,title:guide.title,summary:guide.summary,audience:guide.audience,category:guide.category,status:guide.status,
  variants:guide.variants,sources:guide.sources,verified_at:guide.verifiedAt,verified_by:guide.verifiedBy||null,editor_note:guide.editorNote||null,
  updated_by:actorId,updated_at:new Date().toISOString()};
 let result;
 if(id){
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new RequestValidationError('معرّف الدليل غير صالح.');
  const {data:before}=await db.from('transaction_guides').select('published_at').eq('id',id).maybeSingle();
  if(!before)throw new RequestValidationError('لم يُعثر على الدليل.',404);
  if(guide.status==='published'&&!before.published_at)row.published_at=row.updated_at;
  result=await db.from('transaction_guides').update(row).eq('id',id).select(COLUMNS).single();
 }else{
  if(guide.status==='published')row.published_at=row.updated_at;
  result=await db.from('transaction_guides').insert({...row,created_by:actorId}).select(COLUMNS).single();
 }
 if(result.error?.code==='23505')throw new RequestValidationError('الرابط المختصر «'+guide.slug+'» مستخدم لدليل آخر.',409);
 if(result.error){recordOperationalEvent('database_failure',{source:'transaction_guides'});throw Error('تعذر حفظ الدليل.');}
 invalidatePublishedGuides();
 return guideFromRow(result.data);
}

export const listGuideEditors=db=>listAccess(db,'transaction_guide_editors');
export const addGuideEditor=(db,input)=>addAccess(db,'transaction_guide_editors',input);
export const removeGuideEditor=(db,input)=>removeAccess(db,'transaction_guide_editors',input);
