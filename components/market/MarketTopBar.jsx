import Link from 'next/link';
import {Heart,LayoutList,MessageCircle,Plus} from 'lucide-react';
import MarketSearchBar from './MarketSearchBar';
import MarketUnread from './MarketUnread';
import styles from './MarketBar.module.css';

const LINKS=[
 {key:'favourites',href:'/market/favourites',label:'المفضلة',Icon:Heart},
 {key:'messages',href:'/messages?tab=market',label:'رسائل السوق',Icon:MessageCircle},
 {key:'mine',href:'/market/mine',label:'إعلاناتي',Icon:LayoutList},
];

// The market's own bar, under the site header on every browsing screen: search first (what most
// people came for), then the member's places one tap away. `sell` adds the floating «بيع» button
// within thumb reach, above the phone tab bar.
export default function MarketTopBar({query='',keep,current=null,sell=true}){
 return <>
  <div className={styles.bar}>
   <div className={styles.inner}>
    <MarketSearchBar initial={query} keep={keep} compact/>
    <nav className={styles.links} aria-label="سوقي">
     {LINKS.map(({key,href,label,Icon})=><Link key={key} href={href} className={styles.link} aria-label={label} title={label} aria-current={current===key?'page':undefined} prefetch={false}>
      <Icon size={20} aria-hidden="true"/>{key==='messages'&&<MarketUnread/>}
     </Link>)}
    </nav>
   </div>
  </div>
  {sell&&<Link href="/market/new" className={styles.sell} prefetch={false}><Plus size={20} aria-hidden="true"/> بيع</Link>}
 </>;
}
