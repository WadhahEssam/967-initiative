import {shareCardPath} from '@/lib/shareCard';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ExternalLink} from 'lucide-react';
import CourseJourney from '@/components/school/v2/CourseJourney';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionGate,sectionIsVisible} from '@/lib/pageVisibility';
import {readPublicHistoryCatalog} from '@/lib/historyRepository';
import {musnadCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {publishedSchoolCatalog,publishedSchoolStageList} from '@/lib/schoolContentServer';
import {pageMetadata} from '@/lib/seo';
import {SCHOOL_COURSE_TOOLS,SCHOOL_COURSE_SOURCES} from '@/lib/schoolCourseTools';
import styles from '../../studio/studio.module.css';
export const dynamic='force-dynamic';
// Each course has its own title, description and canonical address.
export async function generateMetadata({params}){
 const {slug}=await params,db=serverDb(),path='/school/courses/'+slug;
 const course=db?(await publishedSchoolCatalog(db).catch(()=>[])).find(x=>x.slug===slug):null;
 if(!course)return pageMetadata({title:'مسار في مدرسة 967',path,noindex:true});
 return pageMetadata({title:course.title+' — مدرسة 967',description:course.description,path,image:shareCardPath('course',slug,course.title,course.description)});
}
// Local-only preview of a card course (needs SCHOOL_V2_FIXTURES=1): units plus fixture lessons for the first stages.
async function fixtureCourse(name){
 if(process.env.SCHOOL_V2_FIXTURES!=='1'||!/^course-[a-z0-9-]{3,60}$/.test(name||''))return null;
 const read=async n=>JSON.parse(await readFile(path.join(process.cwd(),'data/school-v2/fixtures',n+'.json'),'utf8'));
 try{const course=await read(name);const lessons={};for(const [i,n] of Object.entries(course.lessons||{}))lessons[i]={name:n,lesson:await read(n)};return {...course,lessons};}catch{return null;}
}
// Only lesson metadata reaches the browser: card lessons carry their answer keys.
const stageMeta=s=>({index:s.index,title:s.title,subtitle:s.subtitle||'',format:s.format===2?2:1,template:s.template||null,minutes:Number.isInteger(s.minutes)?s.minutes:null});
export default async function CoursePage({params,searchParams}){
 const {slug}=await params,settings=await getSiteSettings(),db=serverDb();
 if(!sectionGate('school',settings)||!db)notFound();
 const course=(await publishedSchoolCatalog(db)).find(x=>x.slug===slug);
 if(!course)notFound();
 // Every course is a card course now (phase 8): only card lessons are listed and playable.
 const stages=(await publishedSchoolStageList(db,slug)).filter(s=>s.format===2);
 const preview=await fixtureCourse((await searchParams)?.fixture);
 if(!stages.length&&!preview)notFound();
 const back=course.category==='السياسة والاقتصاد'?'/school/civic':course.category==='الفلك والطبيعة'?'/school/nature':course.category==='المنطق والتفكير'?'/school/logic':'/school/writing';
 const journey=stages.map(s=>{const f=preview?.lessons?.[s.index];return stageMeta(f?{...f.lesson,index:s.index}:s);});
 const tools=SCHOOL_COURSE_TOOLS[slug],sources=SCHOOL_COURSE_SOURCES[slug];
 // Musnad keeps the history links of its old course page.
 const crossLinks=slug==='musnad'&&sectionIsVisible('history',settings.pageVisibility)
  ?musnadCrossLinks(await readPublicHistoryCatalog(db).then(r=>r.entries).catch(()=>[]),settings.pageVisibility):[];
 return <div className={styles.root}><section className={styles.workspace}><div className="container">
  <CourseJourney backHref={back} slug={slug} title={course.title} description={course.description} units={preview?.units||course.units} capstone={preview?.capstone??course.capstone}
   stages={journey} fixtures={preview?Object.fromEntries(Object.entries(preview.lessons).map(([i,f])=>[i,f.name])):null}/>
  {tools&&<nav className={styles.courseTools} aria-label="أدوات المسار"><h2>أدوات تساعدك</h2><div>{tools.map(t=><Link key={t.href} href={t.href}><strong>{t.title}</strong><span>{t.description}</span></Link>)}</div></nav>}
  {sources&&<section className={styles.courseTools} aria-labelledby="course-sources"><h2 id="course-sources">{sources.title}</h2><p className={styles.courseToolsNote}>{sources.note}</p><div>{sources.links.map(l=><a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"><strong>{l.title} <ExternalLink size={14} aria-hidden="true"/></strong><span>{l.label}</span></a>)}</div></section>}
  {crossLinks.length>0&&<div className={styles.courseExtra}><CrossSectionPaths items={crossLinks} id="musnad-cross-paths" title="من حروف المسند إلى تاريخ النقوش"/></div>}
 </div></section></div>;
}
