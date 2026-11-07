import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,Trophy,ShieldCheck} from 'lucide-react';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import Leaderboard from '@/components/games/Leaderboard';
import styles from '../games.module.css';
import board from './leaderboard.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'لوحة المتصدرين | ألعاب 967',description:'الترتيب الرسمي الموحد لألعاب 967: أبطال اليوم والأسبوع والشهر وكل الوقت، مع نتائج موثقة.',path:'/games/leaderboard'});
export default async function Page(){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 return <div className={styles.root} dir="rtl">
  <header className={board.hero}>
   <div className="container">
    <nav className={board.breadcrumb} aria-label="مسار الصفحة"><Link href="/games">ألعاب 967</Link><ArrowLeft size={14}/><span aria-current="page">لوحة المتصدرين</span></nav>
    <span className={board.eyebrow}><ShieldCheck size={16}/> OFFICIAL RANKINGS / 967</span>
    <h1>لوحة <em>المتصدرين</em></h1>
    <p>منافسة واحدة تجمع ألعاب المعرفة والجغرافيا والتاريخ. نتيجة رسمية واحدة لكل حساب في اليوم، ونقاط محسوبة على الخادم.</p>
    <div className={board.heroActions}><Link href="/games" className={board.return}><ArrowLeft size={17}/> عُد إلى الألعاب</Link><span><Trophy size={16}/> 9 ألعاب · ترتيب موحد</span></div>
   </div>
  </header>
  <Leaderboard/>
 </div>;
}
