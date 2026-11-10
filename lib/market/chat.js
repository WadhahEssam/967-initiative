// «سوق 967» chats and price offers: the rules, kept pure so the server, the browser and the tests
// share them.
import {parseNumber} from './listing.js';
import {cleanText} from './text.js';

export const CHAT_LIMITS={body:2000,note:300,perMinute:20,newChatsPerDay:30,pageSize:40};
// An offer below half the price is refused (protects sellers from insulting offers); the seller
// has 48 hours to answer; ready-made offers are 5, 10 and 15% below the price.
export const OFFER_RULES={minShare:0.5,hours:48,suggestions:[5,10,15]};

export class ChatError extends Error{
 constructor(message,field=null){super(message);this.name='ChatError';this.field=field;}
}

export const OFFER_STATUS_LABELS={pending:'بانتظار الرد',accepted:'تم قبول العرض',rejected:'رُفض العرض',countered:'قدّم البائع سعرًا مقابلًا',expired:'انتهى العرض دون رد',withdrawn:'سُحب العرض',cancelled:'أُلغي'};

const money=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:2});

// A round amount close to `value`: 8,075 → 8,080; 1,140,000 → 1,140,000.
export function roundAmount(value,reference=value){
 const step=10**Math.max(0,Math.floor(Math.log10(Math.max(1,reference)))-2);
 return Math.round(value/step)*step;
}
export function offerSuggestions(price){
 const number=Number(price);
 if(!Number.isFinite(number)||number<=0)return [];
 return OFFER_RULES.suggestions.map(percent=>({percent,amount:roundAmount(number*(1-percent/100),number)}));
}

// The amount of a buyer's offer, checked against the listing's price.
export function validateOffer(raw,listingPrice){
 const amount=parseNumber(raw);
 const price=Number(listingPrice);
 if(!Number.isFinite(amount)||amount<=0)throw new ChatError('اكتب مبلغ العرض بالأرقام.','amount');
 if(Number.isFinite(price)&&price>0){
  if(amount<price*OFFER_RULES.minShare)throw new ChatError('لا يُقبل عرض أقل من نصف سعر الإعلان ('+money(price*OFFER_RULES.minShare)+').','amount');
  if(amount>price)throw new ChatError('العرض أعلى من سعر الإعلان. راسل البائع مباشرة.','amount');
 }
 return Math.round(amount*100)/100;
}

// A seller's counter-offer: more than the buyer offered, and not above the listing's price.
export function validateCounter(raw,offerAmount,listingPrice){
 const amount=parseNumber(raw);
 if(!Number.isFinite(amount)||amount<=0)throw new ChatError('اكتب السعر المقابل بالأرقام.','amount');
 if(amount<=Number(offerAmount))throw new ChatError('السعر المقابل يجب أن يكون أعلى من عرض المشتري ('+money(offerAmount)+').','amount');
 if(Number.isFinite(Number(listingPrice))&&Number(listingPrice)>0&&amount>Number(listingPrice))throw new ChatError('السعر المقابل أعلى من سعر الإعلان.','amount');
 return Math.round(amount*100)/100;
}

// A pending offer whose 48 hours have passed counts as expired, even before it is updated.
export function offerStatus(offer,now=Date.now()){
 return offer.status==='pending'&&Date.parse(offer.expires_at)<=now?'expired':offer.status;
}
// Who may answer an offer: the other side, while it is pending.
export const canAnswerOffer=(offer,role,now=Date.now())=>offerStatus(offer,now)==='pending'&&Boolean(role)&&offer.from_role!==role;

export const chatRole=(chat,userId)=>!userId?null:chat.buyer_id===userId?'buyer':chat.seller_id===userId?'seller':null;

export function messageText(raw){
 const body=cleanText(raw,CHAT_LIMITS.body);
 if(!body)throw new ChatError('اكتب رسالتك أولًا.','body');
 return body;
}
export const offerNote=raw=>cleanText(raw,CHAT_LIMITS.note);

// Whether a listing takes new messages and offers.
export const listingOpenForChat=listing=>Boolean(listing)&&['active','reserved'].includes(listing.status);
export const listingTakesOffers=listing=>listingOpenForChat(listing)&&Boolean(listing.negotiable)&&Number(listing.price)>0;
