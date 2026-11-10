import MarketTopBar from '@/components/market/MarketTopBar';
import MarketNotices from '@/components/market/MarketNotices';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'رسائل الإدارة — سوق 967',description:'رسائل فريق 967 وقراراته بشأن إعلاناتك.',path:'/market/notices',noindex:true});

export default function MarketNoticesPage(){
 return <div className={styles.page}>
  <MarketTopBar/>
  <h1 className={styles.pageTitle}>رسائل الإدارة</h1>
  <MarketNotices/>
 </div>;
}
