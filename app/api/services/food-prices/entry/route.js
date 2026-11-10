import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {authorizeRatesRequest} from '@/lib/exchangeRatesServer';
import {readFoodWorkspace,saveFoodPrices,setFoodBatchHidden} from '@/lib/foodPricesServer';

// Weekly staple prices entry: editors and the price reporters added by management (the same
// people as for exchange rates). It works while the page is still hidden, so the first prices
// can be in place before launch.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request,action){
 try{
  const db=serverDb();
  const auth=await authorizeRatesRequest(request,db);
  if(action==='read')return json({...await readFoodWorkspace(db),role:auth.role||'reporter'});
  const body=await readJsonObject(request,16000);
  if(action==='save')return json({ok:true,...await saveFoodPrices(db,{input:body,actorId:auth.user.id})});
  return json({ok:true,...await setFoodBatchHidden(db,{batchId:body.batchId,hidden:body.hidden===true,actorId:auth.user.id})});
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message,...(error.moves?{moves:error.moves}:{})},error.status);
  console.error('food prices entry:',error?.code||error?.name||'service');
  return json({error:error?.message&&/[؀-ۿ]/.test(error.message)?error.message:'تعذر إتمام العملية. لم تُحفظ الأسعار.'},503);
 }
}
export const GET=request=>handle(request,'read');
export const POST=request=>handle(request,'save');
export const PATCH=request=>handle(request,'hide');
