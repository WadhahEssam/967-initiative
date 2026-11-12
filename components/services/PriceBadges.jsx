import {Eye,Flag,LockKeyhole,ShieldCheck,Zap} from 'lucide-react';
import {PRICE_BADGES} from '@/lib/priceIncentives';
import styles from './Services.module.css';

// The four reporters' badges: small icons on the weekly board, cards on a member's own page.
const ICONS={flag:Flag,eye:Eye,shield:ShieldCheck,zap:Zap};
const byCode=Object.fromEntries(PRICE_BADGES.map(badge=>[badge.code,badge]));

export function BadgeIcons({codes=[]}){
 const shown=PRICE_BADGES.filter(badge=>codes.includes(badge.code));
 if(!shown.length)return null;
 return <span className={styles.badgeIcons}>{shown.map(badge=>{const Icon=ICONS[badge.icon];return <span key={badge.code} className={styles.badgeIcon} data-tier={badge.tier} title={badge.title} role="img" aria-label={badge.title}><Icon size={14} aria-hidden="true"/></span>;})}</span>;
}

export function BadgeCards({badges=[]}){
 return <ul className={styles.badgeCards}>{badges.map(badge=>{
  const info=byCode[badge.code]||badge,Icon=ICONS[info.icon]||Flag;
  return <li key={badge.code} data-earned={badge.earned||undefined} data-tier={info.tier}>
   <span className={styles.badgeSymbol} aria-hidden="true"><Icon size={22}/></span>
   <strong>{info.title}</strong>
   <small>{info.description}</small>
   <span className={styles.badgeState}>{badge.earned?'مكتسبة':<><LockKeyhole size={12} aria-hidden="true"/> {badge.progress!=null&&info.goal?badge.progress+' من '+info.goal:'لم تُكتسب'}</>}</span>
  </li>;
 })}</ul>;
}
