import {NextResponse} from 'next/server';
import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {RequestValidationError} from '@/lib/requestSecurity';
import {countersBetween,schoolLearningOverview} from '@/lib/siteAnalytics';
import {statsRange} from '@/lib/siteStats';
import {schoolStudioAnalytics} from '@/lib/schoolStudioAnalytics';
import {SCHOOL_COURSES} from '@/lib/schoolCatalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Authorization','X-Robots-Tag':'noindex, nofollow'}});
const rpc=async(db,fn,args)=>{const {data,error}=await db.rpc(fn,args);if(error)throw new RequestValidationError('تعذر تحميل الإحصاءات.',503);return data;};

// «إحصاءات الموقع» (owner, 2026-11-11): one page for the management role only.
export async function GET(request){
 try{
  const db=serverDb();
  const actor=await authorizeEditorRequest(request,db);
  if(actor.role!=='management')throw new RequestValidationError('إحصاءات الموقع متاحة لحسابات الإدارة فقط.',403);
  const params=new URL(request.url).searchParams;
  // «Now» refreshes every minute on its own.
  if(params.get('live')==='1')return respond({live:await rpc(db,'analytics_live')});
  const range=statsRange(params.get('range')||'7d');
  if(!range)throw new RequestValidationError('اختر فترة عرض صالحة.');
  const [stats,previous,live,accounts,traffic,attempts,catalog]=await Promise.all([
   rpc(db,'analytics_report',{p_from:range.from,p_to:range.to}),
   rpc(db,'analytics_report',{p_from:range.previous.from,p_to:range.previous.to}),
   rpc(db,'analytics_live'),
   rpc(db,'analytics_accounts',{p_from:range.from,p_to:range.to}),
   db.from('site_usage_daily').select('day,metric,section,total').order('day',{ascending:true}).limit(5000),
   db.from('school_stage_attempts')
    .select('user_id,course_slug,stage_index,status,score,questions,submission')
    .in('status',['passed','failed']).order('submitted_at',{ascending:false}).limit(3000),
   db.from('school_editor_courses').select('slug,published').not('published','is',null).limit(200)
  ]);
  if(traffic.error||attempts.error||catalog.error)throw new RequestValidationError('تعذر تحميل الإحصاءات.',503);
  // Hide results based on small student groups and never return user IDs,
  // answers, original question banks or individual attempts to the browser.
  const rows=attempts.data||[];
  const learning=schoolLearningOverview(rows);
  const courseNames=Object.fromEntries([
   ...SCHOOL_COURSES.map(item=>[item.slug,item.title]),
   ...(catalog.data||[]).filter(x=>typeof x?.published?.title==='string').map(x=>[x.slug,x.published.title.slice(0,100)])
  ]);
  const q=schoolStudioAnalytics(rows,3000,5).questions.slice(0,12)
   .map(({course,stage,prompt,asked,wrong,wrongRate})=>({
    course,stage,prompt:String(prompt||'').slice(0,160),asked,wrong,wrongRate
   }));
  return respond({
   range,stats,previous:previous.totals,live,accounts,
   // site_usage_daily counts UTC days; close enough for these daily counters.
   counters:countersBetween(traffic.data||[],range.from,range.to),
   school:{...learning,courseNames,questions:q},
  });
 }catch(error){
  if(error instanceof RequestValidationError)return respond({error:error.message},error.status);
  console.error('Admin analytics error',error?.name||'unknown');
  return respond({error:'تعذر تحميل الإحصاءات.'},503);
 }
}
