import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ChevronLeft,ExternalLink,PenTool} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {MUSNAD_ALPHABET,MUSNAD_NAMES} from '@/lib/schoolMusnad';
import styles from '../../../school.module.css';
export const metadata=pageMetadata({title:'أبجدية المسند كاملة | مدرسة 967',description:'دليل الحروف الـ29 لخط المسند، والمقابلات العربية والنقل الصوتي اللاتيني.',path:'/school/writing/musnad/alphabet'});
export default async function MusnadAlphabetPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <div className={styles.root}><section className={styles.innerHero}><div className="container">
  <div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/><Link href="/school/writing/musnad">خط المسند</Link><ChevronLeft size={14}/> دليل الأبجدية</div>
  <span className={styles.eyebrow}><PenTool size={16}/> مرجع تعليمي</span><h1>حروف المسند <em>الـ29.</em></h1>
  <p>أشكال الحروف ومقابلاتها التقريبية في العربية ورموز نقلها اللاتيني. لا تخلط بين معرفة الخط وترجمة اللغات القديمة التي كُتبت به.</p>
  <div className={styles.heroPills}><span>29 حرفًا</span><span>مصدر يونيكود</span><span>مراجعة مفتوحة بلا اختبار</span></div>
 </div></section>
 <section className={styles.alphabetSection}><div className="container">
   <div className={styles.sectionTitle}><div><span>ورقة مراجعة مفتوحة</span><h2>الأبجدية حرفًا بحرف</h2></div><Link className={styles.alphabetAction} href="/school/writing/musnad/practice">التدرب على كتابة الحروف <ArrowLeft size={17}/></Link></div>
   <div className={styles.alphabetGrid} aria-label="حروف خط المسند">
   {MUSNAD_ALPHABET.map((letter,index)=><article key={letter.id} className={styles.alphabetCard}>
    <span className={styles.alphabetIndex} dir="ltr">{String(index+1).padStart(2,'0')}</span>
    <strong className={styles.alphabetGlyph} lang="und" dir="rtl">{letter.glyph}</strong>
    <span className={styles.alphabetName}>{letter.name}</span>
    <span className={styles.alphabetLatin} dir="ltr">{letter.latin}</span>
   </article>)}
   </div>
   <div className={styles.alphabetNotes}><h3>ملاحظات مهمة</h3>
    <p>يحتوي المسند على حروف تتشابه أسماؤها العربية، لكنها مختلفة تاريخيًا، مثل رموز الصفير المنقولة باللاتينية s¹ وš وś. كما أن بعض القيم الصوتية القديمة لا تتطابق تمامًا مع نطق العربية الحديثة.</p>
    <p>قد تحتاج أجهزة قديمة إلى دعم خط يونيكود «Old South Arabian» لعرض الرموز بشكل صحيح.</p>
    <a href={MUSNAD_NAMES} target="_blank" rel="noopener noreferrer">راجع أسماء الرموز في معيار يونيكود <ExternalLink size={16}/></a>
   </div>
 </div></section></div>;
}