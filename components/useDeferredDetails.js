'use client';
import {useCallback,useEffect,useRef,useState} from 'react';

// Fetches a list page's full details once the page has loaded and the browser is idle, or at
// once when the reader starts using the list (load). Rows the server already sent stay as they are.
export default function useDeferredDetails(url,initial){
 const [details,setDetails]=useState(()=>initial||{});
 const [status,setStatus]=useState('idle');
 const started=useRef(false);
 const load=useCallback(()=>{
  if(started.current||!url)return;
  started.current=true;setStatus('loading');
  fetch(url).then(response=>{if(!response.ok)throw Error(String(response.status));return response.json();})
   .then(data=>{setDetails(previous=>({...data.details,...previous}));setStatus('ready');})
   .catch(()=>{started.current=false;setStatus('failed');});
 },[url]);
 useEffect(()=>{
  // Data Saver: wait for the reader to scroll (they are looking past the first screen), not for idle time.
 if(navigator.connection?.saveData){addEventListener('scroll',load,{once:true,passive:true});return()=>removeEventListener('scroll',load);}
  let idle=0,timer=0;
  const start=()=>{if(window.requestIdleCallback)idle=requestIdleCallback(load,{timeout:3000});else timer=setTimeout(load,1200);};
  if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});
  return()=>{removeEventListener('load',start);if(idle)cancelIdleCallback(idle);clearTimeout(timer);};
 },[load]);
 return {details,status,load};
}

// Rows without details are marked pending so the UI can show a placeholder instead of empty text.
export function withDetails(rows,details,key='slug'){
 return rows.map(row=>{const extra=details[row[key]];return extra?{...row,...extra}:{...row,pending:true};});
}
