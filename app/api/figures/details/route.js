import {getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {figureDetailsMap,toFigureDirectoryCard} from '@/lib/yemeniFigures';
import {detailsResponse,versionedDetails} from '@/lib/deferredDetails';
export const dynamic='force-dynamic';
// Card text, photos and links for /yemeni-figures, fetched after the page loads.
export async function GET(request){
 const headers={'Cache-Control':'no-store'};
 const gate=sectionStatus('figures',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers});
 try{
  const figures=await getYemeniFigures();
  return detailsResponse(versionedDetails(figures,rows=>figureDetailsMap(rows.map(toFigureDirectoryCard))),new URL(request.url).searchParams.get('v'));
 }catch{return Response.json({error:'تعذر تحميل دليل الشخصيات. حاول مجددًا.'},{status:503,headers});}
}
