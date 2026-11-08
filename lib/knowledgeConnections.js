import {sectionIsVisible} from './pageVisibility.js';
import {yemenGovernorates} from './yemeniFigures.js';

// Editorial relationships only: a shared modern governorate is geographic context,
// not proof that a historic state had today's administrative borders.
const validSlug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const published=value=>value&&value.isPublished!==false&&value.isDemo!==true;
const regionName=id=>yemenGovernorates.find(x=>x.id===id)?.name||null;
const visible=(kind,settings)=>sectionIsVisible(kind,settings);
const historyHref=slug=>'/yemen-history/'+slug;
const figureHref=slug=>'/yemeni-figures/'+encodeURIComponent(slug);
const norm=value=>String(value||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\u0621-\u064a\s]/g,' ').replace(/\s+/g,' ').trim();

const matchesName=(name,query)=>{
 if(query.length<3)return false;
 const full=norm(name);
 return full===query||full.startsWith(query+' ')||full.endsWith(' '+query)||full.includes(' '+query+' ');
};
const matchingPeople=(figures,query)=>figures.filter(figure=>
 published(figure)&&figure.slug&&figure.fullName&&matchesName(figure.fullName,query));

export function connectedHistoryForFigure(figure,entries=[],figures=[]){
 if(!figure?.slug||!figure.fullName)return [];
 return entries.filter(item=>{
  if(!published(item)||!validSlug(item.slug))return false;
  const query=norm(item.figureQuery);
  const matches=matchingPeople(figures,query);
  return matches.length===1&&matches[0].slug===figure.slug;
 }).sort((a,b)=>a.year-b.year).slice(0,3);
}
export function connectedHistoryForGovernorate(id,entries=[]){
 if(!regionName(id))return [];
 return entries.filter(x=>published(x)&&validSlug(x.slug)&&x.governorate===id)
  .sort((a,b)=>a.year-b.year).slice(0,3);
}
export function connectedFiguresForGovernorate(id,figures=[]){
 if(!regionName(id))return [];
 return figures.filter(x=>published(x)&&x.governorateId===id&&x.slug&&x.fullName)
  .slice(0,3);
}
export function historyCrossLinks(item,{visibility={},figures=[]}={}){
 if(!published(item))return [];
 const links=[];
 const place=regionName(item.governorate);
 if(place&&visible('atlas',visibility))links.push({
  href:'/yemen-map?region='+item.governorate+'#map',kind:'الخريطة',title:'استكشف '+place,
  description:'المحافظة المعاصرة المرتبطة بالمادة، وليست حدود المملكة أو الدولة التاريخية.'
 });
 const query=norm(item.figureQuery);
 if(query.length>=3&&visible('figures',visibility)){
  const matches=matchingPeople(figures,query);
  if(matches.length===1)links.push({href:figureHref(matches[0].slug),kind:'الشخصيات',title:matches[0].fullName,
   description:'ملف الشخصية المذكورة في هذه المادة التاريخية.'});
  else links.push({href:'/yemeni-figures?figureQ='+encodeURIComponent(item.figureQuery),kind:'الشخصيات',
   title:'ابحث عن '+item.figureQuery,description:'بحث في دليل الشخصيات؛ راجع هوية النتائج ومصادرها.'});
 }
 if(visible('school',visibility)&&['ancient-inscriptions','saba','qataban','main','himyar'].includes(item.slug))
  links.push({href:'/school/courses/musnad',kind:'مدرسة 967',title:'تعلّم حروف المسند',
   description:'تمارين على الخط العربي الجنوبي القديم، وليست ترجمة تلقائية للنقوش.'});
 return links;
}
export function figureCrossLinks(figure,{visibility={},historyEntries=[],figures=[]}={}){
 if(!figure||figure.isDemo)return [];
 const links=[];
 if(visible('history',visibility))for(const article of connectedHistoryForFigure(figure,historyEntries,figures))
  links.push({href:historyHref(article.slug),kind:'تاريخ اليمن',title:article.title,
   description:'مادة تاريخية تذكر هذه الشخصية وتشرح سياقها.'});
 const place=regionName(figure.governorateId);
 if(place&&visible('atlas',visibility))links.push({
  href:'/yemen-map?region='+figure.governorateId+'#map',kind:'الخريطة',title:'استكشف '+place,
  description:'المحافظة المرتبطة بالملف وفق التقسيم الإداري المعاصر.'
 });
 if(visible('school',visibility)&&figure.field==='الأدب والشعر')links.push({
  href:'/school/courses/arud',kind:'مدرسة 967',title:'تعلّم علم العروض',
  description:'مسار عام لفهم أوزان الشعر العربي، وليس تحليلًا لشعر هذه الشخصية.'
 });
 return links.slice(0,5);
}
export function governorateCrossLinks(id,{visibility={},historyEntries=[],figures=[]}={}){
 if(!regionName(id))return [];
 const links=[];
 if(visible('history',visibility))for(const article of connectedHistoryForGovernorate(id,historyEntries))
  links.push({href:historyHref(article.slug),kind:'تاريخ اليمن',title:article.title,
   description:'مادة مرتبطة جغرافيًا بهذه المحافظة الحديثة؛ دون افتراض حدود تاريخية مطابقة.'});
 if(visible('figures',visibility))for(const person of connectedFiguresForGovernorate(id,figures))
  links.push({href:figureHref(person.slug),kind:'الشخصيات',title:person.fullName,
   description:'شخصية مرتبطة بالمحافظة في دليل 967.'});
 return links.slice(0,6);
}
export function musnadCrossLinks(historyEntries=[],visibility={}){
 if(!visible('history',visibility))return [];
 return ['ancient-inscriptions','saba','himyar'].map(slug=>historyEntries.find(x=>x.slug===slug&&published(x)))
  .filter(Boolean).map(item=>({href:historyHref(item.slug),kind:'تاريخ اليمن',title:item.title,
   description:'اقرأ عن السياق التاريخي للنقوش والممالك، مع المصادر وحدود التوثيق.'}));
}

export function statisticsCrossLinks(visibility={}){
 if(!visible('school',visibility))return [];
 return [{href:'/school/civic',kind:'مدرسة 967',title:'افهم أساسيات الاقتصاد',
  description:'تعرّف على مفاهيم الاقتصاد والمال قبل تفسير المؤشرات؛ لا تستبدل الدروس مصادر البيانات.'}];
}
export function civicCrossLinks(visibility={}){
 const links=[];
 if(visible('statistics',visibility))links.push({href:'/yemen-in-numbers',kind:'اليمن بالأرقام',
  title:'طبّق المفاهيم على بيانات اليمن',description:'مؤشرات وطنية موثقة مع سنة القياس والمصدر؛ ليست أمثلة المختبر الافتراضية.'});
 if(visible('ranking',visibility))links.push({href:'/yemen-ranking',kind:'ترتيب اليمن',
  title:'قارن المؤشرات في سياقها',description:'قارن ترتيب اليمن بحسب المؤشر وسنته ونطاق المقارنة المتاح.'});
 return links;
}
