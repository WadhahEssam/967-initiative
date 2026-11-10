import Link from '@/components/SiteLink';
import FoodEntry from '@/components/services/FoodEntry';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

// The weekly staple prices entry for the people management added (and editors). It works while
// the page is still hidden, so the first prices can be entered before launch.
export const metadata=pageMetadata({title:'إدخال أسعار المواد الأساسية',description:'إدخال أسعار المواد الأساسية الأسبوعية.',path:'/services/food-prices/update',noindex:true});

export default function FoodPricesUpdatePage(){
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services/food-prices">أسعار المواد الأساسية</Link> / الإدخال الأسبوعي</span>
   <h1>إدخال أسعار المواد</h1>
   <p>الخانات تبدأ بآخر الأسعار: عدّل ما تغيّر ثم احفظ. الحفظ يعني أن كل الأسعار المعبأة صحيحة الآن، فيتجدد تاريخها. امسح خانة أي مادة لم تتأكد من سعرها هذا الأسبوع، أو ابدأ بـ«أفرغ الخانات» وأدخل ما تحققت منه فقط.</p>
   <p>أسعار الصرف تُدخل يوميًا من <Link href="/services/exchange-rates/update">صفحتها</Link>.</p>
  </header>
  <FoodEntry/>
 </div>;
}
