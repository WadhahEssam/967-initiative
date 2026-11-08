import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {PAGE_VISIBILITY_KEY,validatePageVisibility,resolvePageVisibility} from '@/lib/pageVisibility';
import {readPublicSetting,writeEditorialSetting} from '@/lib/publicSettingRepository';
import {invalidateSiteSettings} from '@/lib/data';

export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,save=false){
 try{
  const db=serverDb();const actor=await authorizeEditorRequest(request,db);
  if(!save){const saved=await readPublicSetting(db,PAGE_VISIBILITY_KEY);return json({sections:resolvePageVisibility(saved.value?[{key:PAGE_VISIBILITY_KEY,value:saved.value}]:[]),revision:saved.revision});}
  const body=await readJsonObject(request,12000);
  if(!Object.hasOwn(body,'revision'))throw new RequestValidationError('نسخة المحفوظ مطلوبة. أعد تحميل القائمة.');
  const sections=validatePageVisibility(body.sections);
  const result=await writeEditorialSetting(db,PAGE_VISIBILITY_KEY,{version:1,sections},body.revision,actor.user.id);
  invalidateSiteSettings();
  return json({ok:true,sections,revision:result.revision});
 }catch(error){return json({error:error instanceof RequestValidationError?error.message:'تعذر تنفيذ العملية حاليًا.'},error instanceof RequestValidationError?error.status:503);}
}
export const GET=request=>handle(request);
export const PUT=request=>handle(request,true);
