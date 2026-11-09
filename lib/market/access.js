import 'server-only';
import {serverDb} from '../supabase-server';
import {getSiteSettings} from '../data';
import {sectionStatus} from '../pageVisibility';
import {authorizeAudience} from '../debateApi';
import {RequestValidationError} from '../requestSecurity';
import {activeBan} from './safetyServer';
import {banText} from './safety.js';

// Who may use «سوق 967» write APIs: a signed-in member with a confirmed email who is not banned,
// suspended or leaving. A member banned from the market can still read (GET) but not act.
// While the section is hidden (before launch) only editors can use it, to try it out live.
export async function marketMember(request){
 const db=serverDb();
 const user=await authorizeAudience(request,db);
 if(!user.email_confirmed_at)throw new RequestValidationError('أكّد بريدك الإلكتروني لاستخدام السوق.',403);
 if(user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new RequestValidationError('هذا الحساب موقوف.',403);
 const {data:profile,error}=await db.from('public_profiles').select('suspended,deletion_requested_at').eq('user_id',user.id).maybeSingle();
 if(error)throw error;
 if(profile?.suspended||profile?.deletion_requested_at)throw new RequestValidationError('السوق غير متاح لهذا الحساب.',403);
 if(request.method!=='GET'){const ban=await activeBan(db,user.id);if(ban)throw new RequestValidationError(banText(ban),403);}
 const status=sectionStatus('market',await getSiteSettings());
 if(status==='unavailable')throw new RequestValidationError('تعذر التحقق من إتاحة السوق مؤقتًا. حاول بعد قليل.',503);
 let preview=false;
 if(status==='hidden'){
  const {data:editor,error:editorError}=await db.from('editors').select('role').eq('user_id',user.id).maybeSingle();
  if(editorError)throw editorError;
  if(!['admin','management'].includes(editor?.role))throw new RequestValidationError('السوق غير متاح حاليًا.',404);
  preview=true;
 }
 return {db,user,preview};
}
