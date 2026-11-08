'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import useSessionDb from '@/components/useSessionDb';
import {readEditorFlag,writeEditorFlag} from '@/components/editorFlag';

const Runtime=dynamic(()=>import('./InlineEditorRuntime'),{ssr:false});
const noop=()=>{};
const Context=createContext({actor:null,enabled:false,pageTarget:null,revision:0,lastChange:null,open:noop,close:noop,setPageTarget:noop,refresh:noop,notify:noop,setPanelDirty:noop,setPanelBusy:noop});
const preference=id=>'967:inline-editor:'+id;
export function useInlineEditor(){return useContext(Context);}

// Only this small session gate is loaded for visitors. No administrative data
// or editor UI is rendered until the server has verified the current account.
export default function InlineEditorProvider({children}){
 const {db}=useSessionDb();
 const pathname=usePathname(),[actor,setActor]=useState(null),[enabled,setEnabledState]=useState(false),[panel,setPanel]=useState(null),[registration,setRegistration]=useState(null),[change,setChange]=useState({revision:0,target:null}),[notice,setNotice]=useState(null);
 const pageTarget=registration?.pathname===pathname?registration.target:null;
 const [permissionNotice,setPermissionNotice]=useState('');
 const setPageTarget=useCallback(target=>setRegistration({pathname,target}),[pathname]);
 const generation=useRef(0),identityVersion=useRef(0),owner=useRef(null),actorRef=useRef(null),dirty=useRef(false),busy=useRef(false),verifyRef=useRef(null);
 actorRef.current=actor;
 const clear=useCallback(reason=>{identityVersion.current++;actorRef.current=null;setActor(null);setEnabledState(false);setPanel(null);setNotice(null);setChange(current=>({revision:current.revision+1,target:null}));if(typeof reason==='string')setPermissionNotice(reason);dirty.current=false;busy.current=false;},[]);
 useEffect(()=>{
  if(!db)return;
  let live=true;const timers=new Set(),epoch=generation;
  // Opening a page triggers two checks at once (the initial session and the auth event); they
  // share one request. Each check costs the server a Supabase Auth call and an editors query.
  let shared=null;
  const checkSession=session=>{
   if(shared&&shared.userId===session.user.id&&Date.now()-shared.at<3000)return shared.promise;
   const promise=fetch('/api/admin/inline?view=session',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)})
    .then(async response=>({ok:response.ok,status:response.status,data:response.ok?await response.json():null}));
   shared={userId:session.user.id,at:Date.now(),promise};
   promise.catch(()=>{if(shared?.promise===promise)shared=null;});
   return promise;
  };
  const verify=async session=>{
   const current=++generation.current;
   if(!session){owner.current=null;clear();return;}
   if(owner.current!==session.user.id){clear('');owner.current=session.user.id;}
   // Most signed-in visitors are not editors: once the server has said so, stop asking every
   // minute for 10 minutes (the header shares this answer).
   if(!actorRef.current&&readEditorFlag(session.user.id)===false)return;
   try{
    const response=await checkSession(session);
    if(!response.ok){if(response.status===403)writeEditorFlag(session.user.id,false);if([401,403].includes(response.status)){if(live&&current===generation.current)clear(actorRef.current?'لم تعد جلسة التحرير أو صلاحياتها متاحة. أُزيلت أدوات الإدارة.':'');return;}throw Error('Unavailable');}
    const data=response.data;
    if(!live||current!==generation.current||owner.current!==session.user.id)return;
    if(data.actor?.id!==session.user.id||!['admin','management'].includes(data.actor.role)){clear('تعذر تأكيد هوية المحرر. أُزيلت أدوات الإدارة.');return;}
    writeEditorFlag(session.user.id,true);
    const previous=actorRef.current;actorRef.current=data.actor;setActor(data.actor);setPermissionNotice('');
    if(previous?.id!==data.actor.id){let value=false;try{value=localStorage.getItem(preference(data.actor.id))==='1';}catch{}setEnabledState(value);}
   }catch{if(live&&current===generation.current){if(actorRef.current?.id===session.user.id)setPermissionNotice('تعذر تحديث صلاحيات التحرير مؤقتاً. بقيت مسودتك محفوظة؛ تحقق من الاتصال قبل الحفظ.');else clear();}}
  };
  const recheck=()=>{if(document.visibilityState==='hidden')return;db.auth.getSession().then(({data})=>{if(live)verify(data.session);}).catch(()=>{if(live)clear();});};
  verifyRef.current=recheck;
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{
   generation.current++;
   if(!session){owner.current=null;clear('');return;}
   if(owner.current!==session.user.id){owner.current=session.user.id;clear('');}
   const timer=setTimeout(()=>{timers.delete(timer);if(live)verify(session);},0);timers.add(timer);
  });
  recheck();const interval=setInterval(recheck,60000);window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);
  return()=>{live=false;epoch.current++;verifyRef.current=null;timers.forEach(clearTimeout);clearInterval(interval);subscription.unsubscribe();window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);};
 },[clear,db]);
 useEffect(()=>{setPanel(null);dirty.current=false;busy.current=false;},[pathname]);
 const request=useCallback(async(path,body,options={})=>{
  if(!path.startsWith('/api/admin/'))throw Error('مسار إدارة غير صالح.');
  const {data,error}=db?await db.auth.getSession():{data:{},error:true};
  if(error||!data.session){clear();throw Object.assign(Error('انتهت الجلسة. سجل الدخول مجدداً.'),{status:401});}
  const id=data.session.user.id,current=identityVersion.current;
  const control=new AbortController(),timeout=setTimeout(()=>control.abort(),60000),abort=()=>control.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)control.abort();
  let response,result;
  try{response=await fetch(path,{method:options.method||(body?'POST':'GET'),headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:control.signal});result=await response.json();}
  catch{throw Error(body?'تعذر تأكيد نتيجة الحفظ. احتفظ بمسودتك وأعد تحميل المحفوظ قبل المحاولة مجدداً.':'تعذر الاتصال بالخدمة أو قراءة الاستجابة. حاول مجدداً.');}
  finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
  const ownsRequest=()=>id===owner.current&&current===identityVersion.current;
  if(!ownsRequest())throw Error('تغيرت الجلسة. أعد المحاولة.');
  if(!response.ok){
   const stopped='توقفت أدوات التحرير: '+(result.error||'تحقق من الجلسة وصلاحيات الحساب.');
   if(response.status===401)clear(stopped);
   else if(response.status===403){
    // An action policy can reject a valid editor. Recheck the role before
    // removing the editor and its draft; every mutation stays server-enforced.
    try{
     const verified=await fetch('/api/admin/inline?view=session',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
     if(!ownsRequest())throw Error('Changed session');
     if([401,403].includes(verified.status))clear(stopped);
     else if(!verified.ok)throw Error('Unavailable');
     else{
      const checked=await verified.json();
      if(!ownsRequest())throw Error('Changed session');
      if(checked.actor?.id!==id||!['admin','management'].includes(checked.actor.role))clear(stopped);
      else{actorRef.current=checked.actor;setActor(checked.actor);setPermissionNotice('');}
     }
    }catch{
     if(ownsRequest()&&actorRef.current?.id===id)setPermissionNotice('تعذر تحديث صلاحيات التحرير مؤقتاً. بقيت مسودتك محفوظة؛ تحقق من الاتصال قبل الحفظ.');
    }
   }
   throw Object.assign(Error(result.error||'تعذر حفظ الإجراء. حاول مجدداً.'),{status:response.status});
  }
  return result;
 },[clear,db]);
 const close=useCallback(()=>{if(busy.current)return false;if(dirty.current&&!confirm('لديك تغييرات غير محفوظة. هل تريد إغلاق المحرر وفقدها؟'))return false;dirty.current=false;setPanel(null);return true;},[]);
 const open=useCallback(next=>{if(!actorRef.current||busy.current)return;if(dirty.current&&!confirm('لديك تغييرات غير محفوظة. هل تريد الانتقال وفقدها؟'))return;dirty.current=false;setPanel(next);},[]);
 const setEnabled=useCallback(value=>{if(!actorRef.current)return;if(!value&&busy.current)return;if(!value&&dirty.current&&!confirm('لديك تغييرات غير محفوظة. هل تريد إيقاف التحرير وفقدها؟'))return;setEnabledState(value);try{localStorage.setItem(preference(actorRef.current.id),value?'1':'0');}catch{}if(!value){dirty.current=false;setPanel(null);setNotice(null);}},[]);
 const refresh=useCallback(target=>setChange(value=>({revision:value.revision+1,target})),[]);
 const notify=useCallback((message,type='success',undo_id=null)=>setNotice(message?{message,type,undo_id}:null),[]);
 const setPanelDirty=useCallback(value=>{dirty.current=value;},[]),setPanelBusy=useCallback(value=>{busy.current=value;},[]);
 const value=useMemo(()=>({actor,enabled:Boolean(actor&&enabled),setEnabled,panel,open,close,pageTarget,setPageTarget,revision:change.revision,lastChange:change.target,refresh,request,notice,notify,sessionNotice:permissionNotice,setPanelDirty,setPanelBusy}),[actor,enabled,setEnabled,panel,open,close,pageTarget,setPageTarget,change,refresh,request,notice,notify,permissionNotice,setPanelDirty,setPanelBusy]);
 return <Context.Provider value={value}>{children}{actor&&<Runtime/>}{permissionNotice&&<div className="inline-permission-message" role="alert"><span>{permissionNotice}</span><button type="button" aria-label="إغلاق التنبيه" onClick={()=>setPermissionNotice('')}>×</button></div>}</Context.Provider>;
}
