import {handleDebateRequest} from '@/lib/debateApi';
import {taskRequestDb} from '@/lib/taskServer';
import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request){
 const gate=sectionStatus('debates',await getSiteSettings());
 if(gate!=='visible')return Response.json({error:gate==='hidden'?'القسم غير متاح حاليًا.':'تعذر التحقق من إتاحة القسم مؤقتًا. حاول بعد قليل.'},{status:gate==='hidden'?404:503,headers:{'Cache-Control':'no-store'}});
 return handleDebateRequest(request,taskRequestDb);
}
export const GET=handle;
export const POST=handle;
