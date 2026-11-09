import {formatNumber} from './format.js';

export const issueDownloadPath=slug=>'/api/magazine/download/'+encodeURIComponent(slug);

// «حُمّل 12 مرة» with Arabic number agreement; nothing for zero.
export function downloadCountLabel(count){
 const n=Number(count);
 if(!Number.isSafeInteger(n)||n<1)return '';
 if(n===1)return 'حُمّل مرة واحدة';
 if(n===2)return 'حُمّل مرتين';
 const tail=n%100,text=formatNumber(n);
 return 'حُمّل '+text+(tail>=3&&tail<=10?' مرات':' مرة');
}

// Crawlers and link previews must not count as downloads.
export const isBotAgent=agent=>/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless/i.test(String(agent||''));
