import {getSiteSettings,getStatIndicators} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {indicatorCardDetailsMap,indicatorListItem} from '@/lib/yemenNumbers';
import {detailsResponse,versionedDetails} from '@/lib/deferredDetails';
export const dynamic='force-dynamic';
// Latest values, sources and trend lines for the /yemen-in-numbers cards, fetched after the page loads.
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 const gate=sectionStatus('statistics',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers});
 try{
  const indicators=await getStatIndicators();
  return detailsResponse(versionedDetails(indicators,rows=>indicatorCardDetailsMap(rows.map(indicatorListItem))),new URL(request.url).searchParams.get('v'));
 }catch{return Response.json({error:'تعذر تحميل المؤشرات. حاول مجددًا.'},{status:503,headers});}
}
