import {loadShareCard,renderShareCard} from '@/lib/shareCardServer';
import {shareCardKinds} from '@/lib/shareCard';
import {recordOperationalEvent} from '@/lib/operationalEvents';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// Rendered cards are kept in memory (about 40 KB each). The ?v= tag in page metadata changes
// when the content changes, so a new card is drawn and social sites fetch it again.
const MAX_CARDS=400;
const cards=new Map();
const remember=(key,png)=>{cards.delete(key);cards.set(key,png);if(cards.size>MAX_CARDS)cards.delete(cards.keys().next().value);};
const pending=new Map();

export async function GET(request,{params}){
 const {kind,id:rawId}=await params;
 let id;try{id=decodeURIComponent(rawId);}catch{return new Response('Not found',{status:404});}
 if(!shareCardKinds.includes(kind))return new Response('Not found',{status:404});
 const version=new URL(request.url).searchParams.get('v')||'';
 const key=kind+'|'+id+'|'+version.slice(0,16);
 let png=cards.get(key);
 if(!png){
  if(!pending.has(key))pending.set(key,(async()=>{
   const card=await loadShareCard(kind,id);
   return card?renderShareCard(card):null;
  })().finally(()=>pending.delete(key)));
  try{png=await pending.get(key);}
  catch(error){recordOperationalEvent('request_error',{source:'page',status:503});void error;return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
  if(!png)return new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=300'}});
  remember(key,png);
 }
 return new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Robots-Tag':'noindex'}});
}
