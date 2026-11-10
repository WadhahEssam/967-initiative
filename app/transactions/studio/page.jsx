import Link from '@/components/SiteLink';
import GuidesEditor from '@/components/transactions/GuidesEditor';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/transactions/Transactions.module.css';

// Where the guide editors (and editors) write and check guides. Not behind the section switch,
// so guides can be prepared before launch.
export const metadata=pageMetadata({title:'تحرير دليل المعاملات',description:'كتابة أدلة المعاملات والتحقق منها.',path:'/transactions/studio',noindex:true});

export default function GuidesStudioPage(){
 return <div className={'ed-wrap '+styles.page}>
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/transactions">دليل المعاملات</Link> / التحرير</span>
   <h1>تحرير الأدلة</h1>
   <p>اكتب خطوات المعاملة لكل مدينة، ثم اجعل حالتها «بانتظار التحقق». تُنشر فقط بعد أن يتحقق منها شخص يعرف الإجراءات ويكتب تاريخ التحقق.</p>
  </header>
  <GuidesEditor/>
 </div>;
}
