import {shareCardPath} from '@/lib/shareCard';
import {notFound} from 'next/navigation';
import {serverDb} from '@/lib/supabase-server';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {publishedSchoolCatalog,publishedSchoolStage,publishedSchoolStageList} from '@/lib/schoolContentServer';
import CardLessonPlayer from '@/components/school/v2/CardLessonPlayer';
import {validateCardLesson} from '@/lib/schoolCards';
import {cardSnapshot} from '@/lib/schoolCardProgress';
import {guestLessonOpen} from '@/lib/schoolGuest';
import {resolveCardVisuals} from '@/lib/schoolCardVisualsServer';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
// Each lesson has its own title and canonical address (they all used to share one title and
// point their canonical link at /school/courses, which does not exist).
export async function generateMetadata({params}){
 const {slug,stage:raw}=await params,db=serverDb();
 const path='/school/courses/'+slug+'/'+raw;
 if(!db||!/^(?:[1-9]|1[0-2])$/.test(raw))return pageMetadata({title:'درس في مدرسة 967',path,noindex:true});
 const [catalog,list]=await Promise.all([publishedSchoolCatalog(db).catch(()=>[]),publishedSchoolStageList(db,slug).catch(()=>[])]);
 const course=catalog.find(x=>x.slug===slug),lesson=list.find(x=>x.index===Number(raw)-1);
 if(!course||!lesson)return pageMetadata({title:'درس في مدرسة 967',path,noindex:true});
 return pageMetadata({title:lesson.title+' — '+course.title,description:lesson.subtitle||course.description,path,image:shareCardPath('course',slug,course.title,course.description)});
}
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
 // One lesson plus the lesson list (for «الدرس التالي»), not every lesson of the course.
 const index=Number(raw)-1,[list,published]=await Promise.all([publishedSchoolStageList(db,slug),fixture?null:publishedSchoolStage(db,slug,index)]);
 const stage=fixture?{...fixture,index}:published&&{index,...published};
 if(!stage)notFound();
 // Card lessons (format 2): the public lesson goes to the browser; answer keys stay on the server,
 // except for the first lessons (lib/schoolGuest GUEST_LESSONS), which guests may take without an
 // account: graded in the browser, then graded again on the server after they sign in.
 // Every lesson is a card lesson now (phase 8); anything else is not playable.
 if(stage.format!==2)notFound();
 let lesson;try{lesson=validateCardLesson(stage).lesson;}catch{notFound();}
 lesson=await resolveCardVisuals(lesson);
 return <CardLessonPlayer slug={slug} stageIndex={index} lesson={lesson} guestSnapshot={guestLessonOpen(index)?cardSnapshot(stage):null}
  courseTitle={course.title} hasNext={list.some(x=>x.index===index+1)}/>;
}
