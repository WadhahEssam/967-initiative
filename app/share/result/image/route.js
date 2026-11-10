import {renderShareCard} from '@/lib/shareCardServer';
import {parseResultShare,resultShareQuery} from '@/lib/resultShare';
import {describeResult} from '@/lib/resultShareServer';
import {recordOperationalEvent} from '@/lib/operationalEvents';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// The preview image of a shared result (/share/result). Only parsed values reach the card, so
// the address cannot put arbitrary text on it. Rendered images are kept in memory.
const MAX_CARDS=300;
const cards=new Map(),pending=new Map();
const remember=(key,png)=>{cards.delete(key);cards.set(key,png);if(cards.size>MAX_CARDS)cards.delete(cards.keys().next().value);};

export async function GET(request){
 const result=parseResultShare(new URL(request.url).searchParams);
 if(!result)return new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
 const key=resultShareQuery(result);
 let png=cards.get(key);
 if(!png){
  if(!pending.has(key))pending.set(key,(async()=>{
   const card=await describeResult(result);
   return card?renderShareCard(card):null;
  })().finally(()=>pending.delete(key)));
  try{png=await pending.get(key);}
  catch(error){recordOperationalEvent('request_error',{source:'page',status:503});void error;return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
  if(!png)return new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
  remember(key,png);
 }
 return new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Robots-Tag':'noindex'}});
}
