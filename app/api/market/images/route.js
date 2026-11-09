import {randomUUID} from 'node:crypto';
import {marketMember} from '@/lib/market/access';
import {ImageError,UPLOAD_LIMITS,processListingImage} from '@/lib/market/images';
import {imageKey,marketStorageConfigured,putImage} from '@/lib/market/storage';
import {RequestValidationError} from '@/lib/requestSecurity';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// Photos a member may upload per 24 hours: 10 listings of 10 photos, plus retries.
const DAILY_UPLOADS=120;
const headers={'Cache-Control':'no-store'};
const json=(body,status=200)=>Response.json(body,{status,headers});

// One listing photo: re-encoded and stripped of metadata (lib/market/images.js), stored under tmp/
// until a listing uses it (lib/market/uploads.js), and recorded so only its owner can attach it.
export async function POST(request){
 try{
  if(!marketStorageConfigured())throw new RequestValidationError('رفع الصور غير مفعّل بعد.',503);
  const length=Number(request.headers.get('content-length')||0);
  if(length>UPLOAD_LIMITS.maxBytes+64*1024)throw new RequestValidationError('حجم الصورة كبير جدًا (الحد 12 ميغابايت).',413);
  const {db,user}=await marketMember(request);
  const since=new Date(Date.now()-24*60*60*1000).toISOString();
  const {count,error:countError}=await db.from('market_uploads').select('id',{count:'exact',head:true}).eq('owner_id',user.id).gte('created_at',since);
  if(countError)throw countError;
  if(count>=DAILY_UPLOADS)throw new RequestValidationError('وصلت إلى حد رفع الصور اليومي. حاول غدًا.',429);
  let file;
  try{file=(await request.formData()).get('file');}catch{throw new RequestValidationError('أرسل الصورة في حقل file.',400);}
  if(!file||typeof file.arrayBuffer!=='function')throw new RequestValidationError('أرسل الصورة في حقل file.',400);
  const image=await processListingImage(Buffer.from(await file.arrayBuffer()));
  const id=randomUUID();
  await Promise.all([putImage(imageKey(id,'full',{temporary:true}),image.full),putImage(imageKey(id,'thumb',{temporary:true}),image.thumb)]);
  const {error}=await db.from('market_uploads').insert({id,owner_id:user.id,width:image.width,height:image.height,bytes:image.bytes});
  if(error)throw error;
  return json({id,width:image.width,height:image.height,thumb:'/api/market/img/'+id+'/thumb',full:'/api/market/img/'+id+'/full'},201);
 }catch(error){
  if(error instanceof ImageError)return json({error:error.message},400);
  if(error instanceof RequestValidationError)return json({error:error.message},error.status);
  console.error('market image upload failed',error?.code||error?.status||error?.name||'unknown');
  return json({error:'تعذر رفع الصورة. حاول مجددًا.'},503);
 }
}
