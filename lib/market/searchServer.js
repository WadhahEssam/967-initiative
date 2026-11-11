import 'server-only';
import {MarketActionError,PUBLIC_STATUSES,toCard} from './listingsServer';
import {ALL_YEMEN,describeFilters,queryGroups,savedFilters,searchHref,setTeamSynonyms} from './search.js';
import {normalizeSearch} from './text.js';
import {placeNames} from './places';

const must=result=>{if(result.error)throw result.error;return result.data;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_SAVED_SEARCHES=20;
export const MAX_FAVOURITES=300;

// ---- Category order ----
// Live listings per category, read at most every 5 minutes; the order of the category icons.
let categoryCounts={value:{},readAt:0};
export async function marketCategoryCounts(db){
 if(!db||Date.now()-categoryCounts.readAt<300000)return categoryCounts.value;
 const {data,error}=await db.rpc('market_category_counts');
 if(error)return categoryCounts.value;
 categoryCounts={value:Object.fromEntries((data||[]).map(row=>[row.category,Number(row.listings)||0])),readAt:Date.now()};
 return categoryCounts.value;
}

// ---- Search ----
// Listings for a search page or the market home. Returns {cards, more} (more: a next page exists).
// The team's synonyms (/admin/market), read at most every 5 minutes.
let synonymsReadAt=0;
export const forgetTeamSynonyms=()=>{synonymsReadAt=0;};
async function loadTeamSynonyms(db){
 if(Date.now()-synonymsReadAt<300000)return;
 const {data,error}=await db.from('market_synonyms').select('words').limit(500);
 if(error)return;
 synonymsReadAt=Date.now();
 setTeamSynonyms((data||[]).map(row=>row.words));
}

export async function searchListings(db,places,filters,{limit=24,notGovernorate=null}={}){
 if(filters.q)await loadTeamSynonyms(db);
 const page=filters.page||1;
 const rows=must(await db.rpc('market_search',{
  p_groups:filters.q?queryGroups(filters.q):[],p_category:filters.category||null,p_subcategory:filters.sub||null,
  p_governorate:filters.gov&&filters.gov!==ALL_YEMEN?filters.gov:null,p_not_governorate:notGovernorate,p_district:filters.district||null,
  p_currency:filters.currency||null,p_min:filters.min??null,p_max:filters.max??null,p_condition:filters.condition||null,
  p_sort:filters.sort||'new',p_limit:limit+1,p_offset:(page-1)*limit,
 }))||[];
 return {cards:rows.slice(0,limit).map(row=>toCard(row,places)),more:rows.length>limit};
}

// Words that find nothing anywhere in Yemen, even without filters, are counted (normalised words
// only) to grow the synonyms list. A search that is empty only because of its filters is not a miss.
export async function logSearchMiss(db,places,query){
 const words=normalizeSearch(query).slice(0,80);
 if(words.length<2)return;
 const anywhere=await searchListings(db,places,{q:query,gov:ALL_YEMEN},{limit:1}).catch(()=>null);
 if(!anywhere||anywhere.cards.length)return;
 await db.rpc('market_log_miss',{p_query:words}).then(()=>null,()=>null);
}

// ---- Favourites ----
const LISTING='id,number,seller_id,status,category,subcategory,title,price,currency,negotiable,condition,governorate_id,district_id,attributes,images,published_at,sold_at';
const isListingId=id=>typeof id==='string'&&UUID.test(id);

export async function isFavourite(db,user,listingId){
 if(!isListingId(listingId))return false;
 return Boolean(must(await db.from('market_favourites').select('listing_id').eq('user_id',user.id).eq('listing_id',listingId).maybeSingle()));
}

export async function addFavourite(db,user,listingId){
 if(!isListingId(listingId))throw new MarketActionError('NOT_FOUND','لم نجد هذا الإعلان.',404);
 const listing=must(await db.from('market_listings').select('id,seller_id,status').eq('id',listingId).maybeSingle());
 if(!listing||!listing.seller_id||!PUBLIC_STATUSES.includes(listing.status))throw new MarketActionError('NOT_FOUND','هذا الإعلان لم يعد متاحًا.',404);
 if(listing.seller_id===user.id)throw new MarketActionError('OWN_LISTING','هذا إعلانك، وتجده في إعلاناتك.');
 const {count,error}=await db.from('market_favourites').select('listing_id',{count:'exact',head:true}).eq('user_id',user.id);
 if(error)throw error;
 if((count||0)>=MAX_FAVOURITES)throw new MarketActionError('TOO_MANY','المفضلة ممتلئة. احذف بعض الإعلانات القديمة منها أولًا.');
 const insert=await db.from('market_favourites').insert({user_id:user.id,listing_id:listingId});
 if(insert.error&&insert.error.code!=='23505')throw insert.error;
 return {saved:true};
}

export async function removeFavourite(db,user,listingId){
 if(!isListingId(listingId))return {saved:false};
 must(await db.from('market_favourites').delete().eq('user_id',user.id).eq('listing_id',listingId));
 return {saved:false};
}

// An available listing like one that is sold or expired: same section, brand and model, same
// governorate and currency, and a price within 30%.
async function availableAlternative(db,places,listing){
 if(listing.price===null||listing.price===undefined)return null;
 const price=Number(listing.price);
 const rows=must(await db.rpc('market_search',{p_subcategory:listing.subcategory,p_governorate:listing.governorate_id,p_currency:listing.currency,
  p_min:Math.floor(price*0.7),p_max:Math.ceil(price*1.3),p_limit:12}))||[];
 const same=key=>row=>!listing.attributes?.[key]||row.attributes?.[key]===listing.attributes[key];
 const match=rows.find(row=>row.id!==listing.id&&row.category===listing.category&&same('brand')(row)&&same('model')(row));
 return match?toCard(match,places):null;
}

const AVAILABILITY={active:'available',reserved:'available',sold:'sold',expired:'expired'};
export async function listFavourites(db,user,places){
 const rows=must(await db.from('market_favourites').select('created_at,listing:market_listings('+LISTING+')').eq('user_id',user.id).order('created_at',{ascending:false}).limit(MAX_FAVOURITES))||[];
 const items=[];
 for(const row of rows){
  const listing=row.listing;
  if(!listing)continue;
  const state=listing.seller_id?AVAILABILITY[listing.status]||'gone':'gone';
  // Sold listings stay public for two days; after that the card is shown without a link.
  const linkable=state==='available'||(state==='sold'&&Date.parse(listing.sold_at)>Date.now()-2*86400000);
  items.push({savedAt:row.created_at,state,linkable,listing:toCard(listing,places),
   alternative:state==='sold'||state==='expired'?await availableAlternative(db,places,listing).catch(()=>null):null});
 }
 return items;
}

// ---- Saved searches ----
const SAVED='id,filters,label,notify,created_at';
export async function listSavedSearches(db,user){
 return must(await db.from('market_saved_searches').select(SAVED).eq('user_id',user.id).order('created_at',{ascending:false}).limit(MAX_SAVED_SEARCHES))||[];
}

export async function createSavedSearch(db,user,filters,places){
 const kept=savedFilters(filters);
 if(kept.q)await loadTeamSynonyms(db);
 if(!Object.keys(kept).length)throw new MarketActionError('EMPTY_SEARCH','اختر كلمة بحث أو فلترًا واحدًا على الأقل لحفظ البحث.',400);
 const existing=await listSavedSearches(db,user);
 // The database may return the keys in another order.
 const canonical=value=>JSON.stringify(Object.keys(value||{}).sort().map(name=>[name,value[name]]));
 const same=existing.find(item=>canonical(item.filters)===canonical(kept));
 if(same)return same;
 if(existing.length>=MAX_SAVED_SEARCHES)throw new MarketActionError('TOO_MANY','لديك 20 بحثًا محفوظًا. احذف أحدها لتحفظ بحثًا جديدًا.');
 const names=placeNames(places,kept.gov||null,kept.district||null);
 return must(await db.from('market_saved_searches').insert({user_id:user.id,filters:kept,label:describeFilters(kept,names),
  // For the daily digest in the database (market_lifecycle): the query's spellings and the results page.
  query_groups:kept.q?queryGroups(kept.q):[],href:searchHref(kept)}).select(SAVED).single());
}

export async function updateSavedSearch(db,user,id,{notify}){
 if(!isListingId(id))throw new MarketActionError('NOT_FOUND','لم نجد هذا البحث.',404);
 const row=must(await db.from('market_saved_searches').update({notify:Boolean(notify)}).eq('id',id).eq('user_id',user.id).select(SAVED).maybeSingle());
 if(!row)throw new MarketActionError('NOT_FOUND','لم نجد هذا البحث.',404);
 return row;
}

export async function deleteSavedSearch(db,user,id){
 if(!isListingId(id))return;
 must(await db.from('market_saved_searches').delete().eq('id',id).eq('user_id',user.id));
}
