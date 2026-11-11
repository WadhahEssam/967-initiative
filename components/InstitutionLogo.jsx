'use client';
/* eslint-disable @next/next/no-img-element -- remote, licence-credited or canvas-rendered images whose hosts are not all in next.config remotePatterns */

import {useState} from 'react';
import {servedImageUrl} from '@/lib/media';

// Fallback identity is deliberately NOT stored in logo_url and is not an official logo.
const ignoredWords=new Set(['هيئة','مستشفى','المستشفى','مستشفي','المستشفي','العام','العامة','الريفي','المركز','مركز','الصحي','الصحية','للأمومة','والطفولة','جامعي','التعليمي','التخصصي','م','محافظة','مديرية']);
const palette=[
  ['#155b70','#eef8fa'],['#335a87','#edf3fb'],['#236e64','#edf9f3'],
  ['#745b87','#f6eff9'],['#805f40','#faf4e9'],['#5b617b','#f0f2f9'],
];
function medicalMark(name) {
 const terms=String(name||'').replace(/[()[\]،–—/]/g,' ').split(/\s+/u).map(s=>s.trim()).filter(Boolean);
 const key=terms.find(x=>x.length>1&&!ignoredWords.has(x))||terms[0]||'صحة';
 return key.replace(/^ال(?=.{2,})/u,'').slice(0,2);
}
function MedicalIdentity({name,maxSize}) {
 const mark=medicalMark(name);
 const hash=Array.from(String(name||'')).reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
 const [ink,tint]=palette[hash%palette.length];
 const side=Math.min(Number(maxSize)||64,84);
 return <span
  role="img"
  aria-label={'علامة تعريفية توضيحية لمنشأة '+name+'، ليست شعاراً رسمياً'}
  title="علامة تعريفية غير رسمية"
  style={{position:'relative',display:'grid',placeItems:'center',width:'100%',height:'100%',maxWidth:side,maxHeight:side,minWidth:0,aspectRatio:'1 / 1',borderRadius:'22%',border:'1px solid '+ink+'22',background:tint,color:ink,fontWeight:800,fontSize:side*.35,letterSpacing:'-.04em',lineHeight:1,overflow:'hidden'}}
 ><span aria-hidden="true">{mark}</span><span aria-hidden="true" style={{position:'absolute',left:side*.1,bottom:side*.07,fontSize:side*.15,fontWeight:700,opacity:.55}}>+</span></span>;
}

/** Broken external logo links safely fall back to a non-official identifier. */
export default function InstitutionLogo({src,name,children,maxSize=64,kind='other'}) {
 const [failed,setFailed]=useState(false);
 // A Commons logo (Wikimedia is hard to reach from Yemen) is served from our own address.
 const shown=servedImageUrl(src,192);
 if (!shown||failed) return kind==='medical'?<MedicalIdentity name={name} maxSize={maxSize}/>:children;
 return <img
  src={shown}
  alt={'شعار منشور لـ '+name}
  loading="lazy"
  decoding="async"
  referrerPolicy="no-referrer"
  onError={()=>setFailed(true)}
  style={{display:'block',width:'100%',height:'100%',maxWidth:maxSize,maxHeight:maxSize,objectFit:'contain'}}
 />;
}
