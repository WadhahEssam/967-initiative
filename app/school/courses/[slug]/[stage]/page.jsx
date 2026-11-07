import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowRight} from 'lucide-react';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {publishedSchoolCatalog,publishedSchoolStages} from '@/lib/schoolContentServer';
import GenericSchoolLesson from '@/components/school/GenericSchoolLesson';
import CardLessonPlayer from '@/components/school/v2/CardLessonPlayer';
import {validateCardLesson} from '@/lib/schoolCards';
import {cardSnapshot} from '@/lib/schoolCardProgress';
import {resolveCardVisuals} from '@/lib/schoolCardVisualsServer';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pageMetadata} from '@/lib/seo';
import styles from '../../../studio/studio.module.css';
import player from '@/components/school/LessonPlayer.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'محطات مدرسة 967',path:'/school/courses'});
// Local-only preview of card lessons from data/school-v2/fixtures (never in production: needs SCHOOL_V2_FIXTURES=1).
async function fixtureLesson(name){
 if(process.env.SCHOOL_V2_FIXTURES!=='1'||!/^[a-z0-9-]{3,60}$/.test(name||''))return null;
 try{return JSON.parse(await readFile(path.join(process.cwd(),'data/school-v2/fixtures',name+'.json'),'utf8'));}catch{return null;}
}
export default async function CourseStagePage({params,searchParams}){
 const {slug,stage:raw}=await params,settings=await getSiteSettings(),db=serverDb();
 const fixture=await fixtureLesson((await searchParams)?.fixture);
 if(!sectionGate('school',settings)||!db||slug==='musnad'||!/^(?:[1-9]|1[0-2])$/.test(raw))notFound();
 const course=(await publishedSchoolCatalog(db)).find(x=>x.slug===slug);
 if(!course)notFound();
 const stages=await publishedSchoolStages(db,slug),index=Number(raw)-1,stage=fixture?{...fixture,index}:stages.find(x=>x.index===index);
 if(!stage)notFound();
 // Card lessons (format 2): the public lesson goes to the browser; answer keys stay on the server,
 // except for the first lesson, which guests may try without an account (graded in the browser, no points).
 if(stage.format===2){
  let lesson;try{lesson=validateCardLesson(stage).lesson;}catch{notFound();}
  lesson=await resolveCardVisuals(lesson);
  return <CardLessonPlayer slug={slug} stageIndex={index} lesson={lesson} guestSnapshot={index===0?cardSnapshot(stage):null}
   courseTitle={course.title} hasNext={stages.some(x=>x.index===index+1)}/>;
 }
 return <div className={styles.root}><section className={styles.workspace}><div className="container">
  <Link href={'/school/courses/'+slug} className={player.crumb}><ArrowRight size={14}/> {course.title}</Link>
  <GenericSchoolLesson slug={slug} stage={stage} hasNext={stages.some(x=>x.index===index+1)}/>
 </div></section></div>;
}
