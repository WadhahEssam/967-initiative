'use client';
import {useEffect} from 'react';
import {operationalRoute} from '@/lib/operationalEvents';
export default function OperationalMonitor(){
 useEffect(()=>{
  const last=new Map();let sent=0;
  const send=(event,extra={})=>{
   if(sent>=10)return;
   const route=operationalRoute(location.pathname),key=event+route+String(extra.kind||'');
   if(Date.now()-(last.get(key)||0)<30000)return;
   last.set(key,Date.now());sent++;
   fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,route,...extra}),keepalive:true,credentials:'omit'}).catch(()=>{});
  };
  const error=()=>send('client_error',{kind:'error'}),rejection=event=>{if(!event.defaultPrevented)send('client_error',{kind:'unhandledrejection'});};
  window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);
  let observer;
  if(typeof PerformanceObserver!=='undefined'){
   observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){
    try{const url=new URL(entry.name);if(url.origin!==location.origin||!url.pathname.startsWith('/api/')||url.pathname==='/api/telemetry')continue;
     if(entry.responseStatus>=500)send('api_failure',{route:operationalRoute(url.pathname),status:entry.responseStatus});
     else if(entry.duration>=5000)send('slow_response',{route:operationalRoute(url.pathname),durationMs:entry.duration});
    }catch{/* No raw resource URLs are sent. */}
   }});observer.observe({type:'resource',buffered:true});
  }
  return ()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);observer?.disconnect();};
 },[]);
 return null;
}
