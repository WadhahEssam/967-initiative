// Validation and display helpers for «سوق 967» listings. Pure: the server passes the place lookup.
import {CATEGORIES,CONDITIONS,CURRENCIES,OTHER,findSubcategory} from './catalog.js';
import {cleanText,normalizeSearch,westernDigits} from './text.js';

export class ListingError extends Error{
 constructor(message,field=null){super(message);this.name='ListingError';this.field=field;}
}
export const LISTING_LIMITS={title:120,description:4000,images:{min:1,max:10},price:{max:1e12}};
const fail=(message,field)=>{throw new ListingError(message,field);};

const optionLabel=(options,value)=>options?.find(item=>item.value===value)?.label;
// «٨٬٥٠٠» or «8,500» → 8500; «٢٫٥» → 2.5. Anything else gives NaN.
export const parseNumber=raw=>Number(westernDigits(String(raw)).replace(/[\s,،٬]/g,'').replace('٫','.'));

// One attribute value, checked against its field. Returns undefined for an empty value.
function attributeValue(field,raw,attributes){
 if(raw===undefined||raw===null||raw==='')return undefined;
 if(field.type==='number'){
  const value=parseNumber(raw);
  if(!Number.isFinite(value)||value<(field.min??0)||(field.max!==undefined&&value>field.max))fail('قيمة «'+field.label+'» غير صحيحة.',field.key);
  return Math.round(value*100)/100;
 }
 if(field.type==='text'){
  const value=cleanText(raw,field.maxLength||80);
  return value||undefined;
 }
 if(field.type==='select'){
  if(!field.options.some(item=>item.value===raw))fail('اختر «'+field.label+'» من القائمة.',field.key);
  return raw;
 }
 if(field.type==='brand'){
  if(raw===OTHER)return OTHER;
  if(!field.brands.some(item=>item.value===raw))fail('اختر «'+field.label+'» من القائمة أو «أخرى».',field.key);
  return raw;
 }
 if(field.type==='model'){
  const list=field.models[attributes[field.dependsOn]]||[];
  if(raw===OTHER)return OTHER;
  if(!list.some(item=>item.value===raw))fail('اختر «'+field.label+'» من القائمة أو «أخرى».',field.key);
  return raw;
 }
 return undefined;
}
// «أخرى» in a brand or model list is completed by a typed name in `<key>_other`.
const needsOther=field=>field.type==='brand'||field.type==='model';

export function validateAttributes(sub,input={},{complete=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('تفاصيل الإعلان غير صالحة.','attributes');
 const known=new Set(sub.fields.flatMap(field=>needsOther(field)?[field.key,field.key+'_other']:[field.key]));
 if(Object.keys(input).some(key=>!known.has(key)))fail('تفاصيل الإعلان غير صالحة.','attributes');
 const out={};
 for(const field of sub.fields){
  const value=attributeValue(field,input[field.key],{...input,...out});
  if(value!==undefined)out[field.key]=value;
  // Without a list for the chosen brand, the model is always typed.
  if(field.type==='model'&&value===undefined&&!(field.models[out[field.dependsOn]]?.length)&&input[field.key+'_other'])out[field.key]=OTHER;
  if(needsOther(field)&&out[field.key]===OTHER){
   const other=cleanText(input[field.key+'_other'],40);
   if(other)out[field.key+'_other']=other;
   else if(complete)fail('اكتب «'+field.label+'».',field.key);
  }
  if(complete&&field.required&&out[field.key]===undefined)fail('أكمل «'+field.label+'».',field.key);
 }
 return out;
}

// places: {isGovernorate(id), districtGovernorate(id)} from the site's boundary file.
export function validateListing(input,{complete=false,places}={}){
 if(!input||typeof input!=='object')fail('بيانات الإعلان غير صالحة.');
 const sub=findSubcategory(input.category,input.subcategory);
 if(!sub)fail('اختر الفئة والقسم.','category');
 const out={category:input.category,subcategory:input.subcategory};
 out.attributes=validateAttributes(sub,input.attributes||{},{complete});
 out.title=cleanText(input.title,LISTING_LIMITS.title);
 out.description=cleanText(input.description,LISTING_LIMITS.description);
 if(input.price!==undefined&&input.price!==null&&input.price!==''){
  const price=parseNumber(input.price);
  if(!Number.isFinite(price)||price<0||price>LISTING_LIMITS.price.max)fail('السعر غير صحيح.','price');
  out.price=Math.round(price*100)/100;
 }else out.price=null;
 out.currency=input.currency||null;
 if(out.currency&&!CURRENCIES.some(item=>item.value===out.currency))fail('اختر العملة.','currency');
 out.negotiable=input.negotiable!==false;
 out.condition=input.condition||null;
 if(out.condition&&!CONDITIONS.some(item=>item.value===out.condition))fail('اختر حالة المنتج.','condition');
 out.governorate_id=input.governorate_id||null;out.district_id=input.district_id||null;
 if(out.governorate_id&&!places?.isGovernorate(out.governorate_id))fail('اختر المحافظة.','governorate_id');
 if(out.district_id&&places?.districtGovernorate(out.district_id)!==out.governorate_id)fail('اختر مديرية من المحافظة نفسها.','district_id');
 out.show_whatsapp=input.show_whatsapp===true;
 if(complete){
  if(!out.title)out.title=suggestTitle(out)||'';
  if(out.title.length<3)fail('اكتب عنوانًا للإعلان.','title');
  if(out.price===null)fail('اكتب السعر.','price');
  if(!out.currency)fail('اختر العملة.','currency');
  if(!out.condition)fail('اختر حالة المنتج.','condition');
  if(!out.governorate_id||!out.district_id)fail('اختر المحافظة والمديرية.','district_id');
 }
 return out;
}

// «تويوتا هايلكس 2015» from the subcategory's titleFrom fields.
export function attributeText(sub,key,attributes){
 const field=sub.fields.find(item=>item.key===key),value=attributes?.[key];
 if(!field||value===undefined||value===null||value==='')return '';
 if(value===OTHER)return attributes[key+'_other']||'';
 if(field.type==='select')return optionLabel(field.options,value)||'';
 if(field.type==='brand')return optionLabel(field.brands,value)||'';
 if(field.type==='model')return optionLabel(field.models[attributes[field.dependsOn]],value)||'';
 if(field.type==='number'){
  if(key==='area')return value+' '+(optionLabel(sub.fields.find(item=>item.key==='area_unit')?.options,attributes.area_unit)||'');
  if(key==='rooms')return value+(value>=3&&value<=10?' غرف':' غرفة');
  // «120,000 كم»; a year stays «2015».
  const shown=key==='year'?String(value):Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
  return field.unit?shown+' '+field.unit:shown;
 }
 return String(value);
}
export function suggestTitle({category,subcategory,attributes}){
 const sub=findSubcategory(category,subcategory);
 if(!sub)return '';
 return sub.titleFrom.map(key=>attributeText(sub,key,attributes).trim()).filter(Boolean).join(' ').slice(0,LISTING_LIMITS.title);
}
// Spec icons under the price: «2015 · 120,000 كم · أوتوماتيك · ديزل».
export function listingHighlights({category,subcategory,attributes}){
 const sub=findSubcategory(category,subcategory);
 return sub?sub.highlights.map(key=>attributeText(sub,key,attributes)).filter(Boolean):[];
}
// «إعلانك مكتمل 60%»: share of the subcategory's fields, the description and 3+ photos.
export function listingCompleteness(listing){
 const sub=findSubcategory(listing.category,listing.subcategory);
 if(!sub)return 0;
 const checks=[...sub.fields.filter(field=>field.key!=='area_unit').map(field=>listing.attributes?.[field.key]!==undefined),Boolean(listing.description&&listing.description.length>=30),(listing.images?.length||0)>=3];
 return Math.round(checks.filter(Boolean).length/checks.length*100);
}
// What the search index stores: title, category names, attribute texts and the description.
export function listingSearchText(listing){
 const category=CATEGORIES.find(item=>item.key===listing.category),sub=findSubcategory(listing.category,listing.subcategory);
 const attributes=sub?sub.fields.map(field=>attributeText(sub,field.key,listing.attributes)):[];
 return normalizeSearch([listing.title,category?.label,sub?.label,...attributes,listing.description].filter(Boolean).join(' ')).slice(0,6000);
}
