import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowRight} from 'lucide-react';
import SchoolCourseMap from '@/components/school/SchoolCourseMap';
import CourseJourney from '@/components/school/v2/CourseJourney';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {publishedSchoolCatalog,publishedSchoolStages} from '@/lib/schoolContentServer';
import {pageMetadata} from '@/lib/seo';
import {SCHOOL_COURSE_TOOLS} from '@/lib/schoolCourseTools';
import styles from '../../studio/studio.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'مسارات مدرسة 967',path:'/school/courses'});
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
 const stages=await publishedSchoolStages(db,slug);
 // Musnad still runs on its built-in pages until its card lessons are published.
 if(slug==='musnad'&&!stages.some(s=>s.format===2))notFound();
 const back=course.category==='السياسة والاقتصاد'?'/school/civic':course.category==='الفلك والطبيعة'?'/school/nature':course.category==='المنطق والتفكير'?'/school/logic':'/school/writing';
 const preview=await fixtureCourse((await searchParams)?.fixture);
 const journey=stages.map(s=>{const f=preview?.lessons?.[s.index];return stageMeta(f?{...f.lesson,index:s.index}:s);});
 // Card courses (format 2) use the journey map; other courses keep the station map until they are rebuilt.
 if(preview||course.format===2||journey.some(s=>s.format===2))return <div className={styles.root}><section className={styles.workspace}><div className="container">
  <CourseJourney backHref={back} slug={slug} title={course.title} description={course.description} units={preview?.units||course.units} capstone={preview?.capstone??course.capstone}
   stages={journey} fixtures={preview?Object.fromEntries(Object.entries(preview.lessons).map(([i,f])=>[i,f.name])):null}/>
  {SCHOOL_COURSE_TOOLS[slug]&&<nav className={styles.courseTools} aria-label="أدوات المسار"><h2>أدوات تساعدك</h2><div>{SCHOOL_COURSE_TOOLS[slug].map(t=><Link key={t.href} href={t.href}><strong>{t.title}</strong><span>{t.description}</span></Link>)}</div></nav>}
 </div></section></div>;
 return <div className={styles.root}><header className={styles.hero}><div className="container">
  <Link className={styles.back} href={course.category==='السياسة والاقتصاد'?'/school/civic':course.category==='الفلك والطبيعة'?'/school/nature':course.category==='المنطق والتفكير'?'/school/logic':'/school/writing'}><ArrowRight size={16}/> جميع المسارات</Link>
  <h1>{course.title}</h1><p>{course.description}</p>
  <p>{course.category} · {stages.length} محطة منشورة</p>
 </div></header><section className={styles.workspace}><div className="container">
  <div className={styles.report}><h2>محطات هذا المسار</h2><p>أكمل المحطات بالترتيب؛ تحتاج إلى 5 إجابات صحيحة من 6 لفتح المحطة التالية.</p>
   <SchoolCourseMap slug={slug} stages={stages}/>
  </div>
 </div></section></div>;
}
