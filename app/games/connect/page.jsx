import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import ArcadeIntro from '@/components/games/ArcadeIntro';
import ExtraArcadeChallenge from '@/components/games/ExtraArcadeChallenge';
import {extraGameTypes} from '@/lib/extraGames';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import {dailyGameForDate,utcDay,dailyGameUrl} from '@/lib/dailyGame';
import styles from '../games.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'اربط المعلومة | ألعاب 967',description:'وصّل الشخصيات والأحداث والمدن بالمعلومات الصحيحة. جولات وتحديات يومية موثقة.',path:'/games/connect'});
export default async function Page({searchParams}){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 const params=await searchParams;
 const date=utcDay();
 if(params?.mode==='daily'&&dailyGameForDate(date)!=='connect')redirect(dailyGameUrl(date));
 return <div className={styles.root}>
  <ArcadeIntro compact title="اربط المعلومة" description={extraGameTypes.connect.description}>
   <Link href="/games" className={styles.heroSecondary}><ArrowRight size={17}/> جميع الألعاب</Link>
   <span className={styles.roundChip}>10 مهام <span aria-hidden="true">·</span> 7 ثوانٍ في تحدي اليوم</span>
  </ArcadeIntro>
  <ExtraArcadeChallenge game="connect" date={date} initialMode={params?.mode==='daily'?'daily':'practice'}/>
 </div>;
}
