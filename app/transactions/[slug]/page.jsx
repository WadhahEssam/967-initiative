import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import SectionPreviewNote from '@/components/SectionPreviewNote';
import {serverDb} from '@/lib/supabase-server';
import {getPublishedGuide,getPublishedGuides} from '@/lib/transactionGuidesServer';
import {guideCategory,guideRegions} from '@/lib/transactionGuides';
import {pageMetadata,siteUrl} from '@/lib/seo';
import {JsonLd} from '@/lib/seo-schema';
import GuideView,{CategoryArt} from '@/components/transactions/GuideView';
import styles from '@/components/transactions/Transactions.module.css';

export const dynamic='force-dynamic';
const load=async slug=>/^[a-z0-9-]{1,60}$/.test(slug)?getPublishedGuide(serverDb(),slug).catch(()=>null):null;

export async function generateMetadata({params}){
 const {slug}=await params;
 const guide=await load(slug);
 if(!guide)return pageMetadata({title:'دليل المعاملات',path:'/transactions',noindex:true});
 return pageMetadata({title:guide.title+': الخطوات والأوراق المطلوبة',description:guide.summary||('خطوات '+guide.title+' في '+guideRegions(guide).map(region=>region.name).join(' و')+'.'),path:'/transactions/'+guide.slug});
}

export default async function TransactionGuidePage({params}){
 const settings=await getSiteSettings();
 const access=await sectionAccess('transactions',settings);
 if(!access)notFound();
 const {slug}=await params;
 const guide=await load(slug);
 if(!guide)notFound();
 const url=siteUrl('/transactions/'+guide.slug);
 // Related guides: the ones chosen by the editor, else others in the same category.
 const all=await getPublishedGuides(serverDb()).catch(()=>[]);
 const chosen=(guide.related||[]).map(slug=>all.find(item=>item.slug===slug)).filter(Boolean);
 const related=(chosen.length?chosen:all.filter(item=>item.category===guide.category&&item.slug!==guide.slug)).slice(0,4).map(({slug,title,category})=>({slug,title,category}));
 const first=guideRegions(guide)[0];
 const steps=first?guide.variants[first.id].steps:[];
 return <div className={'ed-wrap '+styles.page}>
  {access==='preview'&&<SectionPreviewNote/>}
  {steps.length>0&&<JsonLd data={{'@context':'https://schema.org','@type':'HowTo',name:guide.title,description:guide.summary||undefined,inLanguage:'ar',url,
   supply:(guide.variants[first.id].documents||[]).map(name=>({'@type':'HowToSupply',name})),
   step:steps.map((step,index)=>({'@type':'HowToStep',position:index+1,name:step.title,text:step.text||step.title}))}}/>}
  <header className={styles.head}>
   <span className={styles.kicker}><Link href="/transactions">دليل المعاملات</Link> / {guideCategory(guide.category).name}</span>
   <div className={styles.headRow}><CategoryArt category={guide.category}/><h1>{guide.title}</h1></div>
   {guide.summary&&<p>{guide.summary}</p>}
   {guide.audience&&<p className={styles.audience}><strong>لمن هذه المعاملة: </strong>{guide.audience}</p>}
  </header>
  {guide.faqs?.length>0&&<JsonLd data={{'@context':'https://schema.org','@type':'FAQPage',mainEntity:guide.faqs.map(item=>({'@type':'Question',name:item.q,acceptedAnswer:{'@type':'Answer',text:item.a}}))}}/>}
  <GuideView guide={guide} shareUrl={url} related={related}/>
 </div>;
}
