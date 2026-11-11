'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';

const KEY='967-editorial-theme';
const current=()=>document.documentElement.dataset.edTheme==='light'?'light':'dark';

// Dark is the default for everyone (owner, 2026-11-11); a visitor who picks light keeps it.
// The saved choice is applied by a tiny script in <head> before paint.
// It lives in the menu and the footer (with its label), not in the crowded header bar.
export default function ThemeToggle({labelled=false,className=''}){
 const [theme,setTheme]=useState('dark');

 useEffect(()=>{
  const sync=()=>setTheme(current());
  sync();
  const onStorage=event=>{
   if(event.key!==KEY)return;
   const next=event.newValue==='light'?'light':'dark';
   document.documentElement.dataset.edTheme=next;
   setTheme(next);
  };
  window.addEventListener('storage',onStorage);
  return()=>window.removeEventListener('storage',onStorage);
 },[]);

 const toggle=()=>{
  const next=current()==='dark'?'light':'dark';
  document.documentElement.dataset.edTheme=next;
  setTheme(next);
  try{window.localStorage.setItem(KEY,next);}catch{/* Browser storage may be blocked. */}
 };

 const dark=theme==='dark';
 // The labelled switch keeps one name and reports its state with aria-pressed.
 const label=labelled?'الوضع الداكن':dark?'الوضع الفاتح':'الوضع الداكن';
 return <button type="button" className={(labelled?'ed-theme-switch':'ed-tool ed-theme-toggle')+(className?' '+className:'')}
  aria-label={labelled?undefined:(dark?'تفعيل الوضع الفاتح':'تفعيل الوضع الداكن')}
  title={labelled?undefined:label} aria-pressed={dark}
  onClick={toggle}>
  {dark?<Sun size={labelled?17:20} aria-hidden="true"/>:<Moon size={labelled?17:20} aria-hidden="true"/>}
  {labelled&&<span>{label}</span>}
 </button>;
}
