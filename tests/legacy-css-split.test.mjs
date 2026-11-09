import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildAll,classTokens,legacyLayouts,pruneCss,selectorUsed} from '../scripts/build-legacy-css.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('class names are found in strings, template expressions and composed class lists',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'legacy-css-'));
 const file=path.join(dir,'a.jsx');
 writeFileSync(file,"const a=<div className={`reading-save${compact?' reading-save-compact':''}`}/>;\nconst b=`brand-logo ${light?'brand-logo-light':''}`;\nconst c='ymap-'+kind;\nconst d=\"btn btn-outline\";");
 const tokens=classTokens([file]);
 for(const name of ['reading-save','reading-save-compact','brand-logo','brand-logo-light','ymap-','btn','btn-outline'])assert.ok(tokens.has(name),name);
});

test('a selector is kept only when all its classes can appear',()=>{
 const tokens=new Set(['card','title','ymap-']);
 assert.ok(selectorUsed('.card .title',tokens));
 assert.ok(selectorUsed('body',tokens),'element selectors stay');
 assert.ok(selectorUsed('.card:not(.missing)',tokens),'classes inside :not() are optional');
 assert.ok(selectorUsed('.ymap-panel',tokens),'prefix tokens cover composed names');
 assert.ok(selectorUsed('.lucide-arrow',tokens),'icon classes added by libraries');
 assert.ok(!selectorUsed('.card .missing',tokens));
 const css=pruneCss('.card{a:1}.gone{b:2}@media (max-width:5px){.gone{c:3}}@keyframes x{from{d:4}}.card,.gone{e:5}',tokens,'test.css');
 assert.match(css,/\.card\{a:1\}/);
 assert.doesNotMatch(css,/\.gone/);
 assert.doesNotMatch(css,/@media/,'empty media blocks are removed');
 assert.match(css,/@keyframes x/);
 assert.match(css,/\.card\{e:5\}/);
});

test('every generated route stylesheet is up to date with the sources',()=>{
 for(const output of buildAll()){
  const current=readFileSync(output.file,'utf8').replace(/\r\n/g,'\n');
  assert.equal(current,output.css,'run node scripts/build-legacy-css.mjs ('+path.basename(output.file)+')');
 }
});

test('public route layouts load their own subset; editors keep the full bundle',()=>{
 const layouts=legacyLayouts();
 assert.ok(layouts.length>=29);
 for(const layout of layouts){
  const source=readFileSync(layout,'utf8');
  assert.match(source,/^import '@\/app\/legacy\/[\w-]+\.css';/m,layout);
  assert.doesNotMatch(source,/legacy-styles/,layout);
 }
 assert.match(read('app/admin/layout.jsx'),/legacy-styles/);
});
