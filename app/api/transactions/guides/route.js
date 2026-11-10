import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {authorizeGuidesRequest,listGuidesForEditor,saveGuide} from '@/lib/transactionGuidesServer';

// Writing and checking the transaction guides: editors and the guide editors added by management.
// It works while the section is hidden, so guides can be written and checked before launch.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,action){
 try{
  const db=serverDb();
  const auth=await authorizeGuidesRequest(request,db);
  if(action==='list')return json({guides:await listGuidesForEditor(db),role:auth.role||'guideEditor'});
  const body=await readJsonObject(request,120000);
  const guide=await saveGuide(db,{id:action==='update'?body.id:null,input:body.guide,actorId:auth.user.id});
  return json({ok:true,guide});
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('transaction guides:',error?.code||error?.name||'service');
  return json({error:error?.message&&/[؀-ۿ]/.test(error.message)?error.message:'تعذر إتمام العملية. لم يُحفظ الدليل.'},503);
 }
}
export const GET=request=>handle(request,'list');
export const POST=request=>handle(request,'create');
export const PATCH=request=>handle(request,'update');
