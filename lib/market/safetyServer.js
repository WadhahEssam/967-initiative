import 'server-only';
import {MarketActionError} from './listingsServer';
import {BLOCKED_TEXT,validateBlock,validateReport} from './safety.js';

// «سوق 967» member side of safety: blocks, reports and market bans (the team side is
// moderationServer.js). Blocks share private_user_blocks with private messages.
const must=result=>{if(result.error)throw result.error;return result.data;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isId=value=>typeof value==='string'&&UUID.test(value);
const REPORTS_PER_DAY=10;

// ---- Bans ----
// The member's market ban in force, or null.
export async function activeBan(db,userId){
 if(!isId(userId))return null;
 const now=new Date().toISOString();
 const rows=must(await db.from('market_bans').select('id,reason,until,created_at').eq('user_id',userId).is('lifted_at',null)
  .or('until.is.null,until.gt.'+now).order('created_at',{ascending:false}).limit(1));
 return rows?.[0]||null;
}
export async function isBanned(db,userId){
 return Boolean(isId(userId)&&must(await db.rpc('market_banned',{p_user:userId})));
}

// ---- Blocks ----
export async function blockedBetween(db,a,b){
 if(!isId(a)||!isId(b)||a===b)return false;
 return Boolean(must(await db.rpc('market_blocked',{p_a:a,p_b:b})));
}
// Refuses an action between two members when either blocked the other, with the neutral line.
export async function assertNotBlocked(db,a,b){
 if(await blockedBetween(db,a,b))throw new MarketActionError('BLOCKED',BLOCKED_TEXT,403);
}

// Of these sellers, the ones the member must not see (blocked either way). Used by the pages to
// hide listing cards; it answers only for the ids asked about.
export async function hiddenSellers(db,user,ids){
 const wanted=[...new Set((Array.isArray(ids)?ids:[]).filter(isId))].filter(id=>id!==user.id).slice(0,200);
 if(!wanted.length)return [];
 const [mine,theirs]=await Promise.all([
  db.from('private_user_blocks').select('blocked_id').eq('blocker_id',user.id).in('blocked_id',wanted).then(must),
  db.from('private_user_blocks').select('blocker_id').eq('blocked_id',user.id).in('blocker_id',wanted).then(must),
 ]);
 return [...new Set([...(mine||[]).map(row=>row.blocked_id),...(theirs||[]).map(row=>row.blocker_id)])];
}

async function existingMember(db,userId){
 if(!isId(userId))return null;
 return must(await db.from('public_profiles').select('user_id,display_name').eq('user_id',userId).maybeSingle());
}

// Spec: the reason is required and only the team sees it; the blocked member is not told.
// With report:true the block also files a report (spec: «حظر وإبلاغ»).
const REPORT_FOR_BLOCK={spam:'abuse',rude:'abuse',fraud:'fraud',not_serious:'other',other:'other'};
export async function blockMember(db,user,{userId,reason,note,report=false,chatId=null}){
 if(userId===user.id)throw new MarketActionError('SELF','لا يمكنك حظر نفسك.');
 if(!await existingMember(db,userId))throw new MarketActionError('NOT_FOUND','لم نجد هذا المستخدم.',404);
 const block=validateBlock({reason,note});
 const {data:staff}=await db.from('editors').select('role').eq('user_id',userId).maybeSingle();
 if(staff)throw new MarketActionError('STAFF','لا يمكن حظر حساب من فريق 967. أبلغ عنه بدل ذلك.');
 const current=must(await db.from('private_user_blocks').select('blocker_id').eq('blocker_id',user.id).eq('blocked_id',userId).maybeSingle());
 if(current)must(await db.from('private_user_blocks').update({reason:block.reason,note:block.note}).eq('blocker_id',user.id).eq('blocked_id',userId));
 else must(await db.from('private_user_blocks').insert({blocker_id:user.id,blocked_id:userId,reason:block.reason,note:block.note,source:'market'}));
 let reported=false;
 if(report){
  const inChat=isId(chatId)?await chatBetween(db,chatId,user.id,userId):null;
  await fileReport(db,user,inChat?{target:'chat',chatId,reason:REPORT_FOR_BLOCK[block.reason],note:block.note}:{target:'user',userId,reason:REPORT_FOR_BLOCK[block.reason],note:block.note})
   .then(()=>{reported=true;},error=>{if(error?.code!=='DUPLICATE')throw error;reported=true;});
 }
 return {blocked:true,reported};
}
export async function unblockMember(db,user,userId){
 if(!isId(userId))throw new MarketActionError('NOT_FOUND','لم نجد هذا المستخدم.',404);
 must(await db.from('private_user_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',userId));
 return {blocked:false};
}
// Whether the member blocked this person (the blocked side never learns it).
export async function iBlocked(db,user,userId){
 if(!isId(userId))return false;
 return Boolean(must(await db.from('private_user_blocks').select('blocked_id').eq('blocker_id',user.id).eq('blocked_id',userId).maybeSingle()));
}

async function chatBetween(db,chatId,a,b){
 const chat=must(await db.from('market_chats').select('id,seller_id,buyer_id').eq('id',chatId).maybeSingle());
 if(!chat)return null;
 const pair=[chat.seller_id,chat.buyer_id];
 return pair.includes(a)&&(!b||pair.includes(b))?chat:null;
}

// ---- Reports ----
// A listing, a member, a chat (by one of its two members) or a rating (by the seller who got it).
export async function fileReport(db,user,input={}){
 const report=validateReport(input);
 const row={reporter_id:user.id,target:report.target,reason:report.reason,note:report.note};
 if(report.target==='listing'){
  if(!isId(input.listingId))throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
  const listing=must(await db.from('market_listings').select('id,seller_id,status').eq('id',input.listingId).maybeSingle());
  if(!listing||listing.status==='draft')throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
  if(listing.seller_id===user.id)throw new MarketActionError('SELF','هذا إعلانك.');
  Object.assign(row,{listing_id:listing.id,reported_id:listing.seller_id});
 }else if(report.target==='user'){
  if(input.userId===user.id)throw new MarketActionError('SELF','لا يمكنك الإبلاغ عن نفسك.');
  if(!await existingMember(db,input.userId))throw new MarketActionError('NOT_FOUND','لم نجد هذا المستخدم.',404);
  row.reported_id=input.userId;
 }else if(report.target==='chat'){
  const chat=isId(input.chatId)?await chatBetween(db,input.chatId,user.id):null;
  if(!chat)throw new MarketActionError('NOT_FOUND','لم نجد هذه المحادثة.',404);
  Object.assign(row,{chat_id:chat.id,reported_id:chat.seller_id===user.id?chat.buyer_id:chat.seller_id});
 }else{
  const rating=isId(input.ratingId)?must(await db.from('market_ratings').select('id,seller_id,buyer_id,listing_id').eq('id',input.ratingId).maybeSingle()):null;
  if(!rating||rating.seller_id!==user.id)throw new MarketActionError('NOT_FOUND','لم نجد هذا التقييم.',404);
  Object.assign(row,{rating_id:rating.id,listing_id:rating.listing_id,reported_id:rating.buyer_id});
 }
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error}=await db.from('market_reports').select('id',{count:'exact',head:true}).eq('reporter_id',user.id).gte('created_at',since);
 if(error)throw error;
 if((count||0)>=REPORTS_PER_DAY)throw new MarketActionError('DAILY_LIMIT','أرسلت بلاغات كثيرة اليوم. حاول غدًا.',429);
 const inserted=await db.from('market_reports').insert(row).select('id,number').single();
 if(inserted.error?.code==='23505')throw new MarketActionError('DUPLICATE','أبلغت عن هذا من قبل، والإدارة تراجع بلاغك.');
 const saved=must(inserted);
 return {reported:true,number:saved.number};
}
