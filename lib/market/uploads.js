import 'server-only';
import {IMAGE_SIZES,REQUIRED_SIZES,copyImage,imageKey} from './storage';

// Attaches uploaded photos to a listing in two steps, so a listing never goes live without them:
// 1. promoteUploads, before the listing is saved: checks the photos are the member's own and not
//    used by another listing, and copies those still under tmp/ to img/ (tmp/ is deleted after a day).
// 2. linkUploads, after the listing is saved: records which listing uses them.
// The first photo is the cover. Returns the listing's `images` value: [{id, w, h}].
export async function promoteUploads(db,ownerId,listingId,ids){
 const unique=[...new Set(ids)];
 if(!unique.length)return [];
 const {data,error}=await db.from('market_uploads').select('id,width,height,promoted,listing_id,chat_id').eq('owner_id',ownerId).in('id',unique);
 if(error)throw error;
 const byId=new Map((data||[]).map(row=>[row.id,row]));
 if(unique.some(id=>!byId.has(id)||byId.get(id).chat_id||(byId.get(id).listing_id&&byId.get(id).listing_id!==listingId)))
  throw Object.assign(new Error('Upload not owned'),{code:'MARKET_UPLOAD_FORBIDDEN'});
 for(const id of unique){
  if(byId.get(id).promoted)continue;
  // An upload made before «medium» existed has no medium copy; that size is optional.
  await Promise.all(IMAGE_SIZES.map(size=>{const copy=copyImage(imageKey(id,size,{temporary:true}),imageKey(id,size));return REQUIRED_SIZES.includes(size)?copy:copy.catch(()=>null);}));
  const {error:updateError}=await db.from('market_uploads').update({promoted:true}).eq('id',id).eq('owner_id',ownerId);
  if(updateError)throw updateError;
 }
 return unique.map(id=>({id,w:byId.get(id).width,h:byId.get(id).height}));
}

export async function linkUploads(db,ownerId,listingId,photos){
 if(!photos.length)return;
 const {error}=await db.from('market_uploads').update({listing_id:listingId}).eq('owner_id',ownerId).in('id',photos.map(photo=>photo.id));
 if(error)throw error;
}
