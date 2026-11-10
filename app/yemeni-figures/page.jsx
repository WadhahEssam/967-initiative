import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import {notFound} from 'next/navigation';
import {getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {figureDetailsMap,toFigureDirectoryCard,toFigureIndexEntry,yemenGovernorates} from '@/lib/yemeniFigures';
import {figureFilterDefaults,filterFigures,readFigureFilters} from '@/lib/figureFilters';
import {pickDetails,versionedDetails} from '@/lib/deferredDetails';
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
 const stored=await getYemeniFigures(),figures=stored.map(toFigureDirectoryCard);
 // Full card details only for the cards the first screen shows (default order, and the filters in
 // the address); /api/figures/details brings the rest after the page loads.
 const {details,version}=versionedDetails(stored,rows=>figureDetailsMap(rows.map(toFigureDirectoryCard)));
 const query=new URLSearchParams(Object.entries(params||{}).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).map(item=>[key,String(item)])));
 const fromAddress=readFigureFilters(query.toString());
 const firstCards=[
  ...filterFigures(figures,{...figureFilterDefaults,region}).slice(0,figureFilterDefaults.visible),
  ...filterFigures(figures,{...fromAddress,region}).slice(0,Math.min(fromAddress.visible,48)),
 ].map(figure=>figure.slug);
 return <KnowledgeTheme area="figures"><div className="yemeni-figures-page">
  <KnowledgePageIntro
   area="figures"
   title="شخصيات يمنية"
   category="معجم 967 للأعلام"
   description="سير وتجارب وشخصيات تركت أثرها في اليمن. تصفح الشخصيات أو ابحث بالاسم والمجال والمحافظة والفترة.">
   <div className="directory-summary">
    <a href="#yemeni-figures">تصفح دليل الشخصيات</a>
    <Link href="/yemen-history">استكشف تاريخ اليمن</Link>
   </div>
  </KnowledgePageIntro>
  <KnowledgeNavigation/>
  <YemeniFiguresExplorer figures={figures.map(toFigureIndexEntry)} details={pickDetails(details,firstCards)} detailsUrl={'/api/figures/details?v='+version} initialGovernorateId={region}/>
  <KnowledgeReadingGuide kind="figures"/>
 </div></KnowledgeTheme>;
}
