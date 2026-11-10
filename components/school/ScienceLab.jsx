'use client';
import {useMemo,useState} from 'react';
import {FlaskConical,CheckCircle2,AlertTriangle,RefreshCw,ExternalLink} from 'lucide-react';
import {SCIENCE_LABS,calculateScienceLab,SOLAR_PLANETS} from '@/lib/schoolScienceModels';
import {labObservationChoices} from '@/lib/schoolLabEvidence';
import styles from '@/app/school/studio/studio.module.css';

const n=(value,precision=4)=>{
 if(Math.abs(value)>=1000000000)return new Intl.NumberFormat('ar',{notation:'compact',maximumSignificantDigits:4}).format(value);
 if(Math.abs(value)>0&&Math.abs(value)<0.0001)return value.toExponential(3);
 return new Intl.NumberFormat('ar',{maximumFractionDigits:precision}).format(value);
};
function Diagram({model,result,x,y}){
 const ratio=result.ratio||0,light='#d4e5cc',ink='#335e57',accent='#6db89b';
 const circle=(cx,cy,r,color=accent)=> <circle cx={cx} cy={cy} r={r} fill={color}/>;
 const label=(txt,x0,y0)=> <text x={x0} y={y0} fill="#dcece3" fontSize="12" textAnchor="middle">{txt}</text>;
 let view;
 switch(model){
 case 'solar-sun':
  view=<>{[61,52,40,28,16].map((r,i)=><circle key={i} cx="150" cy="87" r={r} fill={['#e8ac64','#e7ca7e','#f4db9e','#e9a66a','#e7dcab'][i]} opacity={1-i*.07}/>)}
   <path d="M150 26V148" stroke="#35564d" strokeWidth="2.5" strokeDasharray="5 4"/>
   {label('اللب ← الطبقات الخارجية',150,164)}</>;break;
 case 'solar-mission':
  view=<><circle cx="151" cy="83" r="19" fill="#e7c07b"/>
   <circle cx="151" cy="83" r="48" fill="none" stroke="#7da9a0" strokeWidth="2.5"/>
   <circle cx="151" cy="83" r="74" fill="none" stroke="#7295a7" strokeWidth="2" strokeDasharray="5 4"/>
   <path d="M186 117Q233 101 235 47" stroke="#e5d3a1" strokeWidth="3" fill="none"/>
   {circle(223,61,7,'#e7d7b0')}{label('انتقال مداري مثالي',150,164)}</>;break;
 case 'cosmos-blackhole':
  view=<><circle cx="150" cy="84" r="43" fill="#6d9c91" opacity=".35"/>
   {circle(150,84,24,'#07151c')}
   <ellipse cx="150" cy="84" rx="73" ry="26" fill="none" stroke="#d3b575" strokeWidth="7"
     transform="rotate(-21 150 84)"/>
   <path d="M40 38Q93 26 105 54T194 105T263 127" stroke="#a9d8d3" strokeWidth="2" fill="none"/>
   {label('رسم مفاهيمي غير مقياسي',150,164)}</>;break;
 case 'solar-scale':
  view=<>{circle(63,84,11,'#5da0c3')}{circle(209,84,Math.max(7,Math.sqrt(ratio)*48),'#d69c62')}
   {label('الأرض',63,142)}{label(SOLAR_PLANETS[Math.round(x)].name,209,142)}</>;break;
 case 'solar-orbit':{
  const ry=61*Math.sqrt(1-y*y);
  view=<><ellipse cx="156" cy="83" rx="114" ry={ry} fill="none" stroke={accent} strokeWidth="2.5"/>
   {circle(156-114*y,83,20,'#e6bd75')}{circle(270,83,8,'#8dc2cd')}{label('الشمس عند إحدى البؤرتين',140,154)}</>;break;
 }
 case 'solar-seasons':
  view=<><path d="M22 55H85M22 83H85M22 111H85" stroke="#ffcd7f" strokeWidth="5"/>
   {circle(182,84,55,'#457fa1')}<path d="M182 29v110" stroke={accent} strokeWidth="3"
    transform={`rotate(${-x} 182 84)`}/><path d="M126 84h111" stroke="#b4d7c2" strokeDasharray="4 6"/>
   {label('محور الأرض المائل',171,154)}</>;break;
 case 'solar-moon':{
  const theta=x*Math.PI/180;const xx=156+80*Math.cos(theta),yy=85+61*Math.sin(theta);
  view=<>{circle(40,85,28,'#e5b96e')}{circle(157,85,30,'#4b96a4')}
   <ellipse cx="156" cy="85" rx="81" ry="62" fill="none" stroke="#6e998f" strokeDasharray="5 5"/>
   {circle(xx,yy,15,'#c7d0d2')}{label('الشمس',42,132)}{label('الأرض',154,132)}</>;break;
 }
 case 'solar-gravity':view=<><rect x="58" y={137-100*Math.min(1,9.81/25)} width="65" height={100*Math.min(1,9.81/25)} rx="6" fill="#86b8dc"/>
   <rect x="173" y={137-100*ratio} width="65" height={100*ratio} rx="6" fill={accent}/>
   {label('الأرض',91,153)}{label('الجرم المختار',206,153)}</>;break;
 case 'weather-atmosphere':
  view=<><rect x="78" y="20" width="143" height="124" rx="10" fill="#375f7b"/>
   {[35,60,85,110].map((yy,i)=><line key={i} x1="78" x2="221" y1={yy} y2={yy} stroke="#a7cbe1" strokeOpacity=".3"/>)}
   {circle(149,143-110*x/20,10,'#eec88b')}{label('ارتفاع نموذجي',150,160)}</>;break;
 case 'weather-heat':
  view=<><circle cx="66" cy="55" r="25" fill="#f0c46f"/><path d="M90 63L143 99M104 47L169 99" stroke="#f7c98c" strokeWidth="5"/>
   <path d="M135 110h118" stroke="#6daa87" strokeWidth="17"/><path d="M175 94L195 52" stroke="#a6c4dd" strokeWidth={2+6*y}/>
   {label('السطح والامتصاص',195,151)}</>;break;
 case 'weather-map':
  view=<>{[26,47,69].map((r,i)=><circle key={i} cx="150" cy="82" r={r} fill="none" stroke={accent} strokeWidth="2" opacity={.9-i*.2}/>)}
   {label(x<y?'L':'H',150,88)}{label('ضغط صناعي للتعلّم',156,162)}</>;break;
 case 'weather-moisture':{
  const opacity=.22+.78*(y/100);
  view=<><g opacity={opacity}>{circle(122,96,27,light)}{circle(153,73,37,light)}{circle(185,99,29,light)}
    <rect x="122" y="96" width="63" height="28" fill={light}/></g>
   <path d="M51 148Q150 130 249 148" fill="none" stroke="#69989c" strokeWidth="3"/>{label('رطوبة نسبية '+Math.round(y)+'%',150,159)}</>;break;
 }
 case 'weather-storm':
  view=<>{[20,36,52,68].map((r,i)=><path key={i} d={`M${150-r} 82 A${r} ${r} 0 1 1 ${150+r} 82`} stroke={accent} fill="none" strokeWidth={2+i} opacity={.4+i*.14}/>)}
   {circle(150,82,8,'#e4c786')}{label('ظروف جوية افتراضية',151,164)}</>;break;
 case 'earth-interior':{
  const colors=['#9dbe8b','#d8a064','#9ec3ba','#e8c378'];
  view=<>{circle(150,86,66,colors[0])}{circle(150,86,57,colors[1])}{circle(150,86,30,colors[2])}{circle(150,86,13,colors[3])}
   <path d={`M150 86L${150+64*Math.cos(-Math.PI/2+ratio*2*Math.PI)} ${86+64*Math.sin(-Math.PI/2+ratio*2*Math.PI)}`} stroke="#fff" strokeWidth="3"/>
   {label('مقطع طبقات الأرض',150,166)}</>;break;
 }
 case 'earth-plates':
  view=<><rect x="29" y="70" width="110" height="50" rx="6" fill="#86a87e"/><rect x="163" y="70" width="109" height="50" rx="6" fill="#c59a72"/>
   <path d={Math.round(x)===0?'M126 63H57M175 63H247':Math.round(x)===1?'M54 63H127M248 63H175':'M119 55V21M175 135V158'}
   stroke={accent} strokeWidth="5" strokeLinecap="round"/>
   {label(['تباعد','تقارب','تحويل'][Math.round(x)],150,155)}</>;break;
 case 'earth-seismic':
  view=<>{[25,48,74].map((r,i)=><circle key={i} cx="72" cy="85" r={r} fill="none" stroke={i===0?'#f4c379':accent} strokeWidth="3" opacity={1-i*.15}/>)}
   {circle(72,85,8,'#f4c379')}<path d="M140 84H244" stroke="#c5ded4" strokeWidth="3"/>{circle(249,84,8,'#a5c9de')}{label('موجات P و S',171,160)}</>;break;
 case 'earth-volcano':
  view=<><path d="M58 139L126 49L152 64L179 49L243 139Z" fill="#98705b"/>
   <path d="M129 53L151 99L175 55" fill="none" stroke="#ef9855" strokeWidth={4+ratio*5}/>
   {circle(150,31,13,'#bbb6ae')}{label('نموذج ثوران نوعي',150,163)}</>;break;
 case 'earth-rocks':
  view=<>{[0,1,2].map((i)=><g key={i}><rect x={17+i*100} y="54" width="88" height="62" rx="12" fill={i===Math.round(x)?'#547c6c':'#3c5c59'} stroke={accent}/>
    {label(['ناري','رسوبي','متحول'][i],61+i*100,89)}</g>)}{label('عمليات وتحولات محتملة',150,156)}</>;break;
 case 'cosmos-scale':
  view=<>{[.1,.16,.28,.42,.64,.94].map((r,i)=><rect key={i} x={25+i*43} y={130-100*r} width="26" height={100*r} rx="4" fill={i===Math.round(x)?'#e7bb7a':'#80b6ad'} />)}
    {label('مقياس لوغاريتمي توضيحي',150,161)}</>;break;
 case 'cosmos-stars':{
  const color=y<3700?'#d87d66':y<5200?'#e6ac70':y<7500?'#f2dfb3':'#c7d9ff';
  view=<>{circle(152,83,Math.min(60,14+Math.sqrt(x)*10),color)}
   {label('سطح النجم — لون تقريبي',150,160)}</>;break;
 }
 case 'cosmos-transit':{
  const dip=9+ratio*48;
  view=<><path d={`M18 61H103L117 ${61+dip}H182L196 61H280`} fill="none" stroke={accent} strokeWidth="4"/>
   {circle(54,118,21,'#dfbf77')}{circle(54+Math.min(30,x*1.9),118,Math.max(3,x/3),'#273e4a')}
   {label('الهبوط مرسوم بتكبير بصري',174,164)}</>;break;
 }
 case 'cosmos-expansion':
  view=<>{[0,1,2,3,4].map((i)=><circle key={i} cx={150+(i-2)*(20+ratio*28)} cy={70+Math.abs(i-2)*18} r="8" fill={i===2?'#efc37d':accent}/>)}
   <path d="M27 142H271" stroke="#6e9c91" strokeDasharray="4 6"/>{label('تباعد المجرات على مقياس كبير',150,163)}</>;break;
 default:view=<>{circle(150,85,30)}</>;
 }
 return <svg className={styles.scienceDiagram} viewBox="0 0 300 175" role="img"
  aria-label={SCIENCE_LABS[model]?.title+' — تمثيل بصري تعليمي يعتمد على قيم المدخلات'}>
  <rect width="300" height="175" rx="12" fill="#16363a"/>
  <g>{view}</g></svg>;
}
export default function ScienceLab({lab,source,onComplete}){
 const config=SCIENCE_LABS[lab?.model];
 const [x,setX]=useState(config?.x.initial??0),[y,setY]=useState(config?.y?.initial??0);
 const [explored,setExplored]=useState(false),[verified,setVerified]=useState(false);
 const value=useMemo(()=>config?calculateScienceLab(lab.model,{x,y}):null,[lab?.model,config,x,y]);
 const original=useMemo(()=>config?calculateScienceLab(lab.model,{x:config.x.initial,y:config.y?.initial}):null,[lab?.model,config]);
 if(!config||!value||!original)return <p role="alert">نموذج المحاكاة غير متاح.</p>;
 const metricIndex=value.metrics.findIndex((metric,i)=>
  Number.isFinite(metric.num)&&Number.isFinite(original.metrics[i]?.num)&&
  Math.abs(metric.num-original.metrics[i].num)>0.000001);
 const observed=metricIndex>=0?value.metrics[metricIndex].num:null;
 const previous=metricIndex>=0?original.metrics[metricIndex].num:null;
 const observationChoices=metricIndex>=0?labObservationChoices(previous,observed):[];
 const confirmObservation=number=>{
  // Choices are rounded for display; the server still checks the raw model value.
  if(metricIndex<0||number!==Number(observed.toFixed(5)))return;
  setVerified(true);onComplete?.({kind:'science',x,y:config.y?y:undefined,metricIndex,observed});
 };
 const setValue=(axis,next)=>{
  const current=axis==='x'?x:y;
  if(next===current)return;
  if(axis==='x')setX(next);else setY(next);
  setExplored(true);setVerified(false);
 };
 return <section className={styles.scienceLab} aria-labelledby="science-lab-title">
  <div className={styles.scienceLabHead}><FlaskConical size={23}/><div>
   <h3 id="science-lab-title">{config.title}</h3>
   <p>تجربة درس «{lab.scenario||'الفلك والطبيعة'}»</p>
  </div></div>
  <div className={styles.scienceLearningInstructions}>
   <strong>كيف تستخدم المختبر؟</strong>
   <ol>
    <li>اقرأ اسم الظاهرة وشاهد الرسم ونتائجه الابتدائية.</li>
    <li>غيّر <b>{config.x.label}</b> بالمنزلق، ثم راقب الرسم والأرقام.</li>
    <li>قارن النتائج، ثم جرّب {config.y?'المتغير الآخر أو':'قيمة أخرى واستنتج'} السبب.</li>
   </ol>
  </div>
  <div className={styles.scienceLayout}>
   <div className={styles.scienceControls}>
    {[[config.x,x,'x'],[config.y,y,'y']].filter(([control])=>Boolean(control)).map(([control,number,axis])=>
     <label key={axis} className={styles.scienceSlider}>
      <span>{control.label}</span><strong>{n(number)} {control.unit}</strong>
      <input type="range" min={control.min} max={control.max} step={control.step} value={number}
       onChange={event=>setValue(axis,Number(event.target.value))} aria-label={control.label}/>
      <span className={styles.scienceRange}><small>{n(control.min)}</small><small>{n(control.max)}</small></span>
     </label>
    )}
    <button type="button" className={styles.scienceReset} onClick={()=>{setX(config.x.initial);setY(config.y?.initial??0);setVerified(false);setExplored(false);}}>
     <RefreshCw size={15}/> إعادة القيم الأصلية
    </button>
   </div>
   <div className={styles.scienceViz}>
    <Diagram model={lab.model} result={value} x={x} y={y}/>
    <div className={styles.scienceMetrics}>{value.metrics.map((m,i)=>
     <div key={i}><small>{m.label}</small><strong>{n(m.num)} <span>{m.unit}</span></strong>
      {explored&&original.metrics[i]&&<small>قبل التجربة: {n(original.metrics[i].num)} {original.metrics[i].unit}</small>}
     </div>)}</div>
   </div>
  </div>
  <p className={styles.scienceInterpretation}>{value.text}</p>
  {explored&&metricIndex>=0&&<div className={styles.scienceObservation}>
   <strong>تحقق من النتيجة قبل الاختبار</strong>
   <p>بعد تغيير المدخلات، ما الرقم الذي تعرضه التجربة الآن أمام «{value.metrics[metricIndex].label}»؟ اقرأ القيمة في الأعلى ثم اخترها.</p>
   <div className={styles.scienceObservationChoices}>{observationChoices.map(number=><button type="button" key={number}
    aria-pressed={verified&&number===observed} onClick={()=>confirmObservation(number)}>
    {n(number)} {value.metrics[metricIndex].unit}</button>)}</div>
   {!verified&&<small>إذا لم تطابق إجابتك الرقم المعروض، حاول مجددًا. لن تخسر نقاطًا.</small>}
  </div>}
  {verified?<p className={styles.scienceActivityDone} role="status"><CheckCircle2 size={18}/>
   قارنت القيم، وتحققت من النتيجة الجديدة. الآن يمكنك متابعة اختبار الفهم.</p>:
   <p className={styles.scienceActivityPrompt}>{explored?'غيّر المدخلات حتى يتغير أحد الأرقام، ثم أكّد النتيجة التي تلاحظها.':'التجربة جاهزة: حرّك أي منزلق لتقارن بين النتيجة الأصلية والنتيجة الجديدة.'}</p>}
  <div className={styles.scienceCaveat}><AlertTriangle size={17}/><p><strong>حدود المحاكاة:</strong> {config.caveat} لا تستخدم هذه التجربة كبيانات رصد أو توقعات فعلية.</p></div>
  <div className={styles.scienceSource}>مصدر للمراجعة:
   <a href={source?.url||config.source} target="_blank" rel="noopener noreferrer">
    {source?.title||'مرجع علمي متخصص'} <ExternalLink size={13}/>
   </a>
  </div>
 </section>;
}
