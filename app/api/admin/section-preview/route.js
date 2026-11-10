import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {isSameOrigin,RequestValidationError} from '@/lib/requestSecurity';
import {PREVIEW_COOKIE,PREVIEW_HOURS,signPreview} from '@/lib/sectionPreview';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const cookie=(value,maxAge)=>PREVIEW_COOKIE+'='+value+'; Path=/; Max-Age='+maxAge+'; HttpOnly; SameSite=Lax'+(process.env.NODE_ENV==='production'?'; Secure':'');

// POST: an editor opens hidden sections in this browser for 12 hours. DELETE: stop previewing.
export async function POST(request){
 try{
  const {user}=await authorizeEditorRequest(request,serverDb());
  const token=signPreview(user.id);
  if(!token)return Response.json({error:'المعاينة غير مفعّلة على هذا الخادم.'},{status:503,headers});
  return Response.json({ok:true,hours:PREVIEW_HOURS},{headers:{...headers,'Set-Cookie':cookie(token,PREVIEW_HOURS*3600)}});
 }catch(error){
  if(error instanceof RequestValidationError)return Response.json({error:error.message},{status:error.status,headers});
  return Response.json({error:'تعذر بدء المعاينة. حاول مجددًا.'},{status:503,headers});
 }
}
export async function DELETE(request){
 if(!isSameOrigin(request))return Response.json({error:'طلب غير مسموح.'},{status:403,headers});
 return Response.json({ok:true},{headers:{...headers,'Set-Cookie':cookie('',0)}});
}
