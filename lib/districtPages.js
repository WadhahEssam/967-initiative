// Pure helpers for the public district pages (/yemen-map/districts/[id]): place-name matching,
// neighbour detection from shared boundary vertices and a small SVG outline of the district.

export const DISTRICT_ID_PATTERN=/^YE\d{4}$/;
export const districtPath=id=>'/yemen-map/districts/'+encodeURIComponent(id);

// Arabic place names are written many ways in the sources (أ/ا, ة/ه, ى/ي, spaces, "محافظة").
export function normalizePlaceName(value){
 return String(value||'').replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
  .trim().replace(/^(محافظه|مديريه)\s+/,'').replace(/\s+/g,'');
}

// Finds the district of a directory record from its governorate and district names.
// Some records repeat the governorate name before the district ("اب السده"); that prefix is ignored.
export function createDistrictMatcher(boundaries){
 const governorates=new Map(),districts=new Map();
 for(const item of boundaries.governorates||[])governorates.set(normalizePlaceName(item.nameAr),item.id);
 for(const item of boundaries.districts||[])districts.set(item.governorateId+'|'+normalizePlaceName(item.nameAr),item.id);
 return ({governorate,district})=>{
  const governorateId=governorates.get(normalizePlaceName(governorate));
  if(!governorateId||!district)return null;
  const name=normalizePlaceName(district),prefix=normalizePlaceName(governorate);
  return districts.get(governorateId+'|'+name)||(name.startsWith(prefix)&&districts.get(governorateId+'|'+name.slice(prefix.length)))||null;
 };
}

const rings=geometry=>geometry?.type==='Polygon'?geometry.coordinates:geometry?.type==='MultiPolygon'?geometry.coordinates.flat():[];

// Two districts are neighbours when at least `minShared` boundary points of one lie within
// `tolerance` degrees (about 1.5 km) of the other's outline points. The map outlines are
// simplified, so shared borders do not always use identical vertices.
export function districtNeighbours(boundaries,{tolerance=0.015,minShared=3}={}){
 const cells=new Map(),cell=value=>Math.floor(value/tolerance);
 for(const district of boundaries.districts||[])for(const ring of rings(district.geometry))for(const [x,y] of ring){
  const key=cell(x)+','+cell(y);let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push([x,y,district.id]);
 }
 const shared=new Map();
 for(const district of boundaries.districts||[]){
  const near=new Map();
  for(const ring of rings(district.geometry))for(const [x,y] of ring){
   const cx=cell(x),cy=cell(y),seen=new Set();
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const [px,py,id] of cells.get((cx+dx)+','+(cy+dy))||[])
    if(id!==district.id&&!seen.has(id)&&Math.hypot(px-x,py-y)<=tolerance){seen.add(id);near.set(id,(near.get(id)||0)+1);}
  }
  shared.set(district.id,near);
 }
 const result=new Map();
 for(const [id,near] of shared)result.set(id,[...near].filter(([other,count])=>count>=minShared||(shared.get(other)?.get(id)||0)>=minShared).sort((a,b)=>b[1]-a[1]).map(([other])=>other));
 return result;
}

// A light SVG outline: the governorate in the background and the district highlighted.
// Points are projected with a cosine correction and thinned so the page stays small.
export function districtOutline(district,governorate,{width=320,height=240,padding=12,maxPoints=220}={}){
 const shapes=[governorate?.geometry,district?.geometry].map(rings);
 const all=shapes.flat(2);
 if(!all.length)return null;
 const lat=all.reduce((sum,[,y])=>sum+y,0)/all.length,k=Math.cos(lat*Math.PI/180);
 const xs=all.map(([x])=>x*k),ys=all.map(([,y])=>y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min((width-padding*2)/((maxX-minX)||1),(height-padding*2)/((maxY-minY)||1));
 const offsetX=(width-(maxX-minX)*scale)/2,offsetY=(height-(maxY-minY)*scale)/2;
 const point=([x,y])=>((x*k-minX)*scale+offsetX).toFixed(1)+' '+((maxY-y)*scale+offsetY).toFixed(1);
 const path=list=>list.map(ring=>{const step=Math.max(1,Math.ceil(ring.length/maxPoints));const kept=ring.filter((_,index)=>index%step===0);return kept.length>2?'M'+kept.map(point).join('L')+'Z':'';}).join('');
 // Very small districts (city quarters) would be a dot: mark their centre with a ring.
 const own=shapes[1].flat();
 const span=own.length?Math.max(Math.max(...own.map(([x])=>x*k))-Math.min(...own.map(([x])=>x*k)),Math.max(...own.map(([,y])=>y))-Math.min(...own.map(([,y])=>y)))*scale:0;
 const centre=district?.center?point(district.center).split(' ').map(Number):null;
 return {width,height,governorate:path(shapes[0]),district:path(shapes[1]),marker:centre&&span<18?{x:centre[0],y:centre[1],r:10}:null};
}

// History entries in the same governorate whose place line names this district.
export function historyForDistrict(district,entries=[]){
 const name=normalizePlaceName(district?.nameAr);
 if(name.length<3)return [];
 return entries.filter(entry=>entry&&entry.isPublished!==false&&entry.slug&&entry.governorate===district.governorateId&&normalizePlaceName(entry.location).includes(name))
  .sort((a,b)=>(a.year??0)-(b.year??0)).slice(0,6);
}

export function districtSummary(profile,{name,governorateName}){
 const text=String(profile?.description||'').split(/\n\s*\n/)[0].trim();
 const fallback='مديرية '+name+' في محافظة '+governorateName+': الموقع والسكان والمساحة والتاريخ والاقتصاد والمعالم.';
 if(!text)return fallback;
 return text.length>160?text.slice(0,text.lastIndexOf(' ',157)>80?text.lastIndexOf(' ',157):157)+'…':text;
}

function insideRing([x,y],ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}
 return inside;
}
export function pointInGeometry(point,geometry){
 const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
 return polygons.some(([outer,...holes])=>outer&&insideRing(point,outer)&&!holes.some(hole=>insideRing(point,hole)));
}

// Medical facilities in a district: by their recorded names first, then by coordinates.
export function facilitiesInDistrict(district,items=[],matcher){
 return items.filter(item=>{
  const byName=matcher?.({governorate:item.governorate,district:item.district});
  if(byName)return byName===district.id;
  const lat=Number(item.latitude),lng=Number(item.longitude);
  return item.latitude!=null&&item.longitude!=null&&Number.isFinite(lat)&&Number.isFinite(lng)&&pointInGeometry([lng,lat],district.geometry);
 }).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
}

// The boundary file writes names without ة and hamza ("صنعاء القديمه"). Use the spelling found in
// the district's own texts, but only when it differs by those letters alone: ه→ة, ا→أ/إ/آ, ي→ى.
const ADDED_LETTERS={'ه':'ة','ا':'أإآ','ي':'ى'};
function betterSpelling(raw,candidate){
 const a=raw.replace(/\s+/g,''),b=candidate.replace(/\s+/g,'');
 if(a.length!==b.length||a===b)return false;
 return [...a].every((letter,index)=>letter===b[index]||(ADDED_LETTERS[letter]||'').includes(b[index]));
}
export function displayPlaceName(raw,texts=[]){
 const name=String(raw||'').trim();
 if(!name)return name;
 const words=name.split(/\s+/).length;
 for(const text of texts){
  const tokens=String(text||'').split(/[\s،,.:؛()«»"]+/).filter(Boolean);
  for(const size of [words,words-1].filter(Boolean))for(let i=0;i+size<=tokens.length;i++){
   const candidate=tokens.slice(i,i+size).join(' ');
   if(betterSpelling(name,candidate))return candidate;
  }
 }
 return name;
}

// Neighbours first; if a district has few, add the closest district centres (within maxKm).
export function nearbyDistricts(district,all=[],neighbourIds=[],{min=4,maxKm=30}={}){
 const byId=new Map(all.map(item=>[item.id,item])),chosen=neighbourIds.map(id=>byId.get(id)).filter(Boolean);
 if(chosen.length>=min||!district?.center)return chosen;
 const [x0,y0]=district.center,k=Math.cos(y0*Math.PI/180);
 const close=all.filter(item=>item.id!==district.id&&item.center&&!chosen.includes(item))
  .map(item=>({item,km:Math.hypot((item.center[0]-x0)*k,item.center[1]-y0)*111}))
  .filter(row=>row.km<=maxKm).sort((a,b)=>a.km-b.km).slice(0,min-chosen.length).map(row=>row.item);
 return [...chosen,...close];
}
