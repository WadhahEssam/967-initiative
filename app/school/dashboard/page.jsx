import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ChevronLeft,GraduationCap} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import SchoolDashboard from '@/components/school/SchoolDashboard';
import school from '../school.module.css';
import styles from './dashboard.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({
 title:'رحلتي التعليمية | مدرسة 967',
 description:'تابع تقدمك في جميع مسارات مدرسة 967 من مكان واحد.',
 path:'/school/dashboard',noindex:true,nofollow:true
});
export default async function SchoolDashboardPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <div className={school.root}>
  <header className={styles.hero}><div className="container">
   <nav className={school.breadcrumb} aria-label="مسار التنقل"><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/> رحلتي التعليمية</nav>
   <span className={styles.eyebrow}><GraduationCap size={18}/> حسابك في المدرسة</span>
   <h1>رحلتك، <em>في مكان واحد.</em></h1>
   <p>شاهد ما أنجزته في المسند والعروض، وواصل تعلمك من المحطة التالية. النتائج تأتي من محاولاتك المحفوظة، لا من تقديرات.</p>
  </div></header>
  <SchoolDashboard/>
 </div>;
}
