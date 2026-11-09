// «سوق 967» search: what a query means (words, spellings and Yemeni synonyms), the filters a search
// page accepts, and the suggestions shown while typing. Pure: used by server pages, APIs and the browser.
import {CATEGORIES,CONDITIONS,CURRENCIES,OTHER,findCategory,findSubcategory} from './catalog.js';
import {parseNumber} from './listing.js';
import {normalizeSearch} from './text.js';

// Words that mean the same thing to a buyer. The first word is how the site writes it. The list grows
// from the searches that found nothing (market_search_misses).
export const SYNONYMS=[
 ['جوال','موبايل','تلفون','تليفون','هاتف','جوالات'],
 ['شقه','شقق'],['بيت','منزل','دار','فيلا'],['ارض','قطعه','اراضي'],['محل','دكان','محلات'],['عماره','بنايه','مبني'],
 ['سياره','سيارات','عربيه','مركبه'],['دراجه','موتور','متور','موتوسيكل','ماطور'],['شاحنه','دينا','قلاب','ناقله'],
 ['لابتوب','كمبيوتر','حاسوب','كمبيوترات'],['تلفزيون','تلفاز','شاشه'],['ثلاجه','براد','تلاجه'],['غساله','غسالات'],
 ['مكيف','مكيفات','تكييف','كندشن','سبليت'],['الواح','لوح','بنل','بانل','الواح شمسيه'],['بطاريه','بطاريات','بتريه','بترية'],
 ['انفرتر','انفيرتر','محول','انفرترات'],['مولد','مولدات','جنريتر','ماطور كهرباء'],['كنب','كنبه','مجلس','كنبات'],
 ['ايفون','iphone','ابل'],['سامسونج','سامسونغ','جالكسي','galaxy'],['هايلكس','هيلوكس','هيلكس'],['لاندكروزر','لاند','شاص','صالون'],
 ['هيونداي','هونداي'],['شيفروليه','شفر','شفروليه'],['بلايستيشن','بلاستيشن','playstation','ps5','ps4'],
];
// Phrases written as two words in Yemen, joined before the query is split.
const PHRASES=[[/لاب توب/g,'لابتوب'],[/لاند كروزر/g,'لاندكروزر'],[/بلاي ستيشن/g,'بلايستيشن'],[/طاقه شمسيه/g,'الواح'],[/قطعه ارض/g,'ارض']];
// Words that say nothing about the item.
const STOP=new Set(['في','من','مع','علي','عن','الي','او','و','ب','ل','للبيع','بيع','ابيع','ابغي','ابي','اريد','مطلوب','حق','نظيف','جديد','مستعمل']);

// Arabic and English names from the catalogue (brands and car models): «hilux» finds «هايلكس».
const catalogNames=()=>{
 const pairs=[];
 const add=list=>{for(const item of list||[])if(item.value!==OTHER)pairs.push([normalizeSearch(item.label),normalizeSearch(item.value.replace(/_/g,' '))]);};
 for(const category of CATEGORIES)for(const sub of category.subcategories)for(const field of sub.fields){
  if(field.type==='brand')add(field.brands);
  if(field.type==='model')for(const list of Object.values(field.models||{}))add(list);
 }
 return pairs;
};
let groupsByWord=null;
function synonymIndex(){
 if(groupsByWord)return groupsByWord;
 groupsByWord=new Map();
 const link=words=>{const group=[...new Set(words.map(normalizeSearch).filter(Boolean))];for(const word of group)groupsByWord.set(word,[...new Set([...(groupsByWord.get(word)||[]),...group])]);};
 for(const group of SYNONYMS)link(group);
 for(const [arabic,latin] of catalogNames())if(arabic&&latin&&!arabic.includes(' ')&&!latin.includes(' '))link([arabic,latin]);
 return groupsByWord;
}

// A query as groups of spellings: a listing matches when each group matches (any spelling in it).
// «جوال سامسونج للبيع» → [[جوال, موبايل, …], [سامسونج, سامسونغ, …]].
export function queryGroups(query){
 let text=normalizeSearch(query).slice(0,80);
 for(const [pattern,joined] of PHRASES)text=text.replace(pattern,joined);
 const index=synonymIndex();
 const groups=[];
 for(const word of text.split(' ')){
  if(!word||STOP.has(word)||groups.some(group=>group.includes(word)))continue;
  const variants=new Set(index.get(word)||[word]);
  variants.add(word);
  // «السيارة» also finds «سيارة».
  if(word.startsWith('ال')&&word.length>=5)variants.add(word.slice(2));
  groups.push([...variants].slice(0,10));
  if(groups.length===6)break;
 }
 return groups;
}

export const SORTS=[{value:'new',label:'الأحدث'},{value:'price_asc',label:'الأقل سعرًا'},{value:'price_desc',label:'الأعلى سعرًا'}];
export const ALL_YEMEN='all';
// Cookie with the visitor's governorate id, or «all» (set by PlaceChooser, read by the market pages).
export const PLACE_COOKIE='market_gov';

// The filters of a search page from its URL. Anything unknown is dropped. `places` = {isGovernorate,
// districtGovernorate}. `homeGovernorate` is the visitor's own governorate, used when the URL has none.
export function parseFilters(params,places,homeGovernorate=null){
 const get=key=>{const value=typeof params?.get==='function'?params.get(key):params?.[key];return Array.isArray(value)?value[0]:value;};
 const filters={};
 const q=normalizeSearch(get('q')).slice(0,80);if(q)filters.q=String(get('q')).trim().replace(/\s+/g,' ').slice(0,80);
 const category=findCategory(get('category'));if(category)filters.category=category.key;
 if(category&&findSubcategory(category.key,get('sub')))filters.sub=get('sub');
 const gov=get('gov');
 if(gov===ALL_YEMEN)filters.gov=ALL_YEMEN;
 else if(gov&&places.isGovernorate(gov))filters.gov=gov;
 else if(homeGovernorate&&places.isGovernorate(homeGovernorate)){filters.gov=homeGovernorate;filters.fromHome=true;}
 const district=get('district');
 if(filters.gov&&filters.gov!==ALL_YEMEN&&district&&places.districtGovernorate(district)===filters.gov)filters.district=district;
 if(CURRENCIES.some(item=>item.value===get('currency'))){
  filters.currency=get('currency');
  for(const key of ['min','max']){const value=get(key);if(value===undefined||value===null||value==='')continue;const number=parseNumber(value);if(Number.isFinite(number)&&number>=0&&number<1e12)filters[key]=number;}
  if(filters.min!==undefined&&filters.max!==undefined&&filters.min>filters.max)[filters.min,filters.max]=[filters.max,filters.min];
 }
 if(CONDITIONS.some(item=>item.value===get('condition')))filters.condition=get('condition');
 if(SORTS.some(item=>item.value===get('sort')))filters.sort=get('sort');
 const page=Number.parseInt(get('page'),10);if(page>1&&page<=50)filters.page=page;
 return filters;
}

// A search page URL for these filters (the visitor's own governorate stays implicit).
export function searchHref(filters,changes={}){
 const next={...filters,...changes};
 const params=new URLSearchParams();
 for(const key of ['q','category','sub','gov','district','currency','min','max','condition','sort','page']){
  const value=next[key];
  if(value===undefined||value===null||value===''||(key==='gov'&&next.fromHome&&!('gov' in changes))||(key==='sort'&&value==='new')||(key==='page'&&value<=1))continue;
  params.set(key,String(value));
 }
 const query=params.toString();
 return '/market/search'+(query?'?'+query:'');
}

// Filters without the ones that only shape the page (for saving a search and matching new listings).
export function savedFilters(filters){
 const kept={};
 for(const key of ['q','category','sub','gov','district','currency','min','max','condition'])if(filters[key]!==undefined&&!(key==='gov'&&filters[key]===ALL_YEMEN))kept[key]=filters[key];
 return kept;
}

// «جوالات · سامسونج · عدن · حتى 300 $»: a short name for a saved search.
export function describeFilters(filters,names={}){
 const category=findCategory(filters.category),sub=findSubcategory(filters.category,filters.sub);
 const currency=CURRENCIES.find(item=>item.value===filters.currency)?.short||'';
 const money=value=>Number(value).toLocaleString('en-US')+(currency?' '+currency:'');
 const price=filters.min!==undefined&&filters.max!==undefined?money(filters.min)+' – '+money(filters.max)
  :filters.min!==undefined?'من '+money(filters.min):filters.max!==undefined?'حتى '+money(filters.max):'';
 const parts=[filters.q&&'«'+filters.q+'»',sub?.label||category?.label,names.district||names.governorate,
  CONDITIONS.find(item=>item.value===filters.condition)?.label,price||(currency&&!price?CURRENCIES.find(item=>item.value===filters.currency)?.label:'')].filter(Boolean);
 return (parts.join(' · ')||'كل الإعلانات').slice(0,160);
}

// A word matches when a word of the text starts with it, also after «ال», «وال», «بال» or «لل»
// («جوال» finds «جوالات» and «الجوال», but «لاب» does not find «كلاب»). The database search
// (market_search) uses the same rule, plus spelling mistakes in words of 4 letters or more.
const PREFIXES=['','ال','وال','بال','لل'];
export const textHasWord=(text,word)=>PREFIXES.some(prefix=>(' '+text).includes(' '+prefix+word));

// Whether a published listing matches saved filters (used to tell members about new listings).
export function listingMatches(filters,listing){
 if(filters.category&&listing.category!==filters.category)return false;
 if(filters.sub&&listing.subcategory!==filters.sub)return false;
 if(filters.gov&&filters.gov!==ALL_YEMEN&&listing.governorate_id!==filters.gov)return false;
 if(filters.district&&listing.district_id!==filters.district)return false;
 if(filters.condition&&listing.condition!==filters.condition)return false;
 if(filters.currency&&listing.currency!==filters.currency)return false;
 if(filters.min!==undefined&&Number(listing.price)<filters.min)return false;
 if(filters.max!==undefined&&Number(listing.price)>filters.max)return false;
 if(filters.q){
  const text=listing.search_text||'';
  if(!queryGroups(filters.q).every(group=>group.some(word=>textHasWord(text,word))))return false;
 }
 return true;
}

// Suggestions while typing: sections, brands and car models whose name starts with (or contains)
// what was typed. Built from the catalogue, so it costs no network request.
let vocabulary=null;
function suggestionVocabulary(){
 if(vocabulary)return vocabulary;
 const seen=new Map();
 const add=(text,hint,href)=>{const key=normalizeSearch(text);if(key&&!seen.has(key))seen.set(key,{text,hint,href,key});};
 for(const category of CATEGORIES){
  for(const sub of category.subcategories){
   add(sub.label,category.label,'/market/search?category='+category.key+'&sub='+sub.key);
   for(const field of sub.fields){
    if(field.type==='brand')for(const item of field.brands||[])if(item.value!==OTHER)add(item.label.replace(/\s*\(.*\)$/,''),sub.label);
    if(field.type==='model')for(const list of Object.values(field.models||{}))for(const item of list)if(item.value!==OTHER)add(item.label.split(' / ')[0],sub.label);
   }
  }
 }
 vocabulary=[...seen.values()];
 return vocabulary;
}
export function suggestions(query,limit=6){
 const key=normalizeSearch(query);
 if(key.length<2)return [];
 const words=key.split(' '),last=words.at(-1),head=words.slice(0,-1).join(' ');
 const list=suggestionVocabulary();
 const starts=list.filter(item=>item.key.startsWith(key)||item.key.split(' ').some(word=>word.startsWith(last)));
 const contains=list.filter(item=>!starts.includes(item)&&item.key.includes(last));
 return [...starts,...contains].slice(0,limit).map(({text,hint,href})=>({text:head&&!href?query.trim().split(/\s+/).slice(0,-1).join(' ')+' '+text:text,hint,href}));
}
