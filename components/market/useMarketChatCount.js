'use client';
import {useCallback,useEffect,useState} from 'react';
import {marketApi} from '@/lib/market/clientApi';

// Unread «سوق 967» chat messages for the messages page tab. One request on load tells whether the
// market answers this member (it is hidden until launch); after that the count follows the summary
// the site header already polls (Header.jsx sends «967:market-unread»), with no second poll.
export default function useMarketChatCount(userId){
 const [state,setState]=useState({available:false,unread:0});
 useEffect(()=>{
  if(!userId){setState({available:false,unread:0});return;}
  let live=true;
  marketApi('/api/market/chats?mode=summary').then(result=>{if(live)setState({available:true,unread:Number(result.unread||0)});})
   .catch(error=>{if(live&&[401,403,404].includes(error.status))setState({available:false,unread:0});});
  const update=event=>setState(current=>current.available?{available:true,unread:Number(event.detail)||0}:current);
  window.addEventListener('967:market-unread',update);
  return()=>{live=false;window.removeEventListener('967:market-unread',update);};
 },[userId]);
 const setUnread=useCallback(unread=>setState(current=>current.unread===unread&&current.available?current:{available:true,unread}),[]);
 return {...state,setUnread};
}
