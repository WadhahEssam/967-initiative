import {authorizeEditorRequest} from './adminAuthorization.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {readJsonObject,RequestValidationError} from './requestSecurity.js';
import {readInlineEditor,mutateInlineEditor} from './inlineEditorRepository.js';

export async function handleInlineEditorRequest(request,createDb){
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Vary':'Authorization'}});
 try{
  const db=createDb(request),params=new URL(request.url).searchParams;
  // «Am I an editor?» is asked once by every signed-in page; for members the answer is a plain
  // «no» (it was a 403, logged as a failed request in each member's console). Every other view
  // and every change still requires an editor.
  const sessionCheck=request.method==='GET'&&(params.get('view')||'session')==='session';
  const actor=await authorizeEditorRequest(request,db,{allowMember:sessionCheck});
  if(sessionCheck&&!actor.role)return json({actor:null});
  if(request.method==='GET')return json(await readInlineEditor(db,actor,params));
  if(request.method!=='POST')return json({error:'إجراء غير مدعوم.'},405);
  return json(await mutateInlineEditor(db,actor,await readJsonObject(request,180000)));
 }catch(error){const status=error instanceof RequestValidationError?error.status:503;if(status>=500)recordOperationalEvent('api_failure',{source:'api',route:'/api/admin/inline',status});return json({error:error instanceof RequestValidationError?error.message:'تعذر إتمام الإجراء. حاول مجدداً.'},status);}
}
