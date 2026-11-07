import {getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {toFigureDirectoryCard} from '@/lib/yemeniFigures';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 const gate=sectionStatus('figures',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers});
 try{return Response.json({figures:(await getYemeniFigures()).map(toFigureDirectoryCard)},{headers});}
 catch{return Response.json({error:'تعذر تحميل دليل الشخصيات. حاول مجددًا.'},{status:503,headers});}
}
