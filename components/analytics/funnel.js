'use client';
import {useEffect} from 'react';
import {reportSiteUsage} from './SiteUsageTracker';
import {browserMayBeSignedIn} from '@/lib/browserSession';

// Conversion counters (lib/siteAnalytics FUNNEL_STEPS). Each step is sent at most once per tab
// session for the same item, so reopening a lesson or re-rendering does not inflate the count.
// Nothing identifies the visitor: the server keeps one counter per step and day.
function firstTime(step,key){
 try{
  const name='967-funnel:'+step+':'+(key||'');
  if(sessionStorage.getItem(name))return false;
  sessionStorage.setItem(name,'1');return true;
 }catch{return true;}
}
export const funnelAudience=()=>browserMayBeSignedIn()?'member':'guest';
export function trackFunnel(step,key=''){
 if(typeof window==='undefined'||!firstTime(step,key))return;
 reportSiteUsage('funnel',step);
}
// Sends `${kind}_${guest|member}` once when `active` turns true (kind: lesson_start, game_done, ...).
export function useFunnelStep(kind,active,key=''){
 useEffect(()=>{if(active)trackFunnel(kind+'_'+funnelAudience(),key);},[kind,active,key]);
}
