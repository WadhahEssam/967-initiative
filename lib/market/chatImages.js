import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';

// Photos sent in a chat are private: the server gives each participant a signed link that works
// until the end of the next day (stable within a day, so the browser can cache it).
const DAY=86400;
const secret=()=>process.env.MARKET_IMAGE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const signature=(id,size,expires)=>createHmac('sha256','967-market-chat-image:'+secret()).update(id+'|'+size+'|'+expires).digest('base64url').slice(0,32);

export function chatImageUrl(id,size,now=Date.now()){
 const expires=(Math.floor(now/1000/DAY)+2)*DAY;
 return '/api/market/chat-img/'+id+'/'+size+'?e='+expires+'&s='+signature(id,size,expires);
}
export function chatImageAllowed(id,size,expires,given,now=Date.now()){
 if(!secret()||!/^\d{9,11}$/.test(String(expires))||Number(expires)*1000<now||typeof given!=='string')return false;
 const expected=Buffer.from(signature(id,size,expires)),actual=Buffer.from(given);
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
