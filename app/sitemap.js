import {
  getIssues,
  getProfessionals,
  getUniversities,
  getMedicalCenters,
  getStatIndicators,
  getStatSections,
  getYemeniCompanies,
  getYemeniFigures,
  getWorks,
  getContentPages,
  getSiteSettings,
} from '@/lib/data';
import {buildSitemap, isIndexableDeployment} from '@/lib/seo';
import {getDebateCatalog} from '@/lib/debateServer';
import {collectPublicSources} from '@/lib/publicSourceCollection';
import {recordOperationalEvent} from '@/lib/operationalEvents';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {serverDb} from '@/lib/supabase-server';
import {getMapBoundaries} from '@/lib/mapProfileRepository';
import {publishedSchoolCatalog,publishedSchoolStageList} from '@/lib/schoolContentServer';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  if (!isIndexableDeployment()) return [];
  const {data}=await collectPublicSources({issues:getIssues,companies:getYemeniCompanies,professionals:getProfessionals,universities:getUniversities,medicalCenters:getMedicalCenters,figures:getYemeniFigures,statSections:getStatSections,statIndicators:getStatIndicators,works:getWorks,contentPages:getContentPages,debates:async()=>{
    const result=await getDebateCatalog();if(!result.available)throw new Error('Unavailable');return result.debates;
  }},{onUnavailable:source=>recordOperationalEvent('source_unavailable',{source,area:'sitemap'})});
  const settings=await getSiteSettings();
  // لا تُنشر خريطة موقع ناقصة حين تتعذر قراءة إعدادات الأقسام: الفشل المؤقت (5xx) يجعل محركات البحث تعود لاحقًا.
  if(settings.pageVisibilityUnavailable)throw new Error('Section settings unavailable; refusing to publish an incomplete sitemap.');
  let history=[];try{history=(await readPublicHistoryCatalog(serverDb())).entries;}catch{recordOperationalEvent('source_unavailable',{source:'pages',area:'sitemap'});}
  // Governorate and district pages come from the boundary file shipped with the site.
  let places=[];try{const boundaries=await getMapBoundaries();places=[...boundaries.governorates.map(item=>'/yemen-map/governorates/'+item.id),...boundaries.districts.map(item=>'/yemen-map/districts/'+item.id)];}catch{recordOperationalEvent('source_unavailable',{source:'places',area:'sitemap'});}
  // Published school courses with their lesson numbers.
  let school=[];
  try{const db=serverDb();const catalog=await publishedSchoolCatalog(db);school=await Promise.all(catalog.map(async course=>({slug:course.slug,lessons:(await publishedSchoolStageList(db,course.slug).catch(()=>[])).map(stage=>stage.index)})));}
  catch{recordOperationalEvent('source_unavailable',{source:'school',area:'sitemap'});}
  return buildSitemap({...data,history,places,school,pageVisibility:settings.pageVisibility});
}
