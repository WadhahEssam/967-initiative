import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import {notFound} from 'next/navigation';
import {BookOpenText,Clock3,Landmark} from 'lucide-react';
import Link from '@/components/SiteLink';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {yemenGovernorates} from '@/lib/yemeniFigures';
import {pageMetadata} from '@/lib/seo';
import HistoryExplorer from '@/components/history/HistoryExplorer';
import {historyDetailsMap,historyIndexEntry} from '@/lib/yemenHistory';
import {chronologicalHistory} from '@/lib/historyTimeline';
import {defaultHistoryPair} from '@/lib/historyComparisons';
import {pickDetails,versionedDetails} from '@/lib/deferredDetails';
import {KnowledgeReadingGuide} from '@/components/knowledge/KnowledgeGuides';
import KnowledgePageIntro from '@/components/knowledge/KnowledgePageIntro';
import styles from './HistoryPage.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({
 title:'تاريخ اليمن',
 description:'استكشف تاريخ اليمن عبر ست مراحل: الممالك القديمة، الدول الإسلامية، الوثائق، الآثار، المجتمع والأحداث المعاصرة، مع المصادر والخط الزمني.',
 path:'/yemen-history',
});
export default async function YemenHistoryPage({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('history',settings))notFound();
 const params=await searchParams;
 let catalog;
 try{catalog=await readPublicHistoryCatalog(serverDb());}
 catch{return <div className="container" style={{padding:'80px 0'}}><h1>تعذر تحميل تاريخ اليمن</h1><p role="alert">حاول تحديث الصفحة لاحقاً؛ لا نعرض نسخة قديمة إذا تعذر التحقق من آخر التعديلات.</p></div>;}
 const locations=[...new Map(catalog.entries.filter(x=>x.isPublished!==false&&x.governorate).map(x=>[x.governorate,x])).values()].map(x=>({...x,governorateName:yemenGovernorates.find(g=>g.id===x.governorate)?.name})).filter(x=>x.governorateName);
 const era=typeof params.era==='string'?params.era:'',type=typeof params.type==='string'?params.type:'';
 const published=catalog.entries.filter(x=>x.isPublished!==false);
 // The page carries full details only for what the first screen shows: the first stop of the
 // timeline and the two states being compared. /api/history/details brings the rest after load.
 const {details,version}=versionedDetails(catalog.entries,historyDetailsMap);
 const states=published.filter(x=>x.kind==='state'),stateSlugs=new Set(states.map(x=>x.slug));
 const firstStop=chronologicalHistory(published.filter(x=>(!era||x.era===era)&&(!type||x.kind===type)))[0]?.slug;
 const pair=[...defaultHistoryPair(states),...['compareA','compareB'].map(key=>params[key]).filter(slug=>stateSlugs.has(slug))];
 return <KnowledgeTheme area="history"><div>
  <KnowledgePageIntro
   area="history"
   title="تاريخ اليمن"
   category="موسوعة 967 التاريخية"
   description="من بدايات الاستيطان إلى قيام الدول الحديثة: اكتشف الممالك والأحداث والناس والمواقع والوثائق في سياقها التاريخي.">
   <div className="directory-summary">
    <a href="#eras">استكشف العصور <Clock3 size={16}/></a>
    <a href="#history-compare-heading">قارن بين دولتين <Landmark size={16}/></a>
    <Link href="/yemeni-figures">شخصيات يمنية <BookOpenText size={16}/></Link>
   </div>
  </KnowledgePageIntro>
  <KnowledgeNavigation/>
  <div id="eras"><HistoryExplorer entries={published.map(historyIndexEntry)} details={pickDetails(details,[firstStop,...pair])} detailsUrl={'/api/history/details?v='+version} initialEra={era} initialType={type}/></div>
  <KnowledgeReadingGuide kind="history"/>
  <section className={styles.locations} aria-labelledby="history-location-title"><div className="container"><span className="eyebrow">الأماكن على الخريطة</span><h2 id="history-location-title">أين دارت هذه الحكايات؟</h2><p>استكشف المواقع المرتبطة بالمواد التاريخية على <strong>خريطة المحافظات المعاصرة</strong>. هذه الروابط لا تمثل حدود الممالك القديمة.</p><div className={styles.locationGrid}>{locations.map(x=><Link key={x.governorate} href={'/yemen-map?region='+x.governorate+'#map'}><strong>{x.governorateName}</strong><span>{x.title}</span></Link>)}</div></div></section>
 </div></KnowledgeTheme>;
}
