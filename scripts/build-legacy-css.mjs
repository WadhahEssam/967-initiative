#!/usr/bin/env node
// Splits the legacy stylesheet bundle (app/legacy-styles.js, ~200 KB) into one file per route
// layout that keeps only the rules that route can use.
//
// How: from each route's layout we follow imports (@/…, ./…) through app/, components/ and lib/,
// collect every word that appears in string literals (class names live there), and keep a CSS
// rule when every class in at least one of its selectors appears in that set. Rules without
// classes (elements, :root, @font-face, @keyframes) are always kept, in the original order.
//
// Run:   node scripts/build-legacy-css.mjs          (writes app/legacy/*.css)
//        node scripts/build-legacy-css.mjs --check  (fails if a file is out of date)
// Re-run it after adding or renaming a class that the legacy sheets style.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel=file=>path.relative(root,file).split(path.sep).join('/');
const check=process.argv.includes('--check');

// The legacy sheets in their cascade order, read from app/legacy-styles.js.
export function legacySheets(){
 const source=readFileSync(path.join(root,'app/legacy-styles.js'),'utf8');
 return [...source.matchAll(/^import '\.\/([^']+\.css)';/gm)].map(match=>path.join(root,'app',match[1]));
}

// Route layouts that import the bundle or their generated subset. Editors' screens keep the full bundle.
const FULL_BUNDLE=new Set(['app/admin/layout.jsx','app/design-system/layout.jsx']);
export function legacyLayouts(){
 const found=[];
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='api'&&entry.name!=='legacy')walk(file);}else if(/^layout\.jsx?$/.test(entry.name)&&/^import '@\/app\/legacy(-styles|\/[\w-]+\.css)';/m.test(readFileSync(file,'utf8')))found.push(file);}};
 walk(path.join(root,'app'));
 return found.filter(file=>!FULL_BUNDLE.has(rel(file))).sort();
}

const EXTENSIONS=['.jsx','.js','.mjs'];
const isFile=file=>{try{return statSync(file).isFile();}catch{return false;}};
function resolveImport(from,specifier){
 let base;
 if(specifier.startsWith('@/'))base=path.join(root,specifier.slice(2));
 else if(specifier.startsWith('.'))base=path.resolve(path.dirname(from),specifier);
 else return null;
 for(const candidate of [base,...EXTENSIONS.map(ext=>base+ext),...EXTENSIONS.map(ext=>path.join(base,'index'+ext))])
  if(EXTENSIONS.includes(path.extname(candidate))&&isFile(candidate))return candidate;
 return null;
}
const IMPORT=/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

// Every file a route can render: its own folder (pages, nested layouts, local components),
// the root layout, and everything they import.
export function routeFiles(layout){
 const dir=path.dirname(layout),seen=new Set(),queue=[path.join(root,'app/layout.jsx'),path.join(root,'app/not-found.jsx'),path.join(root,'app/error.jsx')];
 const walk=folder=>{for(const entry of readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else if(EXTENSIONS.includes(path.extname(entry.name)))queue.push(file);}};
 walk(dir);
 while(queue.length){
  const file=queue.pop();
  if(seen.has(file)||!existsSync(file))continue;
  seen.add(file);
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(IMPORT)){const target=resolveImport(file,match[1]||match[2]||match[3]||match[4]);if(target&&!seen.has(target))queue.push(target);}
 }
 return [...seen];
}

// Words in string and template literals. Class names are always written in one of those.
export function classTokens(files){
 const tokens=new Set();
 for(const file of files){
  const source=readFileSync(file,'utf8');
  for(const match of source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)){
   // Template expressions are kept: they often hold the class, as in `${light?'brand-logo-light':''}`.
   const text=match[1]??match[2]??match[3]??'';
   for(const word of text.split(/[\s,()[\]{}:;+=<>!?|&*/'"`$.#@%^~\\]+/))if(/^-?[A-Za-z_][\w-]*$/.test(word))tokens.add(word);
  }
 }
 return tokens;
}

// Classes that other code adds without writing them in our sources.
const ALWAYS=[/^lucide/,/^leaflet-/,/^maplibregl-/,/^sr-only$/,/^js-/,/^is-/,/^has-/];
const classesOf=selector=>{
 // Classes inside :not(), :is(), :where() and :has() do not have to be present.
 let plain=selector,previous;
 do{previous=plain;plain=plain.replace(/:(not|is|where|has)\((?:[^()]|\([^()]*\))*\)/g,'');}while(plain!==previous);
 return [...plain.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(match=>match[1]);
};
export function selectorUsed(selector,tokens){
 const prefixes=[...tokens].filter(token=>/[-_]$/.test(token));
 return classesOf(selector).every(name=>tokens.has(name)||ALWAYS.some(pattern=>pattern.test(name))||prefixes.some(prefix=>name.startsWith(prefix)&&name.length>prefix.length));
}

export function pruneCss(css,tokens,from){
 const tree=postcss.parse(css,{from});
 tree.walkRules(rule=>{
  if(rule.parent?.type==='atrule'&&/keyframes$/i.test(rule.parent.name))return;
  const kept=rule.selectors.filter(selector=>selectorUsed(selector,tokens));
  if(!kept.length)rule.remove();else if(kept.length!==rule.selectors.length)rule.selectors=kept;
 });
 let changed=true;
 while(changed){changed=false;tree.walkAtRules(atRule=>{if(atRule.nodes&&!atRule.nodes.length){atRule.remove();changed=true;}});}
 tree.walkComments(comment=>comment.remove());
 return tree.toString().replace(/\n{3,}/g,'\n\n').trim()+'\n';
}

export const outputName=layout=>{
 const route=rel(path.dirname(layout)).replace(/^app\/?/,'')||'root';
 return route.replace(/\[([^\]]+)\]/g,'$1').replace(/[\\/]/g,'--')+'.css';
};

export function buildAll(){
 const sheets=legacySheets().map(file=>({file,css:readFileSync(file,'utf8')}));
 return legacyLayouts().map(layout=>{
  const tokens=classTokens(routeFiles(layout));
  const body=sheets.map(sheet=>{const kept=pruneCss(sheet.css,tokens,sheet.file).trim();return kept?'/* '+rel(sheet.file)+' */\n'+kept:'';}).filter(Boolean).join('\n\n');
  const header='/* Generated by scripts/build-legacy-css.mjs for '+rel(layout)+'. Do not edit by hand:\n   change the legacy sheets or the route, then run the script again. */\n';
  // Line endings differ between Windows checkouts and CI; the output always uses \n.
  return {layout,file:path.join(root,'app/legacy',outputName(layout)),css:(header+body+'\n').replace(/\r\n?/g,'\n')};
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const outputs=buildAll();
 const stale=[];
 if(!check)mkdirSync(path.join(root,'app/legacy'),{recursive:true});
 for(const output of outputs){
  const current=existsSync(output.file)?readFileSync(output.file,'utf8').replace(/\r\n/g,'\n'):null;
  if(check){if(current!==output.css)stale.push(rel(output.file));continue;}
  if(current!==output.css)writeFileSync(output.file,output.css);
 }
 const full=legacySheets().reduce((sum,file)=>sum+readFileSync(file,'utf8').length,0);
 for(const output of outputs)console.log(String(Math.round(output.css.length/1024)).padStart(4)+' KB  '+rel(output.file)+'  ('+rel(output.layout)+')');
 console.log('full bundle: '+Math.round(full/1024)+' KB');
 if(stale.length){console.error('Out of date, run node scripts/build-legacy-css.mjs:\n'+stale.join('\n'));process.exit(1);}
}
