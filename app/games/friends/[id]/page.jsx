import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowRight,Swords} from 'lucide-react';
import ArcadeIntro from '@/components/games/ArcadeIntro';
import FriendDuel from '@/components/games/FriendDuel';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from '../../games.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'تحدٍ خاص بين صديقين | ألعاب 967',description:'تنافس مع صديقك في عشر مهام يمنية متطابقة مع نتيجة موثقة.',path:'/games/friends',noindex:true,nofollow:true});
export default async function Page({params}){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 const {id}=await params;
 if(typeof id!=='string'||id.length>64)notFound();
 return <div className={styles.root} dir="rtl">
  <ArcadeIntro compact title="مواجهة 967" description="نفس الأسئلة، نفس الزمن، والنتيجة تحسم المنافسة. لكل لاعب محاولة واحدة فقط.">
   <Link href="/games" className={styles.heroSecondary}><Swords size={17}/> اختر لعبة لتحدي صديقك</Link>
   <Link href="/games" className={styles.heroSecondary}><ArrowRight size={17}/> جميع الألعاب</Link>
  </ArcadeIntro>
  <div className="container"><FriendDuel id={id}/></div>
 </div>;
}
