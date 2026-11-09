'use client';
import {useEffect,useState} from 'react';
import styles from './MarketBar.module.css';

// Unread market chat messages, from the summary the site header already fetches (Header.jsx sends
// «967:market-unread»), so this badge costs no request of its own.
export default function MarketUnread(){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  setCount(Number(window.__967MarketUnread)||0);
  const update=event=>setCount(Number(event.detail)||0);
  window.addEventListener('967:market-unread',update);
  return ()=>window.removeEventListener('967:market-unread',update);
 },[]);
 if(!count)return null;
 return <b className={styles.count} aria-label={count+' غير مقروءة'}>{count>99?'99+':count}</b>;
}
