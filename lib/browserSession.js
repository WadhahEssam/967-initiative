'use client';
import {browserSessionMayExist} from './sessionHint';

// The Supabase browser client (about 65 KB compressed) loads only when needed. A visitor who has
// never signed in reads pages without downloading it; it loads as soon as a session may exist,
// another part of the page starts it, or the visitor signs in. Protected APIs still check the
// session on the server.
export const loadBrowserDb=()=>import('./supabase').then(module=>module.browserDb());

// True when this browser may hold a session (saved token or a sign-in link in the address), or
// the client already runs on this page (lib/supabase.js sets window.__967BrowserDb).
export function browserMayBeSignedIn(){
 if(typeof window==='undefined')return false;
 if(window.__967BrowserDb)return true;
 try{return browserSessionMayExist(process.env.NEXT_PUBLIC_SUPABASE_URL,localStorage,location.href);}catch{return true;}
}

// The current session, or null, without loading the client for a visitor who never signed in.
export async function currentSession(){
 if(!browserMayBeSignedIn())return null;
 const db=await loadBrowserDb();
 if(!db)return null;
 const {data,error}=await db.auth.getSession();
 return error?null:data.session||null;
}

// Runs `start(db)` once the client is available: now if a session may exist, otherwise when the
// visitor signs in on this page (967:auth-ready) or in another tab (storage). Returns a cleanup.
export function whenBrowserDb(start){
 let live=true,started=false,cleanup=null;
 const connect=()=>{if(started)return;started=true;loadBrowserDb().then(db=>{if(live&&db)cleanup=start(db)||null;}).catch(()=>{started=false;});};
 const storage=event=>{if(event.key===null||String(event.key).endsWith('-auth-token'))connect();};
 if(browserMayBeSignedIn())connect();
 window.addEventListener('967:auth-ready',connect);window.addEventListener('storage',storage);
 return()=>{live=false;window.removeEventListener('967:auth-ready',connect);window.removeEventListener('storage',storage);if(typeof cleanup==='function')cleanup();};
}
