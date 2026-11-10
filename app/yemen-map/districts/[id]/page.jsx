import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import JumpNav from '@/components/knowledge/JumpNav';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import ContextBackLink from '@/components/ContextBackLink';
import CorrectionLink from '@/components/CorrectionLink';
import Link from '@/components/SiteLink';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {getMedicalCenters,getSiteSettings,getYemeniFigures} from '@/lib/data';
import {sectionGate,sectionIsVisible} from '@/lib/pageVisibility';
import {publicDb} from '@/lib/supabase';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {relatedProjections} from '@/lib/relatedContent';
import {governorateCrossLinks} from '@/lib/knowledgeConnections';
import {getMapBoundaries,readPublicMapProfiles} from '@/lib/mapProfileRepository';
import {getDistrictIndexes} from '@/lib/districtPagesServer';
import {DISTRICT_ID_PATTERN,displayPlaceName,districtOutline,districtPath,districtSummary,facilitiesInDistrict,historyForDistrict,nearbyDistricts} from '@/lib/districtPages';
import {yemenGovernorates} from '@/lib/yemeniFigures';
import {canOptimizeImage,safeExternalUrl,safeImageUrl} from '@/lib/media';
import {detailPath,pageMetadata} from '@/lib/seo';
import {shareCardPath} from '@/lib/shareCard';
import {formatNumber} from '@/lib/format';
import base from '../../governorates/[id]/GovernorateProfile.module.css';
import styles from './DistrictProfile.module.css';

export const dynamic='force-dynamic';

const sections=[
 {key:'description',title:'نبذة عن المديرية'},
 {key:'history',title:'نبذة تاريخية'},
 {key:'geography',title:'الطبيعة والتضاريس'},
 {key:'economy',title:'الاقتصاد وسبل العيش'},
 {key:'landmarks',title:'المعالم والأنشطة'},
];
const governorateName=region=>yemenGovernorates.find(item=>item.id===region.governorateId)?.name||region.governorateNameAr;
const districtName=(region,profile)=>displayPlaceName(region.nameAr,[profile?.description,profile?.history,profile?.capital]);
const paragraphs=text=>String(text||'').split(/\n\s*\n/).map(item=>item.trim()).filter(Boolean);

async function loadDistrict(id){
 if(!DISTRICT_ID_PATTERN.test(id))return null;
 const settings=await getSiteSettings();
 if(!sectionGate('atlas',settings))return null;
 const boundaries=await getMapBoundaries();
 const region=boundaries.districts.find(item=>item.id===id);
 if(!region)return null;
 const profiles=await readPublicMapProfiles(publicDb());
 const profile=profiles[id];
 if(!profile)return null;
 return {settings,boundaries,region,profile,profiles,names:{name:districtName(region,profile),governorateName:governorateName(region)}};
}

export async function generateMetadata({params}){
 const {id}=await params;
 const data=await loadDistrict(id).catch(()=>null);
 if(!data)return {};
 const {profile,names}=data;
 return pageMetadata({
  title:'مديرية '+names.name+' — محافظة '+names.governorateName+' | خريطة اليمن',
  description:districtSummary(profile,names),
  path:districtPath(id),
  image:shareCardPath('district',id,names.name,profile.description,profile.population,profile.area_km2),
 });
}

export default async function DistrictProfilePage({params}){
 const {id}=await params;
 const data=await loadDistrict(id);
 if(!data)notFound();
 const {settings,boundaries,region,profile,profiles,names}=data;
 const {name,governorateName:govName}=names;
 const visibility=settings.pageVisibility;
 const governorate=boundaries.governorates.find(item=>item.id===region.governorateId);
 const [indexes,historical,people,centers]=await Promise.all([
  getDistrictIndexes(),
  sectionIsVisible('history',visibility)?readPublicHistoryCatalog(serverDb()).then(result=>result.entries).catch(()=>[]):Promise.resolve([]),
  sectionIsVisible('figures',visibility)?getYemeniFigures(relatedProjections.figures).catch(()=>[]):Promise.resolve([]),
  getMedicalCenters().catch(()=>[]),
 ]);
 const neighbours=nearbyDistricts(region,boundaries.districts,indexes.neighbours.get(id)||[]);
 const siblings=boundaries.districts.filter(item=>item.governorateId===region.governorateId&&item.id!==id);
 const facilities=facilitiesInDistrict(region,centers,indexes.matcher);
 const events=historyForDistrict(region,historical);
 const crossLinks=governorateCrossLinks(region.governorateId,{visibility,historyEntries:historical,figures:people}).filter(link=>!events.some(event=>link.href.endsWith('/'+event.slug)));
 const outline=districtOutline(region,governorate);
 const area=Number(profile.area_km2)||Number(region.areaKm2)||null;
 const population=profile.population!==null&&profile.population!==undefined?Number(profile.population):null;
 const density=population&&area?Math.round(population/area):null;
 const image=safeImageUrl(profile.image_url)&&profile.image_credit&&safeExternalUrl(profile.image_source_url)?safeImageUrl(profile.image_url):null;
 // The first description paragraph is the page intro, so «نبذة» is a section (and a jump link) only with more.
 const shown=sections.filter(item=>paragraphs(profile[item.key]).length>(item.key==='description'?1:0));
 const pending=sections.filter(item=>!paragraphs(profile[item.key]).length);
 const sources=(Array.isArray(profile.sources)?profile.sources:[]).filter(item=>safeExternalUrl(item?.url));
 const governorateHref='/yemen-map/governorates/'+encodeURIComponent(region.governorateId);
 const mapHref='/yemen-map?region='+encodeURIComponent(region.governorateId)+'&district='+encodeURIComponent(id)+'#map';
 const nameOf=item=>districtName(item,profiles[item.id]);

 return <KnowledgeTheme area="atlas"><div className={base.page}>
  <header className={base.hero}>
   <div className={'container '+styles.heroGrid}>
    <div>
     <ContextBackLink className={base.back} fallback={governorateHref} label={'العودة إلى محافظة '+govName}/>
     <span className={base.kicker}>خريطة اليمن / <Link href={governorateHref}>محافظة {govName}</Link> / المديريات</span>
     <h1>مديرية {name}</h1>
     <p>{paragraphs(profile.description)[0]||districtSummary(profile,names)}</p>
     <div className={base.facts}>
      <div><span>المركز الإداري</span><strong>{profile.capital||'غير موثق في الدليل'}</strong></div>
      <div><span>المساحة</span><strong>{area?formatNumber(area)+' كم²':'غير متوفرة'}</strong></div>
      <div><span>السكان</span><strong>{population!==null?formatNumber(population)+(profile.population_year?' · '+profile.population_year:''):'لا يوجد تقدير موثق'}</strong></div>
      <div><span>الكثافة التقريبية</span><strong>{density!==null?formatNumber(density)+' نسمة/كم²':'غير متوفرة'}</strong></div>
     </div>
    </div>
    {outline&&<figure className={styles.outline}>
     <svg viewBox={'0 0 '+outline.width+' '+outline.height} role="img" aria-label={'موقع مديرية '+name+' داخل محافظة '+govName}>
      <path d={outline.governorate} className={styles.governorateShape}/>
      <path d={outline.district} className={styles.districtShape}/>
      {outline.marker&&<circle cx={outline.marker.x} cy={outline.marker.y} r={outline.marker.r} className={styles.marker}/>}
     </svg>
     <figcaption>موقع المديرية داخل محافظة {govName}. <Link href={mapHref}>افتحها على الخريطة التفاعلية</Link></figcaption>
    </figure>}
   </div>
  </header>
  <JumpNav label="انتقل داخل ملف المديرية" items={[
   ...shown.map(item=>({href:'#'+item.key,title:item.title,icon:'places'})),
   ...(facilities.length?[{href:'#facilities',title:'المرافق الصحية',icon:'contents'}]:[]),
   {href:'#nearby',title:'مديريات مجاورة',icon:'contents'},
   {href:'#district-sources',title:'المصادر',icon:'sources'},
  ]}/>
  <KnowledgeNavigation/>
  <div className={'container '+base.layout}>
   <article className={base.article}>
    {image&&<figure className={styles.photo}>
     <Image src={image} alt={'منظر من مديرية '+name} width={960} height={540} sizes="(max-width: 950px) 100vw, 760px" unoptimized={!canOptimizeImage(image)}/>
     <figcaption>{profile.image_credit} — <a href={safeExternalUrl(profile.image_source_url)} target="_blank" rel="noopener noreferrer">مصدر الصورة</a></figcaption>
    </figure>}
    {shown.map(item=>{const list=item.key==='description'?paragraphs(profile.description).slice(1):paragraphs(profile[item.key]);return list.length?<section id={item.key} key={item.key} className={base.section}>
     <h2>{item.title}</h2>
     {list.map((text,index)=><p key={index}>{text}</p>)}
    </section>:null;})}
    {pending.length>0&&<p className={styles.pending}>قيد التوثيق: {pending.map(item=>item.title).join('، ')}.</p>}
    {facilities.length>0&&<section id="facilities" className={base.section}>
     <h2>المرافق الصحية في المديرية</h2>
     <p>{formatNumber(facilities.length)} {facilities.length===1?'مرفق مسجل':'مرافق مسجلة'} في دليل المراكز الطبية. تحقق من ساعات العمل والخدمات قبل الزيارة.</p>
     <ul className={styles.facilityList}>{facilities.slice(0,12).map(item=><li key={item.id}><Link href={detailPath('medical-centers',item.id)}><strong>{item.name}</strong><span>{[item.typeLabel,item.city].filter(Boolean).join(' · ')}</span></Link></li>)}</ul>
     {facilities.length>12&&<Link className="text-link" href={'/medical-centers?q='+encodeURIComponent(name)}>عرض كل المرافق ({formatNumber(facilities.length)})</Link>}
    </section>}
    {events.length>0&&<CrossSectionPaths id="district-history" title={'من تاريخ '+name} items={events.map(event=>({href:detailPath('yemen-history',event.slug),kind:'تاريخ اليمن',title:event.title,description:event.location}))}/>}
    {crossLinks.length>0&&<CrossSectionPaths items={crossLinks} id="district-cross-paths" title={'من محافظة '+govName+' إلى تاريخها وشخصياتها'}/>}
    <section className={base.sources} id="district-sources" aria-label="مراجع وتحذيرات التوثيق">
     <h2>المصادر وحدود المعلومات</h2>
     <p>نصوص الملف من أطلس 967، وهي مادة معرفية عامة وليست بياناً رسمياً عن الخدمات أو الأمن أو أحوال الطرق. الحدود الإدارية والمساحة من فهرس الخريطة المعتمد، ولا نعرض تقدير سكان دون سنة ومصدر.</p>
     {sources.length>0&&<ul>{sources.map((item,index)=><li key={index}><a href={safeExternalUrl(item.url)} target="_blank" rel="noopener noreferrer">{item.title}</a></li>)}</ul>}
     <CorrectionLink title={'مديرية '+name} path={districtPath(id)} id={id}/>
    </section>
   </article>
   <aside className={base.sidebar}>
    <section className={base.districts} id="nearby">
     <h2>مديريات مجاورة وقريبة</h2>
     {neighbours.length?<ul className={styles.chips}>{neighbours.map(item=><li key={item.id}><Link href={districtPath(item.id)}>{nameOf(item)}{item.governorateId!==region.governorateId&&<small>{governorateName(item)}</small>}</Link></li>)}</ul>:<p>لا توجد مديريات ملاصقة في فهرس الخريطة.</p>}
    </section>
    <section className={base.districts}>
     <h2>مديريات محافظة {govName}</h2>
     <details className={base.districtDisclosure}><summary>عرض {formatNumber(siblings.length)} مديرية أخرى</summary><ul>{siblings.map(item=><li key={item.id}><Link href={districtPath(item.id)}>{nameOf(item)}</Link></li>)}</ul></details>
    </section>
    <Link className={base.figureLink} href={governorateHref}>الملف الكامل لمحافظة {govName}</Link>
    <Link className={base.figureLink} href={'/yemen-map/compare?a='+encodeURIComponent(id)}>قارن مديرية {name} بمكان آخر</Link>
   </aside>
  </div>
 </div></KnowledgeTheme>;
}
