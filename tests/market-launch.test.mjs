import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navSections,resolveNavSections} from '../lib/navigation.js';
import {buildSitemap} from '../lib/seo.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const env={NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'https://967ye.com'};
const paths=list=>list.map(item=>new URL(item.url).pathname);

test('the market joins the menus only once its section is open',()=>{
 const market=navSections.find(section=>section.id==='market');
 assert.ok(market,'a «سوق 967» section exists');
 assert.deepEqual(market.links.map(([href])=>href),['/market','/market/new','/market/mine']);
 assert.equal(resolveNavSections({visibility:{}}).some(section=>section.id==='market'),false,'hidden by default');
 assert.equal(resolveNavSections({visibility:{market:false}}).some(section=>section.id==='market'),false);
 assert.equal(resolveNavSections({visibility:{market:true}}).some(section=>section.id==='market'),true);
});

test('the sitemap lists the market and its live listings once open',()=>{
 assert.equal(paths(buildSitemap({pageVisibility:{market:true}},env)).some(path=>path.startsWith('/market')),false,'not fetched: nothing listed');
 const empty=paths(buildSitemap({market:[],pageVisibility:{market:true}},env));
 assert.ok(empty.includes('/market')&&empty.includes('/market/terms'),'the home even with no listings yet');
 const full=paths(buildSitemap({market:[{number:12,updated_at:'2026-11-09T10:00:00Z'},{number:'x'}],pageVisibility:{market:true}},env));
 assert.ok(full.includes('/market/12'));
 assert.equal(full.filter(path=>path.startsWith('/market/')).length,2,'bad numbers are left out');
 assert.equal(paths(buildSitemap({market:[{number:12}],pageVisibility:{market:false}},env)).some(path=>path.startsWith('/market')),false,'hidden section, no market urls');
 const sitemap=read('app/sitemap.js');
 assert.match(sitemap,/if\(sectionStatus\('market',settings\)==='visible'\)\{/);
 assert.match(sitemap,/\.in\('status',\['active','reserved'\]\)\.not\('seller_id','is',null\)/);
});

test('the market privacy section goes live with the market',()=>{
 const notice=read('components/market/MarketPrivacyNotice.jsx');
 assert.match(notice,/if\(sectionStatus\('market',await getSiteSettings\(\)\)!=='visible'\)return null;/);
 for(const part of ['رقم الجوال','بيانات الكاميرا والموقع الجغرافي','Backblaze B2','للتحقق من البلاغ فقط','حساب محذوف'])assert.ok(notice.includes(part),part);
 assert.match(read('app/privacy/page.jsx'),/<MarketPrivacyNotice\/>/);
});

test('a member can remove their WhatsApp number',()=>{
 const server=read('lib/market/listingsServer.js');
 assert.match(server,/export async function removePhone\(db,user\)\{\n must\(await db\.from\('market_listings'\)\.update\(\{show_whatsapp:false\}\)/);
 assert.match(read('app/api/market/mine/route.js'),/if\(body\.action==='remove_phone'\)return marketJson\(await removePhone\(db,user\)\);/);
});

test('deleting an account archives the market listings and removes photos and the number',()=>{
 const route=read('app/api/admin/users/route.js');
 const release=route.indexOf('await releaseMarketAccount(db,target.id);'),remove=route.indexOf('await db.auth.admin.deleteUser(target.id);');
 assert.ok(release>0&&release<remove,'before the auth account goes');
 const account=read('lib/market/accountServer.js');
 assert.match(account,/update\(\{status:'archived',reserved_for:null,reserved_at:null,images:\[\],show_whatsapp:false\}\)/);
 assert.match(account,/market_seller_contacts'\)\.delete\(\)/);
 assert.match(account,/deleteImage\(imageKey\(id,size\)\)/);
 const sql=read('supabase/migrations/20261109230000_market_account_deletion.sql');
 assert.match(sql,/before update of seller_id on public\.market_listings/,'a safety net for other deletion paths');
 assert.match(sql,/new\.status:='archived'/);
});
