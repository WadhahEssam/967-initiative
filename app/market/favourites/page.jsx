import Link from 'next/link';
import FavouritesList from '@/components/market/FavouritesList';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'المفضلة — سوق 967',description:'الإعلانات التي حفظتها في سوق 967.',path:'/market/favourites',noindex:true});

export default function MarketFavourites(){
 return <div className={styles.page}>
  <nav className={styles.crumbs} aria-label="مسار الصفحة"><Link href="/market">سوق 967</Link></nav>
  <h1 className={styles.pageTitle}>المفضلة</h1>
  <FavouritesList/>
 </div>;
}
