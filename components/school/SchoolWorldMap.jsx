import Link from 'next/link';
import {ArrowLeft,BookOpen,BrainCircuit,Compass,GraduationCap,Landmark,LockKeyhole,Map,Orbit,PenTool,Sparkles,Telescope,Route} from 'lucide-react';
import styles from './SchoolWorldMap.module.css';

const worlds=[
 {id:'writing',number:'01',href:'/school/writing',name:'الكتابة والأدب',subtitle:'وادي الحروف',description:'ابدأ من المسند، مرّ بأوزان الشعر، ثم اكتشف جمال الخط العربي.',tracks:'3 مسارات',stages:'36 محطة',symbol:'𐩣',icon:PenTool,landmarks:['خط المسند','العروض','الخطوط العربية'],tone:'ink'},
 {id:'nature',number:'02',href:'/school/nature',name:'الفلك والطبيعة',subtitle:'مرصد الكون',description:'تنقّل بين الكواكب والغيوم وطبقات الأرض والمجرات، وجرّب بنفسك.',tracks:'4 مسارات',stages:'48 محطة',symbol:'☉',icon:Telescope,landmarks:['النظام الشمسي','الطقس','أسرار الكون'],tone:'space'},
 {id:'logic',number:'03',href:'/school/logic',name:'المنطق والتفكير',subtitle:'متاهة الأفكار',description:'حل الألغاز، اكشف المغالطات، وفكّ الشفرات وابنِ الدوائر المنطقية.',tracks:'4 مسارات',stages:'48 محطة',symbol:'∧∨',icon:BrainCircuit,landmarks:['الاستدلال','شفرة مورس','البوابات المنطقية'],tone:'mind'},
 {id:'civic',number:'04',href:'/school/civic',name:'السياسة والاقتصاد',subtitle:'مدينة القرارات',description:'اكتشف كيف تعمل المؤسسات والأسواق والبنوك، واختبر قراراتك داخل مختبرات افتراضية.',tracks:'4 مسارات',stages:'48 محطة',symbol:'§',icon:Landmark,landmarks:['الدولة','الأسواق','المال'],tone:'civic'},
];
export default function SchoolWorldMap(){
 return <section className={styles.map} aria-label="خريطة مجالات مدرسة 967">
  <div className={styles.mapHeading}>
   <div className={styles.mapTag}><Compass size={18}/> خريطة مغامراتك</div>
   <p>اختر عالمًا لتدخل إليه. كل عالم يحتوي مسارات ومحطات تتقدم فيها حسب إنجازك.</p>
   <div className={styles.legend}><span><span className={styles.activeDot}/> منطقة متاحة</span><span><LockKeyhole size={14}/> قيد الإعداد</span></div>
  </div>
  <ol className={styles.worldList}>
   {worlds.map((world,i)=>{
    const Icon=world.icon;
    return <li className={styles.worldItem} key={world.id} data-tone={world.tone}>
     <div className={styles.roadNode} aria-hidden="true"><span>{world.number}</span></div>
     <Link href={world.href} className={styles.world}>
      <div className={styles.scene} aria-hidden="true">
       <span className={styles.sceneGrid}/>
       <span className={styles.sceneHalo}/>
       <span className={styles.sceneMark}>{world.symbol}</span>
       <span className={styles.sceneSatellite+' '+styles.satA}><Sparkles size={22}/></span>
       <span className={styles.sceneSatellite+' '+styles.satB}>{i===1?<Orbit size={30}/>:i===2?<BrainCircuit size={27}/>:i===3?<Landmark size={25}/>:<BookOpen size={24}/>}</span>
       <span className={styles.sceneFloor}/>
       <span className={styles.sceneTitle}>{world.subtitle}</span>
      </div>
      <div className={styles.worldInfo}>
       <div className={styles.worldKicker}><span>العالم {world.number}</span><span className={styles.open}><span/> مفتوح للاستكشاف</span></div>
       <div className={styles.worldTitle}><span className={styles.worldIcon}><Icon size={24}/></span><h3>{world.name}</h3></div>
       <p>{world.description}</p>
       <div className={styles.routeBadges}><span><Route size={15}/>{world.tracks}</span><span><GraduationCap size={15}/>{world.stages}</span></div>
       <div className={styles.landmarks} aria-label="مواضيع العالم">{world.landmarks.map((name,j)=><span key={name}>{j>0&&<i aria-hidden="true"/>}{name}</span>)}</div>
       <span className={styles.worldAction}>ادخل هذا العالم <ArrowLeft size={19}/></span>
      </div>
     </Link>
    </li>;
   })}
   <li className={styles.worldItem+' '+styles.future} data-tone="future">
    <div className={styles.roadNode} aria-hidden="true"><LockKeyhole size={18}/></div>
    <div className={styles.worldPending} aria-label="الفنون والمهارات، قيد الإعداد">
     <div className={styles.futureBadge}><Map size={27}/></div>
     <div><span className={styles.futureTag}>العالم 05 · قيد الإعداد</span><h3>الفنون والمهارات</h3><p>مساحة للتصميم والزخرفة والمشاريع الإبداعية. سنفتحها عندما تجهز دروسها.</p></div>
     <span className={styles.lockText}><LockKeyhole size={16}/> قريبًا</span>
    </div>
   </li>
  </ol>
  <div className={styles.mapEnd}><Sparkles size={18}/><span>يمكنك دخول أي عالم متاح. أما المحطات داخل المسار فتُفتح تباعًا بعد النجاح.</span><Link href="/school/dashboard">تابع تقدمك <ArrowLeft size={16}/></Link></div>
 </section>;
}
