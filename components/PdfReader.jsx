'use client';
/* eslint-disable @next/next/no-img-element -- remote, licence-credited or canvas-rendered images whose hosts are not all in next.config remotePatterns */

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import './PdfReader.css';
import {facingPdfPages, normalisePdfPage} from '@/lib/pdfNavigation';
import {
 ChevronRight,ChevronLeft,ZoomIn,ZoomOut,Download,Maximize2,Minimize2,
 Search,LoaderCircle,AlertCircle,Columns2,BookOpen
} from 'lucide-react';

// Arabic book pagination: the cover is on the left, with the spine on the right.
// After the cover, 2/3, 4/5 ... are facing-page spreads.
function Sheet({number,image,side}){
 return <div className={'paper-static paper-'+side} aria-hidden="true">
  {number&&image?<img src={image} alt="" draggable="false"/>:number?<div className="paper-loading"><LoaderCircle className="spin" size={23}/></div>:<div className="paper-blank"/>}
  <span className="paper-edge"/>
 </div>;
}
function LeafSide({image,number,side}){
 return <div className={'paper-leaf-face paper-leaf-'+side}>
  {number&&image?<img src={image} alt="" draggable="false"/>:number?<div className="paper-loading"><LoaderCircle className="spin" size={23}/></div>:<div className="paper-blank"/>}
 </div>;
}

export default function PdfReader({url,title,downloadHref=url}){
 const readerRef=useRef(null),viewRef=useRef(null),pdf=useRef(null),cache=useRef(new Map()),pending=useRef(new Map()),gesture=useRef(null),textCache=useRef(new Map()),searchRequest=useRef({id:0});
 const [count,setCount]=useState(0),[page,setPage]=useState(1),[zoom,setZoom]=useState(1);
 const [pageInput,setPageInput]=useState('1'),[attempt,setAttempt]=useState(0),[pageTexts,setPageTexts]=useState({}),[fullMessage,setFullMessage]=useState('');
 const [spread,setSpread]=useState(false),[flipOn,setFlipOn]=useState(true),[turn,setTurn]=useState(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[full,setFull]=useState(false);
 const [query,setQuery]=useState(''),[searching,setSearching]=useState(false),[searchMessage,setSearchMessage]=useState('');
 const [viewWidth,setViewWidth]=useState(900),[paperRatio,setPaperRatio]=useState(1.414),[docVersion,setDocVersion]=useState(0),[renderVersion,setRenderVersion]=useState(0);

 useEffect(()=>{
  // The desktop reader opens like a physical magazine; mobiles keep one readable page.
  setSpread(window.innerWidth>=940);
  const onFull=()=>setFull(document.fullscreenElement===readerRef.current);
  document.addEventListener('fullscreenchange',onFull);
  return()=>document.removeEventListener('fullscreenchange',onFull);
 },[]);
 useEffect(()=>{
  if(!viewRef.current)return;
  const resize=()=>setViewWidth(viewRef.current?.clientWidth||900);
  resize();const observer=new ResizeObserver(resize);observer.observe(viewRef.current);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let disposed=false;let doc,task;const searchState=searchRequest.current;
  (async()=>{
   setLoading(true);setError('');setCount(0);setPage(1);setTurn(null);setRenderVersion(0);setPageTexts({});setSearching(false);setSearchMessage('');
   cache.current.clear();pending.current=new Map();textCache.current.clear();searchState.id++;
   try{
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
    task=pdfjs.getDocument({url,enableScripting:false,isEvalSupported:false});doc=await task.promise;
    if(disposed){await doc.destroy();return;}
    const first=await doc.getPage(1),viewport=first.getViewport({scale:1});
    if(disposed)return;
    pdf.current=doc;setPaperRatio(viewport.height/viewport.width);
    setCount(doc.numPages);setDocVersion(n=>n+1);setLoading(false);
   }catch(e){if(!disposed){setError('تعذّر فتح ملف المجلة. يمكنك تنزيله وقراءته مباشرة.');setLoading(false);}}
  })();
  return()=>{disposed=true;pdf.current=null;searchState.id++;if(task)task.destroy().catch(()=>{});};
 },[url,attempt]);

 const double=spread&&viewWidth>=760;
 useEffect(()=>{setTurn(null);if(count)setPage(p=>normalisePdfPage(p,count,double)||1);},[double,count]);
 useEffect(()=>{setPageInput(String(page));},[page]);
 const pageWidth=Math.max(170,Math.round(Math.min(double?560:760,double?(viewWidth-46)/2:viewWidth-44)*zoom));
 const pageHeight=Math.round(pageWidth*paperRatio);
 const current=useMemo(()=>facingPdfPages(page,count,double),[page,count,double]);
 const nextStart=double?(page===1?2:page+2):page+1;
 const previousStart=double?(page<=2?1:page-2):page-1;
 const nextAllowed=nextStart<=count,previousAllowed=page>1;
 const target=useMemo(()=>turn?facingPdfPages(turn.to,count,double):null,[turn,count,double]);
 const used=useMemo(()=>{
  if(!count)return [];
  const numbers=[current.single,current.left,current.right,target?.single,target?.left,target?.right];
  // Prefetch the following sheet for an immediate paper turn.
  if(!turn&&nextAllowed){const n=facingPdfPages(nextStart,count,double);numbers.push(n.single,n.left,n.right);}
  return [...new Set(numbers.filter(n=>Number.isInteger(n)&&n>=1&&n<=count))];
 },[current,target,turn,count,double,nextStart,nextAllowed]);

 const getImage=useCallback(n=>n?cache.current.get(n+'|'+pageWidth)||null:null,[pageWidth]);
 useEffect(()=>{
  if(!pdf.current||!count||!used.length)return;
  const doc=pdf.current,width=pageWidth,jobs=pending.current;
  const render=async(n)=>{
   const key=n+'|'+width;
   if(cache.current.has(key))return;
   if(jobs.has(key))return jobs.get(key);
   const request=(async()=>{
    try{
     const p=await doc.getPage(n),initial=p.getViewport({scale:1});
     if(!textCache.current.has(n)){
      const content=await p.getTextContent().catch(()=>null);
      const text=content?.items.map(item=>(item.str||'')+(item.hasEOL?'\n':' ')).join('').trim()||'';
      if(pdf.current===doc){textCache.current.set(n,text);setPageTexts(previous=>({...previous,[n]:text}));}
     }
     const dpr=Math.min(window.devicePixelRatio||1,2);
     const viewport=p.getViewport({scale:width/initial.width*dpr});
     const canvas=document.createElement('canvas');
     canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     await p.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,canvas}).promise;
     const image=canvas.toDataURL('image/png');canvas.width=0;canvas.height=0;
     if(pdf.current===doc){
      cache.current.set(key,image);
      // Retain only nearby pages so long magazines do not consume too much memory.
      while(cache.current.size>16)cache.current.delete(cache.current.keys().next().value);
      setRenderVersion(v=>v+1);
     }
    }catch(e){if(pdf.current===doc)setError('تعذّر رسم صفحة من المجلة. يمكنك تنزيل ملف PDF مباشرة.');}
    finally{jobs.delete(key);}
   })();
   jobs.set(key,request);return request;
  };
  used.forEach(render);
 },[docVersion,pageWidth,count,used]);

 useEffect(()=>{
  if(!turn||turn.phase!=='preparing')return;
  const needed=double?
   [target?.left,target?.right,current.left,current.right]:[page,turn.to];
  if(needed.every(n=>!n||Boolean(getImage(n))))setTurn(t=>t&&t.phase==='preparing'?{...t,phase:'running'}:t);
 },[turn,target,current,page,getImage,renderVersion,double]);

 const go=useCallback((direction)=>{
  if(loading||error||!count||turn)return;
  const to=direction==='next'?nextStart:previousStart;
  if(to<1||to>count||to===page)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!flipOn||reduced){setPage(to);return;}
  setTurn({from:page,to,direction,phase:'preparing'});
 },[loading,error,count,turn,nextStart,previousStart,page,flipOn]);
 const goTo=useCallback(n=>{
  const targetPage=normalisePdfPage(n,count,double);
  if(targetPage===null)return;
  setTurn(null);setPage(targetPage);setPageInput(String(targetPage));
 },[count,double]);
 const onTurnEnd=e=>{
  if(e.target!==e.currentTarget)return;
  if(turn?.phase==='running'){setPage(turn.to);setTurn(null);}
 };
 useEffect(()=>{
  if(turn?.phase!=='running')return;
  // Complete navigation even if animations are interrupted by a display change.
  const timer=window.setTimeout(()=>{setPage(turn.to);setTurn(null);},1100);
  return()=>window.clearTimeout(timer);
 },[turn]);

 async function findText(e){
  e.preventDefault();if(!query.trim()||!pdf.current||searching)return;
  const doc=pdf.current,request=++searchRequest.current.id;
  setSearching(true);setSearchMessage('');const term=query.trim().toLowerCase();
  try{
   for(let n=1;n<=count;n++){
    if(request!==searchRequest.current.id||doc!==pdf.current)return;
    const p=await doc.getPage(n),txt=(await p.getTextContent()).items.map(i=>i.str||'').join(' ').toLowerCase();
    if(request!==searchRequest.current.id||doc!==pdf.current)return;
    if(txt.includes(term)){goTo(n);setSearchMessage('تم الانتقال إلى الصفحة '+n);setSearching(false);return;}
   }
   setSearchMessage('لم نجد النص. ربما يحتوي ملف PDF على صور بدلاً من نص قابل للبحث.');
  }catch{if(request===searchRequest.current.id)setSearchMessage('تعذّر البحث في ملف المجلة.');}
  if(request===searchRequest.current.id)setSearching(false);
 }
 async function toggleFull(){
  setFullMessage('');
  try{if(document.fullscreenElement===readerRef.current)await document.exitFullscreen();else if(readerRef.current?.requestFullscreen)await readerRef.current.requestFullscreen();else setFullMessage('عرض ملء الشاشة غير متاح في هذا المتصفح.');}catch{setFullMessage('تعذر فتح ملء الشاشة في هذا المتصفح.');}
 }
 const isRunning=turn?.phase==='running';
 const underlying=isRunning?(double?
   (turn.direction==='next'?{left:target.left,right:current.right}:{left:current.left,right:target.right}):{single:turn.to}):current;
 const frontNumber=isRunning?(double?(turn.direction==='next'?current.left:current.right):page):null;
 const backNumber=isRunning?(double?(turn.direction==='next'?target.right:target.left):turn.to):null;

 return <div className="pdf-reader" ref={readerRef}>
  <div className="pdf-toolbar"><div className="pdf-toolbar-title"><BookOpen size={21}/><span>{title}</span></div>
   <div className="pdf-controls">
    <button title="تصغير" aria-label="تصغير" onClick={()=>setZoom(z=>Math.max(.65,Math.round((z-.15)*100)/100))} disabled={zoom<=.65||Boolean(turn)}><ZoomOut size={19}/></button>
    <span className="zoom-label">{Math.round(zoom*100)}%</span>
    <button title="تكبير" aria-label="تكبير" onClick={()=>setZoom(z=>Math.min(2,Math.round((z+.15)*100)/100))} disabled={zoom>=2||Boolean(turn)}><ZoomIn size={19}/></button>
    <button className={flipOn?'active-control':''} title={flipOn?'إيقاف تأثير تقليب الورق':'تفعيل تقليب الورق'} aria-pressed={flipOn} onClick={()=>setFlipOn(v=>!v)}><BookOpen size={18}/><span className="flip-label">تقليب الورق</span></button>
    <button className={double?'active-control':''} title="عرض صفحتين على الكمبيوتر" aria-label="عرض صفحتين" aria-pressed={double} disabled={viewWidth<760||Boolean(turn)} onClick={()=>{setTurn(null);setSpread(v=>!v);}}><Columns2 size={19}/></button>
    <button title={full?'إنهاء ملء الشاشة':'ملء الشاشة'} aria-label={full?'إنهاء ملء الشاشة':'ملء الشاشة'} onClick={toggleFull}>{full?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
    <a title="تحميل العدد" aria-label="تحميل العدد" href={downloadHref} target="_blank" rel="noopener noreferrer"><Download size={19}/></a>
   </div>
  </div>
  {fullMessage&&<p className="pdf-notice" role="status">{fullMessage}</p>}
  <div className="pdf-find"><form onSubmit={findText}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن كلمة داخل العدد..." aria-label="البحث داخل العدد"/><button disabled={!query.trim()||searching||loading||Boolean(error)} type="submit">{searching?'جارٍ البحث':'بحث'}</button></form>{searchMessage&&<span role="status">{searchMessage}</span>}</div>
  <div className="pdf-view-area pdf-paper-view" ref={viewRef}>
   {loading&&<div className="pdf-state" role="status"><LoaderCircle className="spin" size={36}/><p>جارٍ تجهيز صفحات المجلة...</p></div>}
   {error&&<div className="pdf-state" role="alert"><AlertCircle size={34}/><p>{error}</p><button type="button" className="btn btn-outline" onClick={()=>setAttempt(value=>value+1)}>إعادة المحاولة</button><a className="btn btn-outline" href={url} target="_blank" rel="noopener noreferrer">فتح ملف PDF</a></div>}
   {!loading&&!error&&<div className="pdf-book-viewport" onTouchStart={e=>{const t=e.changedTouches[0];gesture.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{
    if(!gesture.current||zoom>1){gesture.current=null;return;}
    const t=e.changedTouches[0],dx=t.clientX-gesture.current.x,dy=t.clientY-gesture.current.y;gesture.current=null;
    if(Math.abs(dx)>65&&Math.abs(dy)<Math.abs(dx)*.6)go(dx>0?'next':'previous');
   }} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();go('next');}if(e.key==='ArrowLeft'){e.preventDefault();go('previous');}}} tabIndex={0} role="group" aria-label="قارئ مجلة 967: استخدم الأسهم للتنقل">
    <div className={'pdf-book-scene '+(double?'pdf-book-double':'pdf-book-single')} dir="ltr" style={{width:pageWidth*(double?2:1),height:pageHeight}}>
     {double?<><Sheet side="left" number={underlying.left} image={getImage(underlying.left)}/><Sheet side="right" number={underlying.right} image={getImage(underlying.right)}/><div className="pdf-book-spine"/></>:<Sheet side="single" number={underlying.single} image={getImage(underlying.single)}/>}
     {isRunning&&<div className={'paper-turn-leaf paper-turn-'+turn.direction} onAnimationEnd={onTurnEnd}>
      <LeafSide side="front" number={frontNumber} image={getImage(frontNumber)}/>
      <LeafSide side="back" number={backNumber} image={getImage(backNumber)}/>
     </div>}
    </div>
    <div className="pdf-turn-state" role="status" aria-live="polite">{turn?.phase==='preparing'?'جارٍ تجهيز الصفحة...':''}</div>
   </div>}
  </div>
  <div className="pdf-pagination"><button onClick={()=>go('previous')} disabled={!previousAllowed||loading||Boolean(error)||Boolean(turn)} aria-label="الصفحة السابقة"><ChevronRight size={20}/> السابق</button>
   <form className="pdf-page-jump" onSubmit={event=>{event.preventDefault();goTo(pageInput);}}><label>صفحة <input type="text" inputMode="numeric" pattern="[0-9٠-٩۰-۹]*" value={pageInput} disabled={loading||Boolean(error)} onChange={e=>setPageInput(e.target.value)} onBlur={()=>{if(pageInput.trim()&&normalisePdfPage(pageInput,count,double)!==null)goTo(pageInput);else setPageInput(String(page));}}/> من {count||'—'}</label><button type="submit" disabled={loading||Boolean(error)||!pageInput.trim()}>انتقل</button></form>
   <button onClick={()=>go('next')} disabled={!nextAllowed||loading||Boolean(error)||Boolean(turn)} aria-label="الصفحة التالية">التالي <ChevronLeft size={20}/></button></div>
  {!loading&&!error&&<details className="pdf-accessible-text"><summary>قراءة نص الصفحات المعروضة</summary>{[current.single,current.right,current.left].filter(Boolean).map(number=><section key={number}><h3>صفحة {number}</h3><p>{pageTexts[number]===undefined?'جارٍ استخراج النص…':pageTexts[number]||'هذه الصفحة لا تحتوي على نص قابل للاستخراج. يمكنك فتح الملف الأصلي باستخدام قارئ PDF يدعم الوصول.'}</p></section>)}</details>}
  <p className="pdf-help">يمكنك تقليب الورق بالأزرار أو أسهم لوحة المفاتيح أو السحب على الهاتف. عطّل التأثير من الشريط إذا أردت تنقلاً فورياً.</p>
 </div>;
}
