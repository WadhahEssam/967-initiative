import 'server-only';
import {cache} from 'react';
import {pageIsVisible} from './pageVisibility';
import {getWorks, getIssues, getStatIndicators, getStatSections, getYemeniFigures, getYemeniCompanies, getProfessionals, getUniversities, getMedicalCenters, getSiteSettings} from './data';
import {buildSearchIndex, searchTypes} from './search';
import {getSearchPlaces} from './searchPlaces';
import {searchPages, getSettingsSearchPages} from './searchPages';
import {demoIssue} from './config';
import {getRankingCatalog} from './rankingData';
import {getDebateCatalog} from './debateServer';
import {searchProjections} from './searchProjections';
import {collectPublicSources} from './publicSourceCollection';
import {recordOperationalEvent} from './operationalEvents';
import {readPublicHistoryCatalog} from './historyRepository';
import {serverDb} from './supabase-server';

export const getSearchData = cache(async () => {
  const names = ['works', 'issues', 'indicators', 'figures', 'companies', 'professionals', 'universities', 'medicalCenters', 'sections', 'places', 'settings', 'rankings','debates','history'];
  const {data,unavailable:failed}=await collectPublicSources({
    works:()=>getWorks(searchProjections.works),issues:()=>getIssues(searchProjections.issues),indicators:getStatIndicators,
    figures:()=>getYemeniFigures(searchProjections.figures),companies:()=>getYemeniCompanies(searchProjections.companies),professionals:()=>getProfessionals(searchProjections.professionals),
    universities:()=>getUniversities(searchProjections.universities),medicalCenters:()=>getMedicalCenters(searchProjections.medicalCenters),
    sections:getStatSections,places:getSearchPlaces,settings:getSiteSettings,rankings:getRankingCatalog,debates:getDebateCatalog,history:()=>readPublicHistoryCatalog(serverDb()),
  },{onUnavailable:source=>recordOperationalEvent('source_unavailable',{source,area:'search'})});
  const results=names.map(name=>failed.includes(name)?{status:'rejected'}:{status:'fulfilled',value:data[name]});
  const content = {pages:[...searchPages]}, unavailable = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if(names[index]==='settings'){content.pages=getSettingsSearchPages(result.value);if(result.value.contentPages===null)unavailable.push('صفحات الموقع');}
      else if(names[index]==='places'){content.places=result.value.places;unavailable.push(...result.value.unavailable);}
      else if(names[index]==='debates'){content.debates=result.value.debates;if(!result.value.available)unavailable.push('المناظرات');}
      else if(names[index]==='history')content.history=result.value.entries;
      else if(names[index]==='rankings')content.pages.push(...result.value.indicators.map(item=>({title:`ترتيب اليمن: ${item.name}`,description:item.description,href:`/yemen-ranking?indicator=${encodeURIComponent(item.slug)}`,keywords:`ترتيب مقارنة ${item.unit}`})));
      else content[names[index]] = result.value;
    } else unavailable.push(searchTypes[names[index]]||'مجالات المرصد');
  });
  if(content.issues&&!content.issues.length)content.issues=[demoIssue];
  if(!data.settings)return {items:[],unavailable};
  const settings=data.settings;
  return {items:buildSearchIndex(content).filter(item=>pageIsVisible(item.href,settings.pageVisibility,settings.contentPages||[])),unavailable};
});
