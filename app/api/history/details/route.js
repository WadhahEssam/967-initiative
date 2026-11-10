import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {historyDetailsMap} from '@/lib/yemenHistory';
import {detailsResponse,versionedDetails} from '@/lib/deferredDetails';
export const dynamic='force-dynamic';
// Summaries, list photos and comparison data for /yemen-history, fetched after the page loads.
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 const gate=sectionStatus('history',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers});
 try{
  const catalog=await readPublicHistoryCatalog(serverDb());
  return detailsResponse(versionedDetails(catalog.entries,historyDetailsMap),new URL(request.url).searchParams.get('v'));
 }catch{return Response.json({error:'تعذر تحميل تاريخ اليمن. حاول مجددًا.'},{status:503,headers});}
}
