import Image from 'next/image';
import {canOptimizeImage} from '@/lib/media';
import {BookOpenText,CalendarDays,ExternalLink,ImageIcon,List,ScrollText} from 'lucide-react';
import {formatArabicDate,formatNumber} from '@/lib/format';
import {figureNeedsIndependentSources,getFigureEditorialReview} from '@/lib/figureEditorialReview';
import styles from './FigureEditorialNote.module.css';

const imageKinds={portrait:'صورة للشخصية',context:'صورة سياقية',artwork:'تصوير فني',document:'وثيقة'};
export default function FigureDossier({profile,figure}){
 const sources=new Map(profile.sources.map((source,index)=>[source.id,{...source,number:index+1}]));
 const editorialReview=getFigureEditorialReview(figure.slug);
 const encyclopediaOnly=figureNeedsIndependentSources(profile);
 const cite=ids=><span className="figure-citations">{ids.map(id=>sources.has(id)&&<sup key={id}><a href={'#source-'+id} aria-label={'المصدر '+sources.get(id).number+': '+sources.get(id).title}>[{sources.get(id).number}]</a></sup>)}</span>;
 const contents=[...profile.sections.map(section=>({id:'section-'+section.id,title:section.title})),...(profile.facts.length?[{id:'figure-facts',title:'تفاصيل السيرة'}]:[]),...(profile.timeline.length?[{id:'figure-timeline',title:'التسلسل الزمني'}]:[]),...(profile.works.length?[{id:'figure-works',title:'أعمال وإنجازات'}]:[]),...(profile.gallery.length?[{id:'figure-gallery',title:'الصور والوثائق'}]:[]),...(profile.notes.length?[{id:'figure-notes',title:'ملاحظات توثيقية'}]:[]),{id:'figure-sources',title:'المصادر والمراجع'}];
 return <>
  {editorialReview&&<section className={styles.review} aria-label="إضافة بحثية مستقلة">
    <span className={styles.eyebrow}>إضافة تحريرية بمراجع مستقلة · 27 أكتوبر 2026</span>
    <h2>{editorialReview.title}</h2><p>{editorialReview.text}</p>
    <small>هذه الإضافة تفسير بحثي مستقل عن المصادر الأصلية للسيرة؛ ولا تعني التحقق من جميع تفاصيل الملف.</small>
    <ul className={styles.sources}>{editorialReview.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink size={13} aria-hidden="true"/></a></li>)}</ul>
  </section>}
  <nav className="figure-toc" aria-label="محتويات السيرة"><h2><List size={20}/> محتويات الملف</h2><ul>{contents.map(item=><li key={item.id}><a href={'#'+item.id}>{item.title}</a></li>)}</ul></nav>
  <div className="figure-review-line">{profile.reviewedAt&&<span>آخر مراجعة: {formatArabicDate(profile.reviewedAt)}</span>}<span>مصادر الملف: {formatNumber(profile.sources.length)}</span>{profile.historicity!=='documented'&&<strong>{profile.historicity==='traditional'?'شخصية في الموروث الديني والتراثي':'بعض تفاصيل السيرة محل اختلاف'}</strong>}</div>
  {profile.sections.map(section=><section id={'section-'+section.id} className="figure-dossier-section" key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((paragraph,index)=><p key={index}>{paragraph}{index===section.paragraphs.length-1&&cite(section.sourceIds)}</p>)}</section>)}
  {profile.facts.length>0&&<section id="figure-facts" className="figure-dossier-section"><h2>تفاصيل السيرة</h2><dl className="figure-detail-facts">{profile.facts.map(fact=><div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value}{cite(fact.sourceIds)}</dd></div>)}</dl></section>}
  {profile.timeline.length>0&&<section id="figure-timeline" className="figure-dossier-section"><span className="eyebrow"><CalendarDays size={16}/> محطات موثقة</span><h2>التسلسل الزمني</h2><ol className="figure-timeline">{[...profile.timeline].sort((a,b)=>(a.year??10000)-(b.year??10000)).map(event=><li key={event.id}><span className="figure-event-date">{event.dateLabel||event.year||'تاريخ غير محدد'}</span><div><h3>{event.title}</h3>{event.description&&<p>{event.description}</p>}{cite(event.sourceIds)}</div></li>)}</ol></section>}
  {profile.works.length>0&&<section id="figure-works" className="figure-dossier-section"><span className="eyebrow"><BookOpenText size={16}/> الأثر والإنتاج</span><h2>أعمال وإنجازات</h2><div className="figure-works-grid">{profile.works.map(work=><article key={work.id}><small>{[work.kind,work.year].filter(Boolean).join(' · ')}</small><h3>{work.title}</h3>{work.description&&<p>{work.description}</p>}{work.url&&<a className="text-link" href={work.url} target="_blank" rel="noopener noreferrer">التفاصيل في المصدر <ExternalLink size={14}/></a>}{cite(work.sourceIds)}</article>)}</div></section>}
  {profile.gallery.length>0&&<section id="figure-gallery" className="figure-dossier-section"><span className="eyebrow"><ImageIcon size={16}/> ذاكرة بصرية</span><h2>الصور والوثائق</h2><div className="figure-gallery">{profile.gallery.map(photo=><figure key={photo.id}><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={'المصدر الأصلي: '+photo.alt}><div className="figure-gallery-image"><Image src={photo.url} alt={photo.alt} fill sizes="(max-width:700px) 100vw, 400px" unoptimized={!canOptimizeImage(photo.url)}/></div></a><figcaption><span className="status-badge">{imageKinds[photo.kind]}</span><p>{photo.caption||photo.alt}</p>{photo.credit&&<small>{photo.credit}</small>}<a href={photo.licenseUrl||photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>{cite(photo.sourceIds)}</figcaption></figure>)}</div></section>}
  {profile.notes.length>0&&<section id="figure-notes" className="figure-dossier-section figure-editorial-notes"><span className="eyebrow"><ScrollText size={16}/> توضيح المعلومات</span><h2>ملاحظات توثيقية</h2><ul>{profile.notes.map((note,index)=><li key={index}>{note}</li>)}</ul></section>}
  <section id="figure-sources" className="figure-dossier-section"><h2>المصادر والمراجع</h2>{encyclopediaOnly&&<p className={styles.disclosure}>تعتمد قائمة المراجع المسجلة لهذا الملف حالياً على ويكيبيديا أو ويكي بيانات فقط. هذه مصادر تمهيدية مفيدة للبحث، لكنها لا تغني عن مرجع بحثي أو مؤسسي مستقل للتحقق من التفاصيل. يمكنك المساهمة بمرجع متخصص عبر رابط التصحيح أدناه.</p>}<ol className="figure-source-list">{profile.sources.map(source=><li id={'source-'+source.id} key={source.id}><a href={source.revisionUrl||source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={15}/></a>{source.publisher&&<span>{source.publisher}</span>}{source.accessedAt&&<small>تاريخ الاطلاع: {formatArabicDate(source.accessedAt)}</small>}</li>)}</ol>
   {profile.license&&<div className="figure-text-license"><strong>نسب النص وترخيصه</strong><p>{profile.license.attribution}</p><a href={profile.license.url} target="_blank" rel="noopener noreferrer">{profile.license.name}</a><a href={profile.license.revisionUrl||profile.license.sourceUrl} target="_blank" rel="noopener noreferrer">النص المصدر وسجل المساهمين</a></div>}
   <a className="text-link" href={'/contribute?type='+encodeURIComponent('اقتراح شخصية أو معلومة تاريخية')+'&figure='+encodeURIComponent(figure.slug)}>اقترح مصدرًا أو تصحيحًا <ExternalLink size={14}/></a>
  </section>
 </>;
}
