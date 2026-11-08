import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Gamepad2} from 'lucide-react';
import ArcadeIntro from '@/components/games/ArcadeIntro';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {serverDb} from '@/lib/supabase-server';
import {readGameCatalog} from '@/lib/gameRepository';
import {officialQuizIdsToday} from '@/lib/dailyOfficialSeed';
import {generatedPracticeQuestions} from '@/lib/generatedQuestionsServer';
import {recordOperationalEvent} from '@/lib/operationalEvents';
import {pageMetadata} from '@/lib/seo';
import QuizGame from '@/components/games/QuizGame';
import styles from '../games.module.css';
import {dailyGameForDate,utcDay,dailyGameUrl} from '@/lib/dailyGame';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'اختبر معرفتك باليمن | ألعاب 967',description:'10 أسئلة تفاعلية عن اليمن مع نقاط وشروحات ومصادر موثقة، دون الحاجة إلى التسجيل.',path:'/games/quiz'});
export default async function QuizPage({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 const params=await searchParams;
 const date=utcDay();
 const mode=params?.mode==='daily'?'daily':'practice';
 if(mode==='daily'&&dailyGameForDate(date)!=='quiz')redirect(dailyGameUrl(date));
 let catalog;
 try{catalog=await readGameCatalog(serverDb());}catch{
  return <div className={styles.root}>
   <ArcadeIntro compact description="عالم المعرفة مفتوح، لكن بنك الأسئلة غير متاح في هذه اللحظة."><Link href="/games" className={styles.heroSecondary}><ArrowRight size={17}/> جميع الألعاب</Link></ArcadeIntro>
   <section className={styles.errorNotice} role="alert"><Gamepad2 size={31}/><h2>تعذر تحميل الأسئلة</h2><p>يرجى إعادة المحاولة أو العودة إلى قسم الألعاب.</p><Link href="/games">العودة إلى الألعاب</Link></section>
  </div>;
 }

 // Today's official questions are not sent to the browser with their answers.
 let practice=catalog.questions.filter(q=>q.isPublished);
 try{const official=new Set(await officialQuizIdsToday(null,date,catalog.questions));practice=practice.filter(q=>!official.has(q.id));}
 catch{recordOperationalEvent('source_unavailable',{source:'games',area:'quiz-daily'});}
 // Free play also gets questions generated from the site's own data (40 a day, practice only).
 if(mode==='practice')practice=[...practice,...await generatedPracticeQuestions(date).catch(()=>[])];
 return <div className={styles.root}>
  <ArcadeIntro compact description="أربع اختيارات. إجابة واحدة صحيحة. عشر محطات تفصلك عن نتيجة تستحق أن تفتخر بها.">
   <Link href="/games" className={styles.heroSecondary}><ArrowRight size={17}/> جميع الألعاب</Link>
   <span className={styles.roundChip}>10 أسئلة <span aria-hidden="true">·</span> نقاط وتحديات</span>
  </ArcadeIntro>
  <QuizGame key={mode} questions={practice} date={date} initialMode={mode}/>
 </div>;
}
