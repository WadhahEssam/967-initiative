'use client';
import {useId,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Search,X} from 'lucide-react';
import {suggestions} from '@/lib/market/search';
import styles from './Market.module.css';

// The market's search box. A plain GET form (it works before the page's script loads), with
// suggestions from the catalogue while typing. `keep` holds the filters a new search keeps.
export default function MarketSearchBar({initial='',keep={},autoFocus=false}){
 const router=useRouter();
 const [query,setQuery]=useState(initial);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(-1);
 const form=useRef(null);
 const listId=useId();
 const items=useMemo(()=>open?suggestions(query):[],[open,query]);
 const go=item=>{
  setOpen(false);
  if(item.href){router.push(item.href);return;}
  setQuery(item.text);
  requestAnimationFrame(()=>form.current?.requestSubmit());
 };
 const onKeyDown=event=>{
  if(!items.length)return;
  if(event.key==='ArrowDown'){event.preventDefault();setActive(i=>(i+1)%items.length);}
  else if(event.key==='ArrowUp'){event.preventDefault();setActive(i=>(i-1+items.length)%items.length);}
  else if(event.key==='Enter'&&active>=0){event.preventDefault();go(items[active]);}
  else if(event.key==='Escape')setOpen(false);
 };
 return <form ref={form} className={styles.search} action="/market/search" method="get" role="search" onSubmit={()=>setOpen(false)}>
  {Object.entries(keep).filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}
  <Search size={18} aria-hidden="true" className={styles.searchIcon}/>
  <input name="q" type="search" value={query} placeholder="ابحث: هايلكس، جوال سامسونج، شقة…" aria-label="ابحث في السوق" autoComplete="off" enterKeyHint="search" autoFocus={autoFocus}
   role="combobox" aria-expanded={items.length>0} aria-controls={listId} aria-activedescendant={active>=0?listId+'-'+active:undefined}
   onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(-1);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} onKeyDown={onKeyDown} maxLength={80}/>
  {query&&<button type="button" className={styles.searchClear} aria-label="مسح" onClick={()=>{setQuery('');setOpen(false);}}><X size={16}/></button>}
  <button type="submit" className={styles.searchSubmit}>بحث</button>
  {items.length>0&&<ul id={listId} role="listbox" className={styles.suggestions}>
   {items.map((item,index)=><li key={item.text+index} id={listId+'-'+index} role="option" aria-selected={index===active} onMouseDown={event=>{event.preventDefault();go(item);}}>
    <span>{item.text}</span>{item.hint&&<small>{item.hint}</small>}
   </li>)}
  </ul>}
 </form>;
}
