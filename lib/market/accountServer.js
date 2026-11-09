import 'server-only';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {IMAGE_SIZES,deleteImage,imageKey,marketStorageConfigured} from './storage';

// «سوق 967» when an account is deleted (spec: «حذف الحساب»): the member's listings are archived
// and their photos removed, their WhatsApp number is deleted, pending offers in their chats are
// cancelled and listings held for them become available again. Chats stay readable for the other
// side as «حساب محذوف»; ratings they wrote stay under that name, and ratings they received go with
// the account (database cascades). Runs before the auth account is deleted.
const must=result=>{if(result.error)throw result.error;return result.data;};
const CACHE_DIR=process.env.MARKET_IMAGE_CACHE||path.join(tmpdir(),'967-market-img');

export async function releaseMarketAccount(db,userId){
 const listings=must(await db.from('market_listings').select('id,images').eq('seller_id',userId))||[];
 const photoIds=[...new Set(listings.flatMap(row=>(row.images||[]).map(image=>image.id)).filter(Boolean))];
 if(listings.length)must(await db.from('market_listings').update({status:'archived',reserved_for:null,reserved_at:null,images:[],show_whatsapp:false}).eq('seller_id',userId));
 must(await db.from('market_listings').update({status:'active',reserved_for:null,reserved_at:null,ask_deal_at:null}).eq('reserved_for',userId).eq('status','reserved'));
 const chats=must(await db.from('market_chats').select('id').or('buyer_id.eq.'+userId+',seller_id.eq.'+userId))||[];
 if(chats.length)must(await db.from('market_offers').update({status:'cancelled',responded_at:new Date().toISOString()}).in('chat_id',chats.map(chat=>chat.id)).eq('status','pending'));
 must(await db.from('market_seller_contacts').delete().eq('user_id',userId));
 // Photos last: a storage hiccup must not stop the deletion (the bucket keeps nothing public).
 let removed=0;
 for(const id of photoIds)for(const size of IMAGE_SIZES){
  await rm(path.join(CACHE_DIR,size+'-'+id+'.webp'),{force:true}).catch(()=>{});
  if(marketStorageConfigured())await deleteImage(imageKey(id,size)).then(()=>{removed++;},()=>{});
 }
 return {archived:listings.length,photos:photoIds.length,removed};
}
