// Prohibited-content check for «سوق 967» (spec: المحتوى الممنوع). A match does not reject the
// listing: it is held for review («قيد المراجعة») instead of being published at once.
// Terms are written already normalised (see normalizeSearch): ا not أ، ه not ة، ي not ى.
import {normalizeSearch} from './text.js';

export const PROHIBITED=[
 {reason:'سلاح أو ذخيرة',terms:['سلاح','اسلحه','مسدس','مسدسات','بندق','بندقيه','بنادق','كلاشن','كلاشنكوف','رشاش','ذخيره','طلقات','رصاص','قنبله','قنابل','متفجرات','جنبيه','جنابي','جنبيات','ak47','m16','glock']},
 {reason:'قات',terms:['قات','القات']},
 {reason:'مخدرات أو أدوية بوصفة',terms:['حشيش','مخدر','مخدرات','كبتاجون','ترامادول','شبو','ليريكا','زاناكس','ريفوتريل','بدون وصفه']},
 {reason:'آثار أو مخطوطات',terms:['اثار','اثري','اثريه','مخطوطه','مخطوطات','قطع اثريه']},
 {reason:'حيوانات مهددة بالانقراض',terms:['نمر عربي','فهد عربي','سلحفاه بحريه']},
 {reason:'تزوير',terms:['مزور','مزوره','تزوير','شهاده مزوره','عمله مزوره']},
 {reason:'مسروقات',terms:['مسروق','مسروقه']},
 {reason:'محتوى إباحي',terms:['اباحي','اباحيه','سكس','xxx']},
];

// Whole words or whole phrases only, so «طاقات» does not match «قات».
export function prohibitedMatches(...texts){
 const padded=' '+normalizeSearch(texts.filter(Boolean).join(' '))+' ';
 const found=[];
 for(const group of PROHIBITED)for(const term of group.terms)if(padded.includes(' '+term+' ')){found.push({reason:group.reason,term});break;}
 return found;
}
export const reviewReason=matches=>matches.map(item=>item.reason+' («'+item.term+'»)').join('، ');
