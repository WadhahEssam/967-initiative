import Link from '@/components/SiteLink';
import RatesEntry from '@/components/services/RatesEntry';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/services/Services.module.css';

// The daily rates entry for the people management added (and editors). It works while the
// «الخدمات» section is still hidden, so the first rates can be entered before launch.
export const metadata=pageMetadata({title:'إدخال أسعار الصرف',description:'إدخال أسعار الصرف اليومية.',path:'/services/exchange-rates/update',noindex:true});

export default function RatesUpdatePage(){
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/services/exchange-rates">أسعار الصرف</Link> / الإدخال اليومي</span>
   <h1>إدخال أسعار اليوم</h1>
   <p>الخانات تبدأ بآخر الأسعار: عدّل ما تغيّر ثم احفظ. الحفظ يعني أن كل الأسعار المعبأة صحيحة الآن، فيتجدد وقت تحديثها. امسح شراء وبيع عملة إن لم تتأكد منهما اليوم.</p>
  </header>
  <RatesEntry/>
 </div>;
}
