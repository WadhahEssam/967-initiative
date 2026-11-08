// Quiz questions generated from the site's own data (atlas, history, universities).
// Pure and deterministic: the same data gives the same questions, ids and options.
// Only structured, certain facts are used; anything ambiguous is skipped, never guessed.
import {seededShuffle} from './gameEngine.js';
import {displayPlaceName,normalizePlaceName} from './districtPages.js';

export const GENERATED_DAILY_COUNT=40;
const SITE='https://967ye.com';
const firstSentence=(text,max=200)=>{const value=String(text||'').split(/\n\s*\n/)[0].trim();const end=value.search(/[.!؟](\s|$)/);const sentence=end>0?value.slice(0,end+1):value;return sentence.length>max?'':sentence;};
const uniqueBy=(items,key)=>{const seen=new Set();return items.filter(item=>{const k=key(item);if(seen.has(k))return false;seen.add(k);return true;});};

// Four options with the right answer at a stable, id-dependent place.
function withOptions(id,correct,distractors){
 const wrong=uniqueBy(distractors.filter(item=>normalizePlaceName(item)!==normalizePlaceName(correct)),normalizePlaceName).slice(0,3);
 if(wrong.length<3)return null;
 const options=seededShuffle([correct,...wrong],id+'|options');
 return {options,correct:options.indexOf(correct)};
}
const question=(id,category,difficulty,text,choice,explanation,source)=>choice&&{id,category,difficulty,question:text,options:choice.options,correct:choice.correct,explanation,source,isPublished:true,generated:true};

export function districtQuestions({boundaries,profiles={},governorateNames={}}){
 const governorates=boundaries.governorates.map(item=>({id:item.id,name:governorateNames[item.id]||item.nameAr}));
 const nameCount=new Map();
 for(const item of boundaries.districts)nameCount.set(normalizePlaceName(item.nameAr),(nameCount.get(normalizePlaceName(item.nameAr))||0)+1);
 return boundaries.districts.flatMap(district=>{
  const key=normalizePlaceName(district.nameAr);
  const governorate=governorates.find(item=>item.id===district.governorateId);
  // Skip repeated names and districts named after a governorate (two answers, or no question).
  if(!governorate||nameCount.get(key)>1||governorates.some(item=>key.includes(normalizePlaceName(item.name))))return [];
  const profile=profiles[district.id]||{};
  const name=displayPlaceName(district.nameAr,[profile.description,profile.history,profile.capital]);
  const id='g-district-'+district.id;
  const others=seededShuffle(governorates.filter(item=>item.id!==governorate.id),id).map(item=>item.name);
  const explanation=firstSentence(profile.description)||'تقع مديرية '+name+' في محافظة '+governorate.name+' وفق التقسيم الإداري المعتمد في خريطة 967.';
  return [question(id,'geography',2,'في أي محافظة تقع مديرية '+name+'؟',withOptions(id,governorate.name,others),explanation,{title:'خريطة اليمن — مديرية '+name,url:SITE+'/yemen-map/districts/'+district.id})].filter(Boolean);
 });
}

export function capitalQuestions({boundaries,profiles={},governorateNames={}}){
 const rows=boundaries.governorates.map(item=>({id:item.id,name:governorateNames[item.id]||item.nameAr,capital:String(profiles[item.id]?.capital||'').trim()}))
  .filter(row=>row.capital&&row.capital.length<=24&&!/[()،,؛/]|و\s/.test(row.capital));
 const count=new Map();
 for(const row of rows)count.set(normalizePlaceName(row.capital),(count.get(normalizePlaceName(row.capital))||0)+1);
 return rows.flatMap(row=>{
  // Repeated capitals have two answers; a capital named like its governorate gives the answer away.
  if(count.get(normalizePlaceName(row.capital))>1||normalizePlaceName(row.capital).includes(normalizePlaceName(row.name))||normalizePlaceName(row.name).includes(normalizePlaceName(row.capital)))return [];
  const id='g-capital-'+row.id;
  const others=seededShuffle(rows.filter(item=>item.id!==row.id),id).map(item=>item.capital);
  return [question(id,'geography',1,'ما المركز الإداري لمحافظة '+row.name+'؟',withOptions(id,row.capital,others),'المركز الإداري لمحافظة '+row.name+' هو '+row.capital+'.',{title:'خريطة اليمن — محافظة '+row.name,url:SITE+'/yemen-map/governorates/'+row.id})].filter(Boolean);
 });
}

// "Which of these four is the largest?" Kept only when the winner leads the second by 10% or more.
export function superlativeQuestions({boundaries,profiles={},governorateNames={}},{count=24}={}){
 const rows=boundaries.governorates.map(item=>({id:item.id,name:governorateNames[item.id]||item.nameAr,area:Number(item.areaKm2)||null,population:Number(profiles[item.id]?.population)||null,year:profiles[item.id]?.population_year||null}));
 const kinds=[
  {key:'population',text:'أي هذه المحافظات أكثر سكانًا بحسب تقديرات 2025؟',source:{title:'تقديرات السكان 2025 — الجهاز المركزي للإحصاء عبر OCHA',url:SITE+'/yemen-map'},valid:row=>row.population&&row.year===2025,unit:'نسمة'},
  {key:'area',text:'أي هذه المحافظات أكبر مساحة؟',source:{title:'فهرس الحدود الإدارية — OCHA',url:SITE+'/yemen-map'},valid:row=>row.area,unit:'كم²'},
 ];
 const result=[];
 for(const kind of kinds){
  const pool=rows.filter(kind.valid);
  if(pool.length<4)continue;
  for(let attempt=0;attempt<count*4&&result.filter(item=>item.id.startsWith('g-'+kind.key)).length<count;attempt++){
   const picked=seededShuffle(pool,kind.key+'|'+attempt).slice(0,4).sort((a,b)=>b[kind.key]-a[kind.key]);
   if(picked[0][kind.key]<picked[1][kind.key]*1.1)continue;
   const id='g-'+kind.key+'-'+picked.map(item=>item.id).sort().join('-');
   if(result.some(item=>item.id===id))continue;
   const options=seededShuffle(picked.map(item=>item.name),id+'|options');
   const format=value=>Math.round(value).toLocaleString('en-US');
   result.push({id,category:'geography',difficulty:2,question:kind.text,options,correct:options.indexOf(picked[0].name),
    explanation:picked.map(item=>item.name+': '+format(item[kind.key])+' '+kind.unit).join('، ')+'.',source:kind.source,isPublished:true,generated:true});
  }
 }
 return result;
}

// Events whose date the history entry itself calls established; approximate or disputed dates are skipped.
const DOUBT=/تختلف|مختلف|اختلاف|تقديري|تقريبي|نحو|يرجح|يُرجح|مشكوك|غير محدد|لا يوجد تاريخ|شبه أسطوري|أسطور/;
export function historyYearQuestions({history=[]}){
 return history.filter(entry=>entry&&entry.isPublished!==false&&entry.slug&&entry.kind==='event'&&Number.isInteger(entry.year)&&entry.year>=1500&&entry.year<=2025
  &&!/[0-9٠-٩]/.test(entry.title||'')&&!DOUBT.test(entry.certainty||'')&&!DOUBT.test(entry.period||'')
  // The entry's year can mark the start of a topic; keep it only when the summary states that very year.
  &&new RegExp('(^|[^0-9])'+entry.year+'([^0-9]|$)').test(firstSentence(entry.summary,400)))
  .flatMap(entry=>{
   const id='g-year-'+entry.slug;
   const offsets=seededShuffle([-37,-24,-12,13,26,41],id).slice(0,3);
   const choice=withOptions(id,entry.year+'م',offsets.map(offset=>(entry.year+offset)+'م').filter(value=>Number.parseInt(value,10)<=2025));
   return [question(id,'history',3,'إلى أي عام يعود هذا الحدث: «'+entry.title+'»؟',choice,firstSentence(entry.summary,320)||entry.title+' ('+entry.year+'م).',{title:'تاريخ اليمن — '+entry.title,url:SITE+'/yemen-history/'+entry.slug})].filter(Boolean);
  });
}

export function universityQuestions({universities=[],boundaries,governorateNames={}}){
 const governorates=boundaries.governorates.map(item=>({id:item.id,name:governorateNames[item.id]||item.nameAr,key:normalizePlaceName(governorateNames[item.id]||item.nameAr)}));
 const names=new Map();
 for(const item of universities)names.set(normalizePlaceName(item.name),(names.get(normalizePlaceName(item.name))||0)+1);
 return universities.flatMap(item=>{
  const governorate=governorates.find(row=>row.key===normalizePlaceName(item.governorate)||normalizePlaceName(item.governorate).includes(row.key)&&row.key.length>3);
  const nameKey=normalizePlaceName(item.name);
  // Skip branches (several governorates), repeated names, and names that already contain the answer.
  if(!governorate||!item.name||names.get(nameKey)>1||(item.branches||[]).length||governorates.some(row=>nameKey.includes(row.key)))return [];
  const id='g-university-'+item.id;
  const others=seededShuffle(governorates.filter(row=>row.id!==governorate.id),id).map(row=>row.name);
  return [question(id,'culture',2,'في أي محافظة يقع مقرّ '+item.name+'؟',withOptions(id,governorate.name,others),'مقرّ '+item.name+' في محافظة '+governorate.name+(item.city&&normalizePlaceName(item.city)!==governorate.key?' (مدينة '+item.city+')':'')+' بحسب دليل الجامعات في 967.',{title:'دليل الجامعات — '+item.name,url:SITE+'/universities/'+encodeURIComponent(item.id)})].filter(Boolean);
 });
}

export function buildGeneratedQuestions(data){
 return {
  district:districtQuestions(data),capital:capitalQuestions(data),superlative:superlativeQuestions(data),
  year:historyYearQuestions(data),university:universityQuestions(data),
 };
}

// Today's mix: round-robin over the kinds so no single kind fills the list.
export function generatedQuestionsForDay(groups,date,count=GENERATED_DAILY_COUNT){
 const lists=Object.entries(groups).map(([kind,items])=>seededShuffle(items,'967-generated|'+date+'|'+kind)).filter(list=>list.length);
 const picked=[];
 for(let index=0;picked.length<count&&lists.some(list=>index<list.length);index++)for(const list of lists)if(index<list.length&&picked.length<count)picked.push(list[index]);
 return picked;
}
