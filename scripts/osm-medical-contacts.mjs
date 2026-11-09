#!/usr/bin/env node
// Turns OpenStreetMap tags of the site's OSM-sourced medical facilities into enrich items
// (phone, opening hours, website, email, Facebook) for scripts/apply-medical-enrichment-2026-11.mjs.
//   node scripts/osm-medical-contacts.mjs <overpass.json> <output.json>
// Input: an Overpass `out tags` result for the facilities' OSM ids (slug osm-n123 = node 123).
import {readFileSync,writeFileSync} from 'node:fs';

const DAYS={Mo:'الاثنين',Tu:'الثلاثاء',We:'الأربعاء',Th:'الخميس',Fr:'الجمعة',Sa:'السبت',Su:'الأحد'};
const ROUND='على مدار الساعة';

// Common OSM opening_hours forms in Arabic; anything else (or a rule without times) is skipped.
export function hoursText(value){
 const raw=String(value||'').trim();
 if(!raw)return null;
 if(/^24\/7$/i.test(raw))return ROUND;
 const rules=raw.split(/\s*;\s*/).map(rule=>{
  const match=rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*((?:\d{2}:\d{2}-\d{2}:\d{2})(?:\s*,\s*\d{2}:\d{2}-\d{2}:\d{2})*|off|closed)$/i);
  if(!match)return null;
  const [,days,times]=match;
  const dayText=!days||days==='Mo-Su'?'يوميًا':days.split(',').map(part=>part.split('-').map(day=>DAYS[day]).join('–')).join('، ');
  if(/^(off|closed)$/i.test(times))return dayText+': مغلق';
  const spans=times.split(/\s*,\s*/);
  if(spans.length===1&&spans[0]==='00:00-24:00')return dayText==='يوميًا'?ROUND:dayText+': '+ROUND;
  return dayText+' '+spans.map(span=>span.replace('-','–')).join(' و');
 });
 return rules.every(Boolean)?rules.join('، '):null;
}

// A person-named clinic's mobile is a personal number; landlines and facility lines are kept.
const personal=name=>/(^|\s)(د\s*[./]|الدكتور|الدكتورة|دكتور|دكتورة|عيادة|طبيب)/.test(String(name||''));
const mobile=phone=>/^(\+?967|00967)?\s*7\d/.test(String(phone).replace(/[\s-]/g,''));
export function phoneText(value,name){
 const parts=String(value||'').split(/\s*[;,]\s*|\s+-\s+/).map(part=>part.trim()).filter(Boolean)
  .filter(part=>/^[+\d][\d\s-]{5,}$/.test(part)).filter(part=>!(mobile(part)&&personal(name)));
 return parts.length?parts.join(' / '):null;
}
const https=value=>{const raw=String(value||'').trim();if(!raw)return null;const url=/^https?:\/\//i.test(raw)?raw:'https://'+raw.replace(/^\/+/,'');try{const parsed=new URL(url.replace(/^http:/i,'https:'));return /\./.test(parsed.hostname)?parsed.href:null;}catch{return null;}};

export function osmItems(elements=[]){
 const items=[];
 for(const element of elements){
  const tags=element.tags||{},name=tags['name:ar']||tags.name||'';
  const id=(element.type==='node'?'n':element.type==='way'?'w':'r')+element.id;
  const url='https://www.openstreetmap.org/'+element.type+'/'+element.id;
  const source={title:'OpenStreetMap — '+(name||id),url,publisher:'OpenStreetMap contributors',source_type:'independent_directory'};
  const item={slug:'osm-'+id};
  const phone=phoneText(tags.phone||tags['contact:phone']||tags['contact:mobile']||tags.mobile,name);
  if(phone)item.phone=phone;
  const hours=hoursText(tags.opening_hours);
  if(hours)item.hours=[{label:'ساعات العمل',hours_text:hours,source_url:url}];
  const website=https(tags.website||tags['contact:website']);
  if(website&&!/g\.co\/kgs|google\./.test(website))item.website=website;
  const email=String(tags.email||tags['contact:email']||'').trim();
  if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))item.email=email;
  const facebook=https(tags['contact:facebook']);
  if(facebook&&/facebook\.com/i.test(facebook))item.social_links=[{label:'فيسبوك',url:facebook}];
  if(Object.keys(item).length>1){item.sources=[source];items.push(item);}
 }
 return items;
}

if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){
 const [input,output]=process.argv.slice(2);
 const items=osmItems(JSON.parse(readFileSync(input,'utf8')).elements);
 writeFileSync(output,JSON.stringify(items,null,1));
 console.log('items',items.length,'phones',items.filter(item=>item.phone).length,'hours',items.filter(item=>item.hours).length,'web',items.filter(item=>item.website||item.social_links).length);
}
