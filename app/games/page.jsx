import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowUpLeft,BookOpenCheck,CalendarDays,Gamepad2,MapPinned,Play,ScrollText,Shuffle,ShieldCheck,Sparkles,Trophy,Zap,UsersRound,Scale,Link2,SpellCheck,ScanSearch} from 'lucide-react';
import ArcadeIntro from '@/components/games/ArcadeIntro';
import GamesHomeStatus from '@/components/games/GamesHomeStatus';
import GameAchievementGallery from '@/components/games/GameAchievementGallery';
import WeeklyArcade from '@/components/games/WeeklyArcade';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from './games.module.css';
import {dailyGameUrl,utcDay} from '@/lib/dailyGame';

// UTC daily game selection must be computed for each request, not at build time.
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'ألعاب 967',description:'تسع ألعاب ثقافية تفاعلية عن اليمن في معرض ألعاب واحد: شخصيات ومعالم وتاريخ وخرائط ومقارنات وتحديات يومية موثقة.',path:'/games'});

// A single catalog and a single visual grid: no distinction between original and newer games.
const games=[
 {id:'quiz',number:'01',title:'اختبر معرفتك باليمن',subtitle:'KNOWLEDGE QUEST',category:'معرفة عامة',description:'أسئلة سريعة تكشف لك تفاصيل جديدة من تاريخ اليمن وثقافته.',href:'/games/quiz',icon:BookOpenCheck,teaser:'فكّر وأجب'},
 {id:'place',number:'02',title:'خمن المكان',subtitle:'GUESS THE PLACE',category:'صور ومعالم',description:'شاهد الصورة، اكتشف المعلم، واختر المكان الصحيح.',href:'/games/place',icon:MapPinned,teaser:'تعرف على المكان'},
 {id:'timeline',number:'03',title:'رتب التاريخ',subtitle:'TIME ORDER',category:'تاريخ',description:'ضع الأحداث التاريخية اليمنية في ترتيبها الصحيح.',href:'/games/timeline',icon:ScrollText,teaser:'رتّب الأحداث'},
 {id:'map',number:'04',title:'أين تقع؟',subtitle:'MAP QUEST',category:'جغرافيا',description:'تحدَّ ذاكرتك وحدد المحافظات على خريطة اليمن.',href:'/games/map',icon:Shuffle,teaser:'اكتشف الخريطة'},
 {id:'who',number:'05',title:'من أنا؟',subtitle:'WHO AM I?',category:'شخصيات',description:'ثلاثة تلميحات متدرجة تكشف لك شخصية يمنية مشهورة.',href:'/games/who',icon:UsersRound,teaser:'اكشف الشخصية'},
 {id:'bigger',number:'06',title:'أيهما أكبر؟',subtitle:'HIGHER OR LOWER',category:'مقارنات',description:'قارن المساحات والجبال واكتشف من صاحب الرقم الأكبر.',href:'/games/bigger',icon:Scale,teaser:'اختر الأكبر'},
 {id:'connect',number:'07',title:'اربط المعلومة',subtitle:'MATCH QUEST',category:'توصيل',description:'صِل الشخصيات والمدن والأحداث بالمعلومات الصحيحة.',href:'/games/connect',icon:Link2,teaser:'أكمل الوصلات'},
 {id:'yemenword',number:'08',title:'خمن الإجابة اليمنية',subtitle:'WORD QUEST',category:'حروف وكلمات',description:'كوّن الحروف لتكتشف اسمًا أو حدثًا أو مكانًا يمنيًا.',href:'/games/yemenword',icon:SpellCheck,teaser:'كوّن الإجابة'},
 {id:'object',number:'09',title:'ما هذا الشيء؟',subtitle:'OBJECT QUEST',category:'تراث وصور',description:'تعرّف على آثار وأشياء يمنية من صور حقيقية.',href:'/games/object',icon:ScanSearch,teaser:'اكتشف الشيء'},
];

export default async function GamesPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('games',settings))notFound();
 const date=utcDay();
 const todayGame=dailyGameUrl(date);
 return <div className={styles.root}>
  <ArcadeIntro slim description="تاريخ وجغرافيا وشخصيات وألغاز، ولكن بروح المنافسة. تسع طرق مختلفة لاكتشاف اليمن — اختر اللعبة التي تشدّك!">
   <Link className={styles.heroPrimary} href="#choose-your-game"><Gamepad2 size={19} aria-hidden="true"/> اختر لعبتك <ArrowLeft size={18} aria-hidden="true"/></Link>
   <Link className={styles.heroSecondary} href={todayGame}><CalendarDays size={19} aria-hidden="true"/> تحدي اليوم</Link>
   <Link className={styles.heroSecondary} href="/games/leaderboard"><Trophy size={19} aria-hidden="true"/> لوحة المتصدرين</Link>
  </ArcadeIntro>
  <section className={styles.dailyFirst} aria-label="تحدي اليوم وملفي في ألعاب 967"><div className="container"><GamesHomeStatus initialDate={date}/></div></section>
  <section className={styles.gameSection} id="choose-your-game" aria-labelledby="games-heading">
   <div className="container">
    <div className={styles.sectionHeading}>
     <div><span className={styles.sectionEyebrow}><span/> اختر لعبتك</span>
      <h2 id="games-heading">اختر لعبتك التالية <span className={styles.headingStar} aria-hidden="true">✦</span></h2>
      <p>تسع ألعاب. تسع تجارب مختلفة. جميعها جاهزة للعب في مكان واحد.</p>
     </div>
     <span className={styles.availableCount}><span/> 9 ألعاب متاحة</span>
    </div>
    <div className={styles.arcadeGuide} aria-label="طريقة اللعب">
     <span><Gamepad2 size={16} aria-hidden="true"/> اختر أي لعبة وابدأ فورًا</span>
     <span><Zap size={16} aria-hidden="true"/> 10 مهام في كل جولة</span>
     <span><ShieldCheck size={16} aria-hidden="true"/> نتائج تحدي اليوم موثقة</span>
    </div>
    <div className={styles.selectGrid} aria-label="جميع ألعاب 967 التسع">
     {games.map(game=>{
      const Icon=game.icon;
      return <Link href={game.href} key={game.id} className={[styles.selectTile,styles['tile_'+game.id]].join(' ')}>
       <div className={styles.tileTop}>
        <span className={styles.tileSerial} dir="ltr">{game.number} <span>/ 09</span></span>
        <span className={styles.tileAvailable}><span aria-hidden="true"/> متاحة للعب</span>
       </div>
       <div className={styles.tileArt} aria-hidden="true">
        <span className={styles.tileOrbitOuter}/>
        <span className={styles.tileOrbitInner}/>
        <span className={styles.tileArtDot}/>
        <span className={styles.tileIconFrame}><Icon size={57} strokeWidth={1.6}/></span>
        <span className={styles.tileXP}>967 <Zap size={12} fill="currentColor"/></span>
       </div>
       <div className={styles.tileContent}>
        <div className={styles.tileMeta}><span className={styles.tileCategory}>{game.category}</span></div>
        <h3>{game.title}</h3>
        <p>{game.description}</p>
       </div>
       <div className={styles.tileFooter}>
        <span><Play size={14} fill="currentColor" aria-hidden="true"/> {game.teaser}</span>
        <span className={styles.tileGo} aria-hidden="true"><ArrowUpLeft size={20}/></span>
       </div>
      </Link>;
     })}
    </div>

    <div className={styles.secondarySections} aria-label="المهمات والإنجازات">
     <details className={styles.secondarySection}><summary><span>المهمات الأسبوعية</span><small>ثلاث مهمات وترتيب أسبوعي متجدد</small></summary><div className={styles.secondaryContent}><WeeklyArcade/></div></details>
     <details className={styles.secondarySection}><summary><span>الشارات والإنجازات</span><small>تابع ما جمعته وما تبقى أمامك</small></summary><div className={styles.secondaryContent}><GameAchievementGallery preview/></div></details>
    </div>
    <Link href="/games/leaderboard" className={styles.leaderboardStrip}><Trophy size={25}/><span><strong>لوحة متصدري 967</strong><small>ترتيب يومي وأسبوعي وشهري وتاريخي · نتائج رسمية موثقة للألعاب التسع</small></span><ArrowUpLeft size={20}/></Link>
    <div className={styles.infoRow}>
     <span><Gamepad2 size={19} aria-hidden="true"/> الجولات الحرة بدون تسجيل</span>
     <span><ShieldCheck size={19} aria-hidden="true"/> النتائج الرسمية موثقة على الخادم</span>
     <span><Sparkles size={19} aria-hidden="true"/> تعلم شيئًا جديدًا بعد كل إجابة</span>
    </div>
   </div>
  </section>
 </div>;
}
