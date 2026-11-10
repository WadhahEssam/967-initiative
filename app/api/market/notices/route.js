import {marketMember} from '@/lib/market/access';
import {marketFailure,marketJson} from '@/lib/market/apiResponse';
import {memberNotices} from '@/lib/market/moderationServer';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// GET: the member's notices from the team (messages, review decisions, bans), in full.
export async function GET(request){
 try{
  const {db,user}=await marketMember(request);
  return marketJson(await memberNotices(db,user));
 }catch(error){return marketFailure(error);}
}
