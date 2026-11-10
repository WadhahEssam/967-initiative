import MarketTopBar from '@/components/market/MarketTopBar';
import SavedSearchesList from '@/components/market/SavedSearchesList';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'بحوثي المحفوظة — سوق 967',description:'البحوث التي حفظتها في سوق 967 وإشعاراتها.',path:'/market/saved-searches',noindex:true});

export default function MarketSavedSearches(){
 return <div className={styles.page}>
  <MarketTopBar/>
  <h1 className={styles.pageTitle}>بحوثي المحفوظة</h1>
  <p className={styles.lead}>يصلك إشعار عند نزول إعلان جديد يطابق أي بحث فعّلت إشعاره.</p>
  <SavedSearchesList/>
 </div>;
}
