'use client';
import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import ui from './ui.module.css';

// One sheet for the whole market (filters, place, offer, report, block): a bottom sheet on phones,
// a centred dialog on wider screens. Native <dialog> with showModal() keeps focus inside, closes on
// Escape and returns focus to the button that opened it; the page behind does not scroll.
export default function Sheet({open,title,onClose,children,labelledBy}){
 const ref=useRef(null);
 const id=useId();
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  if(open&&!dialog.open){dialog.showModal();document.documentElement.style.overflow='hidden';}
  if(!open&&dialog.open)dialog.close();
  return ()=>{document.documentElement.style.overflow='';};
 },[open]);
 if(typeof document==='undefined'||!open)return null;
 return createPortal(<dialog ref={ref} className={ui.sheet} aria-labelledby={labelledBy||id}
  onCancel={event=>{event.preventDefault();onClose?.();}}
  onClick={event=>{if(event.target===event.currentTarget)onClose?.();}}>
  <span className={ui.sheetGrip} aria-hidden="true"/>
  {title!==undefined&&<div className={ui.sheetHead}><h2 id={id}>{title}</h2><button type="button" className={ui.iconButton} onClick={onClose} aria-label="إغلاق"><X size={18}/></button></div>}
  <div className={ui.sheetBody}>{children}</div>
 </dialog>,document.body);
}
