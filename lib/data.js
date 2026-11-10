import 'server-only';
import {cache} from 'react';
import {recordOperationalEvent} from './operationalEvents';
import {createMemo,createVersionedMemo,settingsRowsVersion} from './serverMemo.js';
import {fetchAllRows} from './pagination';
import {serverDb} from './supabase-server';
import {resolveSiteSettings} from './siteSettings';
import {CONTENT_PAGE_KEYS,resolveContentCatalog} from './contentPages';
import {PAGE_VISIBILITY_KEY,resolvePageVisibility,publicSections,sectionIsVisible} from './pageVisibility';
import {getDemoYemeniCompany, mapYemeniCompany, yemeniCompanies} from './yemeniProducts';
import {demoProfessionals, getDemoProfessional, mapProfessional} from './professionals';
import {directoryFallbackAllowed,mapUniversity,mapMedicalCenter} from './institutionDirectories';
import {fallbackUniversities,fallbackMedicalCenters} from './institutionFallbacks';
import {mapYemeniFigure} from './yemeniFigures';
import {yemeniFiguresCatalog} from './yemeniFiguresCatalog';
import {readPublicFigureProfile} from './figureProfileRepository';
import {createProjectionReader} from './projectionReader';
const readProjection=createProjectionReader();
import {getFallbackDomain, getFallbackSections, normalizeIndicator} from './yemenNumbers';
async function loadWorks(projection='*'){
 const db=serverDb(); if(!db)return [];
 try{return await fetchAllRows(()=>db.from('works').select(projection,{count:'exact'}).eq('is_published',true).order('published_at',{ascending:false}).order('id'));}
 catch(error){recordOperationalEvent('database_failure',{source:'works'});throw new Error('تعذر تحميل الأعمال. حاول مجدداً لاحقاً.');}
}
async function loadIssues(projection='*'){
 const db=serverDb(); if(!db)return [];
 try{return await fetchAllRows(()=>db.from('issues').select(projection,{count:'exact'}).eq('is_published',true).order('issue_date',{ascending:false}).order('number',{ascending:false}).order('id'));}
 catch(error){recordOperationalEvent('database_failure',{source:'issues'});throw new Error('تعذر تحميل أعداد المجلة. حاول مجدداً لاحقاً.');}
}
async function loadIssue(slug){
 if(slug==='demo') return (await import('./config')).demoIssue;
 const db=serverDb(); if(!db)return null;
 const {data,error}=await db.from('issues').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();
 if(error){recordOperationalEvent('database_failure',{source:'issues'});throw new Error('تعذر تحميل العدد');}return data;
}
// Two attempts before giving up: the first query after a cold start (e.g. right after a deploy)
// can be slow. If both fail, sections stay hidden and pageVisibilityUnavailable tells pages to
// answer with a temporary error instead of 404 (see sectionGate in lib/pageVisibility.js).
const SITE_SETTING_KEYS=[...CONTENT_PAGE_KEYS,PAGE_VISIBILITY_KEY];
async function readSiteSettingsRows(db,columns='key,value,updated_at'){
 let lastError;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const {data,error}=await db.from('site_settings').select(columns).in('key',SITE_SETTING_KEYS).abortSignal(AbortSignal.timeout(6000));
   if(error)throw error;
   return data||[];
  }catch(error){lastError=error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,400));}
 }
 throw lastError;
}
// Last settings read successfully by this server process. When a later read fails (slow database,
// CPU busy during a build on the same host), pages keep using it for up to 15 minutes instead of
// treating every section as unavailable. A fresh process has none, so the host's health check
// (/api/health) keeps visitors away until its first read succeeds.
const SETTINGS_STALE_LIMIT_MS=15*60*1000;
// Checked every 30 s, but only the rows' updated_at (a few hundred bytes); the full settings
// (about 20 KB) are read again only when a row changed, and at least every 15 minutes.
// Reading them in full every 30 s cost about 58 MB of Supabase egress a day.
const settingsMemo=createVersionedMemo({checkMs:30*1000,maxAgeMs:15*60*1000});
export function invalidateSiteSettings(){settingsMemo.clear();}
let lastGoodSettings=null;
export function settingsFallback(lastGood,now=Date.now()){
 if(lastGood&&now-lastGood.at<=SETTINGS_STALE_LIMIT_MS)return {...lastGood.value,settingsStale:true};
 return {...resolveSiteSettings(),contentPages:null,pageVisibility:Object.fromEntries(publicSections.map(item=>[item.id,false])),pageVisibilityUnavailable:true};
}
async function loadSiteSettings(){
 try{
  const db=serverDb();if(!db)return {...resolveSiteSettings(),contentPages:resolveContentCatalog(),pageVisibility:resolvePageVisibility()};
  const data=await settingsMemo({
   version:async()=>settingsRowsVersion(await readSiteSettingsRows(db,'key,updated_at')),
   load:async()=>{const rows=await readSiteSettingsRows(db);return {value:rows,version:settingsRowsVersion(rows)};},
  });
  const value={...resolveSiteSettings(data),contentPages:resolveContentCatalog(data),pageVisibility:resolvePageVisibility(data)};
  lastGoodSettings={value,at:Date.now()};
  return value;
 }catch(error){
  const fallback=settingsFallback(lastGoodSettings);
  recordOperationalEvent('database_failure',{source:'settings',stale:Boolean(fallback.settingsStale)});
  return fallback;
 }
}
export const getContentPages=cache(async()=>{const settings=await getSiteSettings();if(!Array.isArray(settings.contentPages))throw new Error('تعذر تحميل صفحات الموقع. حاول مجددًا لاحقًا.');return settings.contentPages.filter(page=>page.isPublished!==false);});
export const getContentPage=cache(async slug=>(await getContentPages()).find(page=>page.slug===slug)||null);
async function loadMarqueeItems(){return (await getSiteSettings()).aboutTags;}

async function loadYemeniCompanies(projection='*'){
 try{
  const db=serverDb(); if(!db)return yemeniCompanies.map(company=>({...company,isDemo:true,imageUrl:'/images/yemeni-products-hero.png'}));
  const data=await readProjection('yemeni_companies',projection,selected=>fetchAllRows(()=>db.from('yemeni_companies').select(selected,{count:'exact'}).eq('is_published',true).order('created_at',{ascending:false}).order('id')));
  return data.map(mapYemeniCompany);
 }catch(err){
  recordOperationalEvent('database_failure',{source:'companies'});
  throw new Error('تعذر تحميل دليل المنتجات. حاول مجدداً لاحقاً.');
 }
}

async function loadYemeniCompany(slug){
 try{
  const db=serverDb();
  if(db){
   const {data,error}=await db.from('yemeni_companies').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();
   if(!error&&data)return mapYemeniCompany(data);
   if(error)throw new Error(error.message);
   return null;
  }
 }catch(err){recordOperationalEvent('database_failure',{source:'companies'});throw new Error('تعذر تحميل الشركة');}
 const demo=getDemoYemeniCompany(slug);
 return demo?{...demo,isDemo:true,imageUrl:'/images/yemeni-products-hero.png'}:null;
}

async function loadProfessionals(projection='*'){
 try{
  const db=serverDb(); if(!db)return demoProfessionals;
  const data=await readProjection('professionals',projection,selected=>fetchAllRows(()=>db.from('professionals').select(selected,{count:'exact'}).eq('is_published',true).order('created_at',{ascending:false}).order('id')));
  return data.map(mapProfessional);
 }catch(err){recordOperationalEvent('database_failure',{source:'professionals'});throw new Error('تعذر تحميل دليل المهنيين');}
}

async function loadProfessional(slug){
 try{
  const db=serverDb();
  if(db){
   const {data,error}=await db.from('professionals').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();
   if(!error&&data)return mapProfessional(data);
   if(error)throw new Error(error.message);
   return null;
  }
 }catch(err){recordOperationalEvent('database_failure',{source:'professionals'});throw new Error('تعذر تحميل الملف المهني');}
 const demo=getDemoProfessional(slug);
 return demo||null;
}

const universityProjection='*,programs:university_programs(*),branches:university_branches(*),sources:university_sources(*)';
const medicalCenterProjection='*,specialties:medical_center_specialties(*),services:medical_center_services(*),hours:medical_center_hours(*),branches:medical_center_branches(*),sources:medical_center_sources(*)';
async function loadUniversities(projection=universityProjection){
 try{
  const db=serverDb();if(!db){if(directoryFallbackAllowed())return fallbackUniversities;throw Error('Directory database configuration unavailable');}
  const data=await fetchAllRows(()=>db.from('universities').select(projection,{count:'exact'}).eq('is_published',true).is('deleted_at',null).order('name_ar').order('id'));
  return data.map(mapUniversity);
 }catch(error){
  if(['42P01','PGRST205'].includes(error.code))return [];
  recordOperationalEvent('database_failure',{source:'universities'});throw new Error('تعذر تحميل دليل الجامعات والمعاهد.');
 }
}
async function loadUniversity(slug){
 try{
  const db=serverDb();if(!db){if(directoryFallbackAllowed())return fallbackUniversities.find(item=>item.id===slug)||null;throw Error('Directory database configuration unavailable');}
  const {data,error}=await db.from('universities').select(universityProjection).eq('slug',slug).eq('is_published',true).is('deleted_at',null).maybeSingle();
  if(error){if(['42P01','PGRST205'].includes(error.code))return null;throw error;}
  return data?mapUniversity(data):null;
 }catch(error){recordOperationalEvent('database_failure',{source:'universities'});throw new Error('تعذر تحميل المؤسسة التعليمية.');}
}
async function loadMedicalCenters(projection=medicalCenterProjection){
 try{
  const db=serverDb();if(!db){if(directoryFallbackAllowed())return fallbackMedicalCenters;throw Error('Directory database configuration unavailable');}
  const data=await fetchAllRows(()=>db.from('medical_centers').select(projection,{count:'exact'}).eq('is_published',true).is('deleted_at',null).order('name_ar').order('id'));
  return data.map(mapMedicalCenter);
 }catch(error){
  if(['42P01','PGRST205'].includes(error.code))return [];
  recordOperationalEvent('database_failure',{source:'medical_centers'});throw new Error('تعذر تحميل دليل المراكز الطبية.');
 }
}
async function loadMedicalCenter(slug){
 try{
  const db=serverDb();if(!db){if(directoryFallbackAllowed())return fallbackMedicalCenters.find(item=>item.id===slug)||null;throw Error('Directory database configuration unavailable');}
  const {data,error}=await db.from('medical_centers').select(medicalCenterProjection).eq('slug',slug).eq('is_published',true).is('deleted_at',null).maybeSingle();
  if(error){if(['42P01','PGRST205'].includes(error.code))return null;throw error;}
  return data?mapMedicalCenter(data):null;
 }catch(error){recordOperationalEvent('database_failure',{source:'medical_centers'});throw new Error('تعذر تحميل المركز الطبي.');}
}

async function loadYemeniFigures(projection='*'){
 try{
  const db=serverDb(); if(!db)return yemeniFiguresCatalog;
  const data=await readProjection('yemeni_figures',projection,selected=>fetchAllRows(()=>db.from('yemeni_figures').select(selected,{count:'exact'}).eq('is_published',true).order('display_order').order('full_name').order('id')));
  const stored=(data||[]).map(mapYemeniFigure);
  return stored;
 }catch(err){recordOperationalEvent('database_failure',{source:'figures'});throw new Error('تعذر تحميل دليل الشخصيات');}
}

async function loadYemeniFigure(slug){
 const db=serverDb();if(!db)return yemeniFiguresCatalog.find(item=>item.slug===slug)||null;
 const {data,error}=await db.from('yemeni_figures').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();
 if(error)throw new Error('تعذر تحميل الشخصية.');if(!data)return null;
 return {...mapYemeniFigure(data),profile:await readPublicFigureProfile(db,data)};
}

// Ids go into the request URL: 306 ids are ~11k characters, which local Supabase rejects (HTTP 414)
// and which would eventually exceed production limits too. Each batch holds whole indicators,
// so every indicator's values keep their year order.
const STAT_VALUE_ID_BATCH=100;
async function loadPublishedStatValues(db, indicatorIds) {
 if (!indicatorIds.length) return [];
 const data=[];
 for(let start=0;start<indicatorIds.length;start+=STAT_VALUE_ID_BATCH){
  const batch=indicatorIds.slice(start,start+STAT_VALUE_ID_BATCH);
  const rows=await fetchAllRows(()=>db.from('stat_values')
   .select('*,source:stat_sources(id,name,publisher,url,is_active)',{count:'exact'})
   .in('indicator_id',batch).eq('is_published',true).eq('national_scope',true)
   .order('year',{ascending:true}).order('id'));
  if(rows)data.push(...rows);
 }
 // Inactive sources are withdrawn editorial material, including their values.
 return (data||[]).filter(value=>value.source?.is_active);
}

function attachStatValues(indicators, values) {
 const grouped=new Map();
 for(const value of values){
  const list=grouped.get(value.indicator_id)||[];
  list.push(value);
  grouped.set(value.indicator_id,list);
 }
 return indicators.map(indicator=>normalizeIndicator(indicator,grouped.get(indicator.id)||[]));
}

async function loadStatSections(){
 try{
  const db=serverDb(); if(!db)return getFallbackSections();
  const [sectionResult,domainResult]=await Promise.all([
   db.from('stat_sections').select('*').eq('is_published',true).order('display_order'),
   db.from('stat_domains').select('*').eq('is_published',true).order('display_order'),
  ]);
  if(sectionResult.error||domainResult.error){
   recordOperationalEvent('database_failure',{source:'sections'});
   return getFallbackSections();
  }
  return (sectionResult.data||[]).map(section=>({
   ...section,
   domains:(domainResult.data||[]).filter(domain=>domain.section_id===section.id),
  }));
 }catch(err){recordOperationalEvent('database_failure',{source:'sections'});return getFallbackSections();}
}

async function loadStatIndicators(){
 try{
  const db=serverDb(); if(!db)return [];
  const data=await fetchAllRows(()=>db.from('stat_indicators')
   .select('*,domain:stat_domains(*,section:stat_sections(*)),adopted_source:stat_sources!stat_indicators_adopted_source_id_fkey(*)',{count:'exact'})
   .eq('is_published',true).order('updated_at',{ascending:false}).order('id'));
  const visible=(data||[]).filter(item=>(!item.hide_when_incomplete||item.data_status==='complete')&&item.domain?.is_published&&item.domain?.section?.is_published).map(item=>({...item,adopted_source:item.adopted_source?.is_active?item.adopted_source:null}));
  const values=await loadPublishedStatValues(db,visible.map(item=>item.id));
  return attachStatValues(visible,values);
 }catch(err){recordOperationalEvent('database_failure',{source:'indicators'});throw new Error('تعذر تحميل المؤشرات');}
}

async function loadStatDomain(slug){
 const fallback=getFallbackDomain(slug);
 try{
  const db=serverDb(); if(!db)return fallback?{...fallback,indicators:[]}:null;
  const {data:domain,error}=await db.from('stat_domains')
   .select('*,section:stat_sections(*)').eq('slug',slug).eq('is_published',true).maybeSingle();
  if(error){recordOperationalEvent('database_failure',{source:'indicators'});return fallback?{...fallback,indicators:[]}:null;}
  if(!domain||!domain.section?.is_published)return null;
  const indicators=await fetchAllRows(()=>db.from('stat_indicators')
   .select('*,adopted_source:stat_sources!stat_indicators_adopted_source_id_fkey(*)',{count:'exact'}).eq('domain_id',domain.id).eq('is_published',true)
   .order('name').order('id'));
  const visible=(indicators||[]).filter(item=>!item.hide_when_incomplete||item.data_status==='complete').map(item=>({...item,adopted_source:item.adopted_source?.is_active?item.adopted_source:null}));
  const values=await loadPublishedStatValues(db,visible.map(item=>item.id));
  return {...domain,indicators:attachStatValues(visible,values)};
 }catch(err){recordOperationalEvent('database_failure',{source:'indicators'});throw new Error('تعذر تحميل المجال');}
}

async function loadStatIndicator(slug){
 try{
  const db=serverDb(); if(!db)return null;
  const {data,error}=await db.from('stat_indicators')
   .select('*,domain:stat_domains(*,section:stat_sections(*)),adopted_source:stat_sources!stat_indicators_adopted_source_id_fkey(*)')
   .eq('slug',slug).eq('is_published',true).maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)return null;
  if((data.hide_when_incomplete&&data.data_status!=='complete')||!data.domain?.is_published||!data.domain?.section?.is_published)return null;
  const [publicValues,sourcesResult,editorialResult]=await Promise.all([
   loadPublishedStatValues(db,[data.id]),
   db.from('stat_indicator_sources').select('*,source:stat_sources(*)').eq('indicator_id',data.id),
   db.from('stat_indicator_editorial').select('intro,why_it_matters,historical_context,limitations,source_notes,reference_links,reviewed_on,is_published').eq('indicator_id',data.id).eq('is_published',true).maybeSingle(),
  ]);
  if(editorialResult.error&&!['42P01','PGRST205'].includes(editorialResult.error.code))recordOperationalEvent('database_failure',{source:'indicator_editorial'});
  if(sourcesResult.error)recordOperationalEvent('database_failure',{source:'indicators'});
  const publicSources=(sourcesResult.data||[]).filter(item=>item.source?.is_active);
  return {...normalizeIndicator({...data,adopted_source:data.adopted_source?.is_active?data.adopted_source:null},publicValues),sources:publicSources,editorial:editorialResult.error?null:editorialResult.data};
 }catch(err){recordOperationalEvent('database_failure',{source:'indicators'});throw new Error('تعذر تحميل المؤشر');}
}

async function loadTimelineIndicators(){
 return getStatIndicators();
}

// Directory lists (figures, products, universities, medical centres) are 0.5–1.8 MB from Supabase
// each, and list pages, detail pages ("related" items) and search read them in full on every visit.
// Each list is now kept per projection: every 60 s one tiny query (published-row count and the latest
// updated_at) decides whether to read it again, and it is read again at least every 10 minutes in
// case a writer did not touch updated_at. If Supabase fails, the last copy is served for up to 1 hour.
// Every caller gets its own copy, so a page that sorts or edits the result cannot change the cache.
const directoryListMemos=new Map();
async function publishedTableVersion(db,table,softDelete){
 let query=db.from(table).select('updated_at',{count:'exact'}).eq('is_published',true);
 if(softDelete)query=query.is('deleted_at',null);
 const {data,count,error}=await query.order('updated_at',{ascending:false,nullsFirst:false}).limit(1);
 if(error)throw error;
 return count+'@'+(data?.[0]?.updated_at||'');
}
function cachedDirectoryList(table,load,{softDelete=false}={}){
 return async projection=>{
  const db=serverDb();if(!db)return load(projection);
  const key=table+'|'+(projection??'default');
  let memo=directoryListMemos.get(key);
  if(!memo){memo=createVersionedMemo({checkMs:60*1000,maxAgeMs:10*60*1000,staleMs:60*60*1000});directoryListMemos.set(key,memo);}
  // If the version query fails, read the list in full (load reports its own errors).
  const version=()=>publishedTableVersion(db,table,softDelete).catch(()=>'unknown:'+Date.now());
  const rows=await memo({version,load:async()=>{const current=await version();return {value:await load(projection),version:current};}});
  return structuredClone(rows);
 };
}
// Called by server-side saves so the change shows at once.
export function invalidateDirectoryLists(){directoryListMemos.clear();}
const publicList=(section,load)=>cache(async(...args)=>{const settings=await getSiteSettings();if(!sectionIsVisible(section,settings.pageVisibility))return [];const rows=await load(...args);return section==='works'&&!sectionIsVisible('debates',settings.pageVisibility)?rows.filter(row=>!row.debate_id&&!row.debate_slug):rows;});
const publicItem=(section,load)=>cache(async(...args)=>sectionIsVisible(section,(await getSiteSettings()).pageVisibility)?load(...args):null);
export const getWorks = publicList('works',loadWorks);
export const getIssues = publicList('magazine',loadIssues);
export const getIssue = publicItem('magazine',loadIssue);
export const getSiteSettings = cache(loadSiteSettings);
export const getMarqueeItems = cache(loadMarqueeItems);
export const getYemeniCompanies = publicList('products',cachedDirectoryList('yemeni_companies',loadYemeniCompanies));
export const getYemeniCompany = publicItem('products',loadYemeniCompany);
export const getProfessionals = publicList('professionals',loadProfessionals);
export const getProfessional = publicItem('professionals',loadProfessional);
export const getUniversities = publicList('universities',cachedDirectoryList('universities',loadUniversities,{softDelete:true}));
export const getUniversity = publicItem('universities',loadUniversity);
export const getMedicalCenters = publicList('medicalCenters',cachedDirectoryList('medical_centers',loadMedicalCenters,{softDelete:true}));
export const getMedicalCenter = publicItem('medicalCenters',loadMedicalCenter);
export const getYemeniFigures = publicList('figures',cachedDirectoryList('yemeni_figures',loadYemeniFigures));
export const getYemeniFigure = publicItem('figures',loadYemeniFigure);
// Full indicator/section catalogs (~4 MB per read) are shared across requests for 5 minutes
// (and kept for up to an hour if Supabase fails), instead of being re-read on every visit.
const statSectionsMemo=createMemo({ttlMs:5*60*1000,staleMs:60*60*1000});
const statIndicatorsMemo=createMemo({ttlMs:5*60*1000,staleMs:60*60*1000});
const copyList=value=>Array.isArray(value)?[...value]:value;
// Called after a server-side indicator save so the public pages show it at once. Edits made in
// the statistics admin panel go straight from the browser to Supabase and appear within 5 minutes.
export function invalidateStatCatalog(){statIndicatorsMemo.clear();statSectionsMemo.clear();recentIndicatorsMemos.clear();statIndicatorMemos.clear();}
// One indicator page used to run four queries (indicator, values, sources, editorial) on every
// visit. Each indicator is now kept 5 minutes, like the list; at most 400 are held at once.
const statIndicatorMemos=new Map();
async function cachedStatIndicator(slug){
 let memo=statIndicatorMemos.get(slug);
 if(!memo){if(statIndicatorMemos.size>=400)statIndicatorMemos.clear();memo=createMemo({ttlMs:5*60*1000,staleMs:60*60*1000});statIndicatorMemos.set(slug,memo);}
 const value=await memo(()=>loadStatIndicator(slug));
 return value?structuredClone(value):value;
}
export const getStatSections = publicList('statistics',async()=>copyList(await statSectionsMemo(loadStatSections)));
export const getStatIndicators = publicList('statistics',async()=>copyList(await statIndicatorsMemo(loadStatIndicators)));
export const getStatDomain = publicItem('statistics',loadStatDomain);
export const getStatIndicator = publicItem('statistics',cachedStatIndicator);
export const getTimelineIndicators = cache(loadTimelineIndicators);

// ---- Bounded home loaders (Editorial Calm redesign) ----
// The front page shows a handful of records, so it asks the database for a
// handful: no fetchAllRows, no full time series. Publication, visibility,
// national-scope and active-source rules are the same as the full loaders.
async function loadLatestWorks(projection,limit){
 const db=serverDb(); if(!db)return [];
 const {data,error}=await db.from('works').select(projection).eq('is_published',true).order('published_at',{ascending:false}).order('id').limit(limit);
 if(error){recordOperationalEvent('database_failure',{source:'works'});throw new Error('تعذر تحميل الأعمال.');}
 return data||[];
}
async function loadLatestIssues(projection,limit){
 const db=serverDb(); if(!db)return [];
 const {data,error}=await db.from('issues').select(projection).eq('is_published',true).order('issue_date',{ascending:false}).order('number',{ascending:false}).order('id').limit(limit);
 if(error){recordOperationalEvent('database_failure',{source:'issues'});throw new Error('تعذر تحميل أعداد المجلة.');}
 return data||[];
}
// Candidates are ranked exactly like the full list (latest observed year, then
// the indicator list order: updated_at desc, id) from a two-column projection of
// the values table; only the top candidates are then loaded and normalized
// with their adopted series. No full series reach the page.
async function loadRecentIndicators(count,candidates=12){
 const db=serverDb(); if(!db)return [];
 try{
  const [years,ranked]=await Promise.all([
   fetchAllRows(()=>db.from('stat_values').select('indicator_id,year',{count:'exact'}).eq('is_published',true).eq('national_scope',true).order('indicator_id').order('id'),1000),
   fetchAllRows(()=>db.from('stat_indicators').select('id',{count:'exact'}).eq('is_published',true).order('updated_at',{ascending:false}).order('id')),
  ]);
  const latest=new Map();
  for(const row of years){const year=Number(row.year);if(Number.isFinite(year)&&year>(latest.get(row.indicator_id)??-Infinity))latest.set(row.indicator_id,year);}
  const ids=ranked.map(row=>row.id).filter(id=>latest.has(id)).sort((a,b)=>latest.get(b)-latest.get(a)).slice(0,candidates);
  if(!ids.length)return [];
  const {data:rows,error:indicatorError}=await db.from('stat_indicators')
   .select('id,slug,name,unit,data_status,hide_when_incomplete,adopted_source_id,updated_at,domain:stat_domains(id,slug,name,is_published,section:stat_sections(id,name,is_published)),adopted_source:stat_sources!stat_indicators_adopted_source_id_fkey(id,name,publisher,url,is_active)')
   .in('id',ids).eq('is_published',true);
  if(indicatorError)throw indicatorError;
  const visible=(rows||[]).filter(item=>(!item.hide_when_incomplete||item.data_status==='complete')&&item.domain?.is_published&&item.domain?.section?.is_published).map(item=>({...item,adopted_source:item.adopted_source?.is_active?item.adopted_source:null}));
  const values=await loadPublishedStatValues(db,visible.map(item=>item.id));
  return attachStatValues(visible,values).filter(item=>item.latestValue!=null)
   .sort((a,b)=>Number(b.latestValue.year)-Number(a.latestValue.year)||ids.indexOf(a.id)-ids.indexOf(b.id))
   .slice(0,count)
   // Keep a tiny trend line (adopted series, last 16 points) for sparklines.
   .map(({values,allValues:_a,...item})=>({...item,spark:values.slice(-16).map(value=>({year:Number(value.year),value:Number(value.value)}))}));
 }catch(err){recordOperationalEvent('database_failure',{source:'indicators'});throw new Error('تعذر تحميل المؤشرات');}
}
export const getLatestWorks=publicList('works',loadLatestWorks);
export const getLatestIssues=publicList('magazine',loadLatestIssues);
// The home page's "latest indicators" ranks every published national value (about 7,100 rows,
// eight requests) to pick four indicators, and it ran on every home visit. It is now kept for
// 5 minutes like the statistics catalog, and cleared with it by server-side indicator saves.
const recentIndicatorsMemos=new Map();
async function cachedRecentIndicators(count,candidates){
 const key=count+'|'+(candidates??'');
 let memo=recentIndicatorsMemos.get(key);
 if(!memo){memo=createMemo({ttlMs:5*60*1000,staleMs:60*60*1000});recentIndicatorsMemos.set(key,memo);}
 return structuredClone(await memo(()=>loadRecentIndicators(count,candidates)));
}
export const getRecentIndicators=publicList('statistics',cachedRecentIndicators);

// A few recent directory entries for the home "community" block. The same
// selection rules as before (first non-demo; professionals not under review),
// read from a small window instead of the whole directory.
const throwing=({data,error})=>{if(error)throw Object.assign(new Error(error.message),{code:error.code});return data||[];};
async function loadRecentCompanies(projection,limit){
 try{
  const db=serverDb(); if(!db)return yemeniCompanies.slice(0,limit).map(company=>({...company,isDemo:true,imageUrl:'/images/yemeni-products-hero.png'}));
  const data=await readProjection('yemeni_companies',projection,async selected=>throwing(await db.from('yemeni_companies').select(selected).eq('is_published',true).order('created_at',{ascending:false}).order('id').limit(limit)));
  return data.map(mapYemeniCompany);
 }catch(err){recordOperationalEvent('database_failure',{source:'companies'});throw new Error('تعذر تحميل دليل المنتجات.');}
}
async function loadRecentProfessionals(projection,limit){
 try{
  const db=serverDb(); if(!db)return demoProfessionals.slice(0,limit);
  const data=await readProjection('professionals',projection,async selected=>throwing(await db.from('professionals').select(selected).eq('is_published',true).order('created_at',{ascending:false}).order('id').limit(limit)));
  return data.map(mapProfessional);
 }catch(err){recordOperationalEvent('database_failure',{source:'professionals'});throw new Error('تعذر تحميل دليل المهنيين.');}
}
export const getRecentCompanies=publicList('products',loadRecentCompanies);
export const getRecentProfessionals=publicList('professionals',loadRecentProfessionals);
