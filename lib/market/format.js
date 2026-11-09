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
export const whatsappLink=(phone,text='')=>'https://wa.me/967'+phone+(text?'?text='+encodeURIComponent(text):'');
