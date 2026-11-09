import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {getMarketPlaces,placeChecks} from '@/lib/market/places';
import {parseFilters} from '@/lib/market/search';
import {createSavedSearch,deleteSavedSearch,listSavedSearches,updateSavedSearch} from '@/lib/market/searchServer';
import {readJsonObject} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  return marketJson({items:await listSavedSearches(db,user)});
 }catch(error){return marketFailure(error);}
}

// POST {query: "q=…&category=…"} saves the search shown on a search page.
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,2000);
  const places=await getMarketPlaces();
  const filters=parseFilters(new URLSearchParams(typeof body.query==='string'?body.query.slice(0,1000):''),placeChecks(places));
  return marketJson({item:await createSavedSearch(db,user,filters,places)},201);
 }catch(error){return marketFailure(error);}
}

// PATCH {id, notify} turns its notifications on or off; DELETE {id} removes it.
export async function PATCH(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,1000);
  return marketJson({item:await updateSavedSearch(db,user,body.id,{notify:body.notify===true})});
 }catch(error){return marketFailure(error);}
}
export async function DELETE(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,1000);
  await deleteSavedSearch(db,user,body.id);
  return marketJson({ok:true});
 }catch(error){return marketFailure(error);}
}
