'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {loadBrowserDb} from '@/lib/browserSession';

export default function useLiveDebateResults(debateId){
 const [state,setState]=useState({id:debateId,data:null,loading:true,error:''}),reader=useRef(null);
 const refresh=useCallback(()=>reader.current?.(),[]);
 useEffect(()=>{
  let active=true,controller,channel,connected=false,pushTimer,lastRead=0,inFlight=false,db=null;
  setState({id:debateId,data:null,loading:true,error:''});
  async function read(force=false){
   if(!active)return;
   if(inFlight&&!force)return;
   controller?.abort();const request=new AbortController();controller=request;lastRead=Date.now();inFlight=true;
   try{
    const response=await fetch('/api/debates?'+new URLSearchParams({results:'1',debate:debateId}),{cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
    if(!response.ok)throw Error('تعذر تحديث نتائج الاستطلاع.');
    const data=await response.json();
    if(active&&controller===request)setState({id:debateId,data,loading:false,error:''});
   }catch{
    if(active&&controller===request&&!request.signal.aborted)setState(previous=>({...previous,loading:false,error:'تعذر تحديث نتائج الاستطلاع. حاول مجدداً.'}));
   }finally{if(controller===request)inFlight=false;}
  }
  const visibleRead=()=>{if(document.visibilityState!=='hidden')return read();};
  const notify=()=>{clearTimeout(pushTimer);pushTimer=setTimeout(()=>{if(document.visibilityState!=='hidden')read(true);},100);};
  reader.current=()=>read(true);read();
  // Live updates start after the first paint; the 3-second check below covers the wait.
  loadBrowserDb().then(client=>{if(!active||!client)return;db=client;channel=db.channel('debate-live-results:'+debateId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'debate_result_updates',filter:'debate_id=eq.'+debateId},notify).subscribe(status=>{connected=status==='SUBSCRIBED';if(connected)visibleRead();});}).catch(()=>{});
  // Reconcile missed events; keep updating when WebSockets are unavailable.
  const timer=setInterval(()=>{if(!connected||Date.now()-lastRead>=15000)visibleRead();},3000);
  document.addEventListener('visibilitychange',visibleRead);window.addEventListener('online',visibleRead);window.addEventListener('focus',visibleRead);
  return()=>{active=false;controller?.abort();clearTimeout(pushTimer);clearInterval(timer);reader.current=null;document.removeEventListener('visibilitychange',visibleRead);window.removeEventListener('online',visibleRead);window.removeEventListener('focus',visibleRead);if(channel)db.removeChannel(channel);};
 },[debateId]);
 return {...(state.id===debateId?state:{data:null,loading:true,error:''}),refresh};
}
