import {serverDb} from '@/lib/supabase-server';
import {isSameOrigin,readJsonObject,RequestValidationError} from '@/lib/requestSecurity';
import {analyticsOriginAllowed} from '@/lib/siteAnalytics';
import {collectEvent} from '@/lib/siteStats';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
let windowStarted=Date.now(),counter=0;

// «إحصاءات الموقع»: page views, visible time and «on the site now» pings from our own tracker
// (components/analytics/SiteStatsTracker.jsx). The user agent is read here for the device
// category and bot check, then dropped; the IP address is never read.
function allowRequest(){
 const now=Date.now();
 if(now-windowStarted>60000){windowStarted=now;counter=0;}
 return ++counter<=900;
}
export async function POST(request){
 if(!analyticsOriginAllowed(request,isSameOrigin))return new Response(null,{status:403,headers:noStore});
 const site=request.headers.get('sec-fetch-site');
 if(site&&site!=='same-origin'&&site!=='none')return new Response(null,{status:403,headers:noStore});
 if(!request.headers.get('origin')&&site!=='same-origin')return new Response(null,{status:403,headers:noStore});
 if(!allowRequest())return new Response(null,{status:429,headers:noStore});
 try{
  const body=await readJsonObject(request,1200);
  const call=collectEvent(body,{agent:request.headers.get('user-agent')||'',siteHost:request.headers.get('x-forwarded-host')||request.headers.get('host')||''});
  // Ignored (bot, excluded page, malformed): answer 204 so the browser does not retry.
  if(!call)return new Response(null,{status:204,headers:noStore});
  const db=serverDb();
  if(!db)return new Response(null,{status:503,headers:noStore});
  const {error}=await db.rpc(call.fn,call.args);
  if(error){console.error('Site stats unavailable',call.fn,error.code||'database');return new Response(null,{status:503,headers:noStore});}
  return new Response(null,{status:204,headers:noStore});
 }catch(error){
  return new Response(null,{status:error instanceof RequestValidationError?error.status:503,headers:noStore});
 }
}
