'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {browserMayBeSignedIn} from '@/lib/browserSession';
import {PING_MS,VISIT_IDLE_MS,statsPath} from '@/lib/siteStats';
import {OPT_OUT_KEY,isTeamDevice} from '@/lib/siteStatsDevice';

// «إحصاءات الموقع»: our own first-party statistics (no third party, no cookies).
// The browser keeps a random visitor id and a random visit id (localStorage) and sends:
// a page view, the time the page was visible, and a ping every 2 minutes while it is visible.
// Not counted: Do Not Track / GPC, the opt-out flag, automated browsers, and the team's devices
// (marked when an editor or manager signs in, see components/editorFlag.js).
const VISITOR_KEY='967-visitor',VISIT_KEY='967-visit';
// Older phones lack crypto.randomUUID; a v4 id from random bytes works everywhere.
const uuid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
const randomId=()=>{const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return Array.from(bytes,b=>(b%36).toString(36)).join('')+Date.now().toString(36).slice(-6);};

export function statsAllowed(){
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 if(navigator.webdriver||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return false;
 try{return localStorage.getItem(OPT_OUT_KEY)!=='1'&&!isTeamDevice();}
 catch{return false;}
}

function visitor(){
 let id=localStorage.getItem(VISITOR_KEY),isNew=false;
 if(!/^[a-z0-9]{16,32}$/.test(id||'')){id=randomId();isNew=true;localStorage.setItem(VISITOR_KEY,id);}
 return {id,isNew};
}
// A visit ends after 30 minutes without activity.
function visit(now=Date.now(),advance=false){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(VISIT_KEY)||'null');}catch{}
 const fresh=!saved||!/^[a-z0-9]{16,32}$/.test(saved.id||'')||now-Number(saved.last)>VISIT_IDLE_MS;
 const next=fresh?{id:randomId(),seq:0,last:now}:{...saved,last:now};
 if(advance)next.seq=Number(next.seq||0)+1;
 localStorage.setItem(VISIT_KEY,JSON.stringify(next));
 return next;
}
function send(body,beacon=false){
 const text=JSON.stringify(body);
 try{
  if(beacon&&navigator.sendBeacon&&navigator.sendBeacon('/api/analytics/collect',new Blob([text],{type:'application/json'})))return;
 }catch{/* fall back to fetch */}
 fetch('/api/analytics/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:text,credentials:'omit',keepalive:true}).catch(()=>{});
}
const pageTitle=()=>typeof document==='undefined'?'':document.title;
function referrerHost(){
 try{if(!document.referrer)return '';const url=new URL(document.referrer);return url.host===location.host?'':url.protocol==='android-app:'?url.hostname:url.host;}catch{return '';}
}

export default function SiteStatsTracker(){
 const pathname=usePathname();
 const current=useRef(null);
 const flushRef=useRef(null);

 // Visible time of the current page: sent when it is hidden, left, or replaced by the next page.
 useEffect(()=>{
  const flush=beacon=>{
   const page=current.current;if(!page)return;
   if(page.since){page.ms+=Date.now()-page.since;page.since=document.visibilityState==='visible'?Date.now():0;}
   if(page.ms<500)return;
   send({t:'time',id:page.id,v:page.visitor,ms:Math.round(page.ms),ti:pageTitle()},beacon);
  };
  const onVisibility=()=>{
   const page=current.current;if(!page)return;
   if(document.visibilityState==='hidden')flush(true);
   else{page.since=Date.now();try{visit();}catch{}}
  };
  const onHide=()=>flush(true);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('pagehide',onHide);
  const timer=setInterval(()=>{
   const page=current.current;
   if(!page||document.visibilityState!=='visible')return;
   try{const v=visit();send({t:'ping',v:page.visitor,s:v.id,p:page.path});}catch{}
  },PING_MS);
  flushRef.current=flush;
  return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onHide);clearInterval(timer);};
 },[]);

 useEffect(()=>{
  flushRef.current?.(false);
  current.current=null;
  const path=statsPath(pathname);
  if(!path||!statsAllowed())return;
  // Wait a moment so the new page's title is in place, and skip pages left immediately.
  const timer=setTimeout(()=>{
   try{
    const who=visitor(),v=visit(Date.now(),true);
    const page={id:uuid(),visitor:who.id,path,ms:0,since:document.visibilityState==='visible'?Date.now():0};
    current.current=page;
    const params=new URLSearchParams(location.search);
    send({t:'view',id:page.id,v:who.id,s:v.id,p:path,q:v.seq,n:who.isNew,m:browserMayBeSignedIn(),
     r:v.seq===1?referrerHost():'',u:v.seq===1?(params.get('utm_source')||'').slice(0,30):'',sh:v.seq===1&&path.startsWith('/share/'),
     th:document.documentElement.dataset.edTheme,ti:pageTitle()});
   }catch{/* storage or crypto unavailable: not counted */}
  },400);
  return()=>clearTimeout(timer);
 },[pathname]);
 return null;
}
