'use client';
import {useEffect} from 'react';

// Daily aggregate counters (site_usage_daily): conversion steps (funnel.js) and searches without
// results. Section page views are no longer counted here: since 2026-11-11 page views come from
// «إحصاءات الموقع» (SiteStatsTracker.jsx); the old section counts stay as the earlier record.
function trackingAllowed(){
 if(typeof navigator==='undefined'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return false;
 try{return localStorage.getItem('967-analytics-opt-out')!=='1'&&localStorage.getItem('967-analytics-team')!=='1';}
 catch{return false;}
}
export function reportSiteUsage(event,section){
 if(!trackingAllowed()||typeof document==='undefined'||document.visibilityState==='hidden')return;
 fetch('/api/analytics/event',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({event,section}),credentials:'omit',keepalive:true
 }).catch(()=>{/* Analytics must never block navigation. */});
}
export function SearchMissTracker({category='all'}){
 useEffect(()=>{
  reportSiteUsage('search_miss',category);
 },[category]);
 return null;
}
