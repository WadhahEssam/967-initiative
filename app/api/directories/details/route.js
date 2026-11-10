import {getMedicalCenters,getUniversities} from '@/lib/data';
import {institutionDetailsMap} from '@/lib/institutionDirectories';
import {detailsResponse,versionedDetails} from '@/lib/deferredDetails';
export const dynamic='force-dynamic';
const directories={
 universities:{load:getUniversities,kind:'university'},
 'medical-centers':{load:getMedicalCenters,kind:'medical'},
};
// Summaries and programme or service details for /universities and /medical-centers, fetched
// after the page loads. A hidden section returns an empty list (the loaders check visibility).
export async function GET(request){
 const params=new URL(request.url).searchParams,directory=directories[params.get('kind')];
 if(!directory)return Response.json({error:'الدليل غير موجود.'},{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const items=await directory.load();
  return detailsResponse(versionedDetails(items,rows=>institutionDetailsMap(rows,directory.kind)),params.get('v'));
 }catch{return Response.json({error:'تعذر تحميل الدليل. حاول مجددًا.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
