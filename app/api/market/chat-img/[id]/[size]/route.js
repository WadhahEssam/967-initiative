import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chatImageAllowed} from '@/lib/market/chatImages';
import {IMAGE_SIZES,getImage,imageKey,marketStorageConfigured} from '@/lib/market/storage';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// A photo sent in a market chat, for a signed link only (lib/market/chatImages.js). Cached on the
// server's disk like listing photos (B2 allows 2,500 downloads a day), but private to the browser.
const CACHE_DIR=path.join(process.env.MARKET_IMAGE_CACHE||path.join(tmpdir(),'967-market-img'),'chat');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const image=body=>new Response(body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});

export async function GET(request,{params}){
 const {id,size}=await params;
 const query=new URL(request.url).searchParams;
 if(!UUID.test(id)||!IMAGE_SIZES.includes(size)||!chatImageAllowed(id,size,query.get('e'),query.get('s')))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const file=path.join(CACHE_DIR,size+'-'+id+'.webp');
 try{return image(await readFile(file));}catch{/* not cached yet */}
 if(!marketStorageConfigured())return new Response('Unavailable',{status:503});
 try{
  const body=await getImage(imageKey(id,size,{chat:true}));
  if(!body)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  await mkdir(CACHE_DIR,{recursive:true}).catch(()=>{});
  const temporary=file+'.'+process.pid+'.part';
  await writeFile(temporary,body).then(()=>rename(temporary,file)).catch(()=>{});
  return image(body);
 }catch(error){
  console.error('market chat image read failed',error?.status||error?.name||'unknown');
  return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
