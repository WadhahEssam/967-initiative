import {matchesSearch} from './search.js';
export const figureFilterDefaults={figureQ:'',field:'الكل',era:'الكل',social:false,photo:false,century:'',birthFrom:'',birthTo:'',figureSort:'default',visible:12};
export function readFigureFilters(search){
 const p=new URLSearchParams(search),f={...figureFilterDefaults};
 for(const key of ['figureQ','field','era'])if(p.has(key))f[key]=p.get(key).slice(0,150);
 for(const key of ['social','photo'])f[key]=p.get(key)==='1';
 if(/^(?:[5-9]|1\d|2[01])$/.test(p.get('century')||''))f.century=p.get('century');
 for(const key of ['birthFrom','birthTo'])if(/^\d{3,4}$/.test(p.get(key)||'')&&Number(p.get(key))>=500&&Number(p.get(key))<=2100)f[key]=p.get(key);
 if(['default','alpha','field','oldest','youngest','newest'].includes(p.get('figureSort')))f.figureSort=p.get('figureSort');
 if(/^\d+$/.test(p.get('visible')||''))f.visible=Math.min(1000,Math.max(12,Number(p.get('visible'))));return f;
}
export function figureFilterSearch(search,f){
 const p=new URLSearchParams(search);for(const [k,d]of Object.entries(figureFilterDefaults)){const v=f[k];if(v===d||v===''||v===false)p.delete(k);else p.set(k,typeof v==='boolean'?'1':String(v));}return p;
}
export function filterFigures(figures,f){
 // The directory's light rows carry hasSocial and hasPhoto before the card details arrive.
 const social=figure=>figure.hasSocial??['website','facebookUrl','instagramUrl','xUrl','youtubeUrl'].some(k=>figure[k]);
 const rows=figures.filter(g=>matchesSearch(f.figureQ,[g.fullName,g.knownFor,g.shortBio])&&(!f.field||f.field==='الكل'||g.field===f.field)&&(!f.region||g.governorateId===f.region)&&(!f.era||f.era==='الكل'||g.era===f.era)&&(!f.social||social(g))&&(!f.photo||Boolean(g.hasPhoto??g.imageUrl))&&(!f.century||Number.isInteger(g.birthYear)&&Math.ceil(g.birthYear/100)===Number(f.century))&&(!f.birthFrom||Number.isInteger(g.birthYear)&&g.birthYear>=Number(f.birthFrom))&&(!f.birthTo||Number.isInteger(g.birthYear)&&g.birthYear<=Number(f.birthTo)));
 const alpha=(a,b)=>a.fullName.localeCompare(b.fullName,'ar')||String(a.slug||a.id).localeCompare(String(b.slug||b.id));
 const known=(value)=>Number.isInteger(value)?value:null;
 if(f.figureSort==='alpha')rows.sort(alpha);
 if(f.figureSort==='field')rows.sort((a,b)=>a.field.localeCompare(b.field,'ar')||alpha(a,b));
 if(['oldest','youngest'].includes(f.figureSort))rows.sort((a,b)=>{const ay=known(a.birthYear),by=known(b.birthYear);return ay===null?by===null?alpha(a,b):1:by===null?-1:(f.figureSort==='youngest'?by-ay:ay-by)||alpha(a,b);});
 if(f.figureSort==='newest')rows.sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||alpha(a,b));
 return rows;
}
