// Audit built Next.js pages in Chromium without user credentials or writes.
// A rendered page audit is not proof that authenticated routes work.
import {chromium} from 'playwright';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';

const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3133';
const output='docs/audit/dark-20261103/browser';
const widths=[320,1440];
const screenshotRoutes=new Set(['/','/login','/register','/account','/admin','/admin/tasks','/school','/games','/games/quiz','/debates','/magazine','/yemen-history','/yemen-in-numbers','/yemen-ranking','/yemen-map','/universities','/medical-centers','/search','/works']);
async function walk(dir='app'){
 const list=await readdir(dir,{withFileTypes:true}),found=[];
 for(const item of list) {
  if(item.isDirectory())found.push(...await walk(join(dir,item.name)));
  else if(/^page\.(js|jsx|tsx|ts)$/.test(item.name))found.push('/'+relative('app',dir).split('/').filter(x=>x!=='.').join('/'));
 }
 return found;
}
const templates=(await walk()).sort();
const normal=templates.filter(x=>!x.includes('['));
const dynamic=templates.filter(x=>x.includes('['));
const report={date:new Date().toISOString(),scope:'Built app, local fallback content, NOT live 967ye.com',templates:templates.length,staticRoutes:normal.length,dynamicTemplates:dynamic.length,checks:[],dynamicCoverage:{},summary:{}};
const links=new Set();
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
function safe(s){return (s==='/'?'home':s.slice(1).replaceAll('/','-')).replace(/[^a-z0-9_-]/gi,'_').slice(0,80)}
function fits(template,url) {
 const expression='^'+template.split('/').map(p=>p.startsWith('[')?'[^/]+':p.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&')).join('/')+'$';
 return new RegExp(expression).test(url);
}
async function check(page,route,width){
 const item={route,width,status:'unvisited',modes:[],errors:[]};
 try{
  const response=await page.goto(base+route,{timeout:35000,waitUntil:'domcontentloaded'});
  await page.waitForTimeout(200);
  item.http=response?.status()??null;
  item.finalPath=new URL(page.url()).pathname;
  if(item.http>=400){item.status='http-error';return item}
  if(item.finalPath!==route){item.status='redirected';return item}
  const paths=await page.locator('a[href^="/"]').evaluateAll(els=>els.map(x=>x.getAttribute('href')).filter(Boolean));
  for(const path of paths){try{links.add(new URL(path,base).pathname)}catch{}}
  item.status='rendered';
  for(const mode of ['light','dark']){
   await page.evaluate(mode=>{document.documentElement.dataset.edTheme=mode},mode);
   await page.waitForTimeout(130);
   const details=await page.evaluate(()=>{
    const root=document.documentElement,cs=getComputedStyle(root);
    const parse=c=>{
     const m=c.match(/^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)$/);
     return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;
    };
    const blend=(a,b)=>[a[0]*a[3]+b[0]*(1-a[3]),a[1]*a[3]+b[1]*(1-a[3]),a[2]*a[3]+b[2]*(1-a[3]),1];
    const bg=e=>{
     const colors=[];for(let i=0;e&&i<28;i++,e=e.parentElement){
      const s=getComputedStyle(e);
      if(s.backgroundImage!=='none')return null;
      const v=parse(s.backgroundColor);
      if(v&&v[3]>0){colors.push(v);if(v[3]===1)break}
     }
     if(!colors.length||colors[colors.length-1][3]<1)colors.push([255,255,255,1]);
     return colors.reverse().reduce((x,y)=>blend(y,x),[255,255,255,1]);
    };
    const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{let x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const visible=e=>{
      if(e.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
      // Chromium may report a positive bounding box for collapsed <details>
      // descendants even though their text is not painted.
      for(let p=e.parentElement;p;p=p.parentElement){
       if(p.tagName==='DETAILS'&&!p.open&&!(p.querySelector(':scope > summary')?.contains(e)))return false;
      }
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&r.width>3&&r.height>3;
    };
    const issues=[];let evaluated=0,skipped=0;
    const els=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,label,small,strong,li,th,td,summary,input,textarea,select')].slice(0,4500);
    for(const el of els){
     if(!visible(el))continue;
     const isField=['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
     // Non-text input controls (sliders etc.) have no visible text; their
     // numeric value should not be treated as painted foreground glyphs.
     if(el.tagName==='INPUT'&&['range','checkbox','radio','color','file','hidden'].includes(el.type))continue;
     if(!isField&&![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
     const st=getComputedStyle(el),c=parse(st.color),b=bg(el);
     if(!c||!b){skipped++;continue}
     evaluated++;
     const size=parseFloat(st.fontSize)||16,weight=parseInt(st.fontWeight)||400;
     const threshold=size>=24||(size>=18.66&&weight>=700)?3:4.5;
     const value=ratio(c,b);
     if(value+0.001<threshold&&issues.length<40){
      issues.push({ratio:+value.toFixed(2),target:el.tagName+'.'+(typeof el.className==='string'?el.className.split(/\s+/).slice(0,2).join('.'):''),
       text:(el.innerText||el.textContent||el.value||el.getAttribute('aria-label')||'').trim().slice(0,55),
       context:[el.parentElement,el.parentElement?.parentElement].filter(Boolean).map(p=>p.tagName.toLowerCase()+(typeof p.className==='string'?'.'+p.className.trim().split(/\s+/).slice(0,2).join('.'):'' )).join(' < '),
       fg:st.color,bg:'rgb('+b.slice(0,3).map(v=>Math.round(v)).join(',')+')'});
     }
    }
    return {mode:root.dataset.edTheme,colorScheme:cs.colorScheme,bg:cs.getPropertyValue('--c-bg').trim(),
      overflow:root.scrollWidth-innerWidth,contrast:issues,contrastChecked:evaluated,skipped,
      toggle:!!document.querySelector('.ed-theme-toggle,.ed-theme-switch'),title:document.title};
   });
   item.modes.push(details);
   if(details.mode!==mode)item.errors.push('Wrong theme '+mode);
   if(mode==='dark'&&!details.colorScheme.includes('dark'))item.errors.push('Missing dark color-scheme');
   if(width===320&&mode==='dark'&&screenshotRoutes.has(route)){
    await page.screenshot({path:output+'/'+safe(route)+'-dark-320.png',fullPage:route==='/'});
   }
  }
 }catch(e){item.status='exception';item.errors.push(String(e).slice(0,500))}
 return item;
}
try{
 const contexts=await Promise.all(widths.map(w=>browser.newContext({viewport:{width:w,height:900},reducedMotion:'reduce',colorScheme:'light'})));
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 for(let i=0;i<normal.length;i++){
  for(let n=0;n<widths.length;n++) {
   const item=await check(pages[n],normal[i],widths[n]);report.checks.push(item);
   const issues=item.modes.reduce((k,v)=>k+v.contrast.length,0);
   if(item.status!=='rendered'||issues>4||item.modes.some(v=>v.overflow>3))console.log('AUDIT_ROUTE '+JSON.stringify({route:item.route,width:item.width,status:item.status,errors:item.errors,contrast:issues,overflow:item.modes.map(v=>v.overflow)}));
  }
  if((i+1)%10===0)console.log('PROGRESS '+(i+1)+'/'+normal.length);
 }
 for(const template of dynamic){
  const candidates=[...links].filter(path=>fits(template,path)&&!normal.includes(path));
  if(!candidates.length){report.dynamicCoverage[template]='unsampled:no-public-link';continue}
  const route=candidates[0];report.dynamicCoverage[template]=route;
  for(let n=0;n<widths.length;n++)report.checks.push(await check(pages[n],route,widths[n]));
 }
 await Promise.all(contexts.map(c=>c.close()));
}finally{await browser.close()}
const checks=report.checks;
report.summary={templates:report.templates,staticRoutes:normal.length,dynamicTemplates:dynamic.length,
 rendered:checks.filter(x=>x.status==='rendered').length,total:checks.length,
 redirect:checks.filter(x=>x.status==='redirected').length,
 error:checks.filter(x=>['exception','http-error'].includes(x.status)).length,
 noSample:dynamic.filter(x=>report.dynamicCoverage[x]?.startsWith('unsampled')),
 contrastWarnings:checks.reduce((k,x)=>k+x.modes.reduce((a,v)=>a+v.contrast.length,0),0),
 overflow:checks.filter(x=>x.modes.some(m=>m.overflow>3)).map(x=>({route:x.route,width:x.width,overflow:x.modes.map(m=>m.overflow)}))};
await writeFile(output+'/audit-results.json',JSON.stringify(report,null,2));
const ranked=checks.map(x=>({route:x.route,width:x.width,status:x.status,
  warnings:x.modes.flatMap(m=>m.contrast.map(z=>({...z,mode:m.mode}))),errors:x.errors}))
 .sort((a,b)=>b.warnings.length-a.warnings.length).slice(0,32)
 .map(x=>({...x,warnings:x.warnings.slice(0,10)}));
console.log('AUDIT_SUMMARY '+JSON.stringify(report.summary));
console.log('AUDIT_TOP '+JSON.stringify(ranked));
console.log('AUDIT_JSON '+output+'/audit-results.json');
