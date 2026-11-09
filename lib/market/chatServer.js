import 'server-only';
import {MarketActionError,LISTING_DAYS} from './listingsServer';
import {CHAT_LIMITS,ChatError,canAnswerOffer,chatRole,listingOpenForChat,listingTakesOffers,messageText,offerNote,offerStatus,validateCounter,validateOffer} from './chat.js';
import {chatImageUrl} from './chatImages';
import {IMAGE_SIZES,copyImage,deleteImage,imageKey} from './storage';
import {formatPrice} from './format.js';

const must=result=>{if(result.error)throw result.error;return result.data;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId=value=>typeof value==='string'&&UUID.test(value);
const CHAT='id,listing_id,buyer_id,seller_id,created_at,last_message_at,last_preview,last_sender_id,buyer_unread,seller_unread,buyer_read_at,seller_read_at';
const LISTING='id,number,seller_id,status,title,price,currency,negotiable,images,reserved_for,governorate_id,district_id';
const MESSAGE='id,chat_id,sender_id,kind,body,image,offer_id,created_at';
const OFFER='id,chat_id,listing_id,from_role,amount,currency,note,status,reply_to,created_at,expires_at,responded_at';
const DELETED='حساب محذوف';
const notFound=()=>new MarketActionError('NOT_FOUND','لم نجد هذه المحادثة.',404);

async function displayNames(db,ids){
 const unique=[...new Set(ids.filter(Boolean))];
 if(!unique.length)return new Map();
 const rows=must(await db.from('public_profiles').select('user_id,display_name').in('user_id',unique))||[];
 return new Map(rows.map(row=>[row.user_id,row.display_name]));
}
const listingCard=listing=>listing?{id:listing.id,number:listing.number,title:listing.title,price:listing.price,currency:listing.currency,status:listing.status,negotiable:listing.negotiable,
 cover:listing.images?.[0]?.id?'/api/market/img/'+listing.images[0].id+'/thumb':null}:null;
async function getListing(db,id){
 if(!isId(id))return null;
 return must(await db.from('market_listings').select(LISTING).eq('id',id).maybeSingle());
}

// Pending offers whose 48 hours have passed become expired (phase 5 also does this on a schedule).
async function expireOffers(db,chatId){
 must(await db.from('market_offers').update({status:'expired',responded_at:new Date().toISOString()}).eq('chat_id',chatId).eq('status','pending').lt('expires_at',new Date().toISOString()));
}

async function memberChat(db,user,chatId){
 if(!isId(chatId))throw notFound();
 const chat=must(await db.from('market_chats').select(CHAT).eq('id',chatId).maybeSingle());
 const role=chat&&chatRole(chat,user.id);
 if(!role)throw notFound();
 return {chat,role};
}

// A short line from the other side's point of view («أرسل صورة», «عرض سعر: 8,000 $»).
async function systemMessage(db,chatId,senderId,body){
 must(await db.from('market_messages').insert({chat_id:chatId,sender_id:senderId,kind:'system',body:body.slice(0,300)}));
}

// ---- Reading ----
export async function listChats(db,user){
 const rows=must(await db.from('market_chats').select(CHAT).or('buyer_id.eq.'+user.id+',seller_id.eq.'+user.id).order('last_message_at',{ascending:false}).limit(100))||[];
 if(!rows.length)return [];
 const [listings,names]=await Promise.all([
  db.from('market_listings').select(LISTING).in('id',[...new Set(rows.map(row=>row.listing_id))]).then(must),
  displayNames(db,rows.map(row=>row.buyer_id===user.id?row.seller_id:row.buyer_id)),
 ]);
 const byId=new Map((listings||[]).map(row=>[row.id,row]));
 return rows.map(row=>{
  const role=chatRole(row,user.id),partner=role==='buyer'?row.seller_id:row.buyer_id;
  return {id:row.id,role,partnerName:partner?names.get(partner)||'عضو 967':DELETED,listing:listingCard(byId.get(row.listing_id)),
   lastMessageAt:row.last_message_at,preview:row.last_preview,lastFromMe:row.last_sender_id===user.id,unread:role==='buyer'?row.buyer_unread:row.seller_unread};
 });
}

function presentMessage(message,userId){
 const image=message.image?.id?{w:message.image.w,h:message.image.h,thumb:chatImageUrl(message.image.id,'thumb'),full:chatImageUrl(message.image.id,'full')}:null;
 return {id:message.id,kind:message.kind,body:message.body,image,offerId:message.offer_id,mine:message.sender_id===userId,createdAt:message.created_at};
}
const presentOffer=offer=>({id:offer.id,fromRole:offer.from_role,amount:offer.amount,currency:offer.currency,note:offer.note,status:offerStatus(offer),replyTo:offer.reply_to,createdAt:offer.created_at,expiresAt:offer.expires_at});

// One chat with its newest messages (older ones with `before`). Opening it marks it read.
export async function openChat(db,user,chatId,{before=null}={}){
 const {chat,role}=await memberChat(db,user,chatId);
 await expireOffers(db,chat.id);
 let query=db.from('market_messages').select(MESSAGE).eq('chat_id',chat.id).order('created_at',{ascending:false}).limit(CHAT_LIMITS.pageSize+1);
 if(before&&!Number.isNaN(Date.parse(before)))query=query.lt('created_at',before);
 const partner=role==='buyer'?chat.seller_id:chat.buyer_id;
 const [listing,messages,offers,names]=await Promise.all([getListing(db,chat.listing_id),query.then(must),
  db.from('market_offers').select(OFFER).eq('chat_id',chat.id).order('created_at').then(must),displayNames(db,[partner])]);
 const unreadKey=role+'_unread',readKey=role+'_read_at';
 if(chat[unreadKey]>0)must(await db.from('market_chats').update({[unreadKey]:0,[readKey]:new Date().toISOString()}).eq('id',chat.id));
 const page=(messages||[]).slice(0,CHAT_LIMITS.pageSize).reverse();
 const presented=(offers||[]).map(presentOffer);
 const pending=presented.find(offer=>offer.status==='pending')||null;
 return {chat:{id:chat.id,role,partnerName:partner?names.get(partner)||'عضو 967':DELETED,partnerReadAt:role==='buyer'?chat.seller_read_at:chat.buyer_read_at,closed:!partner},
  listing:{...listingCard(listing),reservedForMe:Boolean(listing?.reserved_for&&listing.reserved_for===user.id),reservedForOther:Boolean(listing?.status==='reserved'&&listing.reserved_for!==chat.buyer_id)},
  messages:page.map(message=>presentMessage(message,user.id)),offers:Object.fromEntries(presented.map(offer=>[offer.id,offer])),pendingOfferId:pending?.id||null,
  more:(messages||[]).length>CHAT_LIMITS.pageSize,canOffer:role==='buyer'&&!pending&&listingTakesOffers(listing)&&Boolean(partner)};
}

// Before the first message: the listing a buyer is about to write about, or their existing chat.
export async function chatForListing(db,user,listingId){
 const listing=await getListing(db,listingId);
 if(!listing||!listing.seller_id||!listingOpenForChat(listing))throw new MarketActionError('NOT_FOUND','هذا الإعلان لم يعد متاحًا للمراسلة.',404);
 if(listing.seller_id===user.id)throw new MarketActionError('OWN_LISTING','هذا إعلانك. تصلك رسائل المشترين هنا.');
 const existing=must(await db.from('market_chats').select('id').eq('listing_id',listing.id).eq('buyer_id',user.id).maybeSingle());
 if(existing)return {chatId:existing.id};
 const names=await displayNames(db,[listing.seller_id]);
 return {chatId:null,listing:listingCard(listing),sellerName:names.get(listing.seller_id)||'عضو 967',canOffer:listingTakesOffers(listing)};
}

// ---- Writing ----
async function startChat(db,user,listingId){
 const listing=await getListing(db,listingId);
 if(!listing||!listing.seller_id||!listingOpenForChat(listing))throw new MarketActionError('NOT_FOUND','هذا الإعلان لم يعد متاحًا للمراسلة.',404);
 if(listing.seller_id===user.id)throw new MarketActionError('OWN_LISTING','هذا إعلانك.');
 const existing=must(await db.from('market_chats').select(CHAT).eq('listing_id',listing.id).eq('buyer_id',user.id).maybeSingle());
 if(existing)return {chat:existing,role:'buyer'};
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error}=await db.from('market_chats').select('id',{count:'exact',head:true}).eq('buyer_id',user.id).gte('created_at',since);
 if(error)throw error;
 if((count||0)>=CHAT_LIMITS.newChatsPerDay)throw new MarketActionError('DAILY_LIMIT','بدأت محادثات كثيرة اليوم. حاول غدًا.',429);
 const inserted=await db.from('market_chats').insert({listing_id:listing.id,buyer_id:user.id,seller_id:listing.seller_id,buyer_read_at:new Date().toISOString()}).select(CHAT).single();
 if(inserted.error?.code==='23505')return {chat:must(await db.from('market_chats').select(CHAT).eq('listing_id',listing.id).eq('buyer_id',user.id).single()),role:'buyer'};
 return {chat:must(inserted),role:'buyer'};
}

async function rateLimit(db,user){
 const since=new Date(Date.now()-60000).toISOString();
 const {count,error}=await db.from('market_messages').select('id',{count:'exact',head:true}).eq('sender_id',user.id).gte('created_at',since);
 if(error)throw error;
 if((count||0)>=CHAT_LIMITS.perMinute)throw new MarketActionError('TOO_FAST','أرسلت رسائل كثيرة خلال دقيقة. انتظر قليلًا.',429);
}
const openChatFor=(db,user,{chatId,listingId})=>chatId?memberChat(db,user,chatId):startChat(db,user,listingId);

// A photo the member uploaded (POST /api/market/images), moved to the private chat folder.
async function attachChatImage(db,user,chatId,imageId){
 if(!isId(imageId))throw new ChatError('الصورة غير متاحة. أرسلها مجددًا.','image');
 const upload=must(await db.from('market_uploads').select('id,width,height,promoted,listing_id,chat_id').eq('id',imageId).eq('owner_id',user.id).maybeSingle());
 if(!upload||upload.promoted||upload.listing_id||upload.chat_id)throw new ChatError('الصورة غير متاحة. أرسلها مجددًا.','image');
 await Promise.all(IMAGE_SIZES.map(size=>copyImage(imageKey(upload.id,size,{temporary:true}),imageKey(upload.id,size,{chat:true}))));
 must(await db.from('market_uploads').update({chat_id:chatId,promoted:true}).eq('id',upload.id).eq('owner_id',user.id));
 // The temporary copy is public to whoever has its id; it is no longer needed.
 await Promise.all(IMAGE_SIZES.map(size=>deleteImage(imageKey(upload.id,size,{temporary:true})).catch(()=>null)));
 return {id:upload.id,w:upload.width,h:upload.height};
}

export async function sendMessage(db,user,{chatId=null,listingId=null,body='',imageId=null}){
 const text=body?String(body):'';
 if(!imageId)messageText(text);
 await rateLimit(db,user);
 const {chat,role}=await openChatFor(db,user,{chatId,listingId});
 if(!(role==='buyer'?chat.seller_id:chat.buyer_id))throw new MarketActionError('CLOSED','لا يمكن مراسلة هذا المستخدم.');
 const image=imageId?await attachChatImage(db,user,chat.id,imageId):null;
 const message=must(await db.from('market_messages').insert({chat_id:chat.id,sender_id:user.id,kind:image?'image':'text',body:image?text.trim().slice(0,CHAT_LIMITS.body):messageText(text),image}).select(MESSAGE).single());
 return {chatId:chat.id,message:presentMessage(message,user.id)};
}

export async function makeOffer(db,user,{chatId=null,listingId=null,amount,note=''}){
 await rateLimit(db,user);
 const {chat,role}=await openChatFor(db,user,{chatId,listingId});
 if(role!=='buyer')throw new MarketActionError('NOT_BUYER','العروض يقدّمها المشتري.');
 const listing=await getListing(db,chat.listing_id);
 if(!listingTakesOffers(listing))throw new MarketActionError('NO_OFFERS','هذا الإعلان لا يقبل عروض أسعار.');
 if(!chat.seller_id)throw new MarketActionError('CLOSED','لا يمكن مراسلة هذا المستخدم.');
 await expireOffers(db,chat.id);
 const pending=must(await db.from('market_offers').select('id,from_role').eq('chat_id',chat.id).eq('status','pending').maybeSingle());
 if(pending)throw new MarketActionError('OFFER_PENDING',pending.from_role==='seller'?'ردّ أولًا على السعر المقابل من البائع.':'لديك عرض بانتظار رد البائع.');
 const value=validateOffer(amount,listing.price);
 const inserted=await db.from('market_offers').insert({chat_id:chat.id,listing_id:listing.id,from_role:'buyer',amount:value,currency:listing.currency,note:offerNote(note)}).select(OFFER).single();
 if(inserted.error?.code==='23505')throw new MarketActionError('OFFER_PENDING','لديك عرض بانتظار رد البائع.');
 const offer=must(inserted);
 must(await db.from('market_messages').insert({chat_id:chat.id,sender_id:user.id,kind:'offer',body:offer.note,offer_id:offer.id}));
 return {chatId:chat.id,offer:presentOffer(offer)};
}

// accept / reject (the other side), counter (the seller, to a buyer's offer), withdraw (its sender).
export async function answerOffer(db,user,{offerId,action,amount=null}){
 if(!isId(offerId))throw new MarketActionError('NOT_FOUND','لم نجد هذا العرض.',404);
 const found=must(await db.from('market_offers').select(OFFER).eq('id',offerId).maybeSingle());
 if(!found)throw new MarketActionError('NOT_FOUND','لم نجد هذا العرض.',404);
 const {chat,role}=await memberChat(db,user,found.chat_id);
 await expireOffers(db,chat.id);
 const offer=must(await db.from('market_offers').select(OFFER).eq('id',offerId).single());
 const now=new Date().toISOString();
 const settle=async(status)=>{
  const updated=must(await db.from('market_offers').update({status,responded_at:now}).eq('id',offer.id).eq('status','pending').select(OFFER).maybeSingle());
  if(!updated)throw new MarketActionError('OFFER_CLOSED','لم يعد هذا العرض بانتظار الرد.');
  return updated;
 };
 const price=formatPrice(offer.amount,offer.currency);
 if(action==='withdraw'){
  if(offer.from_role!==role||offerStatus(offer)!=='pending')throw new MarketActionError('OFFER_CLOSED','لا يمكن سحب هذا العرض.');
  const updated=await settle('withdrawn');
  await systemMessage(db,chat.id,user.id,'سُحب العرض ('+price+').');
  return {offer:presentOffer(updated)};
 }
 if(!canAnswerOffer(offer,role))throw new MarketActionError('OFFER_CLOSED','لم يعد هذا العرض بانتظار ردك.');
 if(action==='accept'||action==='reject'){
  const updated=await settle(action==='accept'?'accepted':'rejected');
  await systemMessage(db,chat.id,user.id,action==='accept'?'تم قبول العرض: '+price+'. اتفقا على موعد المعاينة والاستلام.':'رُفض العرض ('+price+').');
  return {offer:presentOffer(updated)};
 }
 if(action==='counter'){
  if(role!=='seller'||offer.from_role!=='buyer')throw new MarketActionError('OFFER_CLOSED','السعر المقابل يقدّمه البائع على عرض المشتري.');
  const listing=await getListing(db,chat.listing_id);
  const value=validateCounter(amount,offer.amount,listing?.price);
  await settle('countered');
  const counter=must(await db.from('market_offers').insert({chat_id:chat.id,listing_id:chat.listing_id,from_role:'seller',amount:value,currency:offer.currency,reply_to:offer.id}).select(OFFER).single());
  must(await db.from('market_messages').insert({chat_id:chat.id,sender_id:user.id,kind:'offer',body:'',offer_id:counter.id}));
  return {offer:presentOffer(counter)};
 }
 throw new MarketActionError('BAD_ACTION','الإجراء غير مدعوم.',400);
}

// After an accepted offer the seller may hold the listing for that buyer. A buyer who held it
// before is told in their chat that the hold was cancelled.
export async function reserveForChat(db,user,{chatId}){
 const {chat,role}=await memberChat(db,user,chatId);
 if(role!=='seller')throw new MarketActionError('NOT_SELLER','الحجز يقرّره البائع.');
 if(!chat.buyer_id)throw new MarketActionError('CLOSED','لا يمكن الحجز لهذا الحساب.');
 const listing=await getListing(db,chat.listing_id);
 if(!listingOpenForChat(listing))throw new MarketActionError('NOT_OPEN','لا يمكن حجز هذا الإعلان الآن.');
 if(listing.reserved_for===chat.buyer_id)return {status:'reserved'};
 await releaseHold(db,user,listing,'حجز البائع الإعلان لمشترٍ آخر، فأُلغي حجزك.');
 must(await db.from('market_listings').update({status:'reserved',reserved_for:chat.buyer_id,reserved_at:new Date().toISOString()}).eq('id',listing.id).eq('seller_id',user.id));
 await systemMessage(db,chat.id,user.id,'حجز البائع الإعلان لك. اتفقا على موعد المعاينة والاستلام.');
 return {status:'reserved'};
}
async function releaseHold(db,seller,listing,message){
 if(!listing.reserved_for)return;
 const previous=must(await db.from('market_chats').select('id').eq('listing_id',listing.id).eq('buyer_id',listing.reserved_for).maybeSingle());
 if(!previous)return;
 must(await db.from('market_offers').update({status:'cancelled',responded_at:new Date().toISOString()}).eq('chat_id',previous.id).eq('status','accepted'));
 await systemMessage(db,previous.id,seller.id,message);
}

export async function chatUnreadSummary(db,user){
 const rows=must(await db.rpc('market_unread_summary',{p_user:user.id}))||[];
 return {unread:Number(rows[0]?.unread||0),latest:rows[0]?.latest||null};
}

// ---- «إعلاناتي» ----
const MINE='id,number,status,title,price,currency,images,views,saves,published_at,expires_at,sold_at,reserved_for,created_at,review_reason,category,subcategory,governorate_id,district_id';
export async function myListings(db,user){
 const rows=must(await db.from('market_listings').select(MINE).eq('seller_id',user.id).neq('status','removed').order('created_at',{ascending:false}).limit(200))||[];
 if(!rows.length)return [];
 const ids=rows.map(row=>row.id);
 const [chats,offers]=await Promise.all([
  db.from('market_chats').select('listing_id,seller_unread').in('listing_id',ids).eq('seller_id',user.id).then(must),
  db.from('market_offers').select('listing_id,status,expires_at,from_role').in('listing_id',ids).then(must),
 ]);
 const count=(list,key,test=()=>true,value=()=>1)=>{const map=new Map();for(const row of list||[])if(test(row))map.set(row[key],(map.get(row[key])||0)+value(row));return map;};
 const unread=count(chats,'listing_id',()=>true,row=>row.seller_unread),chatCount=count(chats,'listing_id');
 const pending=count(offers,'listing_id',row=>row.from_role==='buyer'&&offerStatus(row)==='pending'),offerCount=count(offers,'listing_id',row=>row.from_role==='buyer');
 return rows.map(row=>({id:row.id,number:row.number,status:row.status,title:row.title,price:row.price,currency:row.currency,cover:row.images?.[0]?.id?'/api/market/img/'+row.images[0].id+'/thumb':null,
  views:row.views,saves:row.saves,publishedAt:row.published_at,expiresAt:row.expires_at,createdAt:row.created_at,reviewReason:row.review_reason,reserved:Boolean(row.reserved_for),
  unread:unread.get(row.id)||0,chats:chatCount.get(row.id)||0,pendingOffers:pending.get(row.id)||0,offers:offerCount.get(row.id)||0}));
}

// sold · reserve · available · remove · renew. Removing never deletes: the listing is hidden.
const TRANSITIONS={sold:['active','reserved'],reserve:['active'],available:['reserved'],remove:['draft','pending_review','active','reserved','expired','sold'],renew:['expired']};
export async function changeListingStatus(db,user,{id,action}){
 if(!isId(id)||!TRANSITIONS[action])throw new MarketActionError('BAD_ACTION','الإجراء غير مدعوم.',400);
 const listing=must(await db.from('market_listings').select(LISTING+',expires_at').eq('id',id).eq('seller_id',user.id).maybeSingle());
 if(!listing)throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
 if(!TRANSITIONS[action].includes(listing.status))throw new MarketActionError('BAD_STATE','لا يمكن تنفيذ هذا الإجراء على الإعلان في حالته الحالية.');
 const now=new Date();
 let patch;
 if(action==='sold')patch={status:'sold',sold_at:now.toISOString()};
 if(action==='reserve')patch={status:'reserved',reserved_at:now.toISOString(),reserved_for:null};
 if(action==='available'){await releaseHold(db,user,listing,'أعاد البائع الإعلان متاحًا، فأُلغي حجزك.');patch={status:'active',reserved_for:null,reserved_at:null};}
 if(action==='remove')patch={status:'removed'};
 if(action==='renew')patch={status:'active',expires_at:new Date(now.getTime()+LISTING_DAYS*86400000).toISOString()};
 if(['sold','remove'].includes(action))must(await db.from('market_offers').update({status:'cancelled',responded_at:now.toISOString()}).eq('listing_id',listing.id).eq('status','pending'));
 must(await db.from('market_listings').update(patch).eq('id',listing.id).eq('seller_id',user.id));
 return {id:listing.id,status:patch.status};
}

