import {publicDb} from '@/lib/supabase';
import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {readPublicMapProfiles} from '@/lib/mapProfileRepository';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 const gate=sectionStatus('atlas',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers});
 try{return Response.json({profiles:await readPublicMapProfiles(publicDb())},{headers});}
 catch{return Response.json({error:'تعذر تحميل معلومات الأماكن الموسعة. حاول مجددًا.'},{status:503,headers});}
}
