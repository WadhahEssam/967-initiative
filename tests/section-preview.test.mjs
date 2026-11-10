import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {previewToken,readPreviewToken} from '../lib/sectionPreviewToken.js';

const crypto={createHmac,timingSafeEqual};
const id='3f2b6c1e-8a4d-4c2b-9e1f-0a1b2c3d4e5f';
const now=Date.parse('2026-11-11T10:00:00Z');

test('a genuine preview token names its editor until it expires',()=>{
 const token=previewToken(id,now+3600e3,'secret',crypto);
 assert.equal(readPreviewToken(token,now,'secret',crypto),id);
 assert.equal(readPreviewToken(token,now+3601e3,'secret',crypto),null);
});

test('forged, tampered or unsigned preview tokens are refused',()=>{
 const token=previewToken(id,now+3600e3,'secret',crypto);
 assert.equal(readPreviewToken(token,now,'other',crypto),null);
 const [user,expires,sig]=token.split('.');
 assert.equal(readPreviewToken([user,Number(expires)+999,sig].join('.'),now,'secret',crypto),null);
 assert.equal(readPreviewToken(['00000000-0000-4000-8000-000000000000',expires,sig].join('.'),now,'secret',crypto),null);
 assert.equal(readPreviewToken(token,now,'',crypto),null);
 assert.equal(readPreviewToken('',now,'secret',crypto),null);
 assert.equal(readPreviewToken(undefined,now,'secret',crypto),null);
 assert.equal(previewToken('not-a-uuid',now,'secret',crypto),null);
 assert.equal(previewToken(id,now,'',crypto),null);
});

test('hidden pages open only through the checked preview, and only editors can start one',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const server=read('lib/sectionPreview.js');
 assert.match(server,/from\('editors'\)/);
 assert.match(server,/if\(sectionGate\(id,settings\)\)return 'visible'/);
 const route=read('app/api/admin/section-preview/route.js');
 assert.match(route,/authorizeEditorRequest/);
 assert.match(route,/HttpOnly; SameSite=Lax/);
 for(const path of ['app/market/layout.jsx','app/services/page.jsx','app/services/exchange-rates/page.jsx','app/services/food-prices/page.jsx','app/transactions/page.jsx','app/transactions/[slug]/page.jsx'])
  assert.match(read(path),/if\(!access\)notFound\(\);/,path);
 // Entry pages stay open without the preview.
 for(const path of ['app/services/exchange-rates/update/page.jsx','app/services/food-prices/update/page.jsx','app/transactions/studio/page.jsx'])
  assert.ok(!read(path).includes('sectionAccess'),path);
});
