import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,BookOpen,ChevronLeft,Feather,GraduationCap,PenTool} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from '../school.module.css';
import {serverDb} from '@/lib/supabase-server';
import {publishedSchoolCatalog} from '@/lib/schoolContentServer';
import SchoolTrackTrail from '@/components/school/SchoolTrackTrail';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'الكتابة والأدب | مدرسة 967',description:'خط المسند وعلم العروض والخط العربي ضمن المدرسة التفاعلية.',path:'/school/writing'});
export default async function WritingPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 const db=serverDb();
 const published=db?await publishedSchoolCatalog(db):[];
 const authored=published.filter(c=>c.category==='الكتابة والأدب'&&!['musnad','arud'].includes(c.slug));
 const musnad=published.find(c=>c.slug==='musnad'),arud=published.find(c=>c.slug==='arud');
 const tracks=[
  {href:'/school/courses/musnad',title:musnad?.title||'خط المسند',description:musnad?.description||'رحلة من رموز المسند إلى قراءة النصوص وكتابة جمل كاملة.',glyph:'𐩣𐩡',icon:PenTool,count:12,label:'الكتابة القديمة'},
  {href:'/school/courses/arud',title:arud?.title||'علم العروض',description:arud?.description||'تعلّم الإيقاع والتفعيلات والبحور من خلال تجارب وتقطيع الأبيات.',glyph:'♫',icon:Feather,count:12,label:'إيقاع الشعر'},
  ...authored.map(course=>({slug:course.slug,href:'/school/courses/'+course.slug,title:course.title,description:course.description,glyph:'✒',icon:BookOpen,label:'الخط والفنون الكتابية'}))
 ];
 return <div className={styles.root}><section className={styles.innerHero}><div className="container">
  <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/> الكتابة والأدب</div>
  <span className={styles.eyebrow}><PenTool size={17}/> الكتابة والأدب</span>
  <h1>من شكل الحرف، <em>إلى فن التعبير.</em></h1>
  <p>مسارات تساعدك على إتقان الكتابة والنظم خطوة بخطوة. تعلم خط المسند والعروض والخطوط العربية عبر 36 درسًا تفاعليًا، وتابع رحلتك من مكان واحد.</p><Link className={styles.primaryLink} href="/school/dashboard">عرض رحلتي التعليمية <ArrowLeft size={18}/></Link>
  </div></section>
  <section className={styles.catalogSection}><div className="container">
   <div className={styles.sectionTitle}><div><span>مسارات هذا القسم</span><h2>رحلتك تبدأ من هنا</h2></div></div>
   <SchoolTrackTrail theme="writing" tracks={tracks} intro="اختر ما تحب أن تبدأ به: الكتابة بالمسند، أوزان الشعر أو الخطوط العربية. يمكنك العودة إلى مسار آخر في أي وقت."/>
  </div></section>
 </div>;
}