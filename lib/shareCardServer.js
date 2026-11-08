import 'server-only';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {initWasm,Resvg} from '@resvg/resvg-wasm';
import {SHARE_CARD_FONT,cleanText,shareAccents,shareCardSvg} from './shareCard';
import {getMedicalCenter,getSiteSettings,getStatIndicator,getUniversity,getYemeniCompany,getYemeniFigure} from './data';
import {sectionIsVisible} from './pageVisibility';
import {publicDb} from './supabase';
import {serverDb} from './supabase-server';
import {getMapBoundaries,readPublicMapProfiles} from './mapProfileRepository';
import {readPublicHistoryCatalog} from './historyRepository';
import {historyYear} from './yemenHistory';
import {yemenGovernorates} from './yemeniFigures';
import {DISTRICT_ID_PATTERN,displayPlaceName,districtOutline} from './districtPages';
import {publishedSchoolCatalog,publishedSchoolStageList} from './schoolContentServer';
import {formatNumber} from './format';

// resvg (WebAssembly) and the two font files are loaded once per server process.
let engine=null;
function loadEngine(){
 engine??=(async()=>{
  const root=process.cwd();
  const [wasm,regular,semibold,logo]=await Promise.all([
   readFile(path.join(root,'node_modules/@resvg/resvg-wasm/index_bg.wasm')),
   readFile(path.join(root,'lib/shareCard/IBMPlexSansArabic-Regular.ttf')),
   readFile(path.join(root,'lib/shareCard/IBMPlexSansArabic-SemiBold.ttf')),
   readFile(path.join(root,'lib/shareCard/logo.png')),
  ]);
  await initWasm(wasm).catch(error=>{if(!/already/i.test(String(error?.message)))throw error;});
  return {fonts:[regular,semibold],logo:'data:image/png;base64,'+logo.toString('base64')};
 })().catch(error=>{engine=null;throw error;});
 return engine;
}
const options=fonts=>({font:{fontBuffers:fonts,defaultFontFamily:SHARE_CARD_FONT,loadSystemFonts:false},fitTo:{mode:'original'}});
function measurer(fonts){
 const cache=new Map();
 return (text,size,weight=400)=>{
  const key=size+'|'+weight+'|'+text;
  if(cache.has(key))return cache.get(key);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="300"><text x="10" y="150" font-family="${SHARE_CARD_FONT}" font-weight="${weight}" font-size="${size}">${String(text).replace(/[<>&]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;'})[char])}</text></svg>`;
  const resvg=new Resvg(svg,options(fonts));
  try{const box=resvg.getBBox();const width=box?box.width:0;cache.set(key,width);return width;}
  finally{resvg.free();}
 };
}
export async function renderShareCard(card){
 const {fonts,logo}=await loadEngine();
 const svg=shareCardSvg(card,{measure:measurer(fonts),logo});
 const resvg=new Resvg(svg,options(fonts));
 try{const image=resvg.render();try{return image.asPng();}finally{image.free();}}
 finally{resvg.free();}
}

const firstParagraph=text=>cleanText(String(text||'').split(/\n\s*\n/)[0]);
const governorateName=id=>yemenGovernorates.find(item=>item.id===id)?.name||'';

// Each loader returns the card content, or null when the page is missing or its section is hidden.
const loaders={
 async district(id){
  if(!DISTRICT_ID_PATTERN.test(id))return null;
  const settings=await getSiteSettings();
  if(!sectionIsVisible('atlas',settings.pageVisibility))return null;
  const boundaries=await getMapBoundaries(),region=boundaries.districts.find(item=>item.id===id);
  if(!region)return null;
  const profile=(await readPublicMapProfiles(publicDb()))[id];
  if(!profile)return null;
  const name=displayPlaceName(region.nameAr,[profile.description,profile.history,profile.capital]);
  const population=profile.population!=null?formatNumber(Number(profile.population))+' نسمة'+(profile.population_year?' ('+profile.population_year+')':''):'';
  const area=Number(profile.area_km2)||Number(region.areaKm2);
  return {kicker:'خريطة اليمن · المديريات',title:'مديرية '+name,subtitle:['محافظة '+(governorateName(region.governorateId)||region.governorateNameAr),population,area?formatNumber(area)+' كم²':''].filter(Boolean).join(' · '),
   description:firstParagraph(profile.description),accent:shareAccents.atlas,art:{type:'outline',...districtOutline(region,boundaries.governorates.find(item=>item.id===region.governorateId))}};
 },
 async governorate(id){
  if(!/^YE\d{2}$/.test(id))return null;
  const settings=await getSiteSettings();
  if(!sectionIsVisible('atlas',settings.pageVisibility))return null;
  const boundaries=await getMapBoundaries(),region=boundaries.governorates.find(item=>item.id===id);
  const profile=(await readPublicMapProfiles(publicDb()))[id];
  if(!region||!profile)return null;
  const count=boundaries.districts.filter(item=>item.governorateId===id).length;
  const population=profile.population?formatNumber(Number(profile.population))+' نسمة'+(profile.population_year?' ('+profile.population_year+')':''):'';
  return {kicker:'خريطة اليمن · المحافظات',title:'محافظة '+(governorateName(id)||region.nameAr),subtitle:[formatNumber(count)+' مديرية',population].filter(Boolean).join(' · '),
   description:firstParagraph(profile.description),accent:shareAccents.atlas,art:{type:'outline',...districtOutline(region,{geometry:boundaries.country?.geometry||null})}};
 },
 async history(slug){
  const settings=await getSiteSettings();
  if(!sectionIsVisible('history',settings.pageVisibility))return null;
  const entry=(await readPublicHistoryCatalog(serverDb())).entries.find(item=>item.slug===slug&&item.isPublished!==false);
  if(!entry)return null;
  return {kicker:'تاريخ اليمن',title:entry.title,subtitle:[entry.period,entry.location].filter(Boolean).join(' · '),description:entry.summary,accent:shareAccents.history,
   art:{type:'big',text:historyYear(entry.year),label:entry.location||''}};
 },
 async figure(slug){
  const figure=await getYemeniFigure(slug);
  if(!figure||figure.isDemo)return null;
  const years=[figure.birthYear,figure.deathYear].filter(Boolean).join(' – ');
  return {kicker:'شخصيات يمنية',title:figure.fullName,subtitle:[figure.knownFor||figure.field,figure.governorateName].filter(Boolean).join(' · '),description:figure.shortBio,accent:shareAccents.figures,
   art:years?{type:'big',text:years,label:figure.era||''}:null};
 },
 async indicator(slug){
  const indicator=await getStatIndicator(slug);
  if(!indicator)return null;
  const latest=indicator.latestValue;
  const source=latest?.source;
  const byYear=new Map();
  for(const row of indicator.values||[])if(Number.isFinite(Number(row.value))&&Number.isFinite(Number(row.year))&&(!source||!row.source||row.source===source))byYear.set(Number(row.year),Number(row.value));
  const points=[...byYear].sort((a,b)=>a[0]-b[0]).slice(-20).map(([year,value])=>({year,value}));
  const value=latest?formatNumber(latest.value,{maximumFractionDigits:3}):'';
  return {kicker:'اليمن بالأرقام',title:indicator.name,subtitle:latest?'أحدث قيمة: '+value+(indicator.unit?' '+indicator.unit:'')+' ('+latest.year+')':'',description:indicator.short_description||indicator.definition,accent:shareAccents.statistics,
   art:latest?(points.length>1?{type:'spark',points,value,label:[indicator.unit,String(latest.year)].filter(Boolean).join(' · ')}:{type:'big',text:value,label:[indicator.unit,String(latest.year)].filter(Boolean).join(' · ')}):null};
 },
 async university(id){
  const item=await getUniversity(id);
  if(!item)return null;
  return {kicker:'دليل الجامعات والمعاهد',title:item.name,subtitle:[item.typeLabel,item.city||item.governorate].filter(Boolean).join(' · '),description:item.summary,accent:shareAccents.directories,
   art:item.programs?.length?{type:'big',text:formatNumber(item.programs.length),label:'برنامجًا دراسيًا'}:null};
 },
 async medical(id){
  const item=await getMedicalCenter(id);
  if(!item)return null;
  return {kicker:'دليل المراكز الطبية',title:item.name,subtitle:[item.typeLabel,[item.district,item.governorate].filter(Boolean).join('، ')].filter(Boolean).join(' · '),description:item.summary,accent:shareAccents.directories,
   art:item.specialties?.length?{type:'big',text:formatNumber(item.specialties.length),label:item.specialties.length===1?'تخصص':'تخصصات'}:null};
 },
 async company(id){
  const item=await getYemeniCompany(id);
  if(!item)return null;
  const products=Array.isArray(item.productDetails)&&item.productDetails.length?item.productDetails.length:Array.isArray(item.products)?item.products.length:0;
  return {kicker:'منتجات وشركات يمنية',title:item.name,subtitle:[item.category,item.location].filter(Boolean).join(' · '),description:item.summary,accent:shareAccents.directories,
   art:products?{type:'big',text:formatNumber(products),label:'منتجًا'}:null};
 },
 async course(slug){
  const settings=await getSiteSettings();
  if(!sectionIsVisible('school',settings.pageVisibility))return null;
  const db=serverDb();
  const course=db?(await publishedSchoolCatalog(db).catch(()=>[])).find(item=>item.slug===slug):null;
  if(!course)return null;
  const lessons=(await publishedSchoolStageList(db,slug).catch(()=>[])).length;
  return {kicker:'مدرسة 967',title:course.title,subtitle:'مسار تعليمي مجاني بدروس تفاعلية قصيرة',description:course.description,accent:shareAccents.school,
   art:lessons?{type:'big',text:formatNumber(lessons),label:'درسًا'}:null};
 },
};

export async function loadShareCard(kind,id){
 const load=Object.hasOwn(loaders,kind)?loaders[kind]:null;
 if(!load||typeof id!=='string'||!id||id.length>200)return null;
 return load(id);
}
