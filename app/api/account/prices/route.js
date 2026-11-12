import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {authorizeAudience} from '@/lib/debateApi';
import {RequestValidationError} from '@/lib/requestSecurity';
import {readMyPrices} from '@/lib/priceIncentivesServer';

// «مساهماتي في الأسعار»: a signed-in member's own reporting record. While «الخدمات» is hidden,
// editors only. Answers carry no score, no report grades or statuses, and no ban.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization'}});
export async function GET(request){
 try{
  const db=serverDb();
  const user=await authorizeAudience(request,db);
  const status=sectionStatus('services',await getSiteSettings());
  if(status==='unavailable')throw new RequestValidationError('تعذر التحميل مؤقتًا. حاول بعد قليل.',503);
  if(status==='hidden'){
   const {data,error}=await db.from('editors').select('role').eq('user_id',user.id).maybeSingle();
   if(error||!['admin','management'].includes(data?.role))throw new RequestValidationError('هذه الصفحة غير متاحة حاليًا.',404);
  }
  return json(await readMyPrices(db,user.id));
 }catch(error){
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('account prices:',error?.code||error?.name||'service');
  return json({error:'تعذر تحميل مساهماتك الآن.'},503);
 }
}
