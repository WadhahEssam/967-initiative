import {RequestValidationError} from './requestSecurity.js';

export const PAGE_VISIBILITY_KEY='public_page_visibility_v1';
// Account, editorial and recovery routes deliberately remain available.
export const publicSections=[
 {id:'works',path:'/works',title:'الأعمال الإعلامية'},
 {id:'magazine',path:'/magazine',title:'مجلة 967'},
 {id:'debates',path:'/debates',title:'مناظرات 967'},
 {id:'statistics',path:'/yemen-in-numbers',title:'اليمن بالأرقام'},
 {id:'ranking',path:'/yemen-ranking',title:'ترتيب اليمن'},
 {id:'atlas',path:'/yemen-map',title:'خريطة اليمن'},
 {id:'figures',path:'/yemeni-figures',title:'شخصيات يمنية'},
 {id:'history',path:'/yemen-history',title:'تاريخ اليمن'},
 {id:'games',path:'/games',title:'ألعاب 967'},
 {id:'school',path:'/school',title:'مدرسة 967'},
 {id:'products',path:'/yemeni-products',title:'المنتجات والشركات اليمنية'},
 {id:'professionals',path:'/professionals',title:'المهنيون'},
 {id:'universities',path:'/universities',title:'دليل الجامعات والمعاهد'},
 {id:'medicalCenters',path:'/medical-centers',title:'دليل المراكز الطبية'},
 // «الخدمات» (أسعار الصرف) starts hidden: it opens once the first daily rates are entered.
 {id:'services',path:'/services',title:'الخدمات: أسعار الصرف',defaultHidden:true},
 // Staple prices open on their own once the first weekly prices are entered (needs «الخدمات»).
 {id:'foodPrices',path:'/services/food-prices',title:'الخدمات: أسعار المواد الأساسية',parent:'services',defaultHidden:true},
 // New sections can start hidden: «سوق 967» stays off until the owner launches it.
 {id:'market',path:'/market',title:'سوق 967',defaultHidden:true},
 {id:'contribute',path:'/contribute',title:'التواصل والمساهمة'},
];

export function validatePageVisibility(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!publicSections.some(item=>item.id===key)))throw new RequestValidationError('إعدادات ظهور الصفحات غير صالحة.');
 const value={};
 for(const {id,defaultHidden} of publicSections){if(Object.hasOwn(input,id)&&typeof input[id]!=='boolean')throw new RequestValidationError('حالة ظهور الصفحة يجب أن تكون ظاهرة أو مخفية.');value[id]=Object.hasOwn(input,id)?input[id]:!defaultHidden;}
 return value;
}
export function resolvePageVisibility(rows=[]){
 const row=rows.find(item=>item.key===PAGE_VISIBILITY_KEY);
 if(!row)return validatePageVisibility({});
 if(row.value?.version!==1)throw new RequestValidationError('تعذر قراءة إعدادات ظهور الصفحات.',503);
 return validatePageVisibility(row.value.sections);
}
export function sectionIsVisible(id,visibility={}){
 const section=publicSections.find(item=>item.id===id);
 return Boolean(section)&&(Object.hasOwn(visibility,id)?visibility[id]!==false:!section.defaultHidden)&&(!section.parent||sectionIsVisible(section.parent,visibility));
}
// When the settings cannot be read (database slow or unreachable, e.g. right after a deploy),
// sections stay hidden (fail closed) but pages must not answer 404: a 404 tells visitors and
// search engines the page is gone. sectionGate throws instead, so the page renders the error
// boundary with a temporary 5xx status; sectionStatus lets API routes answer 503.
export class SectionsUnavailableError extends Error{
 constructor(){super('تعذر التحقق من إتاحة الأقسام مؤقتًا.');this.name='SectionsUnavailableError';}
}
export function sectionStatus(id,settings={}){
 if(settings.pageVisibilityUnavailable)return 'unavailable';
 return sectionIsVisible(id,settings.pageVisibility)?'visible':'hidden';
}
export function sectionGate(id,settings={}){
 const status=sectionStatus(id,settings);
 if(status==='unavailable')throw new SectionsUnavailableError();
 return status==='visible';
}
export function pageIsVisible(href,visibility={},pages=[]){
 let url;try{url=new URL(href,'https://local.invalid');}catch{return false;}
 if(url.origin!=='https://local.invalid')return true;
 // The embedded figure route needs BOTH its atlas parent and its figures subsection.
 // Match the nested server layouts, not just the standalone /yemeni-figures page.
 if(url.pathname==='/yemen-map'&&url.hash==='#yemeni-figures')
  return sectionIsVisible('atlas',visibility)&&sectionIsVisible('figures',visibility);
 if(url.pathname.startsWith('/yemen-map/figures/'))
  return sectionIsVisible('atlas',visibility)&&sectionIsVisible('figures',visibility);
 if(publicSections.some(item=>(url.pathname===item.path||url.pathname.startsWith(item.path+'/'))&&!sectionIsVisible(item.id,visibility)))return false;
 let slug;try{slug=decodeURIComponent(url.pathname.startsWith('/pages/')?url.pathname.slice(7):url.pathname.slice(1));}catch{return false;}
 return !pages.some(page=>page.slug===slug&&page.isPublished===false);
}
