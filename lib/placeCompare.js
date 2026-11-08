// Side-by-side comparison of two places (governorates or districts) from the atlas data.
// Pure: the page passes the boundary file, the public profiles and the related lists.
import {createDistrictMatcher,displayPlaceName,facilitiesInDistrict,historyForDistrict,normalizePlaceName} from './districtPages.js';

export const PLACE_ID_PATTERN=/^YE\d{2}(\d{2})?$/;
export const placeKind=id=>/^YE\d{4}$/.test(id)?'district':/^YE\d{2}$/.test(id)?'governorate':null;
export const comparePath=(a,b)=>'/yemen-map/compare'+(a||b?'?'+new URLSearchParams(Object.entries({a,b}).filter(([,value])=>value)):'');

// Population rows show their year and the source that carries population figures.
function populationSource(profile){
 const sources=Array.isArray(profile?.sources)?profile.sources:[];
 return sources.find(item=>/سكان|population|الإحصاء/i.test(item?.title||''))||null;
}

export function placeFacts(id,{boundaries,profiles={},governorateNames={},medicalCenters=[],universities=[],figures=[],history=[]}){
 const kind=placeKind(id);
 if(!kind)return null;
 const region=kind==='district'?boundaries.districts.find(item=>item.id===id):boundaries.governorates.find(item=>item.id===id);
 const profile=profiles[id];
 if(!region||!profile)return null;
 const governorateId=kind==='district'?region.governorateId:region.id;
 const name=kind==='district'?displayPlaceName(region.nameAr,[profile.description,profile.history,profile.capital]):governorateNames[id]||region.nameAr;
 const area=Number(profile.area_km2)||Number(region.areaKm2)||null;
 const population=profile.population!=null&&Number.isFinite(Number(profile.population))?Number(profile.population):null;
 const matcher=createDistrictMatcher(boundaries);
 const governorateKey=normalizePlaceName(boundaries.governorates.find(item=>item.id===governorateId)?.nameAr);
 const inGovernorate=item=>normalizePlaceName(item.governorate)===governorateKey||matcher({governorate:item.governorate,district:item.district})?.startsWith(governorateId);
 const facilities=kind==='district'?facilitiesInDistrict(region,medicalCenters,matcher):medicalCenters.filter(inGovernorate);
 return {
  id,kind,name,governorateId,
  title:(kind==='district'?'مديرية ':'محافظة ')+name,
  governorateName:governorateNames[governorateId]||region.governorateNameAr||'',
  href:kind==='district'?'/yemen-map/districts/'+id:'/yemen-map/governorates/'+id,
  capital:profile.capital||'',
  area,population,populationYear:population!==null?profile.population_year||null:null,populationSource:population!==null?populationSource(profile):null,
  density:population&&area?Math.round(population/area):null,
  districts:kind==='governorate'?boundaries.districts.filter(item=>item.governorateId===id).length:null,
  facilities:facilities.length,
  hospitals:facilities.filter(item=>/hospital|مستشفى/i.test(String(item.type||'')+' '+String(item.typeLabel||''))).length,
  universities:kind==='governorate'?universities.filter(inGovernorate).length:null,
  figures:kind==='governorate'?figures.filter(item=>item.governorateId===id).length:null,
  history:kind==='governorate'?history.filter(item=>item.isPublished!==false&&item.governorate===id).length:historyForDistrict(region,history).length,
  summary:String(profile.description||'').split(/\n\s*\n/)[0].trim(),
 };
}

// Rows to show. A row is skipped when neither place has a value. `wide` marks the higher value.
export function comparisonRows(a,b){
 const rows=[
  {key:'governorate',label:'المحافظة',text:true,only:'district'},
  {key:'capital',label:'المركز الإداري',text:true},
  {key:'population',label:'السكان',unit:'نسمة'},
  {key:'area',label:'المساحة',unit:'كم²'},
  {key:'density',label:'الكثافة التقريبية',unit:'نسمة/كم²',note:'السكان ÷ المساحة'},
  {key:'districts',label:'عدد المديريات'},
  {key:'facilities',label:'المرافق الصحية في الدليل',note:'المسجلة في دليل 967، وليست حصرًا رسميًا'},
  {key:'hospitals',label:'منها مستشفيات'},
  {key:'universities',label:'الجامعات والمعاهد في الدليل'},
  {key:'figures',label:'شخصيات مرتبطة بها'},
  {key:'history',label:'مواد تاريخية مرتبطة'},
 ];
 const value=(place,row)=>row.key==='governorate'?(place.kind==='district'?place.governorateName:null):place[row.key];
 return rows.filter(row=>!row.only||a.kind===row.only||b.kind===row.only).map(row=>{
  const left=value(a,row),right=value(b,row);
  const numbers=!row.text&&Number.isFinite(left)&&Number.isFinite(right);
  return {...row,a:left,b:right,higher:numbers&&left!==right?(left>right?'a':'b'):null,ratio:numbers&&Math.min(left,right)>0?Math.max(left,right)/Math.min(left,right):null};
 }).filter(row=>(row.a!==null&&row.a!==undefined&&row.a!=='')||(row.b!==null&&row.b!==undefined&&row.b!==''));
}

// One plain sentence for the most telling difference (population, then area).
export function comparisonHeadline(a,b){
 for(const [key,phrase] of [['population','أكثر سكانًا'],['area','أكبر مساحة'],['density','أعلى كثافة']]){
  const left=a[key],right=b[key];
  if(!Number.isFinite(left)||!Number.isFinite(right)||!left||!right||left===right)continue;
  const [big,small]=left>right?[a,b]:[b,a],ratio=Math.max(left,right)/Math.min(left,right);
  const times=ratio<1.95?'بنحو '+Math.round((ratio-1)*100)+'%':ratio<2.5?'بنحو الضعف':Math.round(ratio)<=10?'بنحو '+Math.round(ratio)+' أضعاف':'بنحو '+Math.round(ratio)+' ضعفًا';
  return big.title+' '+phrase+' من '+small.title+' '+times+'.';
 }
 return '';
}
