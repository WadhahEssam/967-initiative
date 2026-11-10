'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createAccountWatch,shouldReloadOnAuth} from '@/lib/authEvents';
import {browserMayBeSignedIn,loadBrowserDb} from '@/lib/browserSession';

// The Supabase client loads only when needed (see lib/browserSession.js).
export {loadBrowserDb};

export async function audienceRequest(path,body){
 if(!browserMayBeSignedIn())throw Error('انتهت الجلسة. سجل الدخول مجدداً.');
 const db=await loadBrowserDb();if(!db)throw Error('خدمة الحسابات غير مفعّلة بعد.');
 const {data,error}=await db.auth.getSession();
 if(error||!data.session)throw Error('انتهت الجلسة. سجل الدخول مجدداً.');
 // A dropped connection or a proxy error page must not surface as «Failed to fetch» or a JSON parse error.
 let response;
 try{response=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});}catch{throw Error('تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.');}
 const result=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===401)await db.auth.signOut({scope:'local'});throw Object.assign(Error(result.error||'تعذر إتمام الطلب.'),{status:response.status,code:result.code});}
 return result;
}

export default function useAudience(){
 const [state,setState]=useState({user:null,ready:false,error:''});
 const dbRef=useRef(null);
 const refresh=useCallback(async()=>{
  let db=dbRef.current;
  if(!db){try{db=await loadBrowserDb();}catch{db=null;}}
  if(!db){setState({user:null,ready:true,error:''});return;}
  try{const {data,error}=await db.auth.getUser();setState({user:error?null:data.user,ready:true,error:error&&error.status!==400&&error.name!=='AuthSessionMissingError'?'انتهت الجلسة أو تعذر التحقق منها. سجل الدخول مجدداً.':''});}
  catch{setState({user:null,ready:true,error:'تعذر التحقق من الجلسة. حاول مجدداً.'});}
 },[]);
 useEffect(()=>{let active=true,revision=0,subscription=null,loading=false;const timers=new Set();const account=createAccountWatch();
  const check=async db=>{const current=++revision;try{const {data,error}=await db.auth.getUser();if(active&&current===revision){account.seen(error?null:{user:data.user});}if(active&&current===revision)setState({user:error?null:data.user,ready:true,error:error&&error.name!=='AuthSessionMissingError'?'انتهت الجلسة أو تعذر التحقق منها. سجل الدخول مجدداً.':''});}catch{if(active&&current===revision)setState({user:null,ready:true,error:'تعذر التحقق من الجلسة.'});}};
  const attach=db=>{
   if(!active||subscription)return;
   if(!db){setState({user:null,ready:true,error:''});return;}
   dbRef.current=db;check(db);
   ({data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{if(!shouldReloadOnAuth(account,event,session))return;account.seen(session);revision++;if(!session){setState({user:null,ready:true,error:''});return;}const timer=setTimeout(()=>{timers.delete(timer);if(active)check(db);},0);timers.add(timer);}));
  };
  const connect=()=>{if(loading||subscription)return;loading=true;loadBrowserDb().then(attach,()=>{if(active)setState({user:null,ready:true,error:''});}).finally(()=>{loading=false;});};
  if(browserMayBeSignedIn())connect();
  else setState({user:null,ready:true,error:''});
  // Signing in on this page starts the client (967:auth-ready); signing in from another tab writes the session.
  const storage=event=>{if(event.key===null||String(event.key).endsWith('-auth-token'))connect();};
  window.addEventListener('967:auth-ready',connect);window.addEventListener('storage',storage);
  return()=>{active=false;revision++;timers.forEach(clearTimeout);subscription?.unsubscribe();window.removeEventListener('967:auth-ready',connect);window.removeEventListener('storage',storage);};
 },[]);
 return {...state,refresh};
}
