import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ChevronLeft,PenLine} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import MusnadWritingStudio from '@/components/school/MusnadWritingStudio';
import styles from '../../../school.module.css';
export const metadata=pageMetadata({title:'تدرّب على كتابة المسند | مدرسة 967',description:'لوحة تفاعلية لتتبع حروف المسند الـ29 بإصبعك أو الفأرة.',path:'/school/writing/musnad/practice'});
export default async function PracticePage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <div className={styles.root}><section className={styles.innerHero}><div className="container">
   <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/><Link href="/school/writing/musnad">خط المسند</Link><ChevronLeft size={14}/> لوحة الكتابة</div>
   <span className={styles.eyebrow}><PenLine size={18}/> تعلم بالممارسة</span>
   <h1>اكتب المسند <em>بيدك.</em></h1>
   <p>اختر حرفًا ثم تتبّع شكله على الشاشة باستخدام الفأرة أو الإصبع. يمكنك إخفاء الدليل ورسمه من الذاكرة.</p>
 </div></section>
 <MusnadWritingStudio/>
 </div>;
}