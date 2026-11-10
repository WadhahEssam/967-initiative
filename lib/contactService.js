import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {contributionTypes,resolveContributionReference} from './contributions.js';
import {isSameOrigin,readJsonObject,RequestValidationError} from './requestSecurity.js';
import {recordOperationalEvent} from './operationalEvents.js';

const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'600'}:{})}});
const fail=(message,status=400)=>response({error:message},status);

// The visitor's address as the hosting proxy reports it, hashed (never stored as an IP).
// On Coolify the proxy (Traefik) replaces incoming X-Forwarded-For/X-Real-IP with the client
// address; on Vercel the edge sets x-vercel-forwarded-for. Signed-in senders are keyed by account.
// Without any of these every sender shared one bucket, so 9 requests in 10 minutes blocked the
// form for everybody (found 2026-11-10).
export function contactClientAddress(request,env=process.env){
 const first=value=>value?.split(',')[0]?.trim()||null;
 const candidate=env.VERCEL==='1'?first(request.headers.get('x-vercel-forwarded-for')):first(request.headers.get('x-real-ip'))||first(request.headers.get('x-forwarded-for'));
 return candidate&&isIP(candidate)?candidate:null;
}
export function contactRateKey(request,env=process.env,accountUserId=null){
 const secret=env.CONTACT_RATE_LIMIT_SECRET||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)return null;
 const address=contactClientAddress(request,env);
 const identity=accountUserId?'account:'+accountUserId:address||'shared-unattributed';
 return createHmac('sha256',secret).update('967-contact:v1:'+identity).digest('hex');
}

export async function handleContactRequest(request,{createDb,fetchImpl=fetch,env=process.env,log=console.warn}={}){
 const logFailure=()=>recordOperationalEvent('contact_failure',{source:'contact',status:503,route:'/api/contact'},log);
 try{
  if(!isSameOrigin(request))return fail('طلب غير مسموح',403);
  const data=await readJsonObject(request);
  if(data.website)return response({ok:true});
  if(['name','email','type','message'].some(field=>typeof data[field]!=='string'))return fail('تحقق من الحقول وحاول مرة أخرى');
  const name=data.name.trim(),email=data.email.trim().toLowerCase(),type=data.type.trim(),body=data.message.trim();
  if(data.submissionId!==undefined&&(typeof data.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.submissionId)))return fail('معرّف الإرسال غير صالح. أعد تحميل الصفحة.');
  if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>250||!contributionTypes.includes(type)||body.length<10||body.length>4000)return fail('تحقق من الحقول وحاول مرة أخرى');
  const db=createDb();if(!db)return fail('التواصل غير مفعّل بعد. حاول لاحقاً.',503);
  // A bearer token is optional: anonymous submissions still work. Only a
  // verified Supabase identity can link a new message to "مشاركاتي".
  const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1]||null;
  let accountUserId=null;
  if(token){
   const checked=await db.auth.getUser(token);
   if(checked.error||!checked.data?.user)return fail('انتهت جلسة حسابك. سجل الدخول مجدداً ثم أرسل المشاركة.',401);
   if(checked.data.user.email?.toLowerCase()!==email)return fail('لربط المساهمة بحسابك، استخدم البريد الإلكتروني نفسه المسجل في حسابك.',400);
   accountUserId=checked.data.user.id;
  }
  const key=contactRateKey(request,env,accountUserId);
  if(!key)return fail('حماية إرسال الرسائل غير متاحة حالياً. حاول لاحقاً.',503);
  const limit=await db.rpc('contact_rate_limit',{p_key:key});
  if(limit.error){logFailure();return fail('تعذر إرسال الرسالة حالياً. حاول لاحقاً.',503);}
  if(limit.data!==true)return fail('وصلت إلى حد الإرسال. حاول بعد عشر دقائق.',429);
  if(Boolean(env.TURNSTILE_SECRET_KEY)!==Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY))return fail('التحقق البشري غير متاح حالياً. حاول لاحقاً.',503);
  if(env.TURNSTILE_SECRET_KEY){
   const token=typeof data['cf-turnstile-response']==='string'?data['cf-turnstile-response']:'';
   if(!token||token.length>2048)return fail('يرجى إكمال التحقق البشري');
   let verify,result;
   try{
    verify=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token}),cache:'no-store',signal:AbortSignal.timeout(8000)});
    result=verify.ok?await verify.json():null;
   }catch{return fail('تعذر التحقق البشري حالياً. حاول لاحقاً.',503);}
   if(!verify.ok)return fail('تعذر التحقق البشري حالياً. حاول لاحقاً.',503);
   // The public host: behind the proxy request.url carries the container's internal address.
   const expectedHosts=new Set([new URL(env.NEXT_PUBLIC_SITE_URL||'https://967ye.com').hostname,new URL(request.url).hostname]);
   if(result?.success!==true||!expectedHosts.has(result.hostname)||result.action!=='contact')return fail('فشل التحقق البشري. أعد المحاولة.');
  }
  const reference=resolveContributionReference(data);
  const message=reference?`مرجع الطلب: ${reference.title}\nصفحة المرجع: ${reference.path}${reference.id?'\nمعرّف المرجع: '+reference.id:''}\n\n${body}`:body;
  const {error}=await db.from('messages').insert({name,email,type,message,...(accountUserId?{user_id:accountUserId}:{}),...(data.submissionId?{id:data.submissionId}:{})});
  if(error&&!(data.submissionId&&error.code==='23505')){logFailure();return fail('تعذر حفظ الرسالة حالياً',503);}
  return response({ok:true},201);
 }catch(error){
  if(error instanceof RequestValidationError)return fail(error.message,error.status);
  logFailure();
  return fail('تعذر إرسال الرسالة حالياً. حاول لاحقاً.',503);
 }
}
