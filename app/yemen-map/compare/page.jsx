import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import ContextBackLink from '@/components/ContextBackLink';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {getMedicalCenters,getSiteSettings,getUniversities,getYemeniFigures} from '@/lib/data';
import {sectionGate,sectionIsVisible} from '@/lib/pageVisibility';
import {publicDb} from '@/lib/supabase';
import {serverDb} from '@/lib/supabase-server';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {relatedProjections} from '@/lib/relatedContent';
import {getMapBoundaries,readPublicMapProfiles} from '@/lib/mapProfileRepository';
import {displayPlaceName} from '@/lib/districtPages';
import {PLACE_ID_PATTERN,comparePath,comparisonHeadline,comparisonRows,placeFacts} from '@/lib/placeCompare';
import {yemenGovernorates} from '@/lib/yemeniFigures';
import {pageMetadata} from '@/lib/seo';
import {formatNumber} from '@/lib/format';
import {safeExternalUrl} from '@/lib/media';
import styles from './compare.module.css';

export const dynamic='force-dynamic';

const governorateNames=Object.fromEntries(yemenGovernorates.map(item=>[item.id,item.name]));
const pick=value=>typeof value==='string'&&PLACE_ID_PATTERN.test(value)?value:null;
const suggestions=[['YE24','YE13'],['YE19','YE28'],['YE15','YE11'],['YE1301','YE2407']];

export async function generateMetadata({searchParams}){
 const query=await searchParams,a=pick(query?.a),b=pick(query?.b);
 const base={title:'قارن المحافظات والمديريات | خريطة اليمن',description:'قارن بين محافظتين أو مديريتين يمنيتين: السكان مع السنة والمصدر، والمساحة والكثافة، والمرافق الصحية والجامعات والمواد التاريخية.',path:'/yemen-map/compare'};
 if(!a||!b)return pageMetadata(base);
 const boundaries=await getMapBoundaries().catch(()=>null);
 const name=id=>{const district=boundaries?.districts.find(item=>item.id===id);return district?'مديرية '+district.nameAr:'محافظة '+(governorateNames[id]||id);};
 return pageMetadata({...base,title:name(a)+' مقابل '+name(b)+' | قارن',path:comparePath(a,b),noindex:true});
}

const show=(value,unit)=>value===null||value===undefined||value===''?'—':typeof value==='number'?formatNumber(value)+(unit?' '+unit:''):value;

function PlacePicker({name,label,value,boundaries,profiles}){
 return <label className={styles.picker}><span>{label}</span>
  <select name={name} defaultValue={value||''} required>
   <option value="" disabled>اختر محافظة أو مديرية</option>
   {boundaries.governorates.slice().sort((x,y)=>(governorateNames[x.id]||x.nameAr).localeCompare(governorateNames[y.id]||y.nameAr,'ar')).map(governorate=><optgroup key={governorate.id} label={'محافظة '+(governorateNames[governorate.id]||governorate.nameAr)}>
    <option value={governorate.id}>محافظة {governorateNames[governorate.id]||governorate.nameAr}</option>
    {boundaries.districts.filter(item=>item.governorateId===governorate.id).map(item=><option key={item.id} value={item.id}>مديرية {displayPlaceName(item.nameAr,[profiles[item.id]?.description])}</option>)}
   </optgroup>)}
  </select>
 </label>;
}

export default async function ComparePlacesPage({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('atlas',settings))notFound();
 const query=await searchParams,a=pick(query?.a),b=pick(query?.b);
 const [boundaries,profiles]=await Promise.all([getMapBoundaries(),readPublicMapProfiles(publicDb())]);
 const visibility=settings.pageVisibility;
 let left=null,right=null;
 if(a&&b){
  const [medicalCenters,universities,figures,history]=await Promise.all([
   getMedicalCenters().catch(()=>[]),getUniversities().catch(()=>[]),
   sectionIsVisible('figures',visibility)?getYemeniFigures(relatedProjections.figures).catch(()=>[]):Promise.resolve([]),
   sectionIsVisible('history',visibility)?readPublicHistoryCatalog(serverDb()).then(result=>result.entries).catch(()=>[]):Promise.resolve([]),
  ]);
  const context={boundaries,profiles,governorateNames,medicalCenters,universities,figures,history};
  left=placeFacts(a,context);right=placeFacts(b,context);
 }
 const rows=left&&right?comparisonRows(left,right):[];
 const headline=left&&right?comparisonHeadline(left,right):'';
 const nameOf=id=>{const district=boundaries.districts.find(item=>item.id===id);return district?'مديرية '+displayPlaceName(district.nameAr,[profiles[id]?.description]):'محافظة '+(governorateNames[id]||id);};

 return <KnowledgeTheme area="atlas"><div className={styles.page}>
  <header className={styles.hero}><div className="container">
   <ContextBackLink className={styles.back} fallback="/yemen-map" label="العودة إلى خريطة اليمن"/>
   <span className={styles.kicker}>خريطة اليمن / قارن</span>
   <h1>{left&&right?left.title+' مقابل '+right.title:'قارن بين مكانين'}</h1>
   <p>اختر محافظتين أو مديريتين (أو محافظة ومديرية) لترى السكان والمساحة والكثافة والمرافق والمواد المرتبطة بهما جنبًا إلى جنب. كل رقم معروض مع سنته ومصدره.</p>
   <form className={styles.form} action="/yemen-map/compare" method="get">
    <PlacePicker name="a" label="المكان الأول" value={a} boundaries={boundaries} profiles={profiles}/>
    <PlacePicker name="b" label="المكان الثاني" value={b} boundaries={boundaries} profiles={profiles}/>
    <button type="submit" className={styles.submit}>قارن</button>
   </form>
   {a&&b&&<Link className={styles.swap} href={comparePath(b,a)}>بدّل الترتيب</Link>}
  </div></header>
  <KnowledgeNavigation/>
  <div className={'container '+styles.body}>
   {(a||b)&&!(left&&right)&&<p className={styles.notice} role="status">{a&&b?'تعذر العثور على أحد المكانين في فهرس الخريطة. اختر من القائمة.':'اختر المكان الثاني لبدء المقارنة.'}</p>}
   {left&&right&&<>
    {headline&&<p className={styles.headline}>{headline}</p>}
    <div className={styles.places}>
     {[left,right].map((place,index)=><article key={index} className={styles.place} data-side={index?'b':'a'}>
      <span>{place.kind==='district'?'مديرية في محافظة '+place.governorateName:'محافظة'}</span>
      <h2><Link href={place.href}>{place.title}</Link></h2>
      {place.summary&&<p>{place.summary}</p>}
     </article>)}
    </div>
    <table className={styles.table}>
     <caption className={styles.srOnly}>مقارنة بين {left.title} و{right.title}</caption>
     <thead><tr><th scope="col">المؤشر</th><th scope="col">{left.title}</th><th scope="col">{right.title}</th></tr></thead>
     <tbody>{rows.map(row=>{const max=Math.max(Number(row.a)||0,Number(row.b)||0);return <tr key={row.key}>
      <th scope="row">{row.label}{row.note&&<small>{row.note}</small>}</th>
      {[['a',left],['b',right]].map(([side,place])=>{const value=row[side];return <td key={side} data-higher={row.higher===side?'true':undefined} data-side={side}>
       <strong>{show(value,row.unit)}</strong>
       {row.key==='population'&&value!==null&&<small>{place.populationYear?'سنة '+place.populationYear:'السنة غير متوفرة'}{place.populationSource&&safeExternalUrl(place.populationSource.url)?<> · <a href={safeExternalUrl(place.populationSource.url)} target="_blank" rel="noopener noreferrer">{place.populationSource.title}</a></>:null}</small>}
       {row.key==='area'&&value!==null&&<small>فهرس الحدود الإدارية (OCHA)</small>}
       {typeof value==='number'&&max>0&&<span className={styles.bar} aria-hidden="true"><i style={{inlineSize:Math.max(2,Math.round(value/max*100))+'%'}}/></span>}
      </td>;})}
     </tr>;})}</tbody>
    </table>
    <p className={styles.footnote}>الأعداد المرتبطة بالأدلة (المرافق والجامعات والشخصيات والمواد التاريخية) هي ما سُجّل في 967 حتى الآن، وليست إحصاءً رسميًا. السكان من تقديرات الجهاز المركزي للإحصاء كما نشرتها OCHA، والمساحة من فهرس الحدود الإدارية.</p>
   </>}
   <section className={styles.suggest} aria-labelledby="compare-ideas">
    <h2 id="compare-ideas">مقارنات مقترحة</h2>
    <ul>{suggestions.map(([x,y])=><li key={x+y}><Link href={comparePath(x,y)}>{nameOf(x)} <span>مقابل</span> {nameOf(y)}</Link></li>)}</ul>
   </section>
  </div>
 </div></KnowledgeTheme>;
}
