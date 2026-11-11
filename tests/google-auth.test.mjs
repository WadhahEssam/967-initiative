import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {googleRedirectTo,googleSignInEnabled,rememberGoogleTerms,takeGoogleTerms,termsProfileUpdate} from '../lib/googleAuth.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};

// «المتابعة بحساب Google» (owner, 2026-11-12).
test('the button appears only when Supabase reports Google as enabled',async()=>{
 const reply=body=>async()=>({ok:true,json:async()=>body});
 assert.equal(await googleSignInEnabled({url:'https://x.supabase.co',key:'k',fetcher:reply({external:{google:true}}),storage:memory()}),true);
 assert.equal(await googleSignInEnabled({url:'https://x.supabase.co',key:'k',fetcher:reply({external:{google:false}}),storage:memory()}),false);
 assert.equal(await googleSignInEnabled({url:'https://x.supabase.co',key:'k',fetcher:async()=>{throw Error('offline');},storage:memory()}),false);
 assert.equal(await googleSignInEnabled({url:'',key:'',storage:memory()}),false);
 let calls=0;const storage=memory();const counting=async()=>{calls++;return {ok:true,json:async()=>({external:{google:true}})};};
 await googleSignInEnabled({url:'https://x.supabase.co',key:'k',fetcher:counting,storage});
 assert.equal(await googleSignInEnabled({url:'https://x.supabase.co',key:'k',fetcher:counting,storage}),true);
 assert.equal(calls,1,'checked once per tab');
});

test('returns to the callback, then to the page the visitor came from',()=>{
 assert.equal(googleRedirectTo('https://967ye.com','/market/12?x=1'),'https://967ye.com/auth/callback?provider=google&next=%2Fmarket%2F12%3Fx%3D1');
 assert.equal(googleRedirectTo('https://967ye.com',''),'https://967ye.com/auth/callback?provider=google&next=%2Faccount');
});

test('the terms agreed before leaving are recorded once, for new accounts only',()=>{
 const storage=memory();
 rememberGoogleTerms(storage,1000);
 assert.equal(takeGoogleTerms(storage,1000+60000),true);
 assert.equal(takeGoogleTerms(storage,1000+60000),false,'used once');
 rememberGoogleTerms(storage,1000);
 assert.equal(takeGoogleTerms(storage,1000+31*60000),false,'too old');
 assert.deepEqual(termsProfileUpdate({display_name:'أحمد علي',avatar_url:'https://x/a.png',show_avatar:true,terms_accepted_at:null}),
  {action:'profile',data:{display_name:'أحمد علي',avatar_url:'https://x/a.png',show_avatar:true,accepted:true}});
 assert.equal(termsProfileUpdate({display_name:'أحمد',terms_accepted_at:'2026-11-01T00:00:00Z'}),null,'existing members untouched');
 assert.equal(termsProfileUpdate(null),null);
 assert.equal(termsProfileUpdate({display_name:'x',terms_accepted_at:null}),null);
});

test('wired into sign-in and sign-up, finished on the callback page',()=>{
 const auth=read('components/debates/AudienceAuth.jsx');
 assert.ok(auth.includes("{['login','register'].includes(mode)&&<GoogleSignIn db={db} next={next} termsAvailable={termsAvailable}"));
 assert.ok(auth.includes("if(mode==='callback'&&params.get('provider')==='google')await finishGoogleSignIn();"));
 const button=read('components/debates/GoogleSignIn.jsx');
 assert.ok(button.includes("signInWithOAuth({provider:'google'"));
 assert.ok(button.includes('rememberGoogleTerms();'));
 assert.ok(button.includes('if(!enabled||!db)return null;'));
 assert.ok(button.includes('شروط الاستخدام'));
 // No Google keys in the site: Supabase holds them.
 for(const file of ['lib/googleAuth.js','components/debates/GoogleSignIn.jsx'])assert.ok(!/GOOGLE_CLIENT|client_secret/i.test(read(file)),file);
});
