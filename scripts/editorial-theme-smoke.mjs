// Run with playwright temporarily installed in CI; no extra production dependency.
// LOCAL_CONTENT_FALLBACK=1 is used by the workflow: no credentials are required.
// This checks the *rendered* UI rather than treating source text as a visual test.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3129';
const output='docs/audit/editorial/';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const sizes=[320,375,1440];
const results=[];

try{
 for(const width of sizes){
  // Owner decision (2026-11-11): dark is the default on every device; a visitor may pick light.
  const osDark=await browser.newContext({viewport:{width,height:860},colorScheme:'dark'});
  const osPage=await osDark.newPage();
  await osPage.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await osPage.locator('.ed-page').waitFor({timeout:30000});
  assert.equal(await osPage.evaluate(()=>document.documentElement.dataset.edTheme),'dark',width+' should be dark on a dark device');
  await osDark.close();
  const context=await browser.newContext({viewport:{width,height:860},colorScheme:'light'});
  const page=await context.newPage();
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.ed-page').waitFor({timeout:30000});
  // The switch lives in the footer (and the menu sheet), labelled «الوضع الداكن» with aria-pressed.
  const switcher=page.locator('.ed-footer .ed-theme-switch');
  await switcher.waitFor({timeout:15000});
  const pressed=value=>page.locator('.ed-footer .ed-theme-switch[aria-pressed="'+value+'"]').waitFor({timeout:15000});
  const readTheme=()=>page.evaluate(()=>{
   const r=document.documentElement,s=getComputedStyle(r);
   return {mode:r.dataset.edTheme,scheme:s.colorScheme,background:s.getPropertyValue('--c-bg').trim(),overflow:document.documentElement.scrollWidth-window.innerWidth};
  });
  await pressed('true');
  const dark=await readTheme();
  assert.equal(dark.mode,'dark',width+' should default to dark on a light device too');
  assert.equal(dark.scheme,'dark');
  assert.equal(dark.background.toLowerCase(),'#13110f');
  assert.ok(dark.overflow<=2,'home horizontal overflow at '+width+': '+dark.overflow);
  await page.screenshot({path:output+'dark-'+width+'.png',fullPage:true});
  await switcher.click();
  await pressed('false');
  const light=await readTheme();
  assert.equal(light.mode,'light');
  assert.equal(light.background.toLowerCase(),'#f3efe8');
  await page.screenshot({path:output+'light-'+width+'.png',fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await pressed('false');
  assert.equal((await readTheme()).mode,'light','a picked light theme must persist after reload');
  await page.locator('.ed-footer .ed-theme-switch').click();
  await pressed('true');
  await page.goto(base+'/yemen-history',{waitUntil:'domcontentloaded'});
  await page.locator('[data-knowledge-area="history"]').waitFor({timeout:30000});
  const legacy=await readTheme();
  assert.equal(legacy.background.toLowerCase(),'#13110f','legacy pages now use the shared dark palette');
  assert.equal(legacy.scheme,'dark','legacy route must retain dark system controls');
  results.push({width,light,dark,legacy:legacy.background});
  await context.close();
 }
 console.log(JSON.stringify({ok:true,checks:results},null,2));
}finally{
 await browser.close();
}
