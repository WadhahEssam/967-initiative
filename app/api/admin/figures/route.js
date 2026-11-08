import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {fetchAllRows} from '@/lib/pagination';
import {readFigureProfile,saveFigureProfile,deleteFigureProfile} from '@/lib/figureProfileRepository';
import {invalidateDirectoryLists} from '@/lib/data';
import {emptyFigureProfile} from '@/lib/figureProfiles';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,method){
 try{
  const db=serverDb(),auth=await authorizeEditorRequest(request,db);
  if(method==='GET'){
   const id=new URL(request.url).searchParams.get('id');
   if(id){if(!/^[0-9a-f-]{36}$/i.test(id))throw new RequestValidationError('معرّف الشخصية غير صالح.');const {data:record,error}=await db.from('yemeni_figures').select('*').eq('id',id).maybeSingle();if(error)throw new RequestValidationError('تعذر تحميل الشخصية.',503);if(!record)throw new RequestValidationError('الشخصية غير موجودة.',404);return json({record,profile:await readFigureProfile(db,record)||emptyFigureProfile(),revision:record.updated_at});}
   const records=await fetchAllRows(()=>db.from('yemeni_figures').select('id,slug,full_name,known_for,field,governorate_id,governorate_name,era,birth_year,death_year,display_order,is_published,updated_at',{count:'exact'}).order('display_order').order('id'));
   return json({records,canDelete:auth.role==='management'});
  }
  const body=await readJsonObject(request,700000);
  if(!Object.hasOwn(body,'revision'))throw new RequestValidationError('نسخة الشخصية مطلوبة.');
  if(method==='DELETE'){const result=await deleteFigureProfile(db,{id:body.id,revision:body.revision,role:auth.role,actorId:auth.user.id});invalidateDirectoryLists();return json(result);}
  if(method==='PUT'&&!body.record?.id)throw new RequestValidationError('معرّف الشخصية مطلوب للتعديل.');
  if(method==='POST'&&body.record?.id)throw new RequestValidationError('طلب إنشاء الشخصية غير صالح.');
  const saved=await saveFigureProfile(db,{...body,role:auth.role,actorId:auth.user.id});invalidateDirectoryLists();
  return json(saved,method==='POST'?201:200);
 }catch(error){if(error instanceof RequestValidationError)return json({error:error.message},error.status);console.error('figure profile service:',error?.code||error?.name||'service');return json({error:'تعذر تنفيذ العملية حاليًا. أعد تحميل المحفوظ قبل المحاولة.'},503);}
}
export const GET=request=>handle(request,'GET');export const POST=request=>handle(request,'POST');export const PUT=request=>handle(request,'PUT');export const DELETE=request=>handle(request,'DELETE');
