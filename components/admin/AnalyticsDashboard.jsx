'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Activity,ArrowLeft,BookOpenCheck,Clock3,Eye,Layers,LogOut,MonitorSmartphone,RefreshCw,Repeat,SearchX,ShieldCheck,UserPlus,Users,UsersRound} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import useAudience from '@/components/debates/useAudience';
import {RANGES,changePercent} from '@/lib/siteStats';
import {clearTeamDevice,isTeamDevice,markTeamDevice} from '@/lib/siteStatsDevice';
import styles from './AnalyticsDashboard.module.css';

// «إحصاءات الموقع» (owner, 2026-11-11): first-party statistics for the management team only.
const number=value=>Number(value||0).toLocaleString('en-US');
const percent=(part,whole)=>whole>0?Math.round(part/whole*100)+'%':'—';
function duration(ms){
 const seconds=Math.round((Number(ms)||0)/1000);
 if(!seconds)return '—';
 const m=Math.floor(seconds/60),s=seconds%60;
 return m?m+' د '+(s?s+' ث':''):s+' ث';
}
const TYPE_NAMES={all:'جميع الأقسام',works:'الأعمال الإعلامية',debates:'المناظرات',issues:'المجلة',indicators:'المؤشرات',figures:'الشخصيات',history:'التاريخ',companies:'الشركات',professionals:'المهنيون',places:'الأماكن',domains:'مجالات الإحصاء'};
const DEVICES={phone:'جوال',tablet:'جهاز لوحي',desktop:'كمبيوتر'};
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

async function authorized(path,signal){
 const db=browserDb();
 if(!db)throw Error('خدمة الحسابات غير متاحة.');
 const {data,error}=await db.auth.getSession();
 if(error||!data.session?.access_token)throw Error('انتهت الجلسة. سجّل الدخول مجددًا.');
 const response=await fetch(path,{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store',signal});
 const body=await response.json();
 if(!response.ok)throw Object.assign(Error(body.error||'تعذر تحميل الإحصاءات.'),{status:response.status});
 return body;
}

// The change against the previous period of the same length, in words (not color alone).
function Change({now,before}){
 const value=changePercent(now,before);
 if(value===null)return <small className={styles.change}>لا توجد فترة سابقة للمقارنة</small>;
 const label=value===0?'دون تغيير':(value>0?'+':'')+value+'%';
 return <small className={styles.change} data-trend={value>0?'up':value<0?'down':'flat'}>{label} عن الفترة السابقة</small>;
}
function Card({icon:Icon,label,value,note,now,before}){
 return <article><Icon size={22} aria-hidden="true"/><span>{label}</span><strong dir="ltr">{value}</strong>
  {now!==undefined?<Change now={now} before={before}/>:null}{note&&<small>{note}</small>}</article>;
}
function RowBars({items=[],label,value=item=>item.count,title,empty='لا توجد بيانات لهذه الفترة',limit=12}){
 const max=Math.max(1,...items.map(value));
 return <section className={styles.panel} aria-label={title}><h2>{title}</h2>
  {items.length?<div className={styles.barList}>{items.slice(0,limit).map((item,i)=><div className={styles.barRow} key={item.id||item.path||i}>
   <div className={styles.barTitle}><span>{label(item)}</span><strong dir="ltr">{number(value(item))}</strong></div>
   <div className={styles.bar} role="img" aria-label={label(item)+' — '+number(value(item))}><span style={{width:Math.round(value(item)/max*100)+'%'}}/></div>
  </div>)}</div>:<p className={styles.empty}>{empty}</p>}
 </section>;
}
// Visitors per day (per month for a year). One series, so no legend: the title names it.
function Trend({daily=[],rangeId}){
 if(rangeId==='today'||rangeId==='yesterday')return null;
 const byMonth=rangeId==='year';
 const points=byMonth?Object.values(daily.reduce((months,item)=>{const key=item.day.slice(0,7);months[key]=months[key]||{key,label:MONTHS[Number(key.slice(5))-1],visitors:0,views:0};months[key].visitors+=item.visitors;months[key].views+=item.views;return months;},{})):
  daily.map(item=>({key:item.day,label:item.day.slice(8)+'/'+item.day.slice(5,7),visitors:item.visitors,views:item.views}));
 const peak=Math.max(1,...points.map(item=>item.visitors));
 const unit=byMonth?'شهر':'يوم';
 return <section className={styles.panel} aria-labelledby="trend-title">
  <div className={styles.panelHeading}><h2 id="trend-title">الزوار في كل {unit}</h2><p>{byMonth?'مجموع زوار الأيام في كل شهر':'زوار مختلفون في كل يوم'} · بتوقيت اليمن</p></div>
  <div className={styles.chart} style={{gridTemplateColumns:'repeat('+points.length+',minmax(0,1fr))'}} role="img" aria-label={'الزوار في كل '+unit+'، الأعلى '+number(peak)}>
   {points.map(item=><div className={styles.column} key={item.key} title={item.label+': '+number(item.visitors)+' زائر، '+number(item.views)+' مشاهدة'}>
    <strong>{item.visitors>0&&(points.length<=14||item.visitors===peak)?number(item.visitors):''}</strong>
    <span className={styles.columnTrack}><span style={{height:(item.visitors?Math.max(4,Math.round(item.visitors/peak*100)):0)+'%'}}/></span>
    <small>{points.length<=14||points.indexOf(item)%5===0?item.label:''}</small>
   </div>)}
  </div>
  <details className={styles.dailyDetails}><summary>عرض الأرقام في جدول</summary><div className={styles.tableWrap}>
   <table className={styles.table}><thead><tr><th>{byMonth?'الشهر':'اليوم'}</th><th>الزوار</th><th>المشاهدات</th></tr></thead>
    <tbody>{points.map(row=><tr key={row.key}><th scope="row">{byMonth?row.label+' '+row.key.slice(0,4):row.key}</th><td>{number(row.visitors)}</td><td>{number(row.views)}</td></tr>)}</tbody></table>
  </div></details>
 </section>;
}
function Live({live}){
 const devices=Object.entries(live?.devices||{});
 return <section className={styles.live} aria-labelledby="live-title" aria-live="polite">
  <div className={styles.liveCount}><span className={styles.pulse} aria-hidden="true"/><div><h2 id="live-title">يتصفحون الآن</h2><strong dir="ltr">{number(live?.now)}</strong>
   <small>{devices.length?devices.map(([id,count])=>(DEVICES[id]||id)+' '+number(count)).join(' · '):'لا أحد في هذه اللحظة'}</small></div></div>
  <div className={styles.livePages}>{live?.pages?.length?<ol>{live.pages.map(page=><li key={page.path}><span dir="ltr">{page.path}</span><strong>{number(page.count)}</strong></li>)}</ol>:<p className={styles.empty}>تظهر هنا الصفحات المفتوحة الآن.</p>}</div>
  <p className={styles.help}>من فتح صفحة خلال آخر 5 دقائق وما زالت ظاهرة على شاشته. يتحدث تلقائيًا كل دقيقة.</p>
 </section>;
}
function TeamDevice(){
 const [team,setTeam]=useState(null);
 useEffect(()=>{setTeam(isTeamDevice());},[]);
 if(team===null)return null;
 return <p className={styles.team}><ShieldCheck size={16} aria-hidden="true"/>{team?'زيارات هذا الجهاز لا تُحسب في الإحصاءات.':'زيارات هذا الجهاز تُحسب حاليًا.'}
  <button type="button" onClick={()=>{if(team)clearTeamDevice();else markTeamDevice();setTeam(!team);}}>{team?'احسب زيارات هذا الجهاز':'لا تحسب زيارات هذا الجهاز'}</button></p>;
}

export default function AnalyticsDashboard(){
 const {user,ready}=useAudience();
 const [range,setRange]=useState('7d');
 const [revision,setRevision]=useState(0);
 const [state,setState]=useState({owner:null,status:'loading',data:null,error:''});
 const [live,setLive]=useState(null);
 useEffect(()=>{
  if(!ready)return;
  if(!user){setState({owner:null,status:'guest',data:null,error:''});return;}
  let active=true;const controller=new AbortController();
  setState(previous=>({owner:user.id,status:'loading',data:previous.owner===user.id?previous.data:null,error:''}));
  authorized('/api/admin/analytics?range='+range,controller.signal)
   .then(body=>{if(active){setState({owner:user.id,status:'ready',data:body,error:''});setLive(body.live);}})
   .catch(error=>{if(active&&!controller.signal.aborted)setState({owner:user.id,status:error.status===403?'forbidden':'error',data:null,error:error.message||'تعذر تحميل الإحصاءات.'});});
  return()=>{active=false;controller.abort();};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[user?.id,ready,range,revision]);
 const ok=state.owner===user?.id&&state.status==='ready';
 const refreshLive=useCallback(()=>{authorized('/api/admin/analytics?live=1').then(body=>setLive(body.live)).catch(()=>{});},[]);
 useEffect(()=>{
  if(!ok)return;
  const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshLive();},60000);
  return()=>clearInterval(timer);
 },[ok,refreshLive]);
 const data=state.owner===user?.id?state.data:null;
 const stats=data?.stats,totals=stats?.totals,before=data?.previous,accounts=data?.accounts,counters=data?.counters,school=data?.school;
 const returning=totals?Math.max(0,totals.visitors-totals.newVisitors):0;

 return <div className={styles.page}><div className="container">
  <div className={styles.heading}><div><span className={styles.eyebrow}><Activity size={17} aria-hidden="true"/> إدارة 967 / الإحصاءات</span>
   <h1>إحصاءات الموقع</h1><p>أرقامنا نحن، بلا أي خدمة خارجية. زيارات الفريق والبرامج الآلية مستبعدة.</p></div>
   <Link className={styles.back} href="/admin">لوحة الإدارة <ArrowLeft size={16} aria-hidden="true"/></Link>
  </div>

  {!ready||(state.status==='loading'&&!data)?<p role="status" className={styles.notice}>جارٍ تحميل الإحصاءات…</p>:
  state.status==='guest'?<div className={styles.notice}><p>هذه الصفحة لحسابات الإدارة. سجّل الدخول للمتابعة.</p><Link href="/login?next=/admin/analytics">تسجيل الدخول <ArrowLeft size={15}/></Link></div>:
  state.status==='forbidden'?<div className={styles.notice} role="alert"><p>{state.error} محررو المدرسة يجدون تحليلات دروسهم في تبويب «التحليلات» داخل استوديو المدرسة.</p></div>:
  state.status==='error'?<div className={styles.notice} role="alert"><p>{state.error}</p><button type="button" onClick={()=>setRevision(x=>x+1)}>إعادة المحاولة</button></div>:
  <div className={styles.content} aria-busy={state.status==='loading'}>
   <Live live={live}/>

   <div className={styles.controls}>
    <div className={styles.ranges} role="group" aria-label="الفترة">{Object.entries(RANGES).map(([id,label])=><button type="button" key={id} aria-pressed={range===id} onClick={()=>setRange(id)}>{label}</button>)}</div>
    <button type="button" onClick={()=>setRevision(x=>x+1)}><RefreshCw size={17} aria-hidden="true"/> تحديث</button>
    {data?.range&&<span className={styles.period} dir="ltr">{data.range.from===data.range.to?data.range.from:data.range.from+' → '+data.range.to}</span>}
   </div>

   <h2 className={styles.sectionTitle}>الزوار</h2>
   <div className={styles.cards} aria-label="الزوار">
    <Card icon={Users} label="الزوار" value={number(totals.visitors)} now={totals.visitors} before={before?.visitors} note="أجهزة مختلفة، تقريبًا أشخاص مختلفون"/>
    <Card icon={Repeat} label="الزيارات" value={number(totals.visits)} now={totals.visits} before={before?.visits} note="جلسة تصفح تنتهي بعد 30 دقيقة دون نشاط"/>
    <Card icon={Eye} label="المشاهدات" value={number(totals.views)} now={totals.views} before={before?.views} note="كل فتح لصفحة"/>
    <Card icon={Clock3} label="متوسط مدة الزيارة" value={duration(totals.visitMs)} now={totals.visitMs} before={before?.visitMs} note="الوقت الذي كانت فيه الصفحات ظاهرة فقط"/>
    <Card icon={Layers} label="صفحات في الزيارة" value={Number(totals.viewsPerVisit||0).toFixed(1)}/>
    <Card icon={LogOut} label="غادروا بعد صفحة واحدة" value={percent(totals.bounces,totals.visits)} note={number(totals.bounces)+' من '+number(totals.visits)+' زيارة'}/>
    <Card icon={UserPlus} label="زوار جدد" value={number(totals.newVisitors)} note="أول زيارة لهم للموقع"/>
    <Card icon={UsersRound} label="زوار عائدون" value={number(returning)} note="زاروا الموقع من قبل"/>
   </div>
   <Trend daily={stats.daily} rangeId={data.range.id}/>

   <h2 className={styles.sectionTitle}>الأعضاء</h2>
   <div className={styles.cards} aria-label="الأعضاء">
    <Card icon={UsersRound} label="إجمالي الحسابات" value={number(accounts.total)}/>
    <Card icon={UserPlus} label={'حسابات جديدة · '+RANGES[data.range.id]} value={number(accounts.inRange)}/>
    <Card icon={Users} label="أعضاء زاروا الموقع" value={number(totals.memberVisitors)} note="أجهزة دخل منها عضو خلال الفترة"/>
    <Card icon={Activity} label="من الزوار إلى حساب" value={percent(accounts.inRange,totals.visitors)} note="الحسابات الجديدة نسبةً إلى الزوار"/>
   </div>
   <div className={styles.accountsRow}>{[['today','اليوم'],['week','آخر 7 أيام'],['month','آخر 30 يومًا'],['year','آخر سنة']].map(([key,label])=><span key={key}>{label}: <strong dir="ltr">{number(accounts[key])}</strong> حساب جديد</span>)}</div>

   <h2 className={styles.sectionTitle}>التفاعل</h2>
   <div className={styles.two}>
    <section className={styles.panel} aria-labelledby="funnel-rates-title"><h2 id="funnel-rates-title">من يكمل ما بدأه؟</h2>
     <div className={styles.barList}>{counters.funnel.rates.map(rate=><div className={styles.barRow} key={rate.id}>
      <div className={styles.barTitle}><span>{rate.title}</span><strong dir="ltr">{rate.value===null?'—':rate.value+'%'}</strong></div>
      <div className={styles.bar} role="img" aria-label={rate.title+' — '+(rate.value===null?'لا توجد بيانات':rate.value+'%')}><span style={{width:Math.min(100,rate.value||0)+'%'}}/></div>
     </div>)}</div>
     <p className={styles.help}>كل خطوة تُحسب مرة لكل جلسة تصفح. «زائر» و«عضو» تقديريان. هذه العدادات بتوقيت UTC.</p>
    </section>
    <RowBars items={counters.funnel.steps.filter(step=>step.count>0)} title="خطوات التحويل" label={item=>item.title} empty="لم تُسجل خطوات في هذه الفترة."/>
   </div>
   <div className={styles.two}>
    <section className={styles.panel}><h2><SearchX size={19} aria-hidden="true"/> بحث بلا نتائج: {number(counters.searchMisses)}</h2>
     {counters.searches.length?<ul className={styles.plainList}>{counters.searches.map(item=><li key={item.id}><span>{TYPE_NAMES[item.id]||item.title}</span><strong dir="ltr">{number(item.count)}</strong></li>)}</ul>:<p className={styles.empty}>لا توجد عمليات بحث بلا نتائج في هذه الفترة.</p>}
     <p className={styles.help}>لا تُحفظ كلمات البحث نفسها.</p>
    </section>
    <section className={styles.panel}><h2><MonitorSmartphone size={19} aria-hidden="true"/> قادم في المراحل التالية</h2>
     <p className={styles.empty}>الصفحات الأكثر زيارة ومدة القراءة، ثم مصادر الزيارة والأجهزة وأرقام السوق. البيانات تُجمع منذ تشغيل هذه الصفحة.</p></section>
   </div>

   <div className={styles.schoolHeading}><span><BookOpenCheck size={21}/> مدرسة 967</span><h2>أين يتقدم الطلاب، وأين يواجهون صعوبة؟</h2><p>تُحسب نسب إكمال المحطات من الطلاب الذين حاولوا اجتيازها، من آخر 3000 محاولة. لا تظهر المجموعات الأصغر من 5 طلاب.</p></div>
   <div className={styles.two}>
    <section className={styles.panel}><h2>إكمال المحطات</h2>
     {school.stages.length?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>المسار والمحطة</th><th>الطلاب</th><th>أكملوا</th><th>نسبة الإكمال</th></tr></thead><tbody>
      {school.stages.slice(0,15).map(x=><tr key={x.course+':'+x.stage}><th scope="row">{school.courseNames?.[x.course]||x.course} · {x.stage+1}</th><td>{number(x.learners)}</td><td>{number(x.completed)}</td><td>{x.completionRate}%</td></tr>)}
     </tbody></table></div>:<p className={styles.empty}>لا تتوفر بعد محطات بها 5 طلاب مختلفين على الأقل.</p>}
    </section>
    <section className={styles.panel}><h2>الأسئلة الأكثر خطأً</h2>
     {school.questions.length?<ol className={styles.questions}>{school.questions.map((q,i)=><li key={q.course+':'+q.stage+':'+i}>
      <span>{school.courseNames?.[q.course]||q.course} · المحطة {q.stage+1}</span><strong>{q.prompt}</strong>
      <small>الإجابات الخاطئة: {q.wrong} من {q.asked} · {q.wrongRate}%</small>
     </li>)}</ol>:<p className={styles.empty}>لا توجد أسئلة بها 5 إجابات على الأقل.</p>}
    </section>
   </div>

   {counters.legacy.sections.length>0&&<details className={styles.legacy}><summary>السجل السابق: مشاهدات الأقسام من {counters.legacy.from} إلى {counters.legacy.to}</summary>
    <p className={styles.help}>العدّاد القديم: مشاهدات أقسام فقط، تشمل زيارات الفريق والفحوص الآلية، فلا تُقارن بالأرقام أعلاه. توقف عند تشغيل هذه الصفحة.</p>
    <RowBars items={counters.legacy.sections} title="مشاهدات الأقسام (العدّاد القديم)" label={item=>item.title} limit={25}/>
   </details>}

   <aside className={styles.privacy}><ShieldCheck size={21} aria-hidden="true"/><div><strong>كيف تُحسب هذه الأرقام</strong>
    <p>يحفظ متصفح الزائر رقمًا عشوائيًا لا يدل على شخصه، فالزائر الواحد على جوال وكمبيوتر يُحسب زائرَين. لا نحفظ عنوان IP ولا ما يكتبه الزائر ولا هوية حسابه. لا تُحسب زيارات من يفعّل منع التتبع، ولا البرامج الآلية، ولا أجهزة المحررين والإدارة.</p>
    <TeamDevice/>
   </div></aside>
  </div>}
 </div></div>;
}
