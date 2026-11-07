import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ChevronLeft,ExternalLink,Feather} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {serverDb} from '@/lib/supabase-server';
import {publishedSchoolStages} from '@/lib/schoolContentServer';
import {ARUD_STAGES,ARUD_SOURCE,ARUD_METER_SOURCE,ARUD_VERSE_SOURCE} from '@/lib/schoolArud';
import ArudJourney from '@/components/school/ArudJourney';
import school from '../../school.module.css';
import styles from './arud.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'علم العروض | مدرسة 967',description:'ابدأ تعلم الوزن الشعري من الأصوات إلى التفعيلات في 12 محطة تفاعلية مع حفظ التقدم وتصحيح الإجابات.',path:'/school/writing/arud'});
export default async function ArudPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 // بعد نشر دروس البطاقات للعروض ينتقل المسار إلى صفحة المسارات العامة (خريطة الرحلة الجديدة).
 const db=serverDb();
 if(db&&(await publishedSchoolStages(db,'arud')).some(s=>s.format===2))redirect('/school/courses/arud');
 return <div className={school.root}>
  <header className={styles.hero}><div className="container">
   <div className={school.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/><Link href="/school/writing">الكتابة والأدب</Link><ChevronLeft size={14}/>علم العروض</div>
   <div className={styles.heroInterior}>
    <div><span className={styles.overline}><Feather size={18}/> مدرسة 967 · الكتابة والأدب</span>
     <h1>الكلمة لها <em>إيقاع.</em></h1>
     <p>تعلم كيف تسمع وزن الشعر وتراه. من قواعد النطق والتفعيلات إلى تقطيع البيت الكامل، وفهم الزحافات والعلل والتعرف على أوزان البحور الستة عشر، في رحلة تدريجية تحفظ تقدمك.</p>
     <div className={styles.heroFacts}><span>{ARUD_STAGES.length} محطات متدرجة</span><span>6 تمارين لكل محطة</span><span>النجاح من 5 / 6</span></div>
     <a className={styles.heroAction} href="#arud-stages">ابدأ الرحلة <ChevronLeft size={17}/></a>
    </div>
    <div className={styles.heroArtwork} aria-hidden="true"><div className={styles.artworkLabel}>الميزان / 967</div><div className={styles.pulseLine}>ᴗ — —</div><div className={styles.tafila}>فَعُولُنْ</div><div className={styles.artworkFooter}>من الصوت إلى الوزن</div></div>
   </div>
  </div></header>
  <ArudJourney/>
  <section className={styles.reference}><div className="container"><div><h2>التدرّب قبل الحفظ</h2><p>بدأ المسار بأربع محطات تأسيسية، ثم انتقل إلى تقطيع الأشطر والأبيات الكاملة وتغيّرات التفعيلات. وتتناول المحطات الختامية الأوزان النظرية للبحور الستة عشر، مع التنبيه إلى اختلاف الصور المستعملة في الشعر.</p></div><div className={styles.referenceLinks}><a href={ARUD_SOURCE} target="_blank" rel="noopener noreferrer">مرجع العروض <ExternalLink size={17}/></a><a href={ARUD_VERSE_SOURCE} target="_blank" rel="noopener noreferrer">تقطيع بيت امرئ القيس <ExternalLink size={17}/></a><a href={ARUD_METER_SOURCE} target="_blank" rel="noopener noreferrer">البحور الستة عشر <ExternalLink size={17}/></a></div></div></section>
 </div>;
}
