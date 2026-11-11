// Display helpers for «سوق 967» (pure; used by server pages and client components).
import {CURRENCIES} from './catalog.js';

export const listingPath=number=>'/market/'+encodeURIComponent(String(number));

// «8,500 $» · «1,200,000 ر.ي» · «350 ر.س». Western digits, as everywhere on the site.
export function formatPrice(price,currency){
 if(price===null||price===undefined||price==='')return '';
 const short=CURRENCIES.find(item=>item.value===currency)?.short||'';
 return Number(price).toLocaleString('en-US',{maximumFractionDigits:2})+(short?' '+short:'');
}

// «الآن» · «منذ 5 دقائق» · «منذ ساعتين» · «منذ 3 أيام» · «منذ شهر».
export function timeAgo(value,now=Date.now()){
 const then=Date.parse(value);
 if(!Number.isFinite(then))return '';
 const minutes=Math.max(0,Math.floor((now-then)/60000));
 const unit=(n,one,two,few,many)=>n===1?one:n===2?two:n>=3&&n<=10?n+' '+few:n+' '+many;
 if(minutes<1)return 'الآن';
 if(minutes<60)return 'منذ '+unit(minutes,'دقيقة','دقيقتين','دقائق','دقيقة');
 const hours=Math.floor(minutes/60);
 if(hours<24)return 'منذ '+unit(hours,'ساعة','ساعتين','ساعات','ساعة');
 const days=Math.floor(hours/24);
 if(days<30)return 'منذ '+unit(days,'يوم','يومين','أيام','يومًا');
 const months=Math.floor(days/30);
 if(months<12)return 'منذ '+unit(months,'شهر','شهرين','أشهر','شهرًا');
 const years=Math.floor(months/12);
 return 'منذ '+unit(years,'سنة','سنتين','سنوات','سنة');
}

export const STATUS_LABELS={draft:'مسودة',pending_review:'قيد المراجعة',active:'متاح',reserved:'محجوز',sold:'مباع',expired:'منتهي',removed:'محذوف',archived:'مؤرشف'};

// Yemeni mobile numbers: 9 digits starting with 7 (77…, 73…, 71…, 70…, 78…), stored without +967.
export function normalizeYemeniMobile(value){
 const digits=String(value??'').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/\D/g,'').replace(/^(00967|967)/,'').replace(/^0(?=7)/,'');
 return /^7[01378]\d{7}$/.test(digits)?digits:null;
}
// Country codes offered next to the WhatsApp number (Yemen first, then where Yemenis live most).
export const PHONE_COUNTRIES=[
 ['967','اليمن'],['966','السعودية'],['971','الإمارات'],['968','عُمان'],['974','قطر'],['965','الكويت'],['973','البحرين'],
 ['20','مصر'],['962','الأردن'],['249','السودان'],['252','الصومال'],['253','جيبوتي'],['251','إثيوبيا'],['90','تركيا'],
 ['60','ماليزيا'],['62','إندونيسيا'],['91','الهند'],['44','بريطانيا'],['49','ألمانيا'],['1','أمريكا وكندا'],
];
const latinDigits=value=>String(value??'').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x06F0));
// Any WhatsApp number. A number typed with + or 00 keeps its own country code; otherwise
// the chosen country code is added (a leading 0 of the local number is dropped).
// Stored form: Yemeni mobiles as 9 digits (as before), other numbers as international digits
// without + (10–15 digits). Returns null when the number cannot be right.
export function normalizePhone(value,country='967'){
 const raw=latinDigits(value).trim();
 let digits=raw.replace(/\D/g,'');
 if(!digits)return null;
 if(/^(\+|00)/.test(raw))digits=digits.replace(/^00/,'');
 else{
  const code=PHONE_COUNTRIES.some(([id])=>id===String(country))?String(country):'967';
  digits=code+digits.replace(/^0+/,'');
 }
 if(digits.startsWith('967'))return normalizeYemeniMobile(digits);
 return /^[1-9]\d{9,14}$/.test(digits)?digits:null;
}
// International digits for wa.me and display.
const international=phone=>/^7[01378]\d{7}$/.test(phone)?'967'+phone:phone;
export const phoneDisplay=phone=>phone?'+'+international(String(phone)):'';
export const whatsappLink=(phone,text='')=>'https://wa.me/'+international(String(phone))+(text?'?text='+encodeURIComponent(text):'');

// The amount and the currency apart, so the currency can be set smaller: «8,000» + «$».
export function priceParts(price,currency){
 if(price===null||price===undefined||price==='')return null;
 return {amount:Number(price).toLocaleString('en-US',{maximumFractionDigits:2}),currency:CURRENCIES.find(item=>item.value===currency)?.short||''};
}
