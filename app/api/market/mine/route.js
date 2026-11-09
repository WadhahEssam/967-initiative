import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {changeListingStatus,myListings} from '@/lib/market/chatServer';
import {readJsonObject} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// «إعلاناتي»: the member's listings with new messages and offers, and their status changes.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  return marketJson({items:await myListings(db,user)});
 }catch(error){return marketFailure(error);}
}
// POST {id, action: sold|reserve|available|remove|renew}
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,1000);
  return marketJson(await changeListingStatus(db,user,{id:body.id,action:body.action}));
 }catch(error){return marketFailure(error);}
}
