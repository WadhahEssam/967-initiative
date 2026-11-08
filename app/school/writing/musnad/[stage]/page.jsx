import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ChevronLeft} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {musnadStage} from '@/lib/schoolMusnad';
import SchoolLesson from '@/components/school/SchoolLesson';
import {serverDb} from '@/lib/supabase-server';
import {publishedSchoolStage} from '@/lib/schoolContentServer';
import {pageMetadata} from '@/lib/seo';
import styles from '../../../school.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'مراحل خط المسند | مدرسة 967',path:'/school/writing/musnad'});
export default async function StagePage({params}){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 const {stage:raw}=await params;
 if(!/^[1-9][0-9]*$/.test(raw))notFound();
 const original=musnadStage(Number(raw)-1);
 if(!original)notFound();
 const db=serverDb();
 const overlay=db?await publishedSchoolStage(db,'musnad',original.index):null;
 // A published card lesson for this stage opens in the card player instead of the old lesson.
 if(overlay?.format===2)redirect('/school/courses/musnad/'+raw);
 const stage=overlay?{...original,...overlay}:original;
 return <div className={styles.root}>
  <div className={styles.lessonPage}><div className="container"><div className={styles.breadcrumb}><Link href="/school">مدرسة 967</Link><ChevronLeft size={14}/><Link href="/school/writing/musnad">خط المسند</Link><ChevronLeft size={14}/> المرحلة {raw}</div>
   <SchoolLesson stage={stage}/>
  </div></div>
 </div>;
}