import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(root,file),'utf8');

// Files the browser bundle reaches through static imports: everything imported from a
// 'use client' file, or from code that is already in the browser (dynamic import() is not
// followed). Server-only files may use the client freely; they never reach the browser.
function staticImports(start){
 const seen=new Set(),client=new Set();
 const resolve=(from,spec)=>{
  const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):spec.startsWith('.')?path.join(path.dirname(from),spec):null;
  if(!base)return null;
  for(const ext of ['','.js','.jsx','/index.js','/index.jsx']){const file=base+ext;if(existsSync(file)&&statSync(file).isFile())return file;}
  return null;
 };
 const walk=(file,inBrowser)=>{
  const source=readFileSync(file,'utf8');
  const browser=inBrowser||/^\s*['"]use client['"]/.test(source);
  const key=file+(browser?'#client':'');
  if(seen.has(key))return;seen.add(key);
  if(browser)client.add(file);
  for(const match of source.matchAll(/^\s*(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm)){const next=resolve(file,match[1]);if(next)walk(next,browser);}
 };
 walk(path.join(root,start),false);
 return [...client].map(file=>path.relative(root,file).split(path.sep).join('/'));
}

test('the account client is not part of the code every page loads',()=>{
 const files=staticImports('app/layout.jsx');
 assert.ok(files.includes('components/Header.jsx'));
 assert.ok(!files.includes('lib/supabase.js'),'lib/supabase.js must load on demand (lib/browserSession.js)');
});

test('common pages load the account client only when a session may exist',()=>{
 for(const page of ['app/page.jsx','app/market/page.jsx','app/market/[number]/page.jsx','app/yemeni-figures/page.jsx','app/universities/page.jsx','app/games/page.jsx','app/school/page.jsx','app/about/page.jsx'])
  assert.ok(!staticImports(page).includes('lib/supabase.js'),page);
 const lazy=read('lib/browserSession.js');
 assert.match(lazy,/import\('\.\/supabase'\)/);
 assert.match(lazy,/if\(window\.__967BrowserDb\)return true;/);
 assert.match(read('lib/supabase.js'),/window\.__967BrowserDb=true;window\.dispatchEvent\(new Event\('967:auth-ready'\)\)/);
 const audience=read('components/debates/useAudience.js');
 assert.ok(audience.includes("window.addEventListener('967:auth-ready',connect)"),'signing in on the page connects');
 assert.ok(audience.includes('if(browserMayBeSignedIn())connect();'));
});

test('the session hint covers saved sessions and sign-in links',async()=>{
 const {browserSessionMayExist}=await import('../lib/sessionHint.js');
 const url='https://abcd.supabase.co';
 const storage=value=>({getItem:key=>key==='sb-abcd-auth-token'?value:null});
 assert.equal(browserSessionMayExist(url,storage(null),'https://967ye.com/'),false);
 assert.equal(browserSessionMayExist(url,storage('{}'),'https://967ye.com/'),true);
 assert.equal(browserSessionMayExist(url,storage(null),'https://967ye.com/auth/callback?code=x'),true);
 assert.equal(browserSessionMayExist(url,storage(null),'https://967ye.com/#access_token=x'),true);
});

test('lighter fonts are served and match the subset ranges',()=>{
 const css=read('app/fonts.css'),script=read('scripts/optimize-fonts.py'),layout=read('app/layout.jsx');
 const ranges=script.match(/ARABIC = '([^']+)'/)[1].split(',').join(', ');
 for(const file of ['plex-arabic-400-web','plex-arabic-600-web','plex-latin-400-web','plex-latin-600-web','markazi-arabic-web']){
  assert.ok(existsSync(path.join(root,'public/fonts',file+'.woff2')),file);
  assert.ok(css.includes('/fonts/'+file+'.woff2'),file);
 }
 assert.equal(css.split('unicode-range: '+ranges+';').length-1,3,'the three Arabic faces use the subset ranges');
 assert.ok(layout.includes('href="/fonts/plex-arabic-400-web.woff2"'));
 assert.ok(statSync(path.join(root,'public/fonts/plex-arabic-400-web.woff2')).size<30000);
});
