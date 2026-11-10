'use client';
import {useEffect,useMemo,useState} from 'react';
import YemeniFiguresDirectory from './YemeniFiguresDirectory';
import useDeferredDetails,{withDetails} from '@/components/useDeferredDetails';

export default function YemeniFiguresExplorer({figures:index,details:initialDetails,detailsUrl,initialGovernorateId=null}){
 const {details,status,load}=useDeferredDetails(detailsUrl,initialDetails);
 const figures=useMemo(()=>withDetails(index,details),[index,details]);
 const [governorateId,setGovernorateId]=useState(initialGovernorateId);
 useEffect(()=>{
  const sync=()=>setGovernorateId(new URLSearchParams(window.location.search).get('region')||null);
  // Read the address on mount too: a page restored by the back button may carry an older server prop.
  sync();window.addEventListener('popstate',sync);
  return()=>window.removeEventListener('popstate',sync);
 },[]);
 const selectGovernorate=id=>{
  setGovernorateId(id);
  const params=new URLSearchParams(window.location.search);
  if(id)params.set('region',id);else params.delete('region');
  const url='/yemeni-figures'+(params.size?'?'+params:'');
  window.history.replaceState(null,'',url);
 };
 return <YemeniFiguresDirectory figures={figures} selectedGovernorateId={governorateId} onGovernorateChange={selectGovernorate} detailsStatus={status} onNeedDetails={load}/>;
}
