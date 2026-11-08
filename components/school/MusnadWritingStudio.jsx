'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Check,Copy,Eye,EyeOff,PenLine,RotateCcw} from 'lucide-react';
import {MUSNAD_ALPHABET} from '@/lib/schoolMusnad';
import styles from '@/app/school/school.module.css';

export default function MusnadWritingStudio(){
 const [selected,setSelected]=useState(0);
 const [showGuide,setShowGuide]=useState(true);
 const [hasStrokes,setHasStrokes]=useState(false);
 const [copyNote,setCopyNote]=useState('');
 const canvas=useRef(null),drawing=useRef(false);
 const letter=MUSNAD_ALPHABET[selected];

 function clear(){
  const node=canvas.current;
  if(node)node.getContext('2d')?.clearRect(0,0,node.width,node.height);
  setHasStrokes(false);
 }
 useEffect(()=>{
  const node=canvas.current;
  if(!node)return;
  const update=()=>{
   const bounds=node.getBoundingClientRect();
   const width=Math.max(1,bounds.width),height=Math.max(1,bounds.height),scale=Math.min(3,window.devicePixelRatio||1);
   node.width=Math.round(width*scale);
   node.height=Math.round(height*scale);
   const ctx=node.getContext('2d');
   if(ctx){ctx.setTransform(scale,0,0,scale,0,0);ctx.lineWidth=6;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#176456';}
   setHasStrokes(false);
  };
  update();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;
  observer?.observe(node);
  return()=>observer?.disconnect();
 },[]);
 useEffect(()=>{clear();setCopyNote('');},[selected]);
 const position=event=>{const b=event.currentTarget.getBoundingClientRect();return{x:event.clientX-b.left,y:event.clientY-b.top};};
 function down(event){
  if(event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();
  const ctx=event.currentTarget.getContext('2d');
  if(!ctx)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drawing.current=true;
  const {x,y}=position(event);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.01,y+.01);ctx.stroke();
  setHasStrokes(true);
 }
 function move(event){
  if(!drawing.current)return;
  event.preventDefault();
  const ctx=event.currentTarget.getContext('2d');
  if(!ctx)return;
  const {x,y}=position(event);
  ctx.lineTo(x,y);ctx.stroke();
 }
 function up(event){drawing.current=false;try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}}
 async function copy(){
  try{await navigator.clipboard.writeText(letter.glyph);setCopyNote('تم نسخ الحرف.');}
  catch{setCopyNote('تعذّر النسخ؛ يمكنك تحديد الحرف من دليل الأبجدية.');}
 }
 return <section className={styles.writingSection} aria-labelledby="musnad-writing-title"><div className="container">
  <div className={styles.sectionTitle}><div><span>تدريب عملي / 967 SCHOOL</span><h2 id="musnad-writing-title">مساحة التتبّع والكتابة</h2></div><p>هذا التدريب حرّ ولا يُصحّح آليًا ولا يؤثر على نقاط الإتقان أو فتح المراحل.</p></div>
  <div className={styles.writingLayout}>
   <div className={styles.writingPanel}>
    <div className={styles.writingPanelTop}><div><span>الحرف المختار</span><h3>{letter.name} <small dir="ltr">{letter.latin}</small></h3></div><strong className={styles.writingSelectedGlyph} lang="und">{letter.glyph}</strong></div>
    <div className={styles.writingBoard}>
      {showGuide&&<div className={styles.writingGhost} aria-hidden="true" lang="und">{letter.glyph}</div>}
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={'لوحة كتابة حرة لتتبّع حرف '+letter.name}/>
      {!hasStrokes&&<span className={styles.writingHint}>ارسم هنا بإصبعك أو الفأرة</span>}
    </div>
    <div className={styles.writingControls}>
     <button type="button" onClick={clear}><RotateCcw size={17}/> امسح اللوحة</button>
     <button type="button" onClick={()=>setShowGuide(v=>!v)}>{showGuide?<EyeOff size={17}/>:<Eye size={17}/>} {showGuide?'إخفاء الحرف':'إظهار الحرف'}</button>
     <button type="button" onClick={copy}><Copy size={17}/> نسخ الرمز</button>
    </div>
    {copyNote&&<p className={styles.copyFeedback} role="status"><Check size={15}/>{copyNote}</p>}
   </div>
   <aside className={styles.writingAside}>
    <h3>اختر حرفًا للتدرّب عليه</h3>
    <p>تتوفر جميع الحروف الـ29. يبدأ التعلّم بالكتابة فوق النموذج، ثم يمكنك إخفاؤه والرسم من الذاكرة.</p>
    <div className={styles.writingLetters} role="group" aria-label="اختيار حرف المسند">
      {MUSNAD_ALPHABET.map((c,i)=><button key={c.id} type="button" aria-label={'الحرف '+c.name} aria-pressed={i===selected} className={i===selected?styles.writingLetterActive:styles.writingLetter} onClick={()=>setSelected(i)}><span lang="und">{c.glyph}</span><small>{c.name}</small></button>)}
    </div>
    <Link className={styles.writingBack} href="/school/courses/musnad">العودة إلى دروس المسند <ArrowLeft size={17}/></Link>
  </aside>
  </div>
 </div></section>;
}
