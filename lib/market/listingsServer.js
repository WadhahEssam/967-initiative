import 'server-only';
import {randomUUID} from 'node:crypto';
import {linkUploads,promoteUploads} from './uploads';
import {placeChecks,placeNames} from './places';
import {ListingError,editedParts,listingSearchText,previousPriceAfterEdit,validateListing} from './listing.js';
import {prohibitedMatches,reviewReason} from './moderation.js';
import {normalizeSearch} from './text.js';
import {normalizeYemeniMobile} from './format.js';

// Market terms version; a change asks sellers to accept again before their next listing.
export const TERMS_VERSION='2026-11';
export const DAILY_LISTINGS={base:5,confirmed:10};
export const LISTING_DAYS=30;
export const PUBLIC_STATUSES=['active','reserved'];
const COLUMNS='id,number,seller_id,status,category,subcategory,title,description,price,currency,negotiable,condition,governorate_id,district_id,attributes,images,show_whatsapp,views,saves,published_at,expires_at,sold_at,reserved_at,created_at,updated_at,review_reason,previous_price,edited_fields,edited_at';

export class MarketActionError extends Error{
 constructor(code,message,status=409){super(message);this.name='MarketActionError';this.code=code;this.status=status;}
}
const must=result=>{if(result.error)throw result.error;return result.data;};

// The photos a member chose, checked against their own uploads, as stored on a listing.
async function ownUploads(db,ownerId,ids,listingId=null){
 const unique=[...new Set((Array.isArray(ids)?ids:[]).filter(id=>typeof id==='string'))].slice(0,10);
 if(!unique.length)return [];
 const rows=must(await db.from('market_uploads').select('id,width,height,listing_id,chat_id').eq('owner_id',ownerId).in('id',unique));
 const byId=new Map(rows.map(row=>[row.id,row]));
 if(unique.some(id=>!byId.has(id)||byId.get(id).chat_id||(byId.get(id).listing_id&&byId.get(id).listing_id!==listingId)))
  throw new MarketActionError('PHOTO_NOT_YOURS','إحدى الصور غير متاحة. ارفعها مجددًا.',400);
 return unique.map(id=>({id,w:byId.get(id).width,h:byId.get(id).height}));
}
async function ownListing(db,userId,id){
 const row=must(await db.from('market_listings').select(COLUMNS).eq('id',id).eq('seller_id',userId).maybeSingle());
 if(!row)throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
 return row;
}

// WhatsApp needs a Yemeni mobile number, kept privately with the account.
async function ensureWhatsapp(db,user,listing,phone){
 if(!listing.show_whatsapp)return;
 const typed=phone?normalizeYemeniMobile(phone):null;
 if(phone&&!typed)throw new ListingError('رقم الجوال غير صحيح. اكتب رقمًا يمنيًا من 9 أرقام يبدأ بـ 7.','phone');
 if(typed)must(await db.from('market_seller_contacts').upsert({user_id:user.id,phone:typed,updated_at:new Date().toISOString()}));
 else if(!must(await db.from('market_seller_contacts').select('phone').eq('user_id',user.id).maybeSingle()))
  throw new MarketActionError('PHONE_REQUIRED','أضف رقم جوالك لإظهار زر واتساب.');
}

// Drafts are saved as they are typed, so nothing is lost; they never appear in the market.
export async function saveDraft(db,user,{id=null,data={},images=[]},places){
 const listing=validateListing(data,{places:placeChecks(places)});
 const photos=await ownUploads(db,user.id,images,id);
 const row={...listing,images:photos,search_text:listingSearchText(listing)};
 if(id){
  const current=await ownListing(db,user.id,id);
  if(current.status!=='draft')throw new MarketActionError('NOT_DRAFT','هذا الإعلان منشور. عدّله من صفحة إعلاناتي.');
  return must(await db.from('market_listings').update(row).eq('id',id).eq('seller_id',user.id).select('id,number,status').single());
 }
 const drafts=must(await db.from('market_listings').select('id',{count:'exact',head:false}).eq('seller_id',user.id).eq('status','draft'));
 if(drafts.length>=20)throw new MarketActionError('TOO_MANY_DRAFTS','لديك مسودات كثيرة. أكمل إحداها أو احذفها أولًا.');
 return must(await db.from('market_listings').insert({...row,seller_id:user.id,status:'draft'}).select('id,number,status').single());
}

export async function publishListing(db,user,{id=null,data={},images=[],acceptTerms=false,confirmGenuine=false,phone=null},places){
 const listing=validateListing(data,{complete:true,places:placeChecks(places)});
 if(!Array.isArray(images)||!images.length)throw new ListingError('أضف صورة واحدة على الأقل.','images');
 if(id){const current=await ownListing(db,user.id,id);if(current.status!=='draft')throw new MarketActionError('NOT_DRAFT','هذا الإعلان منشور بالفعل.');}
 // Market terms, once per version, before the first listing.
 const accepted=must(await db.from('market_terms_acceptances').select('version').eq('user_id',user.id).maybeSingle());
 if(accepted?.version!==TERMS_VERSION){
  if(!acceptTerms)throw new MarketActionError('TERMS_REQUIRED','وافق على شروط استخدام سوق 967 لنشر إعلانك.');
  must(await db.from('market_terms_acceptances').upsert({user_id:user.id,version:TERMS_VERSION,accepted_at:new Date().toISOString()}));
 }
 await ensureWhatsapp(db,user,listing,phone);
 // 5 listings a day; up to 10 after the seller confirms they are real; beyond that, ask the team.
 const since=new Date(Date.now()-24*60*60*1000).toISOString();
 const today=must(await db.from('market_listings').select('id').eq('seller_id',user.id).gte('published_at',since)).length;
 if(today>=DAILY_LISTINGS.confirmed)throw new MarketActionError('DAILY_LIMIT','وصلت إلى الحد اليومي للإعلانات. راسل الإدارة إن كنت تحتاج أكثر.',429);
 if(today>=DAILY_LISTINGS.base&&!confirmGenuine)throw new MarketActionError('CONFIRM_GENUINE','نشرت 5 إعلانات اليوم. أكّد أن إعلاناتك حقيقية لتنشر 5 إعلانات أخرى.');
 // The same item twice: same title, subcategory and price among the seller's live listings.
 const live=must(await db.from('market_listings').select('id,title,subcategory,price').eq('seller_id',user.id).in('status',['active','reserved','pending_review']));
 if(live.some(row=>row.id!==id&&row.subcategory===listing.subcategory&&Number(row.price)===listing.price&&normalizeSearch(row.title)===normalizeSearch(listing.title)))
  throw new MarketActionError('DUPLICATE','لديك إعلان منشور بالعنوان والسعر نفسيهما.');
 const now=new Date();
 const matches=prohibitedMatches(listing.title,listing.description,JSON.stringify(listing.attributes));
 const base={...listing,search_text:listingSearchText(listing),status:matches.length?'pending_review':'active',review_reason:matches.length?reviewReason(matches):null,
  published_at:now.toISOString(),expires_at:new Date(now.getTime()+LISTING_DAYS*86400000).toISOString()};
 // Photos are copied to their permanent place first, so a listing never goes live without them.
 const listingId=id||randomUUID();
 const photos=await promoteUploads(db,user.id,listingId,images);
 const saved=id
  ?must(await db.from('market_listings').update({...base,images:photos}).eq('id',id).eq('seller_id',user.id).select('id,number,status').single())
  :must(await db.from('market_listings').insert({...base,id:listingId,seller_id:user.id,images:photos}).select('id,number,status').single());
 await linkUploads(db,user.id,saved.id,photos);
 return {...saved,reviewReason:base.review_reason};
}

// The member's own draft, to continue it in the posting form.
export async function getOwnDraft(db,user,id){
 const row=await ownListing(db,user.id,id);
 if(row.status!=='draft')throw new MarketActionError('NOT_DRAFT','هذا الإعلان منشور بالفعل.');
 return row;
}

// ---- Editing a published listing ----
// The same form, with the listing's data. It keeps its publishing date; the category cannot change.
export const EDITABLE_STATUSES=['active','reserved','pending_review'];
export async function getOwnForEdit(db,user,id){
 const row=await ownListing(db,user.id,id);
 if(!EDITABLE_STATUSES.includes(row.status))throw new MarketActionError('NOT_EDITABLE','لا يمكن تعديل هذا الإعلان في حالته الحالية.');
 return row;
}
export async function updateListing(db,user,{id,data={},images=[],phone=null},places){
 const current=await getOwnForEdit(db,user,id);
 if(data.category!==current.category||data.subcategory!==current.subcategory)throw new ListingError('لا يمكن تغيير فئة الإعلان بعد نشره.','category');
 const listing=validateListing(data,{complete:true,places:placeChecks(places)});
 if(!Array.isArray(images)||!images.length)throw new ListingError('أضف صورة واحدة على الأقل.','images');
 await ensureWhatsapp(db,user,listing,phone);
 const photos=await promoteUploads(db,user.id,id,images);
 const changed=editedParts(current,{...listing,images:photos});
 // Showing or hiding the WhatsApp button is saved but is not marked «معدّل».
 if(!changed.length&&listing.show_whatsapp===current.show_whatsapp)return {id,number:current.number,status:current.status,changed};
 // Edited text goes through the prohibited-content check like a new listing.
 const matches=prohibitedMatches(listing.title,listing.description,JSON.stringify(listing.attributes));
 const status=matches.length?'pending_review':current.status;
 const patch={...listing,images:photos,search_text:listingSearchText(listing),status,review_reason:matches.length?reviewReason(matches):current.review_reason,
  previous_price:previousPriceAfterEdit(current,listing),edited_fields:[...new Set([...(current.edited_fields||[]),...changed])],edited_at:changed.length?new Date().toISOString():current.edited_at};
 const saved=must(await db.from('market_listings').update(patch).eq('id',id).eq('seller_id',user.id).select('id,number,status').single());
 await linkUploads(db,user.id,id,photos);
 return {...saved,changed,reviewReason:matches.length?patch.review_reason:null};
}
export async function sellerDefaults(db,user){
 const [preferences,contact,terms]=await Promise.all([
  db.from('account_preferences').select('governorate').eq('user_id',user.id).maybeSingle(),
  db.from('market_seller_contacts').select('phone').eq('user_id',user.id).maybeSingle(),
  db.from('market_terms_acceptances').select('version').eq('user_id',user.id).maybeSingle(),
 ]);
 const last=must(await db.from('market_listings').select('currency,governorate_id,district_id').eq('seller_id',user.id).not('published_at','is',null).order('published_at',{ascending:false}).limit(1));
 return {governorateName:preferences.data?.governorate||'',hasPhone:Boolean(contact.data?.phone),termsAccepted:terms.data?.version===TERMS_VERSION,
  currency:last[0]?.currency||null,governorate_id:last[0]?.governorate_id||null,district_id:last[0]?.district_id||null};
}

// ---- Reading (server pages) ----
const visible=row=>row&&row.seller_id&&(PUBLIC_STATUSES.includes(row.status)||(row.status==='sold'&&Date.parse(row.sold_at)>Date.now()-2*86400000));
export function toCard(row,places){
 const where=placeNames(places,row.governorate_id,row.district_id);
 return {id:row.id,number:row.number,category:row.category,subcategory:row.subcategory,title:row.title,price:row.price,currency:row.currency,negotiable:row.negotiable,condition:row.condition,status:row.status,
  cover:row.images?.[0]?.id?'/api/market/img/'+row.images[0].id+'/thumb':null,governorate:where.governorate,district:where.district,publishedAt:row.published_at};
}
export async function getPublicListing(db,number,places){
 if(!/^\d{1,12}$/.test(String(number)))return null;
 const row=must(await db.from('market_listings').select(COLUMNS).eq('number',Number(number)).maybeSingle());
 if(!visible(row))return null;
 const [profile,contact]=await Promise.all([
  db.from('public_profiles').select('display_name,created_at,suspended,deletion_requested_at').eq('user_id',row.seller_id).maybeSingle(),
  row.show_whatsapp?db.from('market_seller_contacts').select('phone').eq('user_id',row.seller_id).maybeSingle():Promise.resolve({data:null}),
 ]);
 if(profile.data?.suspended||profile.data?.deletion_requested_at)return null;
 const soldQuery=await db.from('market_listings').select('id',{count:'exact',head:true}).eq('seller_id',row.seller_id).eq('status','sold');
 if(soldQuery.error)throw soldQuery.error;
 const sold=soldQuery.count||0;
 return {...row,...placeNames(places,row.governorate_id,row.district_id),
  seller:{id:row.seller_id,name:profile.data?.display_name||'عضو 967',since:profile.data?.created_at||null,sold},
  whatsapp:row.show_whatsapp?contact.data?.phone||null:null};
}
// Same section, from sellers who are not suspended (market_search); same governorate first.
export async function similarListings(db,listing,places,limit=6){
 const rows=(must(await db.rpc('market_search',{p_category:listing.category,p_subcategory:listing.subcategory,p_limit:25}))||[]).filter(row=>row.id!==listing.id);
 return rows.sort((a,b)=>(b.governorate_id===listing.governorate_id)-(a.governorate_id===listing.governorate_id)).slice(0,limit).map(row=>toCard(row,places));
}
