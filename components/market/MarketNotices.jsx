'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Ban,CheckCircle2,Megaphone,ShieldAlert,Trash2} from 'lucide-react';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import {timeAgo} from '@/lib/market/format';
import styles from './Safety.module.css';
import market from './Market.module.css';

const ICONS={listing_held:ShieldAlert,listing_approved:CheckCircle2,listing_rejected:ShieldAlert,listing_removed:Trash2,admin_message:Megaphone,market_ban:Ban};

// The member's notices from the team in full: messages, review decisions and bans. Opening the
// page marks them read.
export default function MarketNotices(){
 const [notices,setNotices]=useState(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  marketSession().then(session=>{
   if(!session){location.href=loginHref();return null;}
   return marketApi('/api/market/notices').then(result=>{if(live)setNotices(result.notices);});
  }).catch(e=>live&&setError(e.message));
  return()=>{live=false;};
 },[]);
 if(error)return <p className={market.empty} role="alert">{error}</p>;
 if(!notices)return <p className={market.empty}>جارٍ التحميل…</p>;
 if(!notices.length)return <p className={market.empty}>لا توجد رسائل من الإدارة.</p>;
 return <ul className={styles.notices}>
  {notices.map(item=>{const Icon=ICONS[item.kind]||Megaphone;return <li key={item.id} className={item.unread?styles.noticeNew:styles.notice}>
   <Icon size={20} aria-hidden="true"/>
   <div><strong>{item.title}</strong>{item.text&&<p>{item.text}</p>}<small>{timeAgo(item.createdAt)}</small></div>
  </li>;})}
  <li className={styles.hint}>لديك سؤال عن قرار؟ راسلنا من <Link href="/privacy-requests">صفحة الطلبات والبلاغات</Link>.</li>
 </ul>;
}
