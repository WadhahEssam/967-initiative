import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {readContentCatalog,writeContentPage} from '@/lib/contentPageRepository';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {invalidateSiteSettings} from '@/lib/data';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,action){
 try{
  const db=serverDb(),auth=await authorizeEditorRequest(request,db);
  if(!action)return json({...await readContentCatalog(db),canDelete:auth.role==='management'});
  if(action==='delete'&&auth.role!=='management')throw new RequestValidationError('حذف الصفحات متاح لحساب الإدارة فقط.',403);
  const body=await readJsonObject(request,120000);
  if(!Object.hasOwn(body,'revision'))throw new RequestValidationError('نسخة الصفحات مطلوبة للحفظ. أعد تحميل القائمة.');
  const result=await writeContentPage(db,{action,input:action==='delete'?{id:body.id}:body.page,revision:body.revision,role:auth.role,actorId:auth.user.id});
  invalidateSiteSettings();
  return json({ok:true,...result,canDelete:auth.role==='management'},action==='create'?201:200);
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('content pages service:',error?.code||error?.name||'service');
  return json({error:'تعذر تنفيذ العملية حاليًا. أعد تحميل القائمة قبل المحاولة.'},503);
 }
}
export const GET=request=>handle(request);
export const POST=request=>handle(request,'create');
export const PUT=request=>handle(request,'update');
export const DELETE=request=>handle(request,'delete');
