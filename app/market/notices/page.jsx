import Link from 'next/link';
import MarketNotices from '@/components/market/MarketNotices';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'رسائل الإدارة — سوق 967',description:'رسائل فريق 967 وقراراته بشأن إعلاناتك.',path:'/market/notices',noindex:true});

export default function MarketNoticesPage(){
 return <div className={styles.page}>
  <nav className={styles.crumbs} aria-label="مسار الصفحة"><Link href="/market">سوق 967</Link></nav>
  <h1 className={styles.pageTitle}>رسائل الإدارة</h1>
  <MarketNotices/>
 </div>;
}
