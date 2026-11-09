import Link from 'next/link';
import MyListings from '@/components/market/MyListings';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'إعلاناتي — سوق 967',description:'إعلاناتك في سوق 967 وحالاتها.',path:'/market/mine',noindex:true});

export default function MarketMine(){
 return <div className={styles.page}>
  <nav className={styles.crumbs} aria-label="مسار الصفحة"><Link href="/market">سوق 967</Link></nav>
  <h1 className={styles.pageTitle}>إعلاناتي</h1>
  <MyListings/>
 </div>;
}
