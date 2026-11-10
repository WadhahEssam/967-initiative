import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import Link from '@/components/SiteLink';
import {pageMetadata} from '@/lib/seo';
import {ArrowRight} from 'lucide-react';
import TimelineExplorer from '@/components/TimelineExplorer';
import {getTimelineIndicators} from '@/lib/data';
import {timelineIndicator} from '@/lib/timeline';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({title:'اليمن عبر الزمن', description:'مقارنة السلاسل الزمنية الوطنية المنشورة عن اليمن منذ 1990.', path:'/yemen-in-numbers/timeline'});

export default async function TimelinePage() {
  const indicators = (await getTimelineIndicators()).filter(item => item.values?.length).map(timelineIndicator);
  return <KnowledgeTheme area="statistics">
    <section className="stat-page-head timeline-page-head"><div className="container"><Link className="back-link" href="/yemen-in-numbers"><ArrowRight size={17}/> العودة إلى اليمن بالأرقام</Link><span className="eyebrow">مقارنة وطنية / 1990 حتى أحدث سنة منشورة</span><h1>اليمن عبر الزمن.</h1><p>قارن السلاسل المتوافقة بوحداتها، وبدّل بين القيم الفعلية ونسبة التغير من سنة الأساس. السنوات الناقصة تبقى ظاهرة كفجوات.</p></div></section>
    <KnowledgeNavigation/>
    <section className="section timeline-page-body"><div className="container"><TimelineExplorer indicators={indicators}/></div></section>
  </KnowledgeTheme>;
}
