import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import {countOf} from '@/lib/arabicCount';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import {notFound} from 'next/navigation';
import Link from '@/components/SiteLink';
import {ArrowUpLeft,BookOpenText,CalendarDays,Clock3,ExternalLink,MapPinned,ScrollText} from 'lucide-react';
import {getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionIsVisible,sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {shareCardPath} from '@/lib/shareCard';
import {relatedProjections} from '@/lib/relatedContent';
import {historyCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {historyKinds,historyEras,historyEntryPath,historyYear} from '@/lib/yemenHistory';
import {pageMetadata} from '@/lib/seo';
import {breadcrumbSchema,JsonLd} from '@/lib/seo-schema';
import CorrectionLink from '@/components/CorrectionLink';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import HistoryEditAction from '@/components/history/HistoryEditAction';
import HistoryMedia from '@/components/history/HistoryMedia';
import ContextBackLink from '@/components/ContextBackLink';
import JumpNav from '@/components/knowledge/JumpNav';
import styles from '../HistoryPage.module.css';

export const dynamic='force-dynamic';
export async function generateMetadata({params}){
 const {slug}=await params;
 const settings=await getSiteSettings();
 if(!sectionIsVisible('history',settings.pageVisibility))return {};
 const catalog=await readPublicHistoryCatalog(serverDb());
 const entry=catalog.entries.find(e=>e.slug===slug&&e.isPublished!==false);
 return entry?pageMetadata({title:entry.title+' | تاريخ اليمن',description:entry.summary,path:historyEntryPath(entry.slug),image:shareCardPath('history',entry.slug,entry.title,entry.summary,entry.period,entry.year)}):{};
}
export default async function YemenHistoryDetail({params}){
 const {slug}=await params;
 const settings=await getSiteSettings();
 if(!sectionGate('history',settings))notFound();
 const catalog=await readPublicHistoryCatalog(serverDb());
 const item=catalog.entries.find(e=>e.slug===slug&&e.isPublished!==false);
 if(!item)notFound();
 const visible=catalog.entries.filter(e=>e.isPublished!==false);
 const era=historyEras.find(x=>x.id===item.era);
 const related=(item.related||[]).map(slug=>visible.find(x=>x.slug===slug)).filter(Boolean).slice(0,6);
 // The editorial figureQuery is a search hint; link directly only on a unique published match.
 const figures=item.figureQuery&&sectionIsVisible('figures',settings.pageVisibility)
  ?await getYemeniFigures(relatedProjections.figures).catch(()=>[]):[];
 const crossLinks=historyCrossLinks(item,{visibility:settings.pageVisibility,figures});
 const wordCount=(item.paragraphs||[]).join(' ').trim().split(/\s+/).filter(Boolean).length;
 const readingMinutes=Math.max(1,Math.ceil(wordCount/180));
 return <KnowledgeTheme area="history"><div className={styles.articlePage}>
  <JsonLd data={breadcrumbSchema([{name:'تاريخ اليمن',path:'/yemen-history'},{name:item.title,path:historyEntryPath(item.slug)}])}/>
  <header className={styles.articleHero}><div className="container">
   <ContextBackLink className={styles.back} fallback="/yemen-history" label="العودة إلى تاريخ اليمن" leading={<ArrowUpLeft size={16}/>}/>
   <span className="eyebrow">{era?.title||'تاريخ اليمن'} / {historyKinds[item.kind]}</span>
   <h1>{item.title}</h1><p>{item.summary}</p>
   <div className={styles.articleMeta}><span><CalendarDays size={17}/>{item.period}</span>{item.location&&<span><MapPinned size={17}/>{item.location}</span>}<span><BookOpenText size={17}/>{countOf((item.sources||[]).length,'source')}</span><span><Clock3 size={17}/>{readingMinutes} دقائق قراءة تقريبًا</span></div>
  </div></header>
    <JumpNav items={[
      {href: '#history-reading', title: 'القصة التاريخية', icon: 'history'},
      {href: '#references-heading', title: 'المصادر والمراجع', icon: 'sources'},
      {href: '#history-facts', title: 'الملف التاريخي', icon: 'card'},
      related.length > 0 && {href: '#history-related', title: 'مواد مرتبطة', icon: 'contents'},
    ]}/>
    <KnowledgeNavigation/>
  <div className={'container '+styles.articleGrid}>
   <article className={styles.articleBody}>
    <ContentReadingAction kind="history" href={historyEntryPath(item.slug)} title={item.title}/>
    <HistoryEditAction slug={item.slug}/>
    {item.certainty&&<p className={styles.warning}><ScrollText size={17}/> درجة التوثيق: {item.certainty}. يُرجى مراجعة المصادر قبل نقل التواريخ أو الاستنتاجات.</p>}
    <h2 className={styles.storyHeading} id="history-reading">القصة التاريخية</h2>
    {item.paragraphs.slice(0,1).map((p,i)=><p key={i}>{p}</p>)}
    <HistoryMedia entry={item}/>
    {item.paragraphs.slice(1).map((p,i)=><p key={i}>{p}</p>)}
    <CrossSectionPaths items={crossLinks} id="history-cross-paths" title="من التاريخ إلى الخريطة والتعلّم"/>
    <section className={styles.references} aria-labelledby="references-heading"><h2 id="references-heading">المصادر والمراجع</h2><p>المراجع تساعد على التحقق والاستزادة؛ وقد تتناول فترة تاريخية أوسع من هذا المدخل. التفاصيل المختلف عليها تحتاج إلى مصادر متخصصة.</p><ol>{item.sources.map((source,i)=><li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={15}/></a></li>)}</ol></section>
    <CorrectionLink title={item.title} path={historyEntryPath(item.slug)} id={item.slug}/>
   </article>
   <aside className={styles.articleAside} id="history-facts"><div className={styles.facts}><h2>الملف التاريخي</h2><dl><dt>التصنيف</dt><dd>{historyKinds[item.kind]}</dd><dt>العصر</dt><dd>{era?.title||'غير محدد'}</dd><dt>مرجع زمني</dt><dd>{historyYear(item.year)}</dd><dt>الفترة</dt><dd>{item.period}</dd><dt>الموقع</dt><dd>{item.location||'مناطق متعددة'}</dd></dl></div><p>تنبيه: الممالك القديمة والدول المتعاقبة قد تزامنت في أجزاء مختلفة من اليمن. لا ينبغي فهم الخط الزمني على أنه قائمة حكام لدولة واحدة.</p></aside>
  </div>
  {related.length>0&&<section id="history-related" className={'container '+styles.related}><h2>مواد مرتبطة</h2><div>{related.map(x=><Link key={x.slug} href={historyEntryPath(x.slug)}><small>{historyKinds[x.kind]} · {historyYear(x.year)}</small><strong>{x.title}</strong><ArrowUpLeft size={18}/></Link>)}</div></section>}
 </div></KnowledgeTheme>;
}
