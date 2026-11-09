import 'server-only';
import {MarketActionError,toCard} from './listingsServer';
import {RATING_CRITERIA,ratingBlocker,ratingOverall,starsText,validateRating} from './ratings.js';
import {chatRole} from './chat.js';
import {placeNames} from './places';
import {cleanText} from './text.js';

const must=result=>{if(result.error)throw result.error;return result.data;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId=value=>typeof value==='string'&&UUID.test(value);
const DELETED='حساب محذوف';
const SCORES=RATING_CRITERIA.map(item=>item.key).join(',');
const RATING='id,listing_id,seller_id,buyer_id,'+SCORES+',comment,reply,replied_at,reported_at,created_at';
const cover=row=>row?.images?.[0]?.id?'/api/market/img/'+row.images[0].id+'/thumb':null;

// A seller who is suspended or leaving has no public seller page or card.
async function activeSeller(db,sellerId){
 if(!isId(sellerId))return null;
 const profile=must(await db.from('public_profiles').select('user_id,display_name,avatar_url,show_avatar,created_at,suspended,deletion_requested_at').eq('user_id',sellerId).maybeSingle());
 return profile&&!profile.suspended&&!profile.deletion_requested_at?profile:null;
}
export async function sellerStats(db,sellerId){
 return must(await db.rpc('market_seller_stats',{p_seller:sellerId}))||{};
}

// ---- Rating a seller ----
async function chatForRating(db,user,chatId){
 if(!isId(chatId))throw new MarketActionError('NOT_FOUND','لم نجد هذه المحادثة.',404);
 const chat=must(await db.from('market_chats').select('id,listing_id,buyer_id,seller_id,created_at').eq('id',chatId).maybeSingle());
 if(!chat||!chatRole(chat,user.id))throw new MarketActionError('NOT_FOUND','لم نجد هذه المحادثة.',404);
 const [listing,seller,messages,existing]=await Promise.all([
  db.from('market_listings').select('id,number,title,status,images,price,currency').eq('id',chat.listing_id).maybeSingle().then(must),
  chat.seller_id?activeSeller(db,chat.seller_id):null,
  db.from('market_messages').select('sender_id').eq('chat_id',chat.id).in('kind',['text','image','offer']).limit(500).then(must),
  db.from('market_ratings').select(RATING).eq('listing_id',chat.listing_id).eq('buyer_id',user.id).maybeSingle().then(must),
 ]);
 const blocker=ratingBlocker({role:chatRole(chat,user.id),listingStatus:listing?.status,chatCreatedAt:chat.created_at,
  sellerReplied:(messages||[]).some(m=>m.sender_id===chat.seller_id),buyerWrote:(messages||[]).some(m=>m.sender_id===user.id),alreadyRated:Boolean(existing),sellerGone:!seller});
 return {chat,listing,seller,existing,blocker};
}
export async function ratingContext(db,user,chatId){
 const {chat,listing,seller,existing,blocker}=await chatForRating(db,user,chatId);
 return {chatId:chat.id,listing:listing?{number:listing.number,title:listing.title,cover:cover(listing),status:listing.status}:null,
  seller:seller?{id:seller.user_id,name:seller.display_name}:null,existing:existing?presentRating(existing,new Map()):null,blocker};
}
export async function submitRating(db,user,{chatId,scores={}}){
 const {chat,listing,blocker}=await chatForRating(db,user,chatId);
 if(blocker)throw new MarketActionError('NOT_ALLOWED',blocker);
 const rating=validateRating(scores);
 const inserted=await db.from('market_ratings').insert({...rating,listing_id:listing.id,chat_id:chat.id,seller_id:chat.seller_id,buyer_id:user.id}).select(RATING).single();
 if(inserted.error?.code==='23505')throw new MarketActionError('NOT_ALLOWED','قيّمت هذا البائع على هذا الإعلان من قبل.');
 const saved=must(inserted);
 // The seller hears about it; the request to the buyer is answered.
 await db.rpc('market_notify',{p_user:chat.seller_id,p_kind:'new_rating',p_listing:listing.id,p_search:null,p_subject:listing.title,
  p_detail:starsText(ratingOverall(saved)),p_href:'/market/seller/'+chat.seller_id,p_count:1}).then(()=>null,()=>null);
 await db.from('market_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('listing_id',listing.id).eq('kind','rate_request').is('read_at',null).then(()=>null,()=>null);
 return presentRating(saved,new Map());
}

// One public reply per rating, by the seller.
export async function replyToRating(db,user,{ratingId,reply}){
 if(!isId(ratingId))throw new MarketActionError('NOT_FOUND','لم نجد هذا التقييم.',404);
 const text=cleanText(reply,600);
 if(!text)throw new MarketActionError('EMPTY','اكتب ردّك أولًا.',400);
 const updated=must(await db.from('market_ratings').update({reply:text,replied_at:new Date().toISOString()}).eq('id',ratingId).eq('seller_id',user.id).is('reply',null).select('id,reply,replied_at').maybeSingle());
 if(!updated)throw new MarketActionError('NOT_ALLOWED','لا يمكن الرد على هذا التقييم، أو رددت عليه من قبل.');
 return updated;
}
// The seller may report an abusive rating; the team reviews reports (phase 7).
export async function reportRating(db,user,{ratingId,reason}){
 if(!isId(ratingId))throw new MarketActionError('NOT_FOUND','لم نجد هذا التقييم.',404);
 const text=cleanText(reason,300);
 if(text.length<5)throw new MarketActionError('EMPTY','اكتب سبب الإبلاغ باختصار.',400);
 const updated=must(await db.from('market_ratings').update({reported_at:new Date().toISOString(),report_reason:text}).eq('id',ratingId).eq('seller_id',user.id).is('reported_at',null).select('id').maybeSingle());
 if(!updated)throw new MarketActionError('NOT_ALLOWED','أبلغت عن هذا التقييم من قبل.');
 return {reported:true};
}

function presentRating(row,names,titles=new Map()){
 return {id:row.id,overall:ratingOverall(row),scores:Object.fromEntries(RATING_CRITERIA.map(({key})=>[key,row[key]])),comment:row.comment,
  buyerName:row.buyer_id?names.get(row.buyer_id)||'عضو 967':DELETED,listingTitle:titles.get(row.listing_id)||null,listingId:row.listing_id,
  reply:row.reply,repliedAt:row.replied_at,reported:Boolean(row.reported_at),createdAt:row.created_at};
}

// ---- The seller page and the seller card ----
export async function sellerCard(db,sellerId){
 const seller=await activeSeller(db,sellerId);
 if(!seller)return null;
 return {id:seller.user_id,name:seller.display_name,stats:await sellerStats(db,sellerId)};
}
export async function sellerProfile(db,sellerId,places){
 const seller=await activeSeller(db,sellerId);
 if(!seller)return null;
 // Active listings are the public ones only (not drafts, held for review, or expired).
 const [stats,active,sold,ratings]=await Promise.all([
  sellerStats(db,sellerId),
  db.from('market_listings').select('*').eq('seller_id',sellerId).in('status',['active','reserved']).order('published_at',{ascending:false}).limit(60).then(must),
  db.from('market_listings').select('id,number,title,images,sold_at,governorate_id').eq('seller_id',sellerId).eq('status','sold').order('sold_at',{ascending:false}).limit(60).then(must),
  db.from('market_ratings').select(RATING).eq('seller_id',sellerId).eq('hidden',false).order('created_at',{ascending:false}).limit(100).then(must),
 ]);
 const own=active||[];
 const buyerIds=[...new Set((ratings||[]).map(r=>r.buyer_id).filter(Boolean))];
 const names=new Map(buyerIds.length?(must(await db.from('public_profiles').select('user_id,display_name').in('user_id',buyerIds))||[]).map(row=>[row.user_id,row.display_name]):[]);
 const titleRows=(ratings||[]).length?must(await db.from('market_listings').select('id,title').in('id',[...new Set(ratings.map(r=>r.listing_id))])):[];
 const titles=new Map((titleRows||[]).map(row=>[row.id,row.title]));
 const ratingByListing=new Map((ratings||[]).map(row=>[row.listing_id,row]));
 // The seller's governorate: where their latest listing is (their account's governorate stays private).
 const latest=[...own,...(sold||[])].find(row=>row.governorate_id);
 return {
  seller:{id:seller.user_id,name:seller.display_name,avatar:seller.show_avatar?seller.avatar_url:null,since:seller.created_at,governorate:latest?placeNames(places,latest.governorate_id,null).governorate:''},
  stats,
  active:own.map(row=>toCard(row,places)),
  // Sold items: photo, title and when, without the price; with the buyer's rating when there is one.
  sold:(sold||[]).map(row=>({id:row.id,title:row.title,cover:cover(row),soldAt:row.sold_at,rating:ratingByListing.get(row.id)?ratingOverall(ratingByListing.get(row.id)):null})),
  ratings:(ratings||[]).map(row=>presentRating(row,names,titles)),
 };
}

// The seller's own received ratings, also before three of them make a public average.
export async function receivedRatings(db,user){
 const rows=must(await db.from('market_ratings').select(RATING).eq('seller_id',user.id).eq('hidden',false).order('created_at',{ascending:false}).limit(100))||[];
 const buyerIds=[...new Set(rows.map(r=>r.buyer_id).filter(Boolean))];
 const names=new Map(buyerIds.length?(must(await db.from('public_profiles').select('user_id,display_name').in('user_id',buyerIds))||[]).map(row=>[row.user_id,row.display_name]):[]);
 const titleRows=rows.length?must(await db.from('market_listings').select('id,title').in('id',[...new Set(rows.map(r=>r.listing_id))])):[];
 return rows.map(row=>presentRating(row,names,new Map((titleRows||[]).map(item=>[item.id,item.title]))));
}
