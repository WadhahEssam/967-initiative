import {notFound} from 'next/navigation';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {publishedSchoolCatalog,publishedSchoolStages} from '@/lib/schoolContentServer';
import CardLessonPlayer from '@/components/school/v2/CardLessonPlayer';
import {validateCardLesson} from '@/lib/schoolCards';
import {cardSnapshot} from '@/lib/schoolCardProgress';
import {resolveCardVisuals} from '@/lib/schoolCardVisualsServer';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pageMetadata} from '@/lib/seo';
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
 if(!sectionGate('school',settings)||!db||!/^(?:[1-9]|1[0-2])$/.test(raw))notFound();
 const course=(await publishedSchoolCatalog(db)).find(x=>x.slug===slug);
 if(!course)notFound();
 const stages=await publishedSchoolStages(db,slug),index=Number(raw)-1,stage=fixture?{...fixture,index}:stages.find(x=>x.index===index);
 if(!stage)notFound();
 // Card lessons (format 2): the public lesson goes to the browser; answer keys stay on the server,
 // except for the first lesson, which guests may try without an account (graded in the browser, no points).
 // Every lesson is a card lesson now (phase 8); anything else is not playable.
 if(stage.format!==2)notFound();
 let lesson;try{lesson=validateCardLesson(stage).lesson;}catch{notFound();}
 lesson=await resolveCardVisuals(lesson);
 return <CardLessonPlayer slug={slug} stageIndex={index} lesson={lesson} guestSnapshot={index===0?cardSnapshot(stage):null}
  courseTitle={course.title} hasNext={stages.some(x=>x.index===index+1)}/>;
}
