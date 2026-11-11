// Server code (sharp is native); no 'server-only' marker so node --test can exercise it.
import sharp from 'sharp';
import {HASH_SIZE,dhashFromPixels} from './photoHash.js';

// Every listing photo is decoded and re-encoded on the server. This turns it the right way up and
// drops all metadata, including the GPS position phones store in photos (a seller's home), and
// gives three WebP sizes: «full» for wide screens, «medium» for phones (the listing page) and «thumb»
// for lists.
export const UPLOAD_LIMITS={maxBytes:12*1024*1024,maxPixels:40_000_000,minSide:200};
export const SIZES={full:{side:1280,quality:76},medium:{side:800,quality:72},thumb:{side:480,quality:70}};
const FORMATS=new Set(['jpeg','png','webp','heif','avif','gif','tiff']);

export class ImageError extends Error{constructor(message){super(message);this.name='ImageError';}}

export async function processListingImage(buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length)throw new ImageError('الملف فارغ.');
 if(buffer.length>UPLOAD_LIMITS.maxBytes)throw new ImageError('حجم الصورة كبير جدًا (الحد 12 ميغابايت).');
 let meta;
 try{meta=await sharp(buffer,{limitInputPixels:UPLOAD_LIMITS.maxPixels}).metadata();}
 catch{throw new ImageError('الملف ليس صورة صالحة.');}
 if(!FORMATS.has(meta.format))throw new ImageError('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.');
 const portrait=(meta.orientation||1)>=5,width=portrait?meta.height:meta.width,height=portrait?meta.width:meta.height;
 if(!width||!height||Math.min(width,height)<UPLOAD_LIMITS.minSide)throw new ImageError('الصورة صغيرة جدًا.');
 const render=async({side,quality})=>{
  const {data,info}=await sharp(buffer,{limitInputPixels:UPLOAD_LIMITS.maxPixels,animated:false}).rotate()
   .resize({width:side,height:side,fit:'inside',withoutEnlargement:true}).webp({quality,effort:4}).toBuffer({resolveWithObject:true});
  return {data,width:info.width,height:info.height};
 };
 const [full,medium,thumb]=await Promise.all([render(SIZES.full),render(SIZES.medium),render(SIZES.thumb)]);
 return {full:full.data,medium:medium.data,thumb:thumb.data,width:full.width,height:full.height,bytes:full.data.length+medium.data.length+thumb.data.length,phash:await photoHash(thumb.data)};
}

// The difference hash of the upright picture, for finding the same photo in other listings.
export async function photoHash(buffer){
 try{
  const pixels=await sharp(buffer).grayscale().resize(HASH_SIZE.width,HASH_SIZE.height,{fit:'fill'}).raw().toBuffer();
  return dhashFromPixels(pixels);
 }catch{return null;}
}
