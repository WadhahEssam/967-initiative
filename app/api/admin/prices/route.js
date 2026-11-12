import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {authorizePriceEditor,readPriceModeration,readReporter,recomputeByEditor,resolveAlert,reviewReport,searchReporters,updateReporter} from '@/lib/priceModerationServer';

// «المُبلّغ المحلي», editors only: GET the workspace (or ?q= to search reporters, ?reporter= for one);
// POST an action. Every action is logged in price_moderation_log.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 try{
  const db=serverDb();
  await authorizePriceEditor(request,db);
  const params=new URL(request.url).searchParams;
  if(params.has('q'))return json(await searchReporters(db,params.get('q')));
  if(params.has('reporter'))return json(await readReporter(db,params.get('reporter')));
  return json(await readPriceModeration(db));
 }catch(error){return failure(error);}
}
export async function POST(request){
 try{
  const db=serverDb();
  const {user}=await authorizePriceEditor(request,db);
  const body=await readJsonObject(request,2000);
  const note=typeof body.note==='string'?body.note.trim().slice(0,300)||null:null;
  if(body.action==='review')return json(await reviewReport(db,{reportId:body.reportId,review:body.review??null,note,actorId:user.id}));
  if(body.action==='reporter')return json(await updateReporter(db,{userId:body.userId,action:body.change,anchorName:body.anchorName,note,actorId:user.id}));
  if(body.action==='resolve')return json(await resolveAlert(db,{alertId:body.alertId,note,actorId:user.id}));
  if(body.action==='recompute')return json(await recomputeByEditor(db,{kind:body.kind,reset:body.reset,actorId:user.id}));
  throw new RequestValidationError('الإجراء غير معروف.');
 }catch(error){return failure(error);}
}
function failure(error){
 if(error instanceof RequestValidationError)return json({error:error.message},error.status);
 console.error('price moderation:',error?.code||error?.name||'service');
 return json({error:error?.message&&/[؀-ۿ]/.test(error.message)?error.message:'تعذر إتمام العملية.'},503);
}
