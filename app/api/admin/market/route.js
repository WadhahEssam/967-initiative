import {serverDb} from '@/lib/supabase-server';
import {authorizeEditorRequest} from '@/lib/adminAuthorization';
import {RequestValidationError,readJsonObject} from '@/lib/requestSecurity';
import {MarketActionError} from '@/lib/market/listingsServer';
import {SafetyError} from '@/lib/market/safety.js';
import {getMarketPlaces} from '@/lib/market/places';
import {marketStorageConfigured} from '@/lib/market/storage';
import {getSiteSettings} from '@/lib/data';
import {sectionStatus} from '@/lib/pageVisibility';
import {actOnReport,activeBans,banMember,blockAlerts,decideListing,findListing,liftBan,listReports,moderationCounts,pendingListings,reportedChat,sendTeamMessage} from '@/lib/market/moderationServer';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization','X-Robots-Tag':'noindex, nofollow'};
const json=(body,status=200)=>Response.json(body,{status,headers});
// Editors (admin and management) moderate the market; bans and reading reported chats are for
// management only (checked in lib/market/moderationServer.js).
async function team(request){
 const db=serverDb();
 const actor=await authorizeEditorRequest(request,db);
 return {db,actor};
}
const fail=error=>{
 if(error instanceof RequestValidationError)return json({error:error.message},error.status);
 if(error instanceof MarketActionError)return json({error:error.message,code:error.code},error.status);
 if(error instanceof SafetyError)return json({error:error.message,field:error.field},400);
 console.error('market moderation error',error?.code||error?.name||'unknown');
 return json({error:'تعذر إتمام إجراء الإشراف. حاول مجددًا.'},503);
};

// GET ?view=pending|reports|alerts|bans|listing|chat (+ status, number, report).
export async function GET(request){
 try{
  const {db,actor}=await team(request);
  const params=new URL(request.url).searchParams;
  const view=params.get('view')||'pending';
  // Launch readiness: photo storage configured on this server, and whether the market is open.
  const launch={storage:marketStorageConfigured(),status:sectionStatus('market',await getSiteSettings())};
  const base={role:actor.role,counts:await moderationCounts(db),launch};
  if(view==='pending')return json({...base,listings:await pendingListings(db,await getMarketPlaces())});
  if(view==='reports')return json({...base,reports:await listReports(db,await getMarketPlaces(),{status:params.get('status')||'open'})});
  if(view==='alerts')return json({...base,alerts:await blockAlerts(db)});
  if(view==='bans')return json({...base,bans:await activeBans(db)});
  if(view==='listing')return json({...base,listing:await findListing(db,await getMarketPlaces(),params.get('number'))});
  if(view==='chat')return json(await reportedChat(db,actor,params.get('report')));
  throw new RequestValidationError('طلب غير معروف.',400);
 }catch(error){return fail(error);}
}

// POST {action}: listing {id, decision:approve|reject|hold|remove, reason} · report {id, act, who, days,
// reason, message} · ban {userId, days, reason} · lift {id} · message {userId, message}.
export async function POST(request){
 try{
  const {db,actor}=await team(request);
  const body=await readJsonObject(request,6000);
  if(body.action==='listing')return json(await decideListing(db,actor,{id:body.id,decision:body.decision,reason:body.reason}));
  if(body.action==='report')return json(await actOnReport(db,actor,{id:body.id,action:body.act,who:body.who,days:body.days??null,reason:body.reason,message:body.message}));
  if(body.action==='ban')return json(await banMember(db,actor,{userId:body.userId,days:body.days??null,reason:body.reason}));
  if(body.action==='lift')return json(await liftBan(db,actor,{id:body.id}));
  if(body.action==='message')return json(await sendTeamMessage(db,actor,{userId:body.userId,message:body.message}));
  throw new RequestValidationError('الإجراء غير مدعوم.',400);
 }catch(error){return fail(error);}
}
