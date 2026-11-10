import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {serverDb} from './supabase-server';
import {sectionGate} from './pageVisibility';
import {previewToken,readPreviewToken} from './sectionPreviewToken.js';

// Editors open hidden sections (before a launch) through a signed cookie set by
// /api/admin/section-preview. Visitors without it still get a 404.
export const PREVIEW_COOKIE='967_section_preview';
export const PREVIEW_HOURS=12;
const secret=()=>process.env.SECTION_PREVIEW_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'';

export const signPreview=(userId,now=Date.now())=>previewToken(userId,now+PREVIEW_HOURS*3600e3,secret(),{createHmac});
const checkPreview=(value,now=Date.now())=>readPreviewToken(value,now,secret(),{createHmac,timingSafeEqual});

// The cookie alone is not enough: the account must still be an editor now.
async function previewing(){
 const userId=checkPreview((await cookies()).get(PREVIEW_COOKIE)?.value);
 if(!userId)return false;
 const db=serverDb();
 if(!db)return false;
 const {data,error}=await db.from('editors').select('role').eq('user_id',userId).maybeSingle();
 return !error&&['admin','management'].includes(data?.role);
}

// 'visible' for everyone, 'preview' for an editor while the section is hidden, else false.
export async function sectionAccess(id,settings){
 if(sectionGate(id,settings))return 'visible';
 return await previewing()?'preview':false;
}
