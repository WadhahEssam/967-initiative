import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,Landmark,Scale,ChartNoAxesCombined,Wallet,Banknote} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {civicCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {serverDb} from '@/lib/supabase-server';
import {publishedSchoolCatalog,publishedSchoolStageList} from '@/lib/schoolContentServer';
import school from '../school.module.css';
import styles from './civic.module.css';
import SchoolTrackTrail from '@/components/school/SchoolTrackTrail';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'السياسة والاقتصاد | مدرسة 967',description:'تعلّم الدولة وأنظمة الحكم والاقتصاد والبنوك عبر محطات ومحاكاة قرارات حيادية.',path:'/school/civic'});
const TRACKS=[
 {slug:'how-state-works',icon:Landmark,area:'السياسة'},
 {slug:'political-systems',icon:Scale,area:'السياسة'},
 {slug:'economics-basics',icon:ChartNoAxesCombined,area:'الاقتصاد'},
 {slug:'money-banks-inflation',icon:Banknote,area:'الاقتصاد'}
];
export default async function SchoolCivicPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 const db=serverDb(),courses=db?await publishedSchoolCatalog(db):[];
 const tracks=await Promise.all(TRACKS.map(async t=>{
  const course=courses.find(c=>c.slug===t.slug&&c.category==='السياسة والاقتصاد');
  return course?{...t,course,count:(await publishedSchoolStageList(db,t.slug)).length}:null;
 }));
 return <div className={school.root}>
  <header className={styles.hero}><div className="container">
   <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/> السياسة والاقتصاد</div>
   <span className={styles.eyebrow}><Landmark size={18}/> القسم الخامس / مدرسة 967</span>
   <h1>افهم القرار، <em>واختبر نتائجه.</em></h1>
   <p>ابدأ بأساسيات الدولة والحكم والاقتصاد والمال. كل محطة تجمع بين الشرح والمثال والمحاكاة والاختبار، دون تقييم الآراء السياسية.</p>
   <Link className={school.primaryLink} href="/school/dashboard">رحلتي التعليمية <ArrowLeft size={17}/></Link>
  </div></header>
  <section className={school.catalogSection}><div className="container">
   <div className={school.sectionTitle}><div><span>المرحلة الأولى</span><h2>أربعة مسارات، 48 محطة</h2></div><p>12 محطة في كل مسار؛ النجاح في 5 من 6 أسئلة يفتح التالية. محاكاة القرارات للتجربة والتعلم، ولا تمنح درجة سياسية.</p></div>
   <SchoolTrackTrail theme="civic" tracks={tracks.filter(Boolean).map(({slug,icon,area,course,count})=>({slug,icon,glyph:area==='السياسة'?'§':'%',title:course.title,description:course.description,count,label:area}))} intro="تعرّف على العالم من زاوية صنع القرار: كيف تعمل الدول والأسواق والمال؟ تعلّم الفكرة ثم جرّب أثر القرار."/>
   {!tracks.some(Boolean)&&<p className={styles.note}>لم تُنشر مسارات السياسة والاقتصاد بعد.</p>}
   <div className={styles.note}><Wallet size={17} style={{verticalAlign:'middle'}}/> تستخدم المختبرات دولًا وأسواقًا افتراضية ونماذج حسابية محددة. النتائج التعليمية لا تصنّف الأنظمة السياسية ولا تتنبأ بالأحداث أو الأسعار.</div>
  </div></section>
  <div className="container"><CrossSectionPaths items={civicCrossLinks(settings.pageVisibility)} id="civic-cross-paths" title="من الدرس إلى بيانات اليمن الحقيقية"/></div>
 </div>;
}
