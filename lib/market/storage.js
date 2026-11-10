import 'server-only';
import {AwsClient} from 'aws4fetch';

// «سوق 967» images live in a private Backblaze B2 bucket (S3 API), never in Supabase Storage:
// the free Supabase plan has 1 GB of storage and 5 GB of monthly egress. Uploads go to tmp/
// (deleted by a bucket lifecycle rule after a day) and are copied to img/ when a listing uses them.
// Settings: MARKET_S3_ENDPOINT, MARKET_S3_REGION, MARKET_S3_BUCKET, MARKET_S3_KEY_ID, MARKET_S3_SECRET.

export const IMAGE_SIZES=['full','medium','thumb'];
// Photos uploaded before «medium» existed have only these; a missing medium falls back to full.
export const REQUIRED_SIZES=['full','thumb'];
// MARKET_S3_KEY_PREFIX lets local development use the same bucket safely: with «tmp/dev/» every
// object it writes falls under the bucket's tmp/ rule and is deleted after a day.
// Photos sent in chats live under chat/ and are only served through signed links (chatImages.js).
export const imageKey=(id,size,{temporary=false,chat=false}={})=>(process.env.MARKET_S3_KEY_PREFIX||'')+(temporary?'tmp/':chat?'chat/':'img/')+id+'/'+size+'.webp';

let client=null;
function config(){
 const {MARKET_S3_ENDPOINT:endpoint,MARKET_S3_REGION:region,MARKET_S3_BUCKET:bucket,MARKET_S3_KEY_ID:accessKeyId,MARKET_S3_SECRET:secretAccessKey}=process.env;
 return endpoint&&region&&bucket&&accessKeyId&&secretAccessKey?{endpoint:endpoint.replace(/\/+$/,''),region,bucket,accessKeyId,secretAccessKey}:null;
}
export const marketStorageConfigured=()=>Boolean(config());
function s3(){
 const settings=config();
 if(!settings)throw Object.assign(new Error('Market storage is not configured'),{code:'MARKET_STORAGE_MISSING'});
 client??={settings,aws:new AwsClient({accessKeyId:settings.accessKeyId,secretAccessKey:settings.secretAccessKey,region:settings.region,service:'s3'})};
 return client;
}
const objectUrl=key=>{const {settings}=s3();return settings.endpoint+'/'+settings.bucket+'/'+key.split('/').map(encodeURIComponent).join('/');};
async function ok(response,action){
 if(response.ok)return response;
 const detail=(await response.text().catch(()=>'')).slice(0,200);
 throw Object.assign(new Error('Market storage '+action+' failed ('+response.status+')'),{status:response.status,detail});
}

export async function putImage(key,body){
 const {aws}=s3();
 // B2 answers 411 without an explicit length (Node's fetch would otherwise stream the body).
 await ok(await aws.fetch(objectUrl(key),{method:'PUT',body,headers:{'content-type':'image/webp','content-length':String(body.length),'cache-control':'public, max-age=31536000, immutable'}}),'put');
}
// Returns the object's bytes, or null when it does not exist.
export async function getImage(key){
 const {aws}=s3();
 const response=await aws.fetch(objectUrl(key));
 if(response.status===404||response.status===403&&/NoSuchKey/.test(await response.clone().text().catch(()=>'')))return null;
 await ok(response,'get');
 return Buffer.from(await response.arrayBuffer());
}
export async function copyImage(fromKey,toKey){
 const {aws,settings}=s3();
 await ok(await aws.fetch(objectUrl(toKey),{method:'PUT',headers:{'x-amz-copy-source':'/'+settings.bucket+'/'+fromKey,'content-length':'0'}}),'copy');
}
export async function deleteImage(key){
 const {aws}=s3();
 const response=await aws.fetch(objectUrl(key),{method:'DELETE'});
 if(response.status!==404)await ok(response,'delete');
}
