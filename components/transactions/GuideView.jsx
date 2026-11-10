'use client';
import {useEffect,useRef,useState} from 'react';
import Link from '@/components/SiteLink';
import {ArrowLeft,BadgeCheck,Briefcase,Camera,Car,Check,CheckSquare,ChevronDown,CircleAlert,ClipboardCheck,ClipboardPen,Clock3,ExternalLink,FileStack,Fingerprint,Globe,GraduationCap,Hourglass,IdCard,Landmark,Lightbulb,Link2,ListOrdered,MapPin,Plane,Printer,Receipt,RotateCcw,Scale,Share2,Smartphone,Square,Stamp,Stethoscope,Timer,UserRound,Users} from 'lucide-react';
import {checklistMessage,guideCategory,guideIsStale,guideRegions,stepKind} from '@/lib/transactionGuides';
import {formatArabicDate} from '@/lib/format';
import styles from './Transactions.module.css';

// Only the icons the step kinds and categories name (lib/transactionGuides.js), not the whole set.
const Icons={BadgeCheck,Briefcase,Camera,Car,ClipboardCheck,ClipboardPen,FileStack,Fingerprint,GraduationCap,Hourglass,IdCard,Landmark,MapPin,Plane,Receipt,Scale,Smartphone,Stamp,Stethoscope,UserRound};
// Each step kind is drawn in its own colour family, so the sequence reads at a glance.
const HUES={visit:'ember',online:'ember',documents:'teal',form:'teal',photo:'teal',counter:'indigo',stamp:'indigo',payment:'amber',fingerprint:'violet',medical:'violet',exam:'violet',wait:'clay',receive:'leaf'};
export function StepArt({kind,number,done=false}){
 const info=stepKind(kind),Icon=Icons[info.icon]||MapPin,hue=done?'leaf':HUES[info.id]||'teal';
 return <span className={styles.art} data-done={done||undefined} style={{'--hue':'var(--c-'+hue+')','--hue-soft':'var(--c-'+hue+'-soft)'}} aria-hidden="true">
  <svg viewBox="0 0 64 64" className={styles.artBg}><circle cx="50" cy="14" r="9"/><rect x="6" y="40" width="18" height="18" rx="5"/></svg>
  {done?<Check size={28} strokeWidth={2.4}/>:<Icon size={28} strokeWidth={1.8}/>}
  {number&&<b>{number}</b>}
 </span>;
}
export function CategoryArt({category,size=34}){
 const info=guideCategory(category),Icon=Icons[info.icon]||Landmark;
 return <span className={styles.categoryArt} aria-hidden="true"><Icon size={size} strokeWidth={1.7}/></span>;
}

const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const countLabel=(n,one,two,few,many)=>n===1?one:n===2?two:n>=3&&n<=10?n+' '+few:n+' '+many;

// A whole guide: summary, city switch, facts, documents checklist, illustrated steps with progress,
// tips and mistakes, questions, related guides. Rendered on the public page and as the editor preview.
export default function GuideView({guide,preview=false,shareUrl='',related=[]}){
 const regions=guideRegions(guide);
 const [region,setRegion]=useState(regions[0]?.id||'sanaa');
 const [checked,setChecked]=useState([]);
 const [done,setDone]=useState([]);
 const [shared,setShared]=useState(false);
 const bar=useRef(null);
 // Lands a section just below the sticky bar, whatever height it has on this screen.
 const jump=(event,id)=>{
  const target=document.getElementById(id);
  if(!target||!bar.current)return;
  event.preventDefault();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:window.scrollY+target.getBoundingClientRect().top-bar.current.offsetHeight-(Number.parseFloat(getComputedStyle(bar.current).top)||0)-8,behavior:reduce?'auto':'smooth'});
  history.replaceState(null,'','#'+id);
 };
 const docsKey='967-guide-checklist:'+guide.slug+':'+region,stepsKey='967-guide-steps:'+guide.slug+':'+region;
 useEffect(()=>{
  if(preview)return;
  try{const saved=localStorage.getItem('967-guide-region');if(saved&&regions.some(item=>item.id===saved))setRegion(saved);}catch{}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(!preview){setChecked(read(docsKey));setDone(read(stepsKey));}},[docsKey,stepsKey,preview]);
 const choose=id=>{setRegion(id);try{localStorage.setItem('967-guide-region',id);}catch{}};
 const flip=(list,setList,key,index)=>setList(previous=>{const next=previous.includes(index)?previous.filter(item=>item!==index):[...previous,index];write(key,next);return next;});
 const variant=guide.variants?.[region]||{};
 if(!regions.length)return <p className={styles.empty}>لم تُكتب خطوات هذه المعاملة بعد.</p>;
 const documents=variant.documents||[],steps=variant.steps||[];
 const ready=documents.filter((_,index)=>checked.includes(index)).length,finished=steps.filter((_,index)=>done.includes(index)).length;
 const facts=[
  variant.authority&&{icon:Landmark,label:'الجهة',value:variant.authority},
  variant.place&&{icon:MapPin,label:'المكان',value:variant.place,link:variant.mapUrl},
  variant.hours&&{icon:Clock3,label:'أوقات الدوام',value:variant.hours},
  variant.fees&&{icon:Receipt,label:'الرسوم',value:variant.fees},
  variant.duration&&{icon:Timer,label:'المدة المتوقعة',value:variant.duration},
  variant.delegate&&{icon:Users,label:'هل ينوب عنك أحد؟',value:variant.delegate},
  variant.online&&{icon:Globe,label:'الخدمة الإلكترونية',value:variant.online},
 ].filter(Boolean);
 const sections=[
  documents.length&&['guide-documents','الأوراق'],
  steps.length&&['guide-steps','الخطوات'],
  (variant.tips?.length||variant.mistakes?.length)&&['guide-notes','نصائح'],
  guide.faqs?.length&&['guide-faqs','أسئلة'],
 ].filter(Boolean);
 const message=checklistMessage(guide,region,shareUrl);
 async function share(){
  try{
   if(navigator.share){await navigator.share({title:guide.title,url:shareUrl||location.href});return;}
   await navigator.clipboard.writeText(shareUrl||location.href);setShared(true);setTimeout(()=>setShared(false),2500);
  }catch{}
 }
 return <div className={styles.guide}>
  <div className={styles.glance} aria-label="باختصار">
   <div><ListOrdered size={18} aria-hidden="true"/><strong>{countLabel(steps.length,'خطوة واحدة','خطوتان','خطوات','خطوة')}</strong></div>
   <div><FileStack size={18} aria-hidden="true"/><strong>{countLabel(documents.length,'ورقة واحدة','ورقتان','أوراق','ورقة')}</strong></div>
   {variant.duration&&<div><Timer size={18} aria-hidden="true"/><strong>{variant.duration}</strong></div>}
   {variant.fees&&<div><Receipt size={18} aria-hidden="true"/><strong>{variant.fees}</strong></div>}
  </div>
  <div className={styles.bar} ref={bar}>
   {regions.length>1&&<div className={styles.regions} role="group" aria-label="اختر المدينة">
    <span>الإجراءات في:</span>
    {regions.map(item=><button key={item.id} type="button" aria-pressed={region===item.id} onClick={()=>choose(item.id)}>{item.name}</button>)}
   </div>}
   {sections.length>1&&<nav className={styles.sectionNav} aria-label="أقسام الدليل">{sections.map(([id,label])=><a key={id} href={'#'+id} onClick={event=>jump(event,id)}>{label}</a>)}</nav>}
  </div>
  <div className={styles.layout}>
  <aside className={styles.side} aria-label="ما تحتاجه">
  {facts.length>0&&<dl className={styles.facts}>{facts.map(fact=>{const Icon=fact.icon;return <div key={fact.label}>
   <dt><Icon size={16} aria-hidden="true"/> {fact.label}</dt>
   <dd>{fact.value}{fact.link&&<> <a href={fact.link} target="_blank" rel="noopener noreferrer">على الخريطة <ExternalLink size={13} aria-hidden="true"/></a></>}</dd>
  </div>;})}</dl>}
  {documents.length>0&&<section id="guide-documents" className={styles.block} aria-labelledby="guide-documents-title">
   <div className={styles.blockHead}>
    <h2 id="guide-documents-title">قبل أن تذهب: الأوراق المطلوبة</h2>
    {!preview&&<span className={styles.progress} aria-live="polite">{ready} من {documents.length} جاهزة</span>}
   </div>
   {!preview&&<span className={styles.meter} aria-hidden="true"><i style={{inlineSize:(documents.length?ready/documents.length*100:0)+'%'}}/></span>}
   <ul className={styles.checklist}>{documents.map((item,index)=>{const on=checked.includes(index);return <li key={index}>
    <button type="button" aria-pressed={on} onClick={()=>flip(checked,setChecked,docsKey,index)} disabled={preview}>{on?<CheckSquare size={20} aria-hidden="true"/>:<Square size={20} aria-hidden="true"/>}<span>{item}</span></button>
   </li>;})}</ul>
   {!preview&&<div className={styles.tools}>
    <a className={styles.tool} data-tone="whatsapp" href={'https://wa.me/?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer"><Share2 size={16} aria-hidden="true"/> أرسل القائمة على واتساب</a>
    <button type="button" className={styles.tool} onClick={()=>window.print()}><Printer size={16} aria-hidden="true"/> اطبع</button>
   </div>}
  </section>}
  </aside>
  <div className={styles.main}>
  {steps.length>0&&<section id="guide-steps" className={styles.block} aria-labelledby="guide-steps-title">
   <div className={styles.blockHead}>
    <h2 id="guide-steps-title">الخطوات بالترتيب</h2>
    {!preview&&<span className={styles.progress} aria-live="polite">{finished?'أنجزت '+finished+' من '+steps.length:'علّم كل خطوة تنجزها'}</span>}
   </div>
   {!preview&&finished>0&&<span className={styles.meter} aria-hidden="true"><i style={{inlineSize:finished/steps.length*100+'%'}}/></span>}
   <ol className={styles.steps}>{steps.map((step,index)=>{const isDone=done.includes(index);return <li key={index} data-done={isDone||undefined}>
    <StepArt kind={step.kind} number={index+1} done={isDone}/>
    <div>
     <small>{stepKind(step.kind).name}</small>
     <h3>{step.title}</h3>
     {step.text&&<p>{step.text}</p>}
     {!preview&&<button type="button" className={styles.stepDone} aria-pressed={isDone} onClick={()=>flip(done,setDone,stepsKey,index)}>{isDone?<><Check size={15} aria-hidden="true"/> أُنجزت</>:'أنجزت هذه الخطوة'}</button>}
    </div>
   </li>;})}</ol>
   {!preview&&finished>0&&<button type="button" className={styles.reset} onClick={()=>{setDone([]);write(stepsKey,[]);}}><RotateCcw size={14} aria-hidden="true"/> ابدأ من جديد</button>}
  </section>}
  {(variant.tips?.length>0||variant.mistakes?.length>0)&&<div id="guide-notes" className={styles.notes}>
   {variant.tips?.length>0&&<section className={styles.note} data-tone="tip" aria-labelledby="guide-tips"><h2 id="guide-tips"><Lightbulb size={18} aria-hidden="true"/> نصائح توفر وقتك</h2><ul>{variant.tips.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
   {variant.mistakes?.length>0&&<section className={styles.note} data-tone="warning" aria-labelledby="guide-mistakes"><h2 id="guide-mistakes"><CircleAlert size={18} aria-hidden="true"/> أخطاء شائعة</h2><ul>{variant.mistakes.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
  </div>}
  {guide.faqs?.length>0&&<section id="guide-faqs" className={styles.block} aria-labelledby="guide-faqs-title">
   <h2 id="guide-faqs-title">أسئلة شائعة</h2>
   <div className={styles.faqs}>{guide.faqs.map((item,index)=><details key={index}>
    <summary>{item.q}<ChevronDown size={18} aria-hidden="true"/></summary>
    <p>{item.a}</p>
   </details>)}</div>
  </section>}
  {related.length>0&&<section className={styles.block} aria-labelledby="guide-related">
   <h2 id="guide-related">معاملات مرتبطة</h2>
   <div className={styles.relatedList}>{related.map(item=><Link key={item.slug} href={'/transactions/'+item.slug} className={styles.related}>
    <CategoryArt category={item.category} size={20}/><span>{item.title}</span><ArrowLeft size={16} aria-hidden="true"/>
   </Link>)}</div>
  </section>}
  <footer className={styles.trust}>
   {guide.verifiedAt?<p><BadgeCheck size={16} aria-hidden="true"/> تحقق فريق 967 من هذه المعلومات في <strong>{formatArabicDate(guide.verifiedAt)}</strong>.{guideIsStale(guide.verifiedAt)&&' مضى على التحقق أكثر من ستة أشهر؛ تأكد من الجهة قبل الذهاب.'}</p>:<p>لم يُتحقق من هذا الدليل بعد.</p>}
   <p>الإجراءات والرسوم قد تتغير دون إعلان. {!preview&&<Link href={'/contribute?type='+encodeURIComponent('تصحيح معلومة')}>أبلغنا إن تغيّر شيء</Link>}</p>
   {!preview&&<button type="button" className={styles.tool} onClick={share}><Link2 size={16} aria-hidden="true"/> {shared?'نُسخ الرابط':'شارك الدليل'}</button>}
   {guide.sources?.length>0&&<details><summary>المصادر</summary><ul>{guide.sources.map((item,index)=><li key={index}>{/^https:\/\//.test(item)?<a href={item} target="_blank" rel="noopener noreferrer" dir="ltr">{item}</a>:item}</li>)}</ul></details>}
  </footer>
  </div>
  </div>
 </div>;
}
