import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import Link from '@/components/SiteLink';
import {pageMetadata} from '@/lib/seo';
import {getRankingCatalog,getRankingDataset} from '@/lib/rankingData';
import {getDefaultRankingYear,getRankingYears} from '@/lib/rankings';
import YemenRankingExplorer from '@/components/YemenRankingExplorer';
import {KnowledgeReadingGuide} from '@/components/knowledge/KnowledgeGuides';
import PageIntro from '@/components/PageIntro';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'ترتيب اليمن',description:'اكتشف ترتيب اليمن بين دول العالم في الاقتصاد والصحة والتعليم والتقنية والخدمات والعمل، مع مقارنة الدول والسنوات ومصادر البيانات.',path:'/yemen-ranking'});

export default async function YemenRankingPage({searchParams}) {
  const query=await searchParams;
  let indicators=[],initialDataset=null,initialIndicator=null,error=false;
  try {
    ({indicators}=await getRankingCatalog());
    initialIndicator=indicators.find(item=>item.slug===query.indicator)||indicators[0]||null;
    if(initialIndicator)initialDataset=await getRankingDataset(initialIndicator);
  }catch{error=true;}
  const requestedYear=Number(query.year);
  const initialYear=initialDataset ? (getRankingYears(initialDataset).includes(requestedYear)?requestedYear:getDefaultRankingYear(initialDataset)) : null;
  return <KnowledgeTheme area="ranking">
    <PageIntro tone="blue" title="ترتيب اليمن" category="اليمن بين دول العالم" description="غيّر المعيار، واختر السنة، واكتشف موقع اليمن والدول الأقرب إليه. لكل رقم مصدر وسنة، ولكل ترتيب سياقه."><div className="directory-summary"><Link href="/yemen-in-numbers">استكشف مرصد اليمن بالأرقام</Link></div></PageIntro>
    <KnowledgeNavigation/>
    <section className="section"><div className="container">{error?<div role="alert"><h2>تعذر تحميل بيانات الترتيب</h2><p>يرجى إعادة المحاولة لاحقاً.</p></div>:<YemenRankingExplorer indicators={indicators.map(({description,...item})=>item)} initialIndicator={initialIndicator} initialDataset={initialDataset} initialYear={initialYear} initialScope={query.scope==='arab'?'arab':'world'} initialCompare={typeof query.compare==='string'?query.compare:''}/>}</div></section>
    <KnowledgeReadingGuide kind="ranking"/>
  </KnowledgeTheme>;
}
