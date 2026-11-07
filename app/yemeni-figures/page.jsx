import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import {notFound} from 'next/navigation';
import {getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {toFigureDirectoryCard,yemenGovernorates} from '@/lib/yemeniFigures';
import {pageMetadata} from '@/lib/seo';
import YemeniFiguresExplorer from '@/components/yemen-map/YemeniFiguresExplorer';
import {KnowledgeReadingGuide} from '@/components/knowledge/KnowledgeGuides';
import KnowledgePageIntro from '@/components/knowledge/KnowledgePageIntro';
import Link from '@/components/SiteLink';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({
 title:'شخصيات يمنية',
 description:'اكتشف سير شخصيات اليمن التاريخية والمعاصرة، وابحث بحسب الاسم والمجال والفترة والمحافظة.',
 path:'/yemeni-figures',
});

export default async function YemeniFiguresPage({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('figures',settings))notFound();
 const params=await searchParams;
 const region=yemenGovernorates.some(item=>item.id===params?.region)?params.region:null;
 const figures=(await getYemeniFigures()).map(toFigureDirectoryCard);
 return <KnowledgeTheme area="figures"><div className="yemeni-figures-page">
  <KnowledgePageIntro
   area="figures"
   title="شخصيات يمنية"
   category="دليل الشخصيات اليمنية"
   description="سير وتجارب وشخصيات تركت أثرها في اليمن. تصفح الشخصيات أو ابحث بالاسم والمجال والمحافظة والفترة.">
   <div className="directory-summary">
    <a href="#yemeni-figures">تصفح دليل الشخصيات</a>
    <Link href="/yemen-history">استكشف تاريخ اليمن</Link>
   </div>
  </KnowledgePageIntro>
  <KnowledgeNavigation/>
  <YemeniFiguresExplorer figures={figures} initialGovernorateId={region}/>
  <KnowledgeReadingGuide kind="figures"/>
 </div></KnowledgeTheme>;
}
