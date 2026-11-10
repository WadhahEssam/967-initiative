import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {blockMember,hiddenSellers,unblockMember} from '@/lib/market/safetyServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// GET ?sellers=<id>,<id>: which of these sellers the member must not see (blocked either way),
// so the pages can hide their listings.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  const ids=String(new URL(request.url).searchParams.get('sellers')||'').split(',').slice(0,200);
  return marketJson({hidden:await hiddenSellers(db,user,ids)});
 }catch(error){return marketFailure(error);}
}

// POST block {userId, reason, note, report, chatId} · unblock {userId}. The list of blocked
// members and unblocking also live in the messages settings (same list).
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,3000);
  if(body.action==='block')return marketJson(await blockMember(db,user,{userId:body.userId,reason:body.reason,note:body.note,report:body.report===true,chatId:body.chatId}));
  if(body.action==='unblock')return marketJson(await unblockMember(db,user,body.userId));
  throw new RequestValidationError('الإجراء غير مدعوم.',400);
 }catch(error){return marketFailure(error);}
}
