import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {addGuideEditor,listGuideEditors,removeGuideEditor} from '@/lib/transactionGuidesServer';

// Management decides who may write and check transaction guides without being an editor.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,action){
 try{
  const db=serverDb();
  const auth=await authorizeEditorRequest(request,db);
  if(action==='list')return json({editors:await listGuideEditors(db),canManage:auth.role==='management'});
  if(auth.role!=='management')throw new RequestValidationError('إدارة محرري دليل المعاملات متاحة لحسابات الإدارة فقط.',403);
  const body=await readJsonObject(request,2000);
  if(action==='add')return json({ok:true,...await addGuideEditor(db,{email:body.email,actorId:auth.user.id})});
  return json({ok:true,...await removeGuideEditor(db,{userId:body.userId})});
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('transaction guide editors:',error?.code||error?.name||'service');
  return json({error:'تعذر إتمام العملية.'},503);
 }
}
export const GET=request=>handle(request,'list');
export const POST=request=>handle(request,'add');
export const DELETE=request=>handle(request,'remove');
