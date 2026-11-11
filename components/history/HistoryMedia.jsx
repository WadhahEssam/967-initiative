import Image from 'next/image';
import {ExternalLink,Images} from 'lucide-react';
import {getHistoryPhotos,historyPhotoSource,historyPhotoPage} from '@/lib/historyVisuals';
import styles from './HistoryMedia.module.css';

// Preserve attribution, copyright and editorial uncertainty alongside every image.
export default function HistoryMedia({entry,variant='gallery'}){
 const pictures=getHistoryPhotos(entry);
 if(!pictures.length)return null;
 if(variant==='thumbnail'){
  const photo=pictures[0];
  return <div className={styles.thumbnail}>
   <Image src={historyPhotoSource(photo,480)} alt={photo.alt||photo.caption||entry.title} width={480} height={300} loading="lazy"/>
   <span className={styles.thumbLabel}>{photo.kind==='direct'?'صورة للموقع':'صورة سياقية'}</span>
  </div>;
 }
 if(variant==='spotlight'){
  const photo=pictures[0];
  return <figure className={styles.spotlight}><Image src={historyPhotoSource(photo,800)} alt={photo.alt||photo.caption||entry.title} width={600} height={360} loading="lazy"/><figcaption>صورة سياقية · <a href={historyPhotoPage(photo)} target="_blank" rel="noopener noreferrer">المصدر</a></figcaption></figure>;
 }
 return <section className={styles.gallery} aria-label={'صور ووثائق مرتبطة بموضوع '+entry.title}>
  <div className={styles.heading}><Images size={20}/><h2>صور من المكان والسياق التاريخي</h2></div>
  <div className={styles.galleryGrid}>{pictures.map((photo,i)=><figure key={(photo.id||photo.file)+'-'+i} className={styles.figure}>
   <a className={styles.photoLink} href={historyPhotoPage(photo)} target="_blank" rel="noopener noreferrer" aria-label={'افتح مصدر صورة '+(photo.alt||entry.title)}>
    <Image src={historyPhotoSource(photo)} alt={photo.alt||photo.caption||entry.title} width={960} height={600} loading="lazy"/>
    <span className={styles.viewLabel}>عرض المصدر <ExternalLink size={15}/></span>
   </a>
   <figcaption>
    <span className={styles.category}>{photo.kind==='direct'?'صورة مرتبطة مباشرة بالموقع':'صورة سياقية معاصرة، لا توثّق الحدث التاريخي'}</span>
    <strong>{photo.caption}</strong>
    <span className={styles.credit}>تصوير / مصدر: {photo.credit} · {photo.license||'راجع ترخيص الملف'} · <a href={historyPhotoPage(photo)} target="_blank" rel="noopener noreferrer">ويكيميديا كومنز</a></span>
   </figcaption>
  </figure>)}</div>
  <p className={styles.notice}>التصوير الحديث للمواقع الأثرية لا يمثل صورةً من زمن المملكة أو الحدث. تُعرض الحقوق والرخص الأصلية في صفحة كل صورة.</p>
 </section>;
}
