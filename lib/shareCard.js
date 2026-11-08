// Share cards (Open Graph images, 1200×630) drawn as SVG and rendered to PNG by resvg on the
// server. resvg shapes Arabic and orders right-to-left text correctly (next/og does not).
// This file is pure: text wrapping takes a measure(text,size,weight) function.

export const SHARE_CARD_SIZE={width:1200,height:630};
export const SHARE_CARD_FONT='IBM Plex Sans Arabic';
export const shareCardKinds=['district','governorate','history','figure','indicator','university','medical','company','course'];
export const shareAccents={atlas:'#0b6b6e',history:'#b4441f',figures:'#7a4b8c',statistics:'#1f5c8f',directories:'#9a6410',school:'#2f7a4a'};

const RLM='‏';
export const escapeXml=value=>String(value??'').replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[char]);
// Diacritics and tatweel make no difference on a card and some sit badly at small sizes.
export const cleanText=value=>String(value??'').replace(/[ً-ْـ​-‏‪-‮⁦-⁩]/g,'').replace(/\s+/g,' ').trim();

// Greedy wrap by measured width; the last allowed line ends with … when text remains.
export function wrapText(text,{maxWidth,maxLines,size,weight=400,measure}){
 const words=cleanText(text).split(' ').filter(Boolean),lines=[];
 let line='';
 for(let index=0;index<words.length;index++){
  const next=line?line+' '+words[index]:words[index];
  if(!line||measure(next,size,weight)<=maxWidth){line=next;continue;}
  lines.push(line);line=words[index];
  if(lines.length===maxLines){line='';lines[maxLines-1]=ellipsize(lines[maxLines-1],{maxWidth,size,weight,measure});return lines;}
 }
 if(line)lines.push(measure(line,size,weight)>maxWidth?ellipsize(line,{maxWidth,size,weight,measure,force:false}):line);
 return lines.slice(0,maxLines);
}
function ellipsize(line,{maxWidth,size,weight,measure,force=true}){
 let words=line.split(' ');
 const fits=value=>measure(value,size,weight)<=maxWidth;
 if(!force&&fits(line))return line;
 while(words.length>1&&!fits(words.join(' ')+' …'))words=words.slice(0,-1);
 let result=words.join(' ');
 while(result.length>1&&!fits(result+'…'))result=result.slice(0,-1);
 return result+'…';
}

// Lines without Arabic letters (numbers, year ranges, the domain) are drawn left to right.
const LRM='‎',hasArabic=value=>/[؀-ۿ]/.test(value),hasLatin=value=>/[A-Za-z]/.test(value);
const textElement=(value,{x,y,size,weight=400,fill,anchor='end'})=>{const rtl=hasArabic(value),mark=rtl?RLM:LRM;return `<text x="${x}" y="${y}" text-anchor="${anchor}" direction="${rtl?'rtl':'ltr'}" font-family="${SHARE_CARD_FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}">${escapeXml(mark+value+mark)}</text>`;};
// resvg lays the parts of a mixed Arabic/Latin line out left to right, so a right-aligned
// Arabic line that contains Latin words is split into runs placed from the right by hand.
export function lineRuns(value){
 const runs=[];
 for(const word of value.split(' ').filter(Boolean)){
  const latin=hasLatin(word)&&!hasArabic(word),last=runs.at(-1);
  if(last&&last.latin===latin)last.text+=' '+word;else runs.push({latin,text:word});
 }
 return runs;
}
function textLine(value,options,measure){
 const anchor=options.anchor||'end';
 if(anchor!=='end'||!measure||!hasArabic(value)||!hasLatin(value))return textElement(value,options);
 const space=options.size*.3;let x=options.x;
 return lineRuns(value).map(run=>{const part=textElement(run.text,{...options,x:Number(x.toFixed(1)),anchor:'end'});x-=measure(run.text,options.size,options.weight||400)+space;return part;}).join('');
}

function artSvg(art,accent,box,measure){
 if(!art)return '';
 const {x,y,width,height}=box;
 if(art.type==='outline'&&art.district){
  const scale=Math.min(width/art.width,height/art.height),dx=x+(width-art.width*scale)/2,dy=y+(height-art.height*scale)/2;
  return `<g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)}) scale(${scale.toFixed(3)})"><path d="${art.governorate}" fill="#ebe5da" stroke="#cfc6b6" stroke-width="${(1.2/scale).toFixed(2)}" stroke-linejoin="round"/><path d="${art.district}" fill="${accent}" fill-opacity=".88" stroke="${accent}" stroke-width="${(1.2/scale).toFixed(2)}" stroke-linejoin="round"/>${art.marker?`<circle cx="${art.marker.x}" cy="${art.marker.y}" r="${art.marker.r}" fill="none" stroke="${accent}" stroke-width="${(3/scale).toFixed(2)}"/>`:''}</g>`;
 }
 if(art.type==='big'){
  const natural=measure?measure(art.text,124,600):0;
  const size=Math.max(40,Math.min(124,natural?Math.floor(124*width/natural):124));
  return `${textLine(art.text,{x:x+width/2,y:y+height/2+size*.3,size,weight:600,fill:accent,anchor:'middle'})}${art.label?textLine(art.label,{x:x+width/2,y:y+height/2+size*.3+52,size:28,fill:'#6b6258',anchor:'middle'}):''}`;
 }
 if(art.type==='spark'&&art.points?.length>1){
  const values=art.points.map(point=>point.value),min=Math.min(...values),max=Math.max(...values),range=(max-min)||1;
  const top=y+40,chartHeight=height-150,stepX=width/(art.points.length-1);
  const coords=art.points.map((point,index)=>[x+index*stepX,top+chartHeight-(point.value-min)/range*chartHeight]);
  const line=coords.map(([px,py],index)=>(index?'L':'M')+px.toFixed(1)+' '+py.toFixed(1)).join('');
  const area=line+`L${(x+width).toFixed(1)} ${top+chartHeight}L${x} ${top+chartHeight}Z`;
  const [lastX,lastY]=coords.at(-1);
  return `<path d="${area}" fill="${accent}" fill-opacity=".12"/><path d="${line}" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lastX}" cy="${lastY}" r="9" fill="${accent}"/>`
   +textLine(art.value,{x:x+width/2,y:top+chartHeight+70,size:art.value.length>9?44:56,weight:600,fill:'#1a1612',anchor:'middle'})
   +(art.label?textLine(art.label,{x:x+width/2,y:top+chartHeight+112,size:26,fill:'#6b6258',anchor:'middle'}):'');
 }
 return '';
}

// card: {kicker, title, subtitle, description, accent, art}; logo: a data: URL of the 967 mark.
export function shareCardSvg(card,{measure,logo}){
 const {width,height}=SHARE_CARD_SIZE,accent=card.accent||shareAccents.atlas;
 const right=width-84,hasArt=Boolean(card.art),textWidth=hasArt?700:1000;
 const titleSize=cleanText(card.title).length>34?54:64;
 const title=wrapText(card.title,{maxWidth:textWidth,maxLines:2,size:titleSize,weight:600,measure});
 const subtitle=card.subtitle?wrapText(card.subtitle,{maxWidth:textWidth,maxLines:1,size:32,measure}):[];
 const description=card.description?wrapText(card.description,{maxWidth:textWidth,maxLines:title.length>1?2:3,size:28,measure}):[];
 const parts=[];
 let y=212;
 title.forEach(line=>{parts.push(textLine(line,{x:right,y,size:titleSize,weight:600,fill:'#1a1612'},measure));y+=titleSize*1.32;});
 y+=4;
 subtitle.forEach(line=>{parts.push(textLine(line,{x:right,y,size:32,fill:accent},measure));y+=50;});
 y+=14;
 description.forEach(line=>{parts.push(textLine(line,{x:right,y,size:28,fill:'#4a443d'},measure));y+=46;});
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  +`<rect width="${width}" height="${height}" fill="#f7f4ee"/>`
  +`<rect x="${width-18}" y="0" width="18" height="${height}" fill="${accent}"/>`
  +(logo?`<image x="60" y="44" width="68" height="72" href="${logo}" xlink:href="${logo}"/>`:'')
  +textLine(card.kicker||'مبادرة 967',{x:right,y:96,size:30,weight:600,fill:accent})
  +`<rect x="${right-64}" y="114" width="64" height="5" rx="2.5" fill="${accent}"/>`
  +parts.join('')
  +artSvg(card.art,accent,{x:60,y:150,width:330,height:380},measure)
  +`<path d="M60 ${height-70}H${right}" stroke="#ddd5c8" stroke-width="2"/>`
  +textLine('967ye.com',{x:60,y:height-30,size:24,fill:'#6b6258',anchor:'start'})
  +textLine('مبادرة 967 — المعرفة اليمنية في مكان واحد',{x:right,y:height-30,size:24,fill:'#6b6258'})
  +'</svg>';
}

// A short version tag so social sites fetch a new card after an edit.
export function shareCardVersion(...values){
 let hash=2166136261;
 for(const char of values.map(value=>String(value??'')).join('|')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
 return hash.toString(36);
}
export function shareCardPath(kind,id,...versionValues){
 if(!shareCardKinds.includes(kind)||!id)return null;
 return '/share/'+kind+'/'+encodeURIComponent(id)+(versionValues.length?'?v='+shareCardVersion(...versionValues):'');
}
