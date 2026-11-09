import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {answerOffer,chatForListing,chatUnreadSummary,listChats,makeOffer,openChat,reserveForChat,sendMessage} from '@/lib/market/chatServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// GET: ?chat=<id>[&before=<time>] one chat · ?listing=<id> before the first message · ?mode=summary
// the unread count · otherwise the member's chats.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  const params=new URL(request.url).searchParams;
  if(params.get('mode')==='summary')return marketJson(await chatUnreadSummary(db,user));
  if(params.get('chat'))return marketJson(await openChat(db,user,params.get('chat'),{before:params.get('before')}));
  if(params.get('listing'))return marketJson(await chatForListing(db,user,params.get('listing')));
  return marketJson({chats:await listChats(db,user)});
 }catch(error){return marketFailure(error);}
}

// POST {action}: message {chatId|listingId, body, imageId} · offer {chatId|listingId, amount, note}
// · answer {offerId, answer: accept|reject|counter|withdraw, amount} · reserve {chatId}.
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,6000);
  const target={chatId:body.chatId||null,listingId:body.listingId||null};
  if(body.action==='message')return marketJson(await sendMessage(db,user,{...target,body:typeof body.body==='string'?body.body:'',imageId:body.imageId||null}),201);
  if(body.action==='offer')return marketJson(await makeOffer(db,user,{...target,amount:body.amount,note:typeof body.note==='string'?body.note:''}),201);
  if(body.action==='answer')return marketJson(await answerOffer(db,user,{offerId:body.offerId,action:body.answer,amount:body.amount}));
  if(body.action==='reserve')return marketJson(await reserveForChat(db,user,{chatId:body.chatId}));
  throw new RequestValidationError('الإجراء غير مدعوم.',400);
 }catch(error){return marketFailure(error,'تعذر إرسال الطلب. حاول مجددًا.');}
}
