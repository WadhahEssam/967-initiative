import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import ArcadeIntro from '@/components/games/ArcadeIntro';
import ArcadeChallenge from '@/components/games/ArcadeChallenge';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from '../games.module.css';
import {dailyGameForDate,utcDay,dailyGameUrl} from '@/lib/dailyGame';

// UTC daily game selection must be computed for each request, not at build time.
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'رتب التاريخ | ألعاب 967',description:'لعبة رتب التاريخ عن اليمن مع عشر مهام ونظام نقاط ومؤقت اختياري وتحدٍ يومي موحد.',path:'/games/timeline'});
export default async function GamePage({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 const params=await searchParams;
 const date=utcDay();
 if(params?.mode==='daily'&&dailyGameForDate(date)!=='timeline')redirect(dailyGameUrl(date));
 return <div className={styles.root}>
  <ArcadeIntro compact title="رتب التاريخ" description="اختبر معرفتك باليمن في تحدٍ سريع. أمامك 10 أو 15 أو 20 أو 30 ثانية لكل مهمة، أو 7 ثوانٍ ثابتة في تحدي اليوم.">
   <Link href="/games" className={styles.heroSecondary}><ArrowRight size={17}/> جميع الألعاب</Link>
   <span className={styles.roundChip}>10 مهام <span aria-hidden="true">·</span> تحدي زمني</span>
  </ArcadeIntro>
  <ArcadeChallenge game="timeline" date={date} initialMode={params?.mode==='daily'?'daily':'practice'}/>
 </div>;
}
