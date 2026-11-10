import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,BookOpen,ChevronLeft,Orbit,CloudSun,Mountain,Stars,FlaskConical} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {serverDb} from '@/lib/supabase-server';
import {publishedSchoolCatalog,publishedSchoolStageList} from '@/lib/schoolContentServer';
import styles from '../school.module.css';
import SchoolTrackTrail from '@/components/school/SchoolTrackTrail';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'الفلك والطبيعة | مدرسة 967',description:'اكتشف المجموعة الشمسية والطقس والأرض من الداخل وأسرار الكون عبر 48 درسًا وتجارب علمية.',path:'/school/nature'});
const TRACKS=[
 {slug:'solar-system',icon:Orbit,glyph:'☉',tag:'المجموعة الشمسية'},
 {slug:'weather-climate',icon:CloudSun,glyph:'☁',tag:'الطقس والمناخ'},
 {slug:'earth-interior',icon:Mountain,glyph:'⌁',tag:'الأرض من الداخل'},
 {slug:'universe-mysteries',icon:Stars,glyph:'✦',tag:'أسرار الكون'}
];
export default async function SchoolNaturePage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 const db=serverDb(),courses=db?await publishedSchoolCatalog(db):[];
 const tracks=await Promise.all(TRACKS.map(async track=>{
  const course=courses.find(c=>c.slug===track.slug);
  if(!course||course.category!=='الفلك والطبيعة')return null;
  const stages=await publishedSchoolStageList(db,track.slug);
  return {...track,course,stageCount:stages.length};
 }));
 return <div className={styles.root}>
  <section className={styles.natureHero}><div className="container">
   <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/> الفلك والطبيعة</div>
   <span className={styles.eyebrow}><Stars size={19}/> القسم الثاني / مدرسة 967</span>
   <h1>افهم العالم، <em>واختبر كيف يعمل.</em></h1>
   <p>من حركة الكواكب إلى تكوّن السحب وطبقات الأرض وأعماق الكون. 48 درسًا قصيرًا، فيها أمثلة وتوقع للنتيجة وتجارب علمية تغيّر متغيراتها بنفسك.</p>
   <Link className={styles.primaryLink} href="/school/dashboard">رحلتي التعليمية <ArrowLeft size={17}/></Link>
  </div></section>
  <section className={styles.catalogSection}><div className="container">
   <div className={styles.sectionTitle}><div><span>المسارات الأربعة</span><h2>اختر موضوعًا لتجربته</h2></div>
    <p>12 درسًا في كل مسار؛ أول ثلاثة مفتوحة دون حساب، وإنهاء الدرس يفتح التالي، والنجوم تقيس إتقانك.</p></div>
   <SchoolTrackTrail theme="nature" tracks={tracks.filter(Boolean).map(({slug,icon,glyph,course,stageCount,tag})=>({slug,icon,glyph,title:course.title,description:course.description,count:stageCount,label:tag}))} intro="من أقرب الكواكب إلى أبعد المجرات: افتح رحلة علمية واختر التجربة التي تثير فضولك."/>
   {!tracks.some(Boolean)&&<p className={styles.logicEmpty}>لم تُنشر مسارات هذا القسم بعد.</p>}
   <div className={styles.natureFootnote}><FlaskConical size={18}/> نماذج علمية مبسطة مع مصادر موثقة، وليست توقعات جوية أو جيولوجية أو فلكية تشغيلية.</div>
  </div></section>
 </div>;
}
