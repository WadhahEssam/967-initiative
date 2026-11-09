import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {getMarketPlaces} from '@/lib/market/places';
import {addFavourite,isFavourite,listFavourites,removeFavourite} from '@/lib/market/searchServer';
import {readJsonObject} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// GET ?listing=<id> → {saved}; GET → {items} (the member's favourites page).
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  const listing=new URL(request.url).searchParams.get('listing');
  if(listing)return marketJson({saved:await isFavourite(db,user,listing)});
  return marketJson({items:await listFavourites(db,user,await getMarketPlaces())});
 }catch(error){return marketFailure(error);}
}

// POST {listingId} saves a listing; DELETE {listingId} removes it.
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,1000);
  return marketJson(await addFavourite(db,user,body.listingId));
 }catch(error){return marketFailure(error);}
}
export async function DELETE(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,1000);
  return marketJson(await removeFavourite(db,user,body.listingId));
 }catch(error){return marketFailure(error);}
}
