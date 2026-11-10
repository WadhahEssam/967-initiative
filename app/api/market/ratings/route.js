import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {ratingContext,receivedRatings,replyToRating,reportRating,submitRating} from '@/lib/market/ratingsServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// GET ?chat=<id>: whether the member may rate the seller of that chat, and their rating if any.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  const params=new URL(request.url).searchParams;
  if(params.get('mine')==='1')return marketJson({ratings:await receivedRatings(db,user)});
  return marketJson(await ratingContext(db,user,params.get('chat')));
 }catch(error){return marketFailure(error);}
}

// POST {action}: rate {chatId, scores:{accuracy,price,punctuality,manners,comment}}
// · reply {ratingId, reply} (the seller, once) · report {ratingId, reason, note} (the seller).
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,4000);
  if(body.action==='rate')return marketJson({rating:await submitRating(db,user,{chatId:body.chatId,scores:body.scores||{}})},201);
  if(body.action==='reply')return marketJson({rating:await replyToRating(db,user,{ratingId:body.ratingId,reply:body.reply})});
  if(body.action==='report')return marketJson(await reportRating(db,user,{ratingId:body.ratingId,reason:body.reason,note:body.note}));
  throw new RequestValidationError('الإجراء غير مدعوم.',400);
 }catch(error){return marketFailure(error);}
}
