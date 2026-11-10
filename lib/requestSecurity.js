// Shared by route handlers and regression tests; never log request bodies or tokens.
import {recordOperationalEvent} from './operationalEvents.js';
export class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Behind Coolify's proxy, request.url carries the app's internal address (http, internal host),
// so a browser on the public site never matched it and every same-site POST was refused.
// The public address is accepted by name: NEXT_PUBLIC_SITE_URL when it is a plain https origin,
// and the production domain. A Host header is never trusted for this.
const PRODUCTION_ORIGIN='https://967ye.com';
function publicSiteOrigins(env=process.env){
  const origins=new Set([PRODUCTION_ORIGIN]);
  try{
    const url=new URL(env.NEXT_PUBLIC_SITE_URL||'');
    if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash)origins.add(url.origin);
  }catch{}
  return origins;
}
export function isSameOrigin(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser clients still require API authorization.
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    if(!['https:', 'http:'].includes(source.protocol)||source.username||source.password||source.pathname!=='/'||source.search||source.hash)return false;
    if(source.origin===target.origin||(origin===source.origin&&publicSiteOrigins().has(source.origin)))return true;
    // Next's local server can report localhost internally while the browser uses
    // 127.0.0.1. Accept only a matching actual Host, port and scheme on loopback.
    const loopback=host=>['localhost','127.0.0.1','[::1]'].includes(host.toLowerCase());
    return loopback(source.hostname)&&loopback(target.hostname)&&source.protocol===target.protocol&&source.port===target.port&&source.host.toLowerCase()===request.headers.get('host')?.toLowerCase();
  } catch { return false; }
}

export async function readJsonObject(request, maxBytes = 12000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new RequestValidationError('نوع الطلب غير مدعوم. أرسل JSON.', 415);
  }
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestValidationError('الطلب أكبر من الحد المسموح.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestValidationError('الطلب فارغ.');
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestValidationError('الطلب أكبر من الحد المسموح.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new RequestValidationError('صيغة الطلب غير صالحة.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestValidationError('بيانات الطلب غير صالحة.');
  return data;
}

export function createTimedFetch(timeoutMs = 10000) {
  return async (input, init = {}) => {
    const started=Date.now();
    try{
      const response=await fetch(input, {...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});
      if(typeof window==='undefined'&&(response.status>=500||Date.now()-started>=3000))recordOperationalEvent(response.status>=500?'database_failure':'slow_response',{source:'database',status:response.status,durationMs:Date.now()-started});
      return response;
    }catch(error){
      if(typeof window==='undefined')recordOperationalEvent('database_failure',{source:'database',durationMs:Date.now()-started});
      throw error;
    }
  };
}
