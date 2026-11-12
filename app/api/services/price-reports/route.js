import {NextResponse} from 'next/server';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {submitPriceReport} from '@/lib/priceReportsServer';

// «المُبلّغ المحلي»: a member reports a price («السعر مختلف») or confirms the one shown
// («السعر صحيح»). Everything is decided in lib/priceReportsServer.js.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'3600'}:{})}});
export async function POST(request){
 try{
  const body=await readJsonObject(request,4000);
  const {status,body:answer}=await submitPriceReport(request,body);
  return json(answer,status);
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('price report:',error?.code||error?.name||'service');
  return json({error:'تعذر الإرسال الآن. حاول بعد قليل.'},503);
 }
}
