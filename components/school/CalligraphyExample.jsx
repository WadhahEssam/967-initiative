import Image from 'next/image';
import {servedImageUrl} from '@/lib/media';
import {ExternalLink} from 'lucide-react';
import {SCHOOL_HISTORICAL_SAMPLES,SCHOOL_SCRIPT_OPTIONS,validSchoolScript} from '@/lib/schoolCalligraphySamples';
import styles from '@/app/school/studio/studio.module.css';

// Render actual specialist typefaces for editable models, or a documented,
// authentic historical artwork when no trustworthy general-purpose font exists.
// hideName: لأسئلة «ما اسم هذا الخط؟» في دروس البطاقات؛ يُخفي اسم الخط من العنوان والتعليق والوصف النصي.
export default function CalligraphyExample({text,script='naskh',label='مثال تطبيقي',hideName=false}){
 const hand=validSchoolScript(script)?script:'naskh';
 const reference=SCHOOL_HISTORICAL_SAMPLES[hand];
 const scriptName=SCHOOL_SCRIPT_OPTIONS.find(item=>item.value===hand)?.label||'النسخ';
 return <figure className={styles.calligraphyReference}>
  <figcaption className={styles.scriptHeading}>{label} {!hideName&&<span>· {scriptName}</span>}</figcaption>
  {reference&&<div className={styles.scriptHistorical}>
   <div className={styles.scriptHistoricalImage}>
    <Image src={servedImageUrl(reference.image,828)} alt={hideName?'نموذج خطي تاريخي حقيقي':reference.description} width={reference.width} height={reference.height}
     unoptimized loading="lazy" className={styles.scriptArchiveImage}/>
   </div>
   <p className={styles.scriptArchiveCaption}>{hideName?'نموذج خطي حقيقي من عمل موثق.':reference.scriptLabel+' — '+reference.description+'.'}</p>
   <a href={reference.source} target="_blank" rel="noopener noreferrer" className={styles.scriptCredit}>
    <ExternalLink size={13} aria-hidden="true"/> {reference.credit} · عرض الأصل
   </a>
  </div>}
  <div className={reference?styles.scriptExerciseText:styles.scriptLiveText}>
   {reference&&<small>عبارة التدريب للقراءة (وليست نص النموذج الأصيل أعلاه)</small>}
   <strong dir="rtl" lang="ar" className={styles['schoolScript'+hand[0].toUpperCase()+hand.slice(1)]||styles.schoolScriptNaskh}>
    {text}
   </strong>
  </div>
 </figure>;
}
