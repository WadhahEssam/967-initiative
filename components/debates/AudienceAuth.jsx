'use client';
import ValidatedForm,{FormInput,FormTextarea,FormSelect,FormLabel} from './ValidatedForm';
import {trackFunnel} from '@/components/analytics/funnel';
import {useEffect,useRef,useState} from 'react';
import Link from '@/components/SiteLink';
import {browserDb} from '@/lib/supabase';
import {safeAccountReturn} from '@/lib/debates';
import {accountAuthErrorMessage} from '@/lib/authErrors';
import {claimSessionDebateDraft,safeTabStorage} from '@/lib/debateDraft';
import {completeAuthSession} from '@/lib/authCallback';
import AuthPasswordField from './AuthPasswordField';
import {usePageVisibility} from '@/components/PageVisibilityProvider';
import GoogleSignIn from './GoogleSignIn';
import {audienceRequest} from './useAudience';
import {takeGoogleTerms,termsProfileUpdate} from '@/lib/googleAuth';

// Back from Google: record the terms agreed before leaving (new accounts only), then continue.
async function finishGoogleSignIn(){
 if(!takeGoogleTerms())return;
 try{
  const account=await audienceRequest('/api/account');
  const update=termsProfileUpdate(account?.profile);
  if(!update)return;
  await audienceRequest('/api/account',update);
  trackFunnel('signup_done');
 }catch{/* The account page asks for the agreement again if this did not go through. */}
}

const labels={login:'تسجيل الدخول',register:'إنشاء حساب',forgot:'استعادة كلمة المرور',update:'تحديث كلمة المرور',callback:'تأكيد الحساب'};
export default function AudienceAuth({mode='login'}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failed,setFailed]=useState(false),[next,setNext]=useState('/account');
 const [recoveryReady,setRecoveryReady]=useState(false),[formVersion,setFormVersion]=useState(0),callbackJob=useRef(null),submitting=useRef(false);
 const db=browserDb();
 const {isVisible}=usePageVisibility(),termsAvailable=isVisible('/terms')&&isVisible('/privacy');
 useEffect(()=>{const params=new URLSearchParams(location.search);setNext(safeAccountReturn(params.get('next')));},[]);
 useEffect(()=>{
  if(!['callback','update'].includes(mode)||!db)return;
  let live=true;
  const params=new URLSearchParams(location.search);
  if(!callbackJob.current)callbackJob.current=completeAuthSession(db.auth,location.href,()=>location.href);
  callbackJob.current.then(async session=>{
   if(!live)return;
   if(mode==='callback'&&params.get('provider')==='google')await finishGoogleSignIn();
   if(mode==='update'){setRecoveryReady(true);history.replaceState({},'',location.pathname+(params.has('next')?'?next='+encodeURIComponent(safeAccountReturn(params.get('next'))):''));return;}
   const target=params.get('recovery')==='1'?'/update-password?next='+encodeURIComponent(safeAccountReturn(params.get('next'))):safeAccountReturn(params.get('next'));
   claimSessionDebateDraft(safeTabStorage(),target,session);location.replace(target);
  }).catch(()=>{if(live){setFailed(true);setNotice(mode==='update'?'افتح رابط استعادة كلمة المرور المرسل إلى بريدك. إذا انتهت صلاحيته، اطلب رابطًا جديدًا.':'تعذر إكمال التأكيد. قد يكون الرابط منتهيًا. يمكنك تسجيل الدخول أو طلب رسالة تحقق جديدة.');}});
  return()=>{live=false;};
 },[mode,db]);
 async function submit(e){e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setNotice('');setFailed(false);const formElement=e.currentTarget,form=new FormData(formElement),email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
  try{
   if(!db)throw Error('خدمة الحسابات غير مفعّلة بعد.');
   if(mode==='register'&&!termsAvailable)throw Error('إنشاء الحسابات غير متاح مؤقتًا. شروط الاستخدام وسياسة الخصوصية قيد التحديث.');
   let result;
   if(mode==='login')result=await db.auth.signInWithPassword({email,password});
   if(mode==='register'){
    if(!form.get('accepted'))throw Error('الموافقة على الشروط والخصوصية مطلوبة.');
    const displayName=String(form.get('display_name')||'').trim();
    result=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/auth/callback?next='+encodeURIComponent(next),data:{display_name:displayName,full_name:displayName,audience_terms:true}}});
   }
   if(mode==='forgot')result=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/update-password?next='+encodeURIComponent(next)});
   if(mode==='update'){
    if(password!==form.get('confirmation'))throw Error('كلمتا المرور غير متطابقتين.');
    const session=await db.auth.getSession();if(!session.data.session)throw Error('افتح رابط استعادة كلمة المرور المرسل إلى بريدك أولاً.');
    result=await db.auth.updateUser({password});
   }
   if(result?.error)throw Error(accountAuthErrorMessage(result.error,mode));
   if(mode==='login'){claimSessionDebateDraft(safeTabStorage(),next,result.data.session);location.assign(next);return;}
   if(mode==='register'){trackFunnel('signup_done');if(result.data.session){claimSessionDebateDraft(safeTabStorage(),next,result.data.session);location.assign(next);return;}setNotice('تحقق من بريدك وافتح رسالة تأكيد الحساب، ثم سجل الدخول.');}
   if(mode==='forgot')setNotice('إذا كان البريد مرتبطاً بحساب، ستصلك رسالة لاستعادة كلمة المرور.');
   if(mode==='update'){setNotice('تم تحديث كلمة المرور. يمكنك العودة إلى حسابك.');formElement.reset();setFormVersion(value=>value+1);}
   if(mode!=='update')formElement.reset();
  }catch(error){setFailed(true);setNotice(error?.__isAuthError||['TypeError','AbortError','TimeoutError'].includes(error?.name)?accountAuthErrorMessage(error,mode):error.message);}finally{setBusy(false);submitting.current=false;}
 }
 async function resend(e){e.preventDefault();if(submitting.current||!db)return;submitting.current=true;setBusy(true);setFailed(false);setNotice('');try{const email=String(new FormData(e.currentTarget).get('email')).trim();const result=await db.auth.resend({type:'signup',email,options:{emailRedirectTo:location.origin+'/auth/callback?next='+encodeURIComponent(next)}});if(result.error)throw result.error;setNotice('إذا كان الحساب بانتظار التأكيد، ستصلك رسالة جديدة.');}catch{setFailed(true);setNotice('تعذر إرسال رسالة التأكيد. حاول لاحقاً.');}finally{setBusy(false);submitting.current=false;}}
 return <div className="container debate-auth"><Link href="/" className="eyebrow">مبادرة 967 · حساب المستخدم</Link><h1>{labels[mode]}</h1><p>يمكنك تصفح 967 دون حساب. أنشئ حساباً للمشاركة في المناظرات، والتصويت، وطرح الأسئلة، ومتابعة مشاركاتك.</p>{!db&&<p className="feedback error" role="alert">خدمة الحسابات غير مفعّلة بعد.</p>}
  {next.includes('draft=')&&<p className="small-muted">للحفاظ على مسودة مشاركتك، أكمل الدخول في علامة التبويب هذه خلال 30 دقيقة. إذا فتحت رسالة التأكيد في علامة تبويب أخرى، عُد إلى هذه العلامة وسجل الدخول.</p>}
  {mode==='register'&&!termsAvailable&&<p className="feedback" role="status">إنشاء الحسابات غير متاح مؤقتًا. شروط الاستخدام وسياسة الخصوصية قيد التحديث.</p>}
  {['login','register'].includes(mode)&&<GoogleSignIn db={db} next={next} termsAvailable={termsAvailable} onError={message=>{setFailed(true);setNotice(message);}}/>}
  {mode!=='callback'&&<ValidatedForm className="debate-form" onSubmit={submit} key={formVersion}><fieldset disabled={busy||!db||mode==='update'&&!recoveryReady||mode==='register'&&!termsAvailable}>
   {mode==='register'&&<FormLabel>اسم العرض<FormInput name="display_name" required minLength={2} maxLength={60} autoComplete="nickname"/><small>هذا الاسم سيظهر في ملفك الشخصي وبحث الأعضاء. يمكنك استخدام اسم مستعار وإيقاف ظهوره في البحث من إعدادات الرسائل.</small></FormLabel>}
   {mode!=='update'&&<FormLabel>البريد الإلكتروني<FormInput name="email" type="email" dir="ltr" required maxLength={254} autoComplete="email"/></FormLabel>}
   {mode!=='forgot'&&<AuthPasswordField label={mode==='update'?'كلمة المرور الجديدة':'كلمة المرور'} newPassword={mode!=='login'}/>}
   {mode==='update'&&<AuthPasswordField name="confirmation" label="تأكيد كلمة المرور" newPassword confirmation/>}
   {mode==='register'&&termsAvailable&&<FormLabel className="debate-check"><FormInput type="checkbox" name="accepted" required/><span>أوافق على <Link href="/terms" target="_blank">شروط الاستخدام</Link> و<Link href="/privacy" target="_blank">سياسة الخصوصية</Link>.</span></FormLabel>}
   <button className="btn btn-primary" disabled={busy||!db}>{busy?'جارٍ التنفيذ…':labels[mode]}</button>
  </fieldset></ValidatedForm>}
  {notice&&<p className={'feedback '+(failed?'error':'success')} role={failed?'alert':'status'}>{notice}</p>}
  {mode==='callback'&&!notice&&<p role="status">جارٍ التحقق من الرابط…</p>}
  <nav className="debate-actions" aria-label="خيارات الحساب"><Link href={'/login?next='+encodeURIComponent(next)}>تسجيل الدخول</Link><Link href={'/register?next='+encodeURIComponent(next)}>حساب جديد</Link><Link href={'/forgot-password?next='+encodeURIComponent(next)}>نسيت كلمة المرور</Link><Link href={next}>{mode==='update'?'متابعة إلى حسابي':'حسابي'}</Link></nav>
  {['login','callback'].includes(mode)&&<details><summary>إعادة إرسال رسالة تأكيد البريد</summary><ValidatedForm className="debate-form" onSubmit={resend}><FormLabel>بريد الحساب<FormInput name="email" type="email" dir="ltr" required autoComplete="email"/></FormLabel><button className="btn btn-outline" disabled={busy||!db}>إرسال رسالة التحقق</button></ValidatedForm></details>}
 </div>;
}
