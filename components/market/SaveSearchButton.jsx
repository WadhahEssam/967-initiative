'use client';
import {useState} from 'react';
import Link from 'next/link';
import {BellPlus,Check} from 'lucide-react';
import {loginHref,marketApi,marketSession} from '@/lib/market/clientApi';
import styles from './Market.module.css';

// «احفظ هذا البحث»: the member is told when a new listing matches it.
export default function SaveSearchButton({query}){
 const [state,setState]=useState('idle');
 const [error,setError]=useState('');
 const save=async()=>{
  if(!await marketSession()){location.href=loginHref();return;}
  setState('busy');setError('');
  try{await marketApi('/api/market/saved-searches',{method:'POST',body:{query}});setState('saved');}
  catch(e){setError(e.message);setState('idle');}
 };
 if(state==='saved')return <p className={styles.savedNote} role="status"><Check size={16} aria-hidden="true"/> حُفظ البحث. <Link href="/market/saved-searches">بحوثي المحفوظة</Link></p>;
 return <div className={styles.saveSearch}>
  <button type="button" className={styles.saveSearchButton} onClick={save} disabled={state==='busy'}><BellPlus size={16} aria-hidden="true"/> احفظ هذا البحث</button>
  {error&&<small role="alert">{error}</small>}
 </div>;
}
