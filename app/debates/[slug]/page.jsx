import DebateLogo from '@/components/debates/DebateLogo';
import ContextBackLink from '@/components/ContextBackLink';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import Image from 'next/image';
import {Fragment} from 'react';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {getDebateCatalog,getDebateDetail} from '@/lib/debateServer';
import {DEBATE_TYPES,DEBATE_STAGES,formatDebateDateTime,SUMMARY_FIELDS,debateDateLabel,httpsUrl,publicRecordingAvailable} from '@/lib/debates';
import {pageMetadata,siteUrl} from '@/lib/seo';
import {JsonLd,breadcrumbSchema} from '@/lib/seo-schema';
import DebateVideo from '@/components/debates/DebateVideo';
import DebateInteraction from '@/components/debates/DebateInteraction';
import DebateCard from '@/components/debates/DebateCard';
import DebateShare from '@/components/debates/DebateShare';
import DebateReminderAction from '@/components/debates/DebateReminderAction';
import DebateDisclosure from '@/components/debates/DebateDisclosure';
import MobileFold from '@/components/mobile/MobileFold';
import InlineTarget from '@/components/inline/InlineTarget';
// A database outage answers 5xx (error.jsx), not a 200 page marked noindex that search engines would drop.
export async function generateMetadata({params}){const {slug}=await params,{debate:d,available}=await getDebateDetail(slug);if(!available)throw new Error('Debate service unavailable');return pageMetadata({title:d?.seo_title||d?.title||'المناظرة غير متاحة',description:d?.seo_description||d?.question,path:'/debates/'+slug,image:d?.cover_url||'/images/debates-logo.png',noindex:!d});}
export default async function Page({params}){
 const {slug}=await params,{debate:d,available}=await getDebateDetail(slug);
 if(!available)throw new Error('Debate service unavailable');
 if(!d)notFound();
 const {debates}=await getDebateCatalog(),related=debates.filter(x=>x.id!==d.id&&x.category===d.category).slice(0,3);
 const hasRecording=publicRecordingAvailable(d);
 const videoSchema=hasRecording&&d.first_published_at&&httpsUrl(d.cover_url)?{'@context':'https://schema.org','@type':'VideoObject',name:d.title,description:d.description||d.question,thumbnailUrl:d.cover_url,uploadDate:d.first_published_at,url:siteUrl('/debates/'+d.slug),...(d.duration_seconds?{duration:'PT'+d.duration_seconds+'S'}:{})}:null;
 return <><InlineTarget kind="debate" id={d.id} slug={d.slug} title={d.title} href={'/debates/'+d.slug}/><JsonLd data={breadcrumbSchema([{name:'مناظرات 967',path:'/debates'},{name:d.title,path:'/debates/'+d.slug}])}/><JsonLd data={videoSchema}/>
  <header className="debate-detail-hero debate-detail-header"><div className="container"><div className="debate-detail-topline"><ContextBackLink fallback="/debates" label="مناظرات 967" className="eyebrow debate-brand-link" leading={<DebateLogo decorative sizes="44px"/>}/><div className="debate-meta"><span>{d.category}</span><span>{DEBATE_TYPES[d.debate_type]}</span><span>{DEBATE_STAGES[d.stage]}</span></div></div><h1>{d.title}</h1>{d.participants.length===2&&<div className="debate-versus" aria-label="طرفا المناظرة">{d.participants.map((p,i)=><Fragment key={p.id}>{i===1&&<span className="debate-versus-vs" aria-hidden="true">ضد</span>}<Link className="debate-versus-side" href={'/debates/speakers/'+p.speaker.slug}>{httpsUrl(p.speaker.photo_url)?<Image unoptimized width={56} height={56} referrerPolicy="no-referrer" src={httpsUrl(p.speaker.photo_url)} alt="" loading="lazy"/>:<span className="debate-person-avatar" aria-hidden="true">{p.speaker.name.trim().charAt(0)}</span>}<strong>{p.speaker.name}</strong>{p.role_label&&<small>{p.role_label}</small>}</Link></Fragment>)}</div>}<div className="debate-detail-toolbar">{d.debate_type==='external_live'&&d.stage!=='cancelled'&&d.stage!=='postponed'&&d.scheduled_at&&<p>{debateDateLabel(d)}: <time dateTime={d.scheduled_at}>{formatDebateDateTime(d.scheduled_at)}</time></p>}<DebateShare/><DebateReminderAction debate={{id:d.id,slug:d.slug,debate_type:d.debate_type,scheduled_at:d.scheduled_at,recording_published:d.recording_published,recording_first_published_at:d.recording_first_published_at,publication_status:d.publication_status,stage:d.stage}}/></div></div></header>
  <div className="container debate-detail-content debate-detail-compact">
   <div className="debate-watch-layout"><div className="debate-watch-main"><DebateVideo key={d.id+':'+(hasRecording?d.recording_url:'preview')} debate={d} now={Date.now()}/>
   <ContentReadingAction kind="debate" href={'/debates/'+encodeURIComponent(d.slug)} title={d.title}/>
   <nav className="debate-detail-nav" aria-label="أقسام المناظرة"><a href="#discussion">ساحة النقاش</a><a href="#polls">استطلاع الرأي والنتائج</a><a href="#participants">المشاركون</a></nav>
   </div><aside className="debate-context-side"><MobileFold title={'المشاركون ومواقفهم ('+d.participants.length+')'} className="debate-mobile-participants"><section id="participants" className="debate-participants-compact"><div className="debate-section-heading"><h2>المشاركون ومواقفهم</h2></div><div className="debate-participant-list">{d.participants.map(p=><article className="debate-participant" key={p.id}><Link className="debate-participant-identity" href={'/debates/speakers/'+p.speaker.slug}>{httpsUrl(p.speaker.photo_url)?<Image unoptimized width={52} height={52} referrerPolicy="no-referrer" src={httpsUrl(p.speaker.photo_url)} alt="" loading="lazy"/>:<span className="debate-person-avatar" aria-hidden="true">{p.speaker.name.trim().charAt(0)}</span>}<div><h3>{p.speaker.name}</h3><small>{p.role_label}{p.speaker.specialty?' · '+p.speaker.specialty:''}</small></div></Link>{p.stance&&<div><p className="debate-participant-stance">{p.stance.length>150?p.stance.slice(0,150)+String.fromCharCode(8230):p.stance}</p>{p.stance.length>150&&<details><summary>قراءة الموقف كاملاً</summary><p>{p.stance}</p></details>}</div>}</article>)}</div></section></MobileFold>
   <div className="debate-context-disclosures"><DebateDisclosure id="about" title="عن القضية" description="السؤال الرئيسي وخلفية الحوار"><p className="debate-context-question">{d.question}</p>{d.description&&<p className="debate-prose">{d.description}</p>}</DebateDisclosure>{d.axes.length>0&&<DebateDisclosure id="axes" title="محاور النقاش" description={d.axes.length+' محاور'}><ol>{d.axes.map(a=><li key={a}>{a}</li>)}</ol></DebateDisclosure>}</div>
   </aside></div>
   {d.summary_published&&Object.keys(d.summary).some(k=>d.summary[k])&&<DebateDisclosure id="debate-summary" title="ملخص المناظرة" description="خلاصة الحوار والمواقف"><div className="debate-summary-content">{Object.entries(SUMMARY_FIELDS).filter(([key])=>typeof d.summary[key]==='string'&&d.summary[key].trim()).map(([key,label])=><div key={key}><h3>{label}</h3><p className="debate-prose">{d.summary[key]}</p></div>)}</div></DebateDisclosure>}
   <DebateInteraction debate={d}/>
   {related.length>0&&<section><h2>حوارات ذات صلة</h2><div className="debate-grid">{related.map(x=><DebateCard debate={x} key={x.id}/>)}</div></section>}
  </div></>;
}
