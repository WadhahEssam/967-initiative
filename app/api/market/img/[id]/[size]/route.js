import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {IMAGE_SIZES,getImage,imageKey,marketStorageConfigured} from '@/lib/market/storage';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// Listing photos come from the private B2 bucket through this route. B2's free tier allows 2,500
// downloads a day, so each published photo is fetched once and then served from a disk cache;
// browsers keep it for a year (photo ids never change). Photos still under tmp/ (being prepared
// in the posting form) are not cached on disk and only briefly by the browser. Photos uploaded
// before the «medium» size existed answer a medium request with their full size.
const CACHE_DIR=process.env.MARKET_IMAGE_CACHE||path.join(tmpdir(),'967-market-img');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const image=(body,cacheControl)=>new Response(body,{headers:{'Content-Type':'image/webp','Cache-Control':cacheControl,'X-Content-Type-Options':'nosniff'}});
const LONG='public, max-age=31536000, immutable';

// The published photo of this size from the disk cache or the bucket (caching it), or null.
async function published(id,size){
 const file=path.join(CACHE_DIR,size+'-'+id+'.webp');
 try{return await readFile(file);}catch{/* not cached yet */}
 if(!marketStorageConfigured())return null;
 const body=await getImage(imageKey(id,size));
 if(!body)return null;
 // Write then rename, so a reader never sees a half-written file.
 await mkdir(CACHE_DIR,{recursive:true}).catch(()=>{});
 const temporary=file+'.'+process.pid+'.part';
 await writeFile(temporary,body).then(()=>rename(temporary,file)).catch(()=>{});
 return body;
}

export async function GET(_request,{params}){
 const {id,size}=await params;
 if(!UUID.test(id)||!IMAGE_SIZES.includes(size))return new Response('Not found',{status:404});
 try{
  const found=await published(id,size)||(size==='medium'?await published(id,'full'):null);
  if(found)return image(found,LONG);
  if(!marketStorageConfigured())return new Response('Unavailable',{status:503});
  const draft=await getImage(imageKey(id,size,{temporary:true}))||(size==='medium'?await getImage(imageKey(id,'full',{temporary:true})):null);
  if(draft)return image(draft,'private, max-age=600');
  return new Response('Not found',{status:404,headers:{'Cache-Control':'public, max-age=60'}});
 }catch(error){
  console.error('market image read failed',error?.status||error?.name||'unknown');
  return new Response('Unavailable',{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
