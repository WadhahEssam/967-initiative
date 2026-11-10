'use client';
import {useEffect,useState} from 'react';
import Link from '@/components/SiteLink';
import {BadgeCheck,Camera,Car,CheckSquare,CircleAlert,ClipboardCheck,ClipboardPen,Clock3,ExternalLink,FileStack,Fingerprint,GraduationCap,Hourglass,IdCard,Landmark,Lightbulb,MapPin,Plane,Printer,Receipt,Scale,Share2,Smartphone,Square,Stamp,Stethoscope,Timer,UserRound} from 'lucide-react';
import {checklistMessage,guideCategory,guideIsStale,guideRegions,stepKind} from '@/lib/transactionGuides';
import {formatArabicDate} from '@/lib/format';
import styles from './Transactions.module.css';

// Only the icons the step kinds and categories name (lib/transactionGuides.js), not the whole set.
const Icons={BadgeCheck,Camera,Car,ClipboardCheck,ClipboardPen,FileStack,Fingerprint,GraduationCap,Hourglass,IdCard,Landmark,MapPin,Plane,Receipt,Scale,Smartphone,Stamp,Stethoscope,UserRound};
// Each step kind is drawn in its own colour family, so the sequence reads at a glance.
const HUES={visit:'ember',online:'ember',documents:'teal',form:'teal',photo:'teal',counter:'indigo',stamp:'indigo',payment:'amber',fingerprint:'violet',medical:'violet',exam:'violet',wait:'clay',receive:'leaf'};
export function StepArt({kind,number}){
 const info=stepKind(kind),Icon=Icons[info.icon]||MapPin,hue=HUES[info.id]||'teal';
 return <span className={styles.art} style={{'--hue':'var(--c-'+hue+')','--hue-soft':'var(--c-'+hue+'-soft)'}} aria-hidden="true">
  <svg viewBox="0 0 64 64" className={styles.artBg}><circle cx="50" cy="14" r="9"/><rect x="6" y="40" width="18" height="18" rx="5"/></svg>
  <Icon size={28} strokeWidth={1.8}/>
  {number&&<b>{number}</b>}
 </span>;
}
export function CategoryArt({category,size=34}){
 const info=guideCategory(category),Icon=Icons[info.icon]||Landmark;
 return <span className={styles.categoryArt} aria-hidden="true"><Icon size={size} strokeWidth={1.7}/></span>;
}

const storageKey=(slug,region)=>'967-guide-checklist:'+slug+':'+region;
function readChecked(slug,region){try{return JSON.parse(localStorage.getItem(storageKey(slug,region))||'[]');}catch{return [];}}

// A whole guide: the city switch, the facts, the documents checklist, the illustrated steps,
// tips and mistakes. Rendered on the public page and as the preview in the editor.
export default function GuideView({guide,preview=false,shareUrl=''}){
 const regions=guideRegions(guide);
 const [region,setRegion]=useState(regions[0]?.id||'sanaa');
 const [checked,setChecked]=useState([]);
 useEffect(()=>{
  if(preview)return;
  try{const saved=localStorage.getItem('967-guide-region');if(saved&&regions.some(item=>item.id===saved))setRegion(saved);}catch{}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(!preview)setChecked(readChecked(guide.slug,region));},[guide.slug,region,preview]);
 const choose=id=>{setRegion(id);try{localStorage.setItem('967-guide-region',id);}catch{}};
 const toggle=index=>setChecked(previous=>{
  const next=previous.includes(index)?previous.filter(item=>item!==index):[...previous,index];
  try{localStorage.setItem(storageKey(guide.slug,region),JSON.stringify(next));}catch{}
  return next;
 });
 const variant=guide.variants?.[region]||{};
 if(!regions.length)return <p className={styles.empty}>لم تُكتب خطوات هذه المعاملة بعد.</p>;
 const facts=[
  variant.authority&&{icon:Landmark,label:'الجهة',value:variant.authority},
  variant.place&&{icon:MapPin,label:'المكان',value:variant.place,link:variant.mapUrl},
  variant.hours&&{icon:Clock3,label:'أوقات الدوام',value:variant.hours},
  variant.fees&&{icon:Receipt,label:'الرسوم',value:variant.fees},
  variant.duration&&{icon:Timer,label:'المدة المتوقعة',value:variant.duration},
 ].filter(Boolean);
 const documents=variant.documents||[],ready=documents.filter((_,index)=>checked.includes(index)).length;
 const message=checklistMessage(guide,region,shareUrl);
 return <div className={styles.guide}>
  {regions.length>1&&<div className={styles.regions} role="group" aria-label="اختر المدينة">
   <span>الإجراءات في:</span>
   {regions.map(item=><button key={item.id} type="button" aria-pressed={region===item.id} onClick={()=>choose(item.id)}>{item.name}</button>)}
  </div>}
  {facts.length>0&&<dl className={styles.facts}>{facts.map(fact=>{const Icon=fact.icon;return <div key={fact.label}>
   <dt><Icon size={16} aria-hidden="true"/> {fact.label}</dt>
   <dd>{fact.value}{fact.link&&<> <a href={fact.link} target="_blank" rel="noopener noreferrer">على الخريطة <ExternalLink size={13} aria-hidden="true"/></a></>}</dd>
  </div>;})}</dl>}
  {documents.length>0&&<section className={styles.block} aria-labelledby="guide-documents">
   <div className={styles.blockHead}>
    <h2 id="guide-documents">قبل أن تذهب: الأوراق المطلوبة</h2>
    {!preview&&<span className={styles.progress} aria-live="polite">{ready} من {documents.length} جاهزة</span>}
   </div>
   <ul className={styles.checklist}>{documents.map((item,index)=>{const done=checked.includes(index);return <li key={index}>
    <button type="button" aria-pressed={done} onClick={()=>toggle(index)} disabled={preview}>{done?<CheckSquare size={20} aria-hidden="true"/>:<Square size={20} aria-hidden="true"/>}<span>{item}</span></button>
   </li>;})}</ul>
   {!preview&&<div className={styles.tools}>
    <a className={styles.tool} href={'https://wa.me/?text='+encodeURIComponent(message)} target="_blank" rel="noopener noreferrer"><Share2 size={16} aria-hidden="true"/> أرسل القائمة على واتساب</a>
    <button type="button" className={styles.tool} onClick={()=>window.print()}><Printer size={16} aria-hidden="true"/> اطبع</button>
   </div>}
  </section>}
  {variant.steps?.length>0&&<section className={styles.block} aria-labelledby="guide-steps">
   <h2 id="guide-steps">الخطوات</h2>
   <ol className={styles.steps}>{variant.steps.map((step,index)=><li key={index}>
    <StepArt kind={step.kind} number={index+1}/>
    <div>
     <small>{stepKind(step.kind).name}</small>
     <h3>{step.title}</h3>
     {step.text&&<p>{step.text}</p>}
    </div>
   </li>)}</ol>
  </section>}
  {(variant.tips?.length>0||variant.mistakes?.length>0)&&<div className={styles.notes}>
   {variant.tips?.length>0&&<section className={styles.note} data-tone="tip" aria-labelledby="guide-tips"><h2 id="guide-tips"><Lightbulb size={18} aria-hidden="true"/> نصائح توفر وقتك</h2><ul>{variant.tips.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
   {variant.mistakes?.length>0&&<section className={styles.note} data-tone="warning" aria-labelledby="guide-mistakes"><h2 id="guide-mistakes"><CircleAlert size={18} aria-hidden="true"/> أخطاء شائعة</h2><ul>{variant.mistakes.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
  </div>}
  <footer className={styles.trust}>
   {guide.verifiedAt?<p>تحقق فريق 967 من هذه المعلومات في <strong>{formatArabicDate(guide.verifiedAt)}</strong>.{guideIsStale(guide.verifiedAt)&&' مضى على التحقق أكثر من ستة أشهر؛ تأكد من الجهة قبل الذهاب.'}</p>:<p>لم يُتحقق من هذا الدليل بعد.</p>}
   <p>الإجراءات والرسوم قد تتغير دون إعلان. {!preview&&<Link href={'/contribute?type='+encodeURIComponent('تصحيح معلومة')}>أبلغنا إن تغيّر شيء</Link>}</p>
   {guide.sources?.length>0&&<details><summary>المصادر</summary><ul>{guide.sources.map((item,index)=><li key={index}>{/^https:\/\//.test(item)?<a href={item} target="_blank" rel="noopener noreferrer" dir="ltr">{item}</a>:item}</li>)}</ul></details>}
  </footer>
 </div>;
}
