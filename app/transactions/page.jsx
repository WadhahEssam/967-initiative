import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getPublishedGuides} from '@/lib/transactionGuidesServer';
import {pageMetadata} from '@/lib/seo';
import {guideStats} from '@/lib/transactionGuides';
import GuideIndex from '@/components/transactions/GuideIndex';
import {StepArt} from '@/components/transactions/GuideView';
import styles from '@/components/transactions/Transactions.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'دليل المعاملات',description:'خطوات واضحة ومصوّرة لأشهر المعاملات الحكومية في صنعاء وعدن: الجواز والبطاقة وشهادة الميلاد ورخصة القيادة وتوثيق الشهادات، مع الأوراق المطلوبة والرسوم.',path:'/transactions'});

export default async function TransactionsPage(){
 const settings=await getSiteSettings();
 const access=await sectionAccess('transactions',settings);
 if(!access)notFound();
 const guides=await getPublishedGuides(serverDb()).catch(()=>null);
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
  <header className={styles.hero}>
   <div className={styles.head}>
   <span className={styles.kicker}><Link href="/explore">الأدلة</Link> / دليل المعاملات</span>
   <h1>دليل المعاملات</h1>
   <p>ماذا تحمل معك، وأين تذهب، وكم تدفع، وما الخطوات بالترتيب. لكل معاملة إجراءاتها في صنعاء وعدن، وتاريخ آخر تحقق منها.</p>
   </div>
   <div className={styles.heroArt} aria-hidden="true">{['documents','counter','payment','receive'].map(kind=><StepArt key={kind} kind={kind}/>)}</div>
  </header>
  {!guides?<p className={styles.notice} role="alert">تعذر تحميل الأدلة الآن. أعد المحاولة بعد قليل.</p>
   :guides.length?<GuideIndex guides={guides.map(guide=>({slug:guide.slug,title:guide.title,summary:guide.summary,category:guide.category,verifiedAt:guide.verifiedAt,featured:guide.featured,keywords:(guide.faqs||[]).map(item=>item.q).join(' '),...guideStats(guide)}))}/>
   :<p className={styles.empty}>تُضاف الأدلة قريبًا.</p>}
 </div>;
}
