import {formatNumber} from './format.js';

// «9 أعضاء»: the noun follows Arabic number agreement on the last two digits:
// 1 عضو واحد, 2 عضوان, 3–10 أعضاء, 11–99 عضوًا, and round hundreds/thousands (or …01, …02) عضو.
export function memberCountLabel(count){
 const n=Number(count);
 if(!Number.isSafeInteger(n)||n<1)return '';
 if(n===1)return 'عضو واحد';
 if(n===2)return 'عضوان';
 const tail=n%100,text=formatNumber(n);
 if(tail>=3&&tail<=10)return text+' أعضاء';
 if(tail>=11)return text+' عضوًا';
 return text+' عضو';
}
