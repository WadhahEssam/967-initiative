import {getIssue} from '@/lib/data';
import {serverDb} from '@/lib/supabase-server';
import {safeExternalUrl} from '@/lib/media';
import {isBotAgent} from '@/lib/issueDownloads';
import {createHash} from 'node:crypto';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// One count per visitor and issue every 6 hours, so reloading the link does not inflate it.
// The visitor key is a hash of the address; it is kept in memory only.
const WINDOW=6*60*60*1000,seen=new Map();
function firstTime(key,now=Date.now()){
 if(seen.size>20000)for(const [k,at] of seen)if(now-at>WINDOW)seen.delete(k);
 const at=seen.get(key);
 if(at&&now-at<WINDOW)return false;
 seen.set(key,now);return true;
}

export async function GET(request,{params}){
 const {slug}=await params;
 const issue=await getIssue(slug).catch(()=>null);
 const target=issue&&!issue.is_demo?safeExternalUrl(issue.pdf_url):null;
 if(!target)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const address=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim()||request.headers.get('x-real-ip')||'';
 const key=createHash('sha256').update(address+'|'+issue.id).digest('hex').slice(0,32);
 if(!isBotAgent(request.headers.get('user-agent'))&&firstTime(key)){
  // Counting never blocks or breaks the download.
  await serverDb()?.rpc('count_issue_download',{p_issue:issue.id}).then(()=>null,()=>null);
 }
 return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
