import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {fileReport} from '@/lib/market/safetyServer';
import {readJsonObject} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// POST {target:'listing'|'user'|'chat', listingId|userId|chatId, reason, note}: a report for the
// team (ratings are reported from /api/market/ratings). One open report per member and thing.
export async function POST(request){
 try{
  const {db,user}=await marketMember(request);
  const body=await readJsonObject(request,3000);
  if(body.target==='rating')return marketJson({error:'أبلغ عن التقييم من صفحتك في السوق.'},400);
  return marketJson(await fileReport(db,user,body),201);
 }catch(error){return marketFailure(error);}
}
