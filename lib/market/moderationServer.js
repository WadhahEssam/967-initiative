import 'server-only';
import {MarketActionError,LISTING_DAYS} from './listingsServer';
import {placeNames} from './places';
import {chatImageUrl} from './chatImages';
import {formatPrice,STATUS_LABELS} from './format.js';
import {BLOCKS_ALERT,REPORT_TARGET_LABELS,banUntil,blockReasonLabel,reportReasonLabel,validateAdminMessage} from './safety.js';
import {RATING_CRITERIA,ratingOverall} from './ratings.js';
import {marketNotice} from './notices.js';
import {cleanText} from './text.js';
import {isId} from './safetyServer';
import {findCategory,findSubcategory} from './catalog.js';
import {normalizeSearch} from './text.js';
import {forgetTeamSynonyms} from './searchServer';

// «سوق 967» moderation for the team (spec: «الإشراف ولوحة التحكم»): held listings, reports, the
// block alert, market bans and messages to members. Bans and reading reported chats are for
// management only, like the site's other member reports.
const must=result=>{if(result.error)throw result.error;return result.data;};
const NOTICES_HREF='/market/notices';
export const MODERATION_KINDS=['listing_held','listing_approved','listing_rejected','listing_removed','admin_message','market_ban'];
const LISTING='id,number,seller_id,status,title,description,price,currency,images,review_reason,category,subcategory,governorate_id,district_id,published_at,edited_at,reserved_for,created_at,updated_at';
const cover=row=>row?.images?.[0]?.id?'/api/market/img/'+row.images[0].id+'/thumb':null;
const managementOnly=actor=>{if(actor.role!=='management')throw new MarketActionError('NOT_ALLOWED','هذا الإجراء لفريق الإدارة فقط.',403);};
const reasonText=(value,what='السبب')=>{const text=cleanText(value,500);if(text.length<3)throw new MarketActionError('REASON','اكتب '+what+' باختصار.',400);return text;};

async function displayNames(db,ids){
 const unique=[...new Set(ids.filter(Boolean))];
 if(!unique.length)return new Map();
 const rows=must(await db.from('public_profiles').select('user_id,display_name').in('user_id',unique))||[];
 return new Map(rows.map(row=>[row.user_id,row.display_name]));
}
const nameOf=(names,id)=>id?names.get(id)||'عضو 967':'حساب محذوف';

// Every moderation notice is its own row (not merged), with the full text, and opens /market/notices.
async function notice(db,userId,kind,{listingId=null,subject='',detail=''}={}){
 if(!userId)return;
 must(await db.from('market_notifications').insert({user_id:userId,kind,listing_id:listingId,subject:String(subject).slice(0,160),detail:String(detail).slice(0,1000),href:NOTICES_HREF}));
}

// ---- The member's side: their notices from the team, in full ----
export async function memberNotices(db,user){
 const rows=must(await db.from('market_notifications').select('id,kind,subject,detail,href,count,created_at,read_at').eq('user_id',user.id).in('kind',MODERATION_KINDS)
  .order('created_at',{ascending:false}).limit(50))||[];
 const unread=rows.filter(row=>!row.read_at).map(row=>row.id);
 if(unread.length)must(await db.from('market_notifications').update({read_at:new Date().toISOString()}).in('id',unread));
 return {notices:rows.map(row=>{const shown=marketNotice(row);return {id:row.id,kind:row.kind,title:shown?.title||'',text:row.detail||shown?.description||'',createdAt:row.created_at,unread:!row.read_at};})};
}

// ---- Overview ----
export async function moderationCounts(db){
 const count=async query=>{const {count:n,error}=await query;if(error)throw error;return n||0;};
 const now=new Date().toISOString();
 const [pending,reports,bans,alerts,misses]=await Promise.all([
  count(db.from('market_listings').select('id',{count:'exact',head:true}).eq('status','pending_review')),
  count(db.from('market_reports').select('id',{count:'exact',head:true}).eq('status','open')),
  count(db.from('market_bans').select('id',{count:'exact',head:true}).is('lifted_at',null).or('until.is.null,until.gt.'+now)),
  db.rpc('market_block_alerts',{p_min:BLOCKS_ALERT}).then(must).then(rows=>(rows||[]).length),
  count(db.from('market_search_misses').select('query',{count:'exact',head:true}).is('handled_at',null)),
 ]);
 return {pending,reports,bans,alerts,misses};
}

// ---- Listings ----
async function presentListings(db,rows,places){
 const ids=rows.map(row=>row.seller_id);
 const [names,reportRows]=await Promise.all([displayNames(db,ids),
  rows.length?db.from('market_reports').select('listing_id').in('listing_id',rows.map(row=>row.id)).eq('status','open').then(must):[]]);
 const reports=new Map();for(const row of reportRows||[])reports.set(row.listing_id,(reports.get(row.listing_id)||0)+1);
 return rows.map(row=>{const where=placeNames(places,row.governorate_id,row.district_id);return {
  id:row.id,number:row.number,status:row.status,statusLabel:STATUS_LABELS[row.status]||row.status,title:row.title,description:row.description,
  price:row.price===null?null:formatPrice(row.price,row.currency),photos:(row.images||[]).map(image=>'/api/market/img/'+image.id+'/thumb'),
  reviewReason:row.review_reason,place:[where.governorate,where.district].filter(Boolean).join(' · '),sellerId:row.seller_id,sellerName:nameOf(names,row.seller_id),
  publishedAt:row.published_at,editedAt:row.edited_at,openReports:reports.get(row.id)||0};});
}
export async function pendingListings(db,places){
 const rows=must(await db.from('market_listings').select(LISTING).eq('status','pending_review').order('updated_at',{ascending:true}).limit(50))||[];
 return presentListings(db,rows,places);
}
export async function findListing(db,places,number){
 if(!/^\d{1,12}$/.test(String(number||'')))throw new MarketActionError('NOT_FOUND','اكتب رقم الإعلان.',400);
 const row=must(await db.from('market_listings').select(LISTING).eq('number',Number(number)).neq('status','draft').maybeSingle());
 if(!row)throw new MarketActionError('NOT_FOUND','لا يوجد إعلان منشور بهذا الرقم.',404);
 return (await presentListings(db,[row],places))[0];
}

// approve / reject a held listing · hold / remove any published one. The seller is told why.
const DECISIONS={
 approve:{from:['pending_review'],kind:'listing_approved',needsReason:false},
 reject:{from:['pending_review'],kind:'listing_rejected',needsReason:true},
 hold:{from:['active','reserved'],kind:'listing_held',needsReason:true},
 remove:{from:['pending_review','active','reserved','expired','sold'],kind:'listing_removed',needsReason:true},
};
export async function decideListing(db,actor,{id,decision,reason=''},{reportId=null}={}){
 const rule=DECISIONS[decision];
 if(!rule)throw new MarketActionError('BAD_ACTION','الإجراء غير مدعوم.',400);
 if(!isId(id))throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
 const listing=must(await db.from('market_listings').select(LISTING).eq('id',id).maybeSingle());
 if(!listing)throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
 if(!rule.from.includes(listing.status))throw new MarketActionError('STATUS','حالة الإعلان الآن «'+(STATUS_LABELS[listing.status]||listing.status)+'»، فلا ينطبق هذا الإجراء.');
 const why=rule.needsReason?reasonText(reason):null;
 const now=new Date();
 const patch=decision==='approve'
  ?{status:listing.reserved_for?'reserved':'active',review_reason:null,expires_at:new Date(now.getTime()+LISTING_DAYS*86400000).toISOString()}
  :{status:decision==='hold'?'pending_review':'removed',review_reason:why};
 const saved=must(await db.from('market_listings').update(patch).eq('id',listing.id).eq('status',listing.status).select('id,status').maybeSingle());
 if(!saved)throw new MarketActionError('STATUS','تغيّرت حالة الإعلان للتو. حدّث الصفحة.');
 await notice(db,listing.seller_id,rule.kind,{listingId:listing.id,subject:listing.title,detail:why?'السبب: '+why:''});
 // Reports about this listing are answered by the decision.
 if(decision!=='approve'){
  let query=db.from('market_reports').update({status:'resolved',action:decision+'_listing',resolved_by:actor.user.id,resolved_at:now.toISOString()}).eq('status','open');
  query=reportId?query.or('listing_id.eq.'+listing.id+',id.eq.'+reportId):query.eq('listing_id',listing.id);
  must(await query);
 }
 return {id:listing.id,status:saved.status};
}

// ---- Reports ----
export async function listReports(db,places,{status='open'}={}){
 const wanted=['open','resolved','dismissed'].includes(status)?status:'open';
 const rows=must(await db.from('market_reports').select('id,number,reporter_id,target,listing_id,chat_id,rating_id,reported_id,reason,note,status,action,resolved_at,created_at')
  .eq('status',wanted).order('created_at',{ascending:wanted==='open'}).limit(60))||[];
 const listingIds=[...new Set(rows.map(row=>row.listing_id).filter(Boolean))];
 const chatIds=[...new Set(rows.map(row=>row.chat_id).filter(Boolean))];
 const ratingIds=[...new Set(rows.map(row=>row.rating_id).filter(Boolean))];
 const reportedIds=[...new Set(rows.map(row=>row.reported_id).filter(Boolean))];
 const [listings,chats,ratings,history,blocks,bans]=await Promise.all([
  listingIds.length?db.from('market_listings').select('id,number,title,status,images,seller_id').in('id',listingIds).then(must):[],
  chatIds.length?db.from('market_chats').select('id,listing_id,seller_id,buyer_id').in('id',chatIds).then(must):[],
  ratingIds.length?db.from('market_ratings').select('id,'+RATING_CRITERIA.map(item=>item.key).join(',')+',comment,reply,hidden,buyer_id').in('id',ratingIds).then(must):[],
  reportedIds.length?db.from('market_reports').select('reported_id').in('reported_id',reportedIds).then(must):[],
  reportedIds.length?db.from('private_user_blocks').select('blocked_id').in('blocked_id',reportedIds).then(must):[],
  reportedIds.length?db.from('market_bans').select('user_id,until').in('user_id',reportedIds).is('lifted_at',null).then(must):[],
 ]);
 const chatListings=[...new Set((chats||[]).map(chat=>chat.listing_id).filter(id=>id&&!listingIds.includes(id)))];
 const extra=chatListings.length?must(await db.from('market_listings').select('id,number,title,status,images,seller_id').in('id',chatListings)):[];
 const listingMap=new Map([...(listings||[]),...(extra||[])].map(row=>[row.id,row]));
 const chatMap=new Map((chats||[]).map(row=>[row.id,row]));
 const ratingMap=new Map((ratings||[]).map(row=>[row.id,row]));
 const tally=(list,key)=>{const map=new Map();for(const row of list||[])map.set(row[key],(map.get(row[key])||0)+1);return map;};
 const reportCount=tally(history,'reported_id'),blockCount=tally(blocks,'blocked_id');
 const banned=new Set((bans||[]).filter(ban=>!ban.until||Date.parse(ban.until)>Date.now()).map(ban=>ban.user_id));
 const names=await displayNames(db,[...rows.flatMap(row=>[row.reporter_id,row.reported_id]),...(chats||[]).flatMap(chat=>[chat.seller_id,chat.buyer_id])]);
 return rows.map(row=>{
  const chat=row.chat_id?chatMap.get(row.chat_id):null;
  const listing=listingMap.get(row.listing_id||chat?.listing_id);
  const rating=row.rating_id?ratingMap.get(row.rating_id):null;
  // Who is the seller and who the buyer, for «إيقاف البائع» / «إيقاف المشتري».
  // A rating report comes from the seller, so only the buyer who wrote it is offered.
  const sellerId=row.target==='rating'?null:chat?.seller_id||listing?.seller_id||null;
  const buyerId=chat?.buyer_id||(row.target==='rating'?rating?.buyer_id:null);
  return {id:row.id,number:row.number,target:row.target,targetLabel:REPORT_TARGET_LABELS[row.target],reason:reportReasonLabel(row.reason),note:row.note,
   status:row.status,action:row.action,createdAt:row.created_at,resolvedAt:row.resolved_at,
   reporter:{id:row.reporter_id,name:nameOf(names,row.reporter_id)},
   reported:row.reported_id?{id:row.reported_id,name:nameOf(names,row.reported_id),reports:reportCount.get(row.reported_id)||0,blocks:blockCount.get(row.reported_id)||0,banned:banned.has(row.reported_id)}:null,
   listing:listing?{id:listing.id,number:listing.number,title:listing.title,status:listing.status,statusLabel:STATUS_LABELS[listing.status],cover:cover(listing)}:null,
   chat:chat?{id:chat.id,seller:{id:chat.seller_id,name:nameOf(names,chat.seller_id)},buyer:{id:chat.buyer_id,name:nameOf(names,chat.buyer_id)}}:null,
   rating:rating?{overall:ratingOverall(rating),comment:rating.comment,reply:rating.reply,hidden:rating.hidden}:null,
   parties:{seller:sellerId?{id:sellerId,name:nameOf(names,sellerId)}:null,buyer:buyerId?{id:buyerId,name:nameOf(names,buyerId)}:null}};
 });
}

async function openReport(db,id){
 if(!isId(id))throw new MarketActionError('NOT_FOUND','لم نجد هذا البلاغ.',404);
 const report=must(await db.from('market_reports').select('id,target,listing_id,chat_id,rating_id,reported_id,reporter_id,status').eq('id',id).maybeSingle());
 if(!report)throw new MarketActionError('NOT_FOUND','لم نجد هذا البلاغ.',404);
 if(report.status!=='open')throw new MarketActionError('CLOSED','عولج هذا البلاغ من قبل.');
 return report;
}
async function closeReport(db,actor,id,status,action){
 must(await db.from('market_reports').update({status,action,resolved_by:actor.user.id,resolved_at:new Date().toISOString()}).eq('id',id).eq('status','open'));
}
// The user an action is aimed at: «seller» or «buyer» of the reported thing, or the reported member.
async function partyOf(db,report,who){
 if(who==='reported')return report.reported_id;
 if(report.chat_id){const chat=must(await db.from('market_chats').select('seller_id,buyer_id').eq('id',report.chat_id).maybeSingle());return who==='seller'?chat?.seller_id:chat?.buyer_id;}
 if(report.rating_id){const rating=must(await db.from('market_ratings').select('seller_id,buyer_id').eq('id',report.rating_id).maybeSingle());return who==='seller'?rating?.seller_id:rating?.buyer_id;}
 if(report.listing_id&&who==='seller'){const listing=must(await db.from('market_listings').select('seller_id').eq('id',report.listing_id).maybeSingle());return listing?.seller_id;}
 return null;
}

// Spec: «حظر البائع، أو حظر المشتري، أو إرسال رسالة تنبيه، أو حذف الإعلان»; also dismiss, hold
// the listing for review, and hide a reported rating.
export async function actOnReport(db,actor,{id,action,who='reported',days=null,reason='',message=''}){
 const report=await openReport(db,id);
 if(action==='dismiss'){await closeReport(db,actor,report.id,'dismissed','dismiss');return {status:'dismissed'};}
 if(action==='warn'){
  const target=await partyOf(db,report,who);
  if(!target)throw new MarketActionError('NOT_FOUND','لم يعد هذا الحساب موجودًا.',404);
  await sendTeamMessage(db,actor,{userId:target,message});
  await closeReport(db,actor,report.id,'resolved','warn');
  return {status:'resolved'};
 }
 if(action==='ban'){
  const target=await partyOf(db,report,who);
  if(!target)throw new MarketActionError('NOT_FOUND','لم يعد هذا الحساب موجودًا.',404);
  await banMember(db,actor,{userId:target,days,reason,reportId:report.id});
  await closeReport(db,actor,report.id,'resolved','ban_'+who);
  return {status:'resolved'};
 }
 if(action==='remove_listing'||action==='hold_listing'){
  if(!report.listing_id)throw new MarketActionError('NOT_FOUND','هذا البلاغ ليس عن إعلان.',400);
  await decideListing(db,actor,{id:report.listing_id,decision:action==='remove_listing'?'remove':'hold',reason},{reportId:report.id});
  return {status:'resolved'};
 }
 if(action==='hide_rating'){
  if(!report.rating_id)throw new MarketActionError('NOT_FOUND','هذا البلاغ ليس عن تقييم.',400);
  must(await db.from('market_ratings').update({hidden:true}).eq('id',report.rating_id));
  await closeReport(db,actor,report.id,'resolved','hide_rating');
  return {status:'resolved'};
 }
 throw new MarketActionError('BAD_ACTION','الإجراء غير مدعوم.',400);
}

// Spec (terms §6): the team may read a reported chat to check the report. Logged first.
export async function reportedChat(db,actor,reportId){
 managementOnly(actor);
 if(!isId(reportId))throw new MarketActionError('NOT_FOUND','لم نجد هذا البلاغ.',404);
 const report=must(await db.from('market_reports').select('id,chat_id').eq('id',reportId).maybeSingle());
 if(!report?.chat_id)throw new MarketActionError('NOT_FOUND','هذا البلاغ ليس عن محادثة.',404);
 must(await db.from('market_report_views').insert({report_id:report.id,viewer_id:actor.user.id}));
 const chat=must(await db.from('market_chats').select('id,seller_id,buyer_id').eq('id',report.chat_id).single());
 const [messages,offers]=await Promise.all([
  db.from('market_messages').select('id,sender_id,kind,body,image,offer_id,created_at').eq('chat_id',chat.id).order('created_at',{ascending:false}).limit(300).then(must),
  db.from('market_offers').select('id,amount,currency,from_role,status').eq('chat_id',chat.id).then(must),
 ]);
 const offerMap=new Map((offers||[]).map(offer=>[offer.id,offer]));
 const role=id=>id===chat.seller_id?'البائع':id===chat.buyer_id?'المشتري':'النظام';
 return {messages:(messages||[]).reverse().map(message=>{const offer=offerMap.get(message.offer_id);return {id:message.id,from:message.kind==='system'?'النظام':role(message.sender_id),kind:message.kind,
  body:message.body,image:message.image?.id?chatImageUrl(message.image.id,'full'):null,offer:offer?formatPrice(offer.amount,offer.currency):null,createdAt:message.created_at};})};
}

// ---- Members: bans, the block alert, messages ----
export async function banMember(db,actor,{userId,days=null,reason='',reportId=null}){
 managementOnly(actor);
 if(!isId(userId))throw new MarketActionError('NOT_FOUND','لم نجد هذا الحساب.',404);
 if(userId===actor.user.id)throw new MarketActionError('SELF','لا يمكنك إيقاف حسابك.');
 const {data:staff}=await db.from('editors').select('role').eq('user_id',userId).maybeSingle();
 if(staff)throw new MarketActionError('STAFF','لا يمكن إيقاف حساب من فريق 967 من هنا.');
 const why=reasonText(reason,'سبب الإيقاف');
 const until=banUntil(days===''?null:days);
 must(await db.from('market_bans').update({lifted_at:new Date().toISOString(),lifted_by:actor.user.id}).eq('user_id',userId).is('lifted_at',null));
 const ban=must(await db.from('market_bans').insert({user_id:userId,reason:why,until,report_id:isId(reportId)?reportId:null,created_by:actor.user.id}).select('id,until').single());
 const when=until?'حتى '+new Intl.DateTimeFormat('ar',{dateStyle:'long'}).format(new Date(until))+'. ':'';
 await notice(db,userId,'market_ban',{detail:when+'السبب: '+why.replace(/[.،]+$/,'')+'. لا تظهر إعلاناتك ولا يمكنك النشر أو المراسلة في السوق خلال الإيقاف.'});
 return ban;
}
export async function liftBan(db,actor,{id}){
 managementOnly(actor);
 if(!isId(id))throw new MarketActionError('NOT_FOUND','لم نجد هذا الإيقاف.',404);
 const lifted=must(await db.from('market_bans').update({lifted_at:new Date().toISOString(),lifted_by:actor.user.id}).eq('id',id).is('lifted_at',null).select('user_id').maybeSingle());
 if(!lifted)throw new MarketActionError('NOT_FOUND','رُفع هذا الإيقاف من قبل.',404);
 await notice(db,lifted.user_id,'admin_message',{detail:'رُفع إيقاف حسابك في السوق. يمكنك النشر والمراسلة من جديد.'});
 return {lifted:true};
}
export async function activeBans(db){
 const now=new Date().toISOString();
 const rows=must(await db.from('market_bans').select('id,user_id,reason,until,created_at,created_by').is('lifted_at',null).or('until.is.null,until.gt.'+now).order('created_at',{ascending:false}).limit(100))||[];
 const names=await displayNames(db,rows.flatMap(row=>[row.user_id,row.created_by]));
 return rows.map(row=>({id:row.id,user:{id:row.user_id,name:nameOf(names,row.user_id)},reason:row.reason,until:row.until,createdAt:row.created_at,by:nameOf(names,row.created_by)}));
}
// Spec: three different members blocking the same person.
export async function blockAlerts(db){
 const rows=must(await db.rpc('market_block_alerts',{p_min:BLOCKS_ALERT}))||[];
 const ids=rows.map(row=>row.user_id);
 const [names,bans,reports]=await Promise.all([displayNames(db,ids),
  ids.length?db.from('market_bans').select('user_id,until').in('user_id',ids).is('lifted_at',null).then(must):[],
  ids.length?db.from('market_reports').select('reported_id').in('reported_id',ids).then(must):[]]);
 const banned=new Set((bans||[]).filter(ban=>!ban.until||Date.parse(ban.until)>Date.now()).map(ban=>ban.user_id));
 const reportCount=new Map();for(const row of reports||[])reportCount.set(row.reported_id,(reportCount.get(row.reported_id)||0)+1);
 return rows.map(row=>({user:{id:row.user_id,name:nameOf(names,row.user_id)},blockers:Number(row.blockers),
  reasons:Object.entries(row.reasons||{}).map(([key,count])=>({label:blockReasonLabel(key)||key,count:Number(count)})),latest:row.latest,
  banned:banned.has(row.user_id),reports:reportCount.get(row.user_id)||0}));
}
// Spec: «إرسال رسالة خاصة للمستخدم» — it reaches the member's notifications in full.
export async function sendTeamMessage(db,actor,{userId,message}){
 if(!isId(userId))throw new MarketActionError('NOT_FOUND','لم نجد هذا الحساب.',404);
 const text=validateAdminMessage(message);
 const exists=must(await db.from('public_profiles').select('user_id').eq('user_id',userId).maybeSingle());
 if(!exists)throw new MarketActionError('NOT_FOUND','لم نجد هذا الحساب.',404);
 await notice(db,userId,'admin_message',{detail:text});
 return {sent:true};
}

// ---- Catalogue upkeep (spec: the brand lists and the synonyms dictionary grow with use) ----
// Brands and models sellers typed under «أخرى», most common first, to add to lib/market/catalog.js.
export async function otherValues(db){
 const rows=must(await db.rpc('market_other_values'))||[];
 return rows.map(row=>{
  const category=findCategory(row.category),sub=findSubcategory(row.category,row.subcategory);
  const field=sub?.fields.find(item=>item.key===row.field);
  return {section:category&&sub?category.label+' / '+sub.label:row.subcategory,field:field?.label||row.field,value:row.value,listings:Number(row.listings),latest:row.latest,example:row.example};
 });
}
// Searches that found nothing anywhere, and the synonym groups the team added.
export async function searchMisses(db){
 const [misses,groups]=await Promise.all([
  db.from('market_search_misses').select('query,count,first_at,last_at').is('handled_at',null).order('count',{ascending:false}).order('last_at',{ascending:false}).limit(100).then(must),
  db.from('market_synonyms').select('id,words,created_at').order('created_at',{ascending:false}).limit(200).then(must),
 ]);
 return {misses:misses||[],synonyms:groups||[]};
}
const missKey=value=>normalizeSearch(value).slice(0,80);
export async function handleMiss(db,actor,{query}){
 const key=missKey(query);
 if(!key)throw new MarketActionError('NOT_FOUND','لم نجد هذا البحث.',404);
 must(await db.from('market_search_misses').update({handled_at:new Date().toISOString()}).eq('query',key));
 return {handled:true};
}
// «تلفون = جوال»: the searched word(s) and the words that mean the same. Takes effect within minutes.
export async function addSynonym(db,actor,{words,query=null}){
 const typed=[...new Set(String(Array.isArray(words)?words.join('،'):words||'').split(/[،,=\n]+/).map(word=>normalizeSearch(word)).filter(word=>word.length>=2&&word.length<=30&&!word.includes(' ')))];
 const searched=query?missKey(query).split(' ').filter(word=>word.length>=2):[];
 const list=[...new Set([...searched,...typed])];
 if(list.length<2||!typed.some(word=>!searched.includes(word)))throw new MarketActionError('WORDS','اكتب كلمة واحدة على الأقل بالمعنى نفسه (حرفان أو أكثر). افصل بين الكلمات بفاصلة.',400);
 if(list.length>10)throw new MarketActionError('WORDS','عشر كلمات على الأكثر في المجموعة الواحدة.',400);
 const saved=must(await db.from('market_synonyms').insert({words:list,created_by:actor.user.id}).select('id,words').single());
 if(query)await handleMiss(db,actor,{query});
 forgetTeamSynonyms();
 return saved;
}
export async function removeSynonym(db,actor,{id}){
 if(!isId(id))throw new MarketActionError('NOT_FOUND','لم نجد هذه المجموعة.',404);
 must(await db.from('market_synonyms').delete().eq('id',id));
 forgetTeamSynonyms();
 return {removed:true};
}
