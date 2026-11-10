import Link from 'next/link';
import {countOf} from '@/lib/arabicCount';
import {ArrowLeft,CheckCircle2,Compass,Flag,MapPinned,Route,Star} from 'lucide-react';
import styles from './SchoolTrackTrail.module.css';

export default function SchoolTrackTrail({tracks=[],theme='writing',intro='اختر المسار الذي يناسب فضولك.'}){
 if(!tracks.length)return null;
 const total=tracks.reduce((n,t)=>n+(Number.isFinite(t.count)?t.count:0),0);
 return <section className={styles.trail} data-theme={theme} aria-label="مسارات القسم التعليمية">
  <header className={styles.trailHead}>
   <div><span className={styles.kicker}><Route size={17}/> اختر مغامرتك التالية</span><h3>مسارات مترابطة، تجارب مختلفة</h3><p>{intro}</p></div>
   <div className={styles.trailCount}><strong>{tracks.length}</strong><span>مسارات منشورة</span>{total>0&&tracks.every(t=>Number.isFinite(t.count))&&<small>{countOf(total,'lesson')}</small>}</div>
  </header>
  <ol className={styles.steps}>{tracks.map((track,index)=>{
   const Icon=track.icon||Compass;
   return <li className={styles.step} key={track.href||track.slug} style={{'--step-index':index}}>
    <span className={styles.pathPin} aria-hidden="true"><span>{String(index+1).padStart(2,'0')}</span></span>
    <Link href={track.href||'/school/courses/'+track.slug} className={styles.quest} aria-label={'استكشف مسار '+track.title}>
     <div className={styles.illustration} aria-hidden="true">
      <span className={styles.artRing}/>
      <span className={styles.artGlyph} dir="ltr">{track.glyph||'✦'}</span>
      <span className={styles.artIcon}><Icon size={27}/></span>
      <span className={styles.artGround}/>
     </div>
     <div className={styles.questBody}>
      <div className={styles.questMeta}><span><MapPinned size={14}/> المسار {String(index+1).padStart(2,'0')}</span><span className={styles.isOpen}><span/> مسار متاح</span></div>
      <h4>{track.title}</h4>
      <p>{track.description}</p>
      <div className={styles.questFacts}><span><Flag size={16}/>{track.count?countOf(track.count,'lesson'):'دروس تفاعلية'}</span>{track.label&&<span><Star size={15}/>{track.label}</span>}</div>
      <span className={styles.questAction}>ادخل المسار <ArrowLeft size={19}/></span>
     </div>
    </Link>
   </li>;
  })}</ol>
  <footer className={styles.foot}><CheckCircle2 size={20}/><div><strong>كيف تتقدم؟</strong><p>يمكنك اختيار أي مسار منشور. داخل كل مسار يُفتح الدرس بعد إنهاء الذي قبله، وأول ثلاثة مفتوحة للجميع. ولا يعني ترتيب المسارات هنا أنها مقفلة.</p></div></footer>
 </section>;
}
