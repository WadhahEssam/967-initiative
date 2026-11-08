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
  return buildSitemap({...data,history,pageVisibility:settings.pageVisibility});
}
