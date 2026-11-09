import 'server-only';
import {IMAGE_SIZES,copyImage,imageKey} from './storage';

// Attaches uploaded photos to a listing: only the member's own uploads, in the order given (the
// first is the cover). Photos still under tmp/ are copied to img/ (tmp/ is deleted after a day).
// Returns the listing's `images` value: [{id, w, h}].
export async function attachUploads(db,ownerId,listingId,ids){
 const unique=[...new Set(ids)];
 if(!unique.length)return [];
 const {data,error}=await db.from('market_uploads').select('id,width,height,promoted,listing_id').eq('owner_id',ownerId).in('id',unique);
 if(error)throw error;
 const byId=new Map((data||[]).map(row=>[row.id,row]));
 if(unique.some(id=>!byId.has(id)||(byId.get(id).listing_id&&byId.get(id).listing_id!==listingId)))
  throw Object.assign(new Error('Upload not owned'),{code:'MARKET_UPLOAD_FORBIDDEN'});
 for(const id of unique){
  if(byId.get(id).promoted)continue;
  await Promise.all(IMAGE_SIZES.map(size=>copyImage(imageKey(id,size,{temporary:true}),imageKey(id,size))));
  const {error:updateError}=await db.from('market_uploads').update({promoted:true,listing_id:listingId}).eq('id',id).eq('owner_id',ownerId);
  if(updateError)throw updateError;
 }
 return unique.map(id=>({id,w:byId.get(id).width,h:byId.get(id).height}));
}
