// «في مثل هذا اليوم»: exact Gregorian dates (day month year) read from the history texts.
// Pure. Nothing is stored: the dates come from the published entries, so edits flow through.

export const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_ALIASES={'إبريل':4,'ابريل':4,'اغسطس':8};
// Events after this year belong to the current conflict; on the home page they would read as
// the site taking a side, so they are left out of the headline (they stay in the history pages).
export const ON_THIS_DAY_LAST_YEAR=2010;
// The look-behind skips the second day of a range («13–14 أكتوبر»).
const DATE=new RegExp('(?<![0-9–\\-]\\s?)([0-9]{1,2})\\s+('+[...MONTHS,...Object.keys(MONTH_ALIASES)].join('|')+')\\s+(?:(?:من\\s+)?(?:عام|سنة)\\s+)?([0-9]{3,4})(?![0-9])\\s*(ق\\.?\\s?م)?','g');
const sentences=text=>String(text||'').split(/(?<=[.!؟])\s+/).map(item=>item.trim()).filter(Boolean);
// A sentence shown alone should not open with «و» or «ثم».
const tidy=sentence=>sentence.replace(/^و(?=(في|بعد|قد|لكن|عندما|حين|خلال|منذ|مع)\s)/,'').replace(/^ثم\s+/,'');

export function extractDatedFacts(entries=[],{lastYear=ON_THIS_DAY_LAST_YEAR}={}){
 const facts=new Map();
 for(const entry of entries){
  if(!entry||entry.isPublished===false||!entry.slug||!entry.title)continue;
  for(const text of [entry.summary,...(Array.isArray(entry.paragraphs)?entry.paragraphs:[])])for(const sentence of sentences(text)){
   if(sentence.length>260||/تتفاوت|تختلف|يُرجّح|يرجح|ربما|قيل/.test(sentence))continue;
   for(const match of sentence.matchAll(DATE)){
    if(match[4])continue;
    const day=Number(match[1]),month=MONTHS.indexOf(match[2])+1||MONTH_ALIASES[match[2]],year=Number(match[3]);
    if(!month||day<1||day>new Date(Date.UTC(2024,month,0)).getUTCDate()||year<600||year>lastYear)continue;
    // One fact per entry and date; keep the shortest sentence.
    const key=entry.slug+'|'+month+'-'+day+'|'+year,text=tidy(sentence);
    const current=facts.get(key);
    if(!current||text.length<current.sentence.length)facts.set(key,{slug:entry.slug,title:entry.title,day,month,year,sentence:text,main:Number(entry.year)===year,lead:/^في\s+[0-9]/.test(text)});
   }
  }
 }
 // A date many entries mention is a landmark (30 نوفمبر 1967, 22 مايو 1990): rank it first.
 const weight=new Map();
 for(const fact of facts.values()){const key=fact.month+'-'+fact.day+'-'+fact.year;weight.set(key,(weight.get(key)||0)+1);}
 return [...facts.values()].map(fact=>({...fact,weight:weight.get(fact.month+'-'+fact.day+'-'+fact.year)}));
}

// Day and month in Yemen (UTC+3), where the readers are.
export function yemenMonthDay(now=new Date()){
 const date=new Date(now.getTime()+3*60*60*1000);
 return {month:date.getUTCMonth()+1,day:date.getUTCDate()};
}
const dayOfYear=({month,day})=>Math.round((Date.UTC(2024,month-1,day)-Date.UTC(2024,0,1))/86400000);
const rank=(a,b)=>(b.weight-a.weight)||(b.main-a.main)||(b.lead-a.lead)||(a.sentence.length-b.sentence.length)||(a.year-b.year);

// Today's facts; when none, the closest dated facts within `window` days (ties go to the coming day).
// pastOnly: the nearby fallback never looks ahead (the home page shows only today and yesterday).
export function factsForDay(facts,{month,day},{window=3,pastOnly=false}={}){
 const exact=facts.filter(item=>item.month===month&&item.day===day);
 const unique=list=>{const seen=new Set();return list.filter(item=>!seen.has(item.slug)&&seen.add(item.slug));};
 if(exact.length)return {exact:true,month,day,items:unique(exact.sort(rank))};
 const today=dayOfYear({month,day});
 let best=null;
 for(const item of facts){
  let distance=dayOfYear(item)-today;
  if(distance>183)distance-=366;if(distance<-183)distance+=366;
  if(Math.abs(distance)>window||distance===0||pastOnly&&distance>0)continue;
  if(!best||Math.abs(distance)<Math.abs(best.distance)||(Math.abs(distance)===Math.abs(best.distance)&&distance>best.distance))best={distance,month:item.month,day:item.day};
 }
 if(!best)return {exact:false,items:[]};
 return {exact:false,month:best.month,day:best.day,distance:best.distance,items:unique(facts.filter(item=>item.month===best.month&&item.day===best.day).sort(rank))};
}

export const formatDayMonth=({day,month})=>day+' '+MONTHS[month-1];
