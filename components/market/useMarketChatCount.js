'use client';
import {useCallback,useEffect,useState} from 'react';
import {marketApi} from '@/lib/market/clientApi';

// Unread «سوق 967» chat messages for the messages page tab. The tab shows only when the market
// answers (it is hidden from members until launch). Checked every minute while the page is visible.
export default function useMarketChatCount(userId){
 const [state,setState]=useState({available:false,unread:0});
 useEffect(()=>{
  if(!userId){setState({available:false,unread:0});return;}
  let live=true;
  const refresh=()=>{
   if(document.visibilityState!=='visible')return;
   marketApi('/api/market/chats?mode=summary').then(result=>{if(live)setState({available:true,unread:Number(result.unread||0)});})
    .catch(error=>{if(live&&[401,403,404].includes(error.status))setState({available:false,unread:0});});
  };
  refresh();
  const timer=setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
  return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[userId]);
 const setUnread=useCallback(unread=>setState(current=>current.unread===unread&&current.available?current:{available:true,unread}),[]);
 return {...state,setUnread};
}
