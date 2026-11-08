import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ChevronLeft,ExternalLink,GraduationCap,ScrollText} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionIsVisible,sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {publishedSchoolStages} from '@/lib/schoolContentServer';
import {musnadCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {MUSNAD_SOURCE,MUSNAD_STAGES} from '@/lib/schoolMusnad';
import SchoolJourney from '@/components/school/SchoolJourney';
import styles from '../../school.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'خط المسند | مدرسة 967',description:'رحلة تعليمية تفاعلية لتعرّف حروف خط المسند وقراءتها وكتابتها عبر مراحل مع تقييم وحفظ التقدم.',path:'/school/writing/musnad'});
export default async function MusnadPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 // Once the card lessons are published, the course lives on the shared journey map.
 const db=serverDb();
 if(db&&(await publishedSchoolStages(db,'musnad')).some(s=>s.format===2))redirect('/school/courses/musnad');
 const entries=sectionIsVisible('history',settings.pageVisibility)
  ?await readPublicHistoryCatalog(db).then(result=>result.entries).catch(()=>[]):[];
 const crossLinks=musnadCrossLinks(entries,settings.pageVisibility);
 return <div className={styles.root}>
  <section className={styles.innerHero}><div className="container">
   <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/><Link href="/school/writing">الكتابة والأدب</Link><ChevronLeft size={14}/> خط المسند</div>
   <span className={styles.eyebrow}><ScrollText size={17}/> مسار تعليمي · الكتابة والأدب</span>
   <h1>رحلة <em>فكّ النقش.</em></h1>
   <p>ابدأ بأربعة حروف، وتدرّج حتى تتعرّف على حروف المسند الـ29، ثم اقرأ واكتب تسلسلات متقدمة. لكل محطة اختبار من 6 تمارين، ولا تفتح المحطة التالية إلا بعد إتقان السابقة.</p>
   <div className={styles.heroPills}><span>{MUSNAD_STAGES.length} مرحلة متاحة</span><span>نجاح بدرجة 5 من 6</span><span>محاولات جديدة بأسئلة متنوعة</span></div>
  </div></section>
  <SchoolJourney/>
  <section className={styles.practiceBanner}><div className="container"><div><span>أدوات التعلّم</span><h2>تعرّف على الحرف ثم اكتبْه بنفسك</h2><p>راجع دليل الحروف الـ29 أو استخدم لوحة تتبّع الخط على هاتفك أو حاسوبك. التدريب حرّ وغير محسوب ضمن درجة الاختبار.</p></div><div className={styles.practiceLinks}><Link href="/school/writing/musnad/alphabet">دليل الأبجدية <ChevronLeft size={17}/></Link><Link href="/school/writing/musnad/practice">لوحة تدريب الكتابة <ChevronLeft size={17}/></Link></div></div></section>
  <section className={styles.inscriptionArchive} aria-labelledby="real-inscriptions-title"><div className="container">
   <div className={styles.sectionTitle}><div><span>بعد التأسيس / مصادر أصلية</span><h2 id="real-inscriptions-title">شاهد نقوشًا يمنية حقيقية</h2></div><p>هذه مواد متحفية وعلمية للتعرّف والبحث؛ لا ندّعي أن التمارين المركبة في الدورة مأخوذة منها حرفيًا.</p></div>
   <div className={styles.inscriptionGrid}>
    <a href="https://www.britishmuseum.org/collection/object/W_1862-1028-9" target="_blank" rel="noopener noreferrer"><span>المتحف البريطاني · سبأ</span><strong>لوح نحاسي يحمل نقشًا سبئيًا من 12 سطرًا</strong><p>قطعة أثرية من اليمن تعرض شكل الكتابة المسندية في سياقها الحقيقي.</p><span>اعرض سجل القطعة <ExternalLink size={16}/></span></a>
    <a href="https://doi.org/10.82194/dasi-epi-1085" target="_blank" rel="noopener noreferrer"><span>أرشيف DASI · RES 2651</span><strong>نقش سبئي قديم بنظام الاتجاه المتناوب</strong><p>مرجع علمي يوضح اختلاف اتجاه الكتابة في بعض النقوش المبكرة عن الاتجاه الشائع من اليمين إلى اليسار.</p><span>اقرأ بطاقة النقش <ExternalLink size={16}/></span></a>
   </div>
  </div></section>
  {crossLinks.length>0&&<div className="container"><CrossSectionPaths items={crossLinks} id="musnad-cross-paths" title="من حروف المسند إلى تاريخ النقوش"/></div>}
  <section className={styles.reference}><div className="container"><div><h2>نقرأ التاريخ بدقة</h2><p>خط المسند نظام كتابة استخدمته لغات قديمة في جنوب الجزيرة العربية. التدريب الأول على قراءة الحروف، وليس على ترجمة السبئية أو تحويل العربية المعاصرة إلى لغة قديمة.</p></div><a href={MUSNAD_SOURCE} target="_blank" rel="noopener noreferrer">مرجع يونيكود لخط جنوب الجزيرة العربية القديم <ExternalLink size={16}/></a></div></section>
 </div>;
}