import 'server-only';
import {createHmac} from 'node:crypto';
import {serverDb} from './supabase-server';
import {getSiteSettings} from './data';
import {sectionStatus} from './pageVisibility';
import {authorizeAudience} from './debateApi';
import {contactClientAddress} from './contactService';
import {recordOperationalEvent} from './operationalEvents.js';
import {RequestValidationError} from './requestSecurity.js';
import {getPriceBoard,instrumentKey,invalidatePriceBoard,recomputePrices} from './priceConsensusServer.js';
import {CONFIRM_THANKS,MIN_ACCOUNT_AGE_DAYS,REPORTS_PER_DAY,REPORT_EVERY_HOURS,REPORT_THANKS,confirmTargets,validateReportInput} from './priceReports.js';

// «المُبلّغ المحلي»: saving a member's report or quick confirmation.
// Every accepted request gets the same thanks, whether the report will count, is held, or comes
// from a silently banned member: nothing in the answer, its timing or its status code tells them
// apart. Only the stated rules (who may report, how often) are explained.

const SECTION={rate:'services',food:'foodPrices'};

// Who may report: a signed-in member with a confirmed email, an account at least 3 days old, not
// banned, suspended or leaving. While the section is hidden, editors only (to try it out live).
export async function authorizeReporter(request,kind){
 const db=serverDb();
 const user=await authorizeAudience(request,db);
 if(!user.email_confirmed_at)throw new RequestValidationError('أكّد بريدك الإلكتروني أولًا لتتمكن من الإبلاغ عن الأسعار.',403);
 if(user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new RequestValidationError('هذا الحساب موقوف.',403);
 const {data:profile,error}=await db.from('public_profiles').select('suspended,deletion_requested_at').eq('user_id',user.id).maybeSingle();
 if(error)throw error;
 if(profile?.suspended||profile?.deletion_requested_at)throw new RequestValidationError('الإبلاغ عن الأسعار غير متاح لهذا الحساب.',403);
 const status=sectionStatus(SECTION[kind],await getSiteSettings());
 if(status==='unavailable')throw new RequestValidationError('تعذر الإرسال مؤقتًا. حاول بعد قليل.',503);
 let editor=false;
 if(status==='hidden'){
  const {data,error:editorError}=await db.from('editors').select('role').eq('user_id',user.id).maybeSingle();
  if(editorError)throw editorError;
  editor=['admin','management'].includes(data?.role);
  if(!editor)throw new RequestValidationError('الإبلاغ عن الأسعار غير متاح حاليًا.',404);
 }
 const age=Date.now()-Date.parse(user.created_at);
 if(!editor&&!(age>=MIN_ACCOUNT_AGE_DAYS*864e5))throw new RequestValidationError('يمكنك الإبلاغ عن الأسعار بعد مرور '+MIN_ACCOUNT_AGE_DAYS+' أيام على إنشاء حسابك. شكرًا لاهتمامك.',403);
 return {db,user};
}

// Keyed hashes: several accounts on one device or connection count as one person, and no address
// or device id is stored in readable form.
function hashSecret(env=process.env){return env.PRICE_REPORT_HASH_SECRET||env.CONTACT_RATE_LIMIT_SECRET||env.SUPABASE_SERVICE_ROLE_KEY||null;}
export function reportHashes(request,deviceId,env=process.env){
 const secret=hashSecret(env);
 if(!secret)return {device:null,connection:null};
 const hash=value=>createHmac('sha256',secret).update(value).digest('hex');
 const address=contactClientAddress(request,env);
 return {
  device:typeof deviceId==='string'&&/^[0-9a-f]{32}$/.test(deviceId)?hash('967-price-device:v1:'+deviceId):null,
  connection:address?hash('967-price-connection:v1:'+address):null,
 };
}

// Cloudflare Turnstile on the report form, when the site has it set up (same keys as the contact form).
async function checkHuman(request,token,env=process.env,fetchImpl=fetch){
 if(!env.TURNSTILE_SECRET_KEY||!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)return;
 if(typeof token!=='string'||!token||token.length>2048)throw new RequestValidationError('أكمل التحقق البشري ثم أرسل.',400);
 let result;
 try{
  const verify=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token}),cache:'no-store',signal:AbortSignal.timeout(8000)});
  result=verify.ok?await verify.json():null;
 }catch{throw new RequestValidationError('تعذر التحقق البشري حاليًا. حاول بعد قليل.',503);}
 const hosts=new Set([new URL(env.NEXT_PUBLIC_SITE_URL||'https://967ye.com').hostname,new URL(request.url).hostname]);
 if(result?.success!==true||!hosts.has(result.hostname)||result.action!=='price_report')throw new RequestValidationError('فشل التحقق البشري. أعد المحاولة.',400);
}

const limitMessage=result=>result.daily
 ?'وصلت إلى حد البلاغات اليوم ('+REPORTS_PER_DAY+' بلاغًا). شكرًا لمساعدتك، عُد غدًا.'
 :'أبلغت عن هذا السعر قبل قليل. يمكنك الإبلاغ عنه مجددًا بعد '+REPORT_EVERY_HOURS+' ساعات من بلاغك.';

/**
 * body: {action:'report', kind, region, item, side, value, source, device, website, turnstile}
 *    or {action:'confirm', kind, region, item, device}
 * Returns {status, body} for the route.
 */
export async function submitPriceReport(request,body){
 const action=body?.action==='confirm'?'confirm':'report';
 // Bots fill every field; people never see this one. They get the usual thanks.
 if(typeof body?.website==='string'&&body.website.trim())return {status:200,body:{ok:true,message:REPORT_THANKS}};
 const entry=action==='report'?validateReportInput(body):null;
 const targets=action==='confirm'?confirmTargets(body):null;
 const kind=entry?.kind||targets[0].kind;
 const {db,user}=await authorizeReporter(request,kind);
 if(action==='report')await checkHuman(request,body.turnstile);
 let entries;
 if(action==='confirm'){
  // The price shown right now, never a number from the browser. Right after launch nothing may be
  // computed yet: work it out from the editor entries first.
  let board=await getPriceBoard(db);
  if(targets.some(target=>!(board?.[instrumentKey(target)]?.value>0))){await recomputePrices(db,kind);invalidatePriceBoard();board=await getPriceBoard(db);}
  entries=targets.map(target=>({...target,value:board?.[instrumentKey(target)]?.value})).filter(item=>item.value>0);
  if(!entries.length)return {status:200,body:{ok:true,message:CONFIRM_THANKS}};
 }else entries=[entry];
 const {device,connection}=reportHashes(request,body.device);
 const {data,error}=await db.rpc('price_report_submit',{p_user:user.id,p_entries:entries,p_confirmation:action==='confirm',p_source:entry?.source||null,p_device:device,p_connection:connection});
 if(error){recordOperationalEvent('database_failure',{source:'prices'});throw new RequestValidationError('تعذر الإرسال الآن. حاول بعد قليل.',503);}
 if(data?.daily||(data?.saved===0&&data?.recent>0))return {status:429,body:{error:limitMessage(data)}};
 // The price is worked out again at once, so a real jump shows within seconds.
 await recomputePrices(db,kind).catch(()=>recordOperationalEvent('database_failure',{source:'prices'}));
 return {status:200,body:{ok:true,message:action==='confirm'?CONFIRM_THANKS:REPORT_THANKS}};
}
