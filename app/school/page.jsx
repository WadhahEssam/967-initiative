import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,GraduationCap,Layers,Sparkles,Star} from 'lucide-react';
import SchoolWorldMap from '@/components/school/SchoolWorldMap';
import SchoolContinueCard from '@/components/school/v2/SchoolContinueCard';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from './school.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'مدرسة 967',description:'مدرسة 967: الكتابة والأدب والفلك والطبيعة والمنطق والتفكير؛ 15 مسارًا و180 محطة تفاعلية',path:'/school'});
export default async function SchoolPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <div className={styles.root}>
  <div className={styles.schoolHero}><div className="container">
   <div className={styles.breadcrumb}><Link href="/">الرئيسية</Link><ChevronLeft size={14}/> مدرسة 967</div>
   <div className={styles.heroGrid}><div>
    <span className={styles.eyebrow}><GraduationCap size={18}/> مدرسة 967</span>
    <h1>كل مهارة، <em>رحلة جديدة.</em></h1>
    <p>هنا لا تكتفي بقراءة معلومة؛ تتعلّمها، تطبّقها، وتتقدم خطوة بخطوة. تنجح فتفتح المحطة التالية، وتتعثر فتتدرّب وتحاول من جديد.</p>
    <div className={styles.heroActions}><Link className={styles.primaryLink} href="#school-paths">استكشف المسارات <ArrowLeft size={18}/></Link><Link className={styles.myLearningLink} href="/school/dashboard">رحلتي التعليمية <GraduationCap size={18}/></Link></div>
    <div className={styles.heroPills}><span><Layers size={16}/> مراحل متدرجة</span><span><Sparkles size={16}/> تمارين تتجدد</span><span><Star size={16}/> إتقان قبل الانتقال</span></div>
   </div><div className={styles.heroArtifact} aria-hidden="true"><div className={styles.artifactRing}/><span className={styles.artifactGlyph}>𐩣</span><span className={styles.artifactTag}>خط المسند</span></div></div>
   <SchoolContinueCard/>
  </div></div>
  <section className={styles.catalogSection} id="school-paths"><div className="container">
   <div className={styles.sectionTitle}><div><span>خريطة التعلم / 967</span><h2>أي عالم ستستكشف أولًا؟</h2></div><p>أربع مناطق متاحة، 15 مسارًا و180 محطة تعليمية. اختر موضوعك وابدأ رحلتك، أو أكمل من حيث توقفت.</p></div>
   <SchoolWorldMap/>
  </div></section>
 </div>;
}
