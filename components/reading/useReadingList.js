'use client';

import {useSyncExternalStore} from 'react';
import {currentSession} from '@/lib/browserSession';
import {audienceRequest} from '@/components/debates/useAudience';
import {parseReadingList, readingContentItem, READING_LIST_KEY, READING_LIST_LIMIT} from '@/lib/readingList';

const CHANGE_EVENT = '967:reading-list-change';
const SERVER = {items:[], ready:false, available:true};
let cachedRaw = Symbol('unread');
let cachedSnapshot = SERVER;

function getSnapshot() {
  let raw;
  try { raw = localStorage.getItem(READING_LIST_KEY); }
  catch {
    if (cachedRaw !== false) { cachedRaw = false;cachedSnapshot = {items:[],ready:true,available:false}; }
    return cachedSnapshot;
  }
  if (raw !== cachedRaw) { cachedRaw = raw;cachedSnapshot = {items:parseReadingList(raw),ready:true,available:true}; }
  return cachedSnapshot;
}

function subscribe(listener) {
  const storage = event => {if (event.key === READING_LIST_KEY || event.key === null) listener();};
  window.addEventListener('storage', storage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {window.removeEventListener('storage', storage);window.removeEventListener(CHANGE_EVENT, listener);};
}

// Saving locally remains usable offline. When signed in, persist the specific
// user-initiated change to the private account library. Existing anonymous items
// are never silently imported into a possibly different person's account.
function mirrorToAccount(body) {
 // currentSession() skips loading the account client for visitors who never signed in.
 currentSession().then(session=>{
  if(session)return audienceRequest('/api/account/workspace',body);
 }).catch(()=>{ /* Local copy remains; account offers explicit import. */ });
}
function write(items) {
  localStorage.setItem(READING_LIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleReadingItem(value) {
  const item = readingContentItem(value);
  if (!item) throw new Error('تعذر حفظ هذا المحتوى.');
  const current = parseReadingList(localStorage.getItem(READING_LIST_KEY));
  if (current.some(entry => entry.href === item.href)) {
   write(current.filter(entry => entry.href !== item.href));
   mirrorToAccount({action:'remove',href:item.href,kind:item.kind,title:item.title});
   return false;
  }
  if (current.length >= READING_LIST_LIMIT) throw new Error('قائمتك تضم 100 عنصر. أزل عنصراً قبل حفظ محتوى جديد.');
  write([item,...current]);
  mirrorToAccount({action:'save',item});
  return true;
}

export function removeReadingItem(href) {
  const current=parseReadingList(localStorage.getItem(READING_LIST_KEY));
  const item=current.find(x=>x.href===href);
  write(current.filter(entry=>entry.href!==href));
  if(item)mirrorToAccount({action:'remove',href:item.href,kind:item.kind,title:item.title});
}

export default function useReadingList() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
