import {marketMember} from '@/lib/market/access';
import {getMarketPlaces,governorateIdByName} from '@/lib/market/places';
import {MarketActionError,getOwnDraft,getOwnForEdit,publishListing,saveDraft,sellerDefaults,updateListing} from '@/lib/market/listingsServer';
import {ListingError} from '@/lib/market/listing';
import {orderCategories} from '@/lib/market/catalog';
import {marketCategoryCounts} from '@/lib/market/searchServer';
import {readJsonObject,RequestValidationError} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function failure(error){
 if(error instanceof ListingError)return json({error:error.message,field:error.field},400);
 if(error instanceof MarketActionError)return json({error:error.message,code:error.code},error.status);
 if(error instanceof RequestValidationError)return json({error:error.message},error.status);
 console.error('market listings request failed',error?.code||error?.status||error?.name||'unknown');
 return json({error:'تعذر حفظ الإعلان. حاول مجددًا.'},503);
}

// What the posting form starts from: the seller's usual place and currency, whether the terms
// and a WhatsApp number are already on file, and a draft when one is being continued.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  const params=new URL(request.url).searchParams;
  const draftId=params.get('draft'),editId=params.get('edit');
  if((draftId&&!UUID.test(draftId))||(editId&&!UUID.test(editId)))throw new RequestValidationError('رابط الإعلان غير صالح.',400);
  const [defaults,places,counts]=await Promise.all([sellerDefaults(db,user),getMarketPlaces(),marketCategoryCounts(db).catch(()=>({}))]);
  const governorate_id=defaults.governorate_id||governorateIdByName(places,defaults.governorateName);
  // The posting form lists the busiest categories first, like the market home.
  const categoryOrder=orderCategories(counts).map(category=>category.key);
  return json({defaults:{...defaults,governorate_id,categoryOrder},draft:draftId?await getOwnDraft(db,user,draftId):null,editing:editId?await getOwnForEdit(db,user,editId):null});
 }catch(error){return failure(error);}
}

export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,40000);
  if(body.id!==undefined&&body.id!==null&&!UUID.test(body.id))throw new RequestValidationError('الإعلان غير صالح.',400);
  const places=await getMarketPlaces();
  const input={id:body.id||null,data:body.data||{},images:body.images||[]};
  if(body.action==='save')return json({listing:await saveDraft(db,user,input,places)});
  if(body.action==='update')return json({listing:await updateListing(db,user,{...input,phone:body.phone||null},places)});
  if(body.action==='publish')return json({listing:await publishListing(db,user,{...input,acceptTerms:body.acceptTerms===true,confirmGenuine:body.confirmGenuine===true,phone:body.phone||null},places)},201);
  throw new RequestValidationError('الإجراء غير مدعوم.',400);
 }catch(error){return failure(error);}
}
