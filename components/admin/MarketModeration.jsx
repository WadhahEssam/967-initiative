'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Ban,Flag,RefreshCcw,Search,ShieldAlert,UserX} from 'lucide-react';
import useAudience from '@/components/debates/useAudience';
import {browserDb} from '@/lib/supabase';
import styles from './MarketModeration.module.css';

// «سوق 967» moderation (spec: «الإشراف ولوحة التحكم»): held listings, reports, the block alert
// and market bans; and catalogue upkeep: searches with no results (with synonyms) and brands typed
// under «أخرى». Bans and reading reported chats are for management only.
const VIEWS=[{id:'pending',label:'قيد المراجعة',count:'pending'},{id:'reports',label:'البلاغات',count:'reports'},{id:'alerts',label:'تنبيهات الحظر',count:'alerts'},{id:'bans',label:'الإيقافات',count:'bans'},{id:'misses',label:'بحث بلا نتائج',count:'misses'},{id:'brands',label:'ماركات «أخرى»'}];
const ACTION_LABELS={dismiss:'تجاهل',warn:'رسالة تنبيه',ban_reported:'إيقاف المبلَّغ عنه',ban_seller:'إيقاف البائع',ban_buyer:'إيقاف المشتري',remove_listing:'حذف الإعلان',hold_listing:'إيقاف الإعلان للمراجعة',hide_rating:'إخفاء التقييم'};
const BAN_OPTIONS=[['3','3 أيام'],['7','أسبوع'],['30','شهر'],['','نهائي']];
const when=value=>value?new Date(value).toLocaleString('ar',{dateStyle:'medium',timeStyle:'short'}):'';

// A button that runs at once (with an optional confirmation) or opens a small form for a reason,
// a message or a ban length.
function Action({label,fields=null,confirm=null,onRun,busy,tone='plain',placeholder}){
 const [open,setOpen]=useState(false);
 const [text,setText]=useState('');
 const [days,setDays]=useState('7');
 const className=tone==='danger'?styles.danger:tone==='primary'?styles.primary:styles.button;
 if(!fields)return <button type="button" className={className} disabled={busy} onClick={()=>{if(confirm&&!window.confirm(confirm))return;onRun({});}}>{label}</button>;
 return <>
  <button type="button" className={className} disabled={busy} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}</button>
  {open&&<form className={styles.actionForm} onSubmit={async event=>{event.preventDefault();if(await onRun({text,days:days===''?null:Number(days)})){setOpen(false);setText('');}}}>
   {fields==='ban'&&<label>المدة <select value={days} onChange={event=>setDays(event.target.value)}>{BAN_OPTIONS.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>}
   <textarea rows={2} maxLength={fields==='message'?1000:500} value={text} onChange={event=>setText(event.target.value)}
    placeholder={placeholder||(fields==='message'?'نص الرسالة كما سيقرؤه المستخدم':'السبب (يصل إلى المستخدم)')} aria-label={fields==='message'?'نص الرسالة':'السبب'}/>
   <div><button type="submit" className={tone==='danger'?styles.danger:styles.primary} disabled={busy||text.trim().length<3}>تأكيد: {label}</button>
    <button type="button" className={styles.button} onClick={()=>setOpen(false)}>إلغاء</button></div>
  </form>}
 </>;
}

function ListingBox({listing,role,busy,run}){
 const decide=(decision,reason)=>run({action:'listing',id:listing.id,decision,reason},{approve:'اعتُمد الإعلان.',reject:'رُفض الإعلان.',hold:'أُوقف الإعلان للمراجعة.',remove:'حُذف الإعلان.'}[decision]);
 return <article className={styles.card}>
  {/* eslint-disable-next-line @next/next/no-img-element -- small market thumbnails, already WebP */}
  <div className={styles.photos}>{listing.photos.slice(0,5).map(src=><img key={src} src={src} alt="" loading="lazy"/>)}</div>
  <div className={styles.cardBody}>
   <p className={styles.kicker}>#{listing.number} · {listing.statusLabel}{listing.openReports?' · '+listing.openReports+' بلاغ مفتوح':''}</p>
   <h3><Link href={'/market/'+listing.number} target="_blank">{listing.title}</Link></h3>
   <p className={styles.meta}>{[listing.price,listing.place].filter(Boolean).join(' · ')} · البائع: <Link href={'/market/seller/'+listing.sellerId} target="_blank">{listing.sellerName}</Link></p>
   {listing.reviewReason&&<p className={styles.reason}><ShieldAlert size={15} aria-hidden="true"/> {listing.reviewReason}</p>}
   {listing.description&&<details className={styles.more}><summary>الوصف</summary><p>{listing.description}</p></details>}
   <div className={styles.actions}>
    {listing.status==='pending_review'&&<>
     <Action label="اعتماد" tone="primary" busy={busy} confirm="اعتماد الإعلان ونشره؟" onRun={()=>decide('approve')}/>
     <Action label="رفض" fields="reason" tone="danger" busy={busy} onRun={({text})=>decide('reject',text)}/>
    </>}
    {['active','reserved'].includes(listing.status)&&<Action label="إيقاف للمراجعة" fields="reason" busy={busy} onRun={({text})=>decide('hold',text)}/>}
    {['active','reserved','expired','sold'].includes(listing.status)&&<Action label="حذف الإعلان" fields="reason" tone="danger" busy={busy} onRun={({text})=>decide('remove',text)}/>}
    <Action label="رسالة للبائع" fields="message" busy={busy} onRun={({text})=>run({action:'message',userId:listing.sellerId,message:text},'أُرسلت الرسالة.')}/>
    {role==='management'&&<Action label="إيقاف البائع" fields="ban" tone="danger" busy={busy} onRun={({text,days})=>run({action:'ban',userId:listing.sellerId,days,reason:text},'أُوقف البائع.')}/>}
   </div>
  </div>
 </article>;
}

function ReportBox({report,role,busy,run,readChat}){
 const [chat,setChat]=useState(null);
 const act=(act,extra,done)=>run({action:'report',id:report.id,act,...extra},done);
 const parties=[report.parties.seller&&{who:'seller',label:'البائع',...report.parties.seller},report.parties.buyer&&{who:'buyer',label:report.target==='rating'?'كاتب التقييم':'المشتري',...report.parties.buyer}].filter(Boolean);
 const banTargets=parties.length?parties:report.reported?[{who:'reported',label:'المستخدم',...report.reported}]:[];
 return <article className={styles.card}>
  <div className={styles.cardBody}>
   <p className={styles.kicker}><Flag size={14} aria-hidden="true"/> بلاغ #{report.number} · {report.targetLabel} · {report.reason} · {when(report.createdAt)}</p>
   {report.note&&<p className={styles.note}>{report.note}</p>}
   <p className={styles.meta}>من: {report.reporter.name}</p>
   {/* eslint-disable-next-line @next/next/no-img-element -- a market thumbnail */}
   {report.listing&&<p className={styles.target}>{report.listing.cover&&<img src={report.listing.cover} alt=""/>}<span>الإعلان <Link href={'/market/'+report.listing.number} target="_blank">#{report.listing.number} {report.listing.title}</Link> · {report.listing.statusLabel}</span></p>}
   {report.chat&&<p className={styles.meta}>المحادثة بين البائع {report.chat.seller.name} والمشتري {report.chat.buyer.name}</p>}
   {report.rating&&<div className={styles.note}>تقييم {report.rating.overall} من 5{report.rating.hidden?' (مخفي)':''}{report.rating.comment&&<p>{report.rating.comment}</p>}{report.rating.reply&&<p>رد البائع: {report.rating.reply}</p>}</div>}
   {report.reported&&<p className={styles.meta}>المبلَّغ عنه: <Link href={'/market/seller/'+report.reported.id} target="_blank">{report.reported.name}</Link> · {report.reported.reports} بلاغ · حظره {report.reported.blocks}{report.reported.banned?' · موقوف الآن':''}</p>}
   {report.chat&&role==='management'&&<div className={styles.actions}>
    <button type="button" className={styles.button} disabled={busy} onClick={async()=>{if(chat){setChat(null);return;}if(!window.confirm('قراءة المحادثة للتحقق من البلاغ؟ تُسجَّل القراءة.'))return;setChat(await readChat(report.id));}}>{chat?'إخفاء المحادثة':'اقرأ المحادثة'}</button>
   </div>}
   {chat&&<ol className={styles.transcript}>{chat.messages.map(message=><li key={message.id}><b>{message.from}</b> <small>{when(message.createdAt)}</small>
    <p>{message.offer?'عرض سعر: '+message.offer+(message.body?' — '+message.body:''):message.body}{message.image&&<> <a href={message.image} target="_blank" rel="noopener noreferrer">صورة</a></>}</p></li>)}</ol>}
   {report.status==='open'?<div className={styles.actions}>
    <Action label="تجاهل" busy={busy} confirm="تجاهل البلاغ دون إجراء؟" onRun={()=>act('dismiss',{},'أُغلق البلاغ.')}/>
    {report.reported&&<Action label="رسالة تنبيه" fields="message" busy={busy} onRun={({text})=>act('warn',{who:'reported',message:text},'أُرسل التنبيه.')}/>}
    {report.target==='listing'&&report.listing&&['active','reserved'].includes(report.listing.status)&&<Action label="إيقاف الإعلان للمراجعة" fields="reason" busy={busy} onRun={({text})=>act('hold_listing',{reason:text},'أُوقف الإعلان للمراجعة.')}/>}
    {report.target==='listing'&&report.listing&&!['removed','draft','archived'].includes(report.listing.status)&&<Action label="حذف الإعلان" fields="reason" tone="danger" busy={busy} onRun={({text})=>act('remove_listing',{reason:text},'حُذف الإعلان.')}/>}
    {report.target==='rating'&&report.rating&&!report.rating.hidden&&<Action label="إخفاء التقييم" tone="danger" busy={busy} confirm="إخفاء التقييم من صفحة البائع ومن متوسطه؟" onRun={()=>act('hide_rating',{},'أُخفي التقييم.')}/>}
    {role==='management'&&banTargets.map(party=><Action key={party.who} label={'إيقاف '+party.label+' ('+party.name+')'} fields="ban" tone="danger" busy={busy}
     onRun={({text,days})=>act('ban',{who:party.who,days,reason:text},'أُوقف الحساب في السوق.')}/>)}
   </div>:<p className={styles.meta}>{report.status==='dismissed'?'تم تجاهله':'عولج: '+(ACTION_LABELS[report.action]||report.action||'')} · {when(report.resolvedAt)}</p>}
  </div>
 </article>;
}

// Searches that found nothing: add words that mean the same (search uses them within minutes), or
// mark the search handled. Below, the synonym groups the team added.
function MissesView({data,busy,run}){
 const [words,setWords]=useState('');
 if(!data.misses)return <p className={styles.empty}>جارٍ التحميل…</p>;
 return <>
  <p className={styles.meta}>عمليات بحث لم تجد أي إعلان في كل اليمن. أضف كلمات بالمعنى نفسه ليجدها البحث (مثل: «تلفون» = جوال، موبايل)، أو علّمها كمعالجة إن لم تحتج شيئًا.</p>
  {data.misses.length?data.misses.map(item=><article key={item.query} className={styles.card}><div className={styles.cardBody}>
   <p className={styles.kicker}><Search size={14} aria-hidden="true"/> بحث عنها {item.count} مرة · آخرها {when(item.last_at)}</p>
   <h3>«{item.query}»</h3>
   <div className={styles.actions}>
    <Action label="أضف مرادفات" fields="message" busy={busy} placeholder="كلمات بالمعنى نفسه، مفصولة بفاصلة: جوال، موبايل" onRun={({text})=>run({action:'synonym',query:item.query,words:text},'أُضيفت المرادفات، ويستخدمها البحث خلال دقائق.')}/>
    <Action label="تمت المعالجة" busy={busy} onRun={()=>run({action:'miss',query:item.query},'أُزيل من القائمة.')}/>
   </div>
  </div></article>):<p className={styles.empty}>لا توجد عمليات بحث بلا نتائج تحتاج مراجعة.</p>}
  <h2 className={styles.subhead}>مرادفات أضافها الفريق</h2>
  <form className={styles.lookup} onSubmit={async event=>{event.preventDefault();if(await run({action:'synonym',words},'أُضيفت المجموعة.'))setWords('');}}>
   <input value={words} onChange={event=>setWords(event.target.value)} placeholder="مجموعة جديدة: كنب، كنبة، صوفا" aria-label="مجموعة مرادفات جديدة" className={styles.wide}/>
   <button type="submit" className={styles.button} disabled={busy||!words.trim()}>أضف</button>
  </form>
  {data.synonyms?.length?<ul className={styles.chips}>{data.synonyms.map(group=><li key={group.id}>{group.words.join(' · ')}
   <button type="button" disabled={busy} aria-label={'حذف المجموعة '+group.words[0]} onClick={()=>{if(window.confirm('حذف هذه المجموعة من المرادفات؟'))run({action:'unsynonym',id:group.id},'حُذفت المجموعة.');}}>×</button></li>)}</ul>
   :<p className={styles.meta}>لم يضف الفريق مرادفات بعد. القاموس الأساسي في الكود يبقى كما هو.</p>}
 </>;
}

// Brands and models sellers typed under «أخرى», most common first: candidates for the lists.
function BrandsView({brands}){
 if(!brands)return <p className={styles.empty}>جارٍ التحميل…</p>;
 return <>
  <p className={styles.meta}>ما كتبه البائعون تحت «أخرى» في الماركة أو الموديل، مرتبًا بعدد الإعلانات. ما يتكرر كثيرًا يستحق أن يُضاف إلى القوائم الجاهزة؛ أرسل القائمة للمطوّر ليضيفه.</p>
  {brands.length?<div className={styles.tableWrap}><table className={styles.table}>
   <thead><tr><th>القسم</th><th>الحقل</th><th>ما كتبه البائع</th><th>الإعلانات</th><th>آخرها</th></tr></thead>
   <tbody>{brands.map(item=><tr key={item.section+item.field+item.value}><td>{item.section}</td><td>{item.field}</td><td><strong>{item.value}</strong></td>
    <td><Link href={'/market/'+item.example} target="_blank">{item.listings}</Link></td><td>{when(item.latest)}</td></tr>)}</tbody>
  </table></div>:<p className={styles.empty}>لم يكتب أي بائع ماركة أو موديلًا تحت «أخرى» بعد.</p>}
 </>;
}

export default function MarketModeration(){
 const {user,ready}=useAudience();
 const [view,setView]=useState('pending');
 const [status,setStatus]=useState('open');
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [number,setNumber]=useState('');
 const [found,setFound]=useState(null);
 const owner=useRef(null);owner.current=user?.id||null;
 const call=useCallback(async(query,body=null)=>{
  const db=browserDb();if(!db)throw Error('خدمة الحسابات غير متاحة.');
  const {data:session,error:sessionError}=await db.auth.getSession();
  if(sessionError||!session.session?.access_token)throw Error('انتهت جلسة تسجيل الدخول.');
  const response=await fetch('/api/admin/market'+(body?'':'?'+query),{method:body?'POST':'GET',cache:'no-store',
   headers:{Authorization:'Bearer '+session.session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(value.error||'تعذر تحميل بيانات السوق.');
  return value;
 },[]);
 // Opens the hidden market for this editor only (signed cookie, 12 hours), in a new tab.
 async function preview(){
  const tab=window.open('about:blank','_blank');
  try{
   const db=browserDb();const {data:session}=await db.auth.getSession();
   const response=await fetch('/api/admin/section-preview',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+(session?.session?.access_token||'')}});
   const value=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(value.error||'تعذر بدء المعاينة.');
   if(tab)tab.location.href='/market';else location.href='/market';
  }catch(e){tab?.close();setError(e.message);}
 }
 const load=useCallback(async()=>{
  const me=owner.current;if(!me)return;
  try{setError('');const value=await call('view='+view+(view==='reports'?'&status='+status:''));if(owner.current===me)setData(value);}
  catch(e){if(owner.current===me){setError(e.message);setData(null);}}
 },[call,view,status]);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the account or the view changes, not on token refresh
 useEffect(()=>{if(!ready||!user){setData(null);return;}load();},[ready,user?.id,load]);
 const lookup=async event=>{
  event?.preventDefault();setError('');
  try{setFound((await call('view=listing&number='+encodeURIComponent(number.trim()))).listing);}catch(e){setFound(null);setError(e.message);}
 };
 const run=async(body,done)=>{
  setBusy(true);setError('');setNotice('');
  try{await call(null,body);setNotice(done);await load();if(found)await lookup();return true;}
  catch(e){setError(e.message);return false;}
  finally{setBusy(false);}
 };
 const readChat=async id=>{try{return await call('view=chat&report='+id);}catch(e){setError(e.message);return null;}};
 if(ready&&!user)return <main className={styles.page}><p className={styles.empty}>سجّل الدخول بحساب تحرير.</p></main>;
 const counts=data?.counts||{};
 const role=data?.role;
 return <main className={styles.page} dir="rtl">
  <header className={styles.header}>
   <div><p className={styles.kicker}><Link href="/admin">لوحة التحرير</Link></p><h1>إشراف سوق 967</h1>
    <p className={styles.meta}>الإعلانات المحجوزة، والبلاغات، وتنبيهات الحظر، والإيقافات، والبحث بلا نتائج، والماركات المكتوبة تحت «أخرى».{role&&role!=='management'?' الإيقاف وقراءة المحادثات لفريق الإدارة فقط.':''}</p></div>
   <button type="button" className={styles.button} onClick={load} disabled={busy}><RefreshCcw size={15} aria-hidden="true"/> تحديث</button>
  </header>
  {data?.launch&&data.launch.status!=='visible'&&<section className={styles.launch} aria-label="جاهزية الإطلاق">
   <h2>السوق مخفي عن الزوار</h2>
   <ul>
    <li data-ok={data.launch.storage}>{data.launch.storage?'تخزين الصور مضبوط على هذا الخادم.':'تخزين الصور غير مضبوط: أضف متغيرات MARKET_S3_* في إعدادات الخادم (Coolify) ثم أعد النشر.'}</li>
    <li data-ok="true">جرّبه قبل فتحه: <button type="button" className={styles.link} onClick={preview}>معاينة السوق</button> تفتحه لك وحدك 12 ساعة، ويبقى مخفيًا عن الزوار.</li>
    <li data-ok="true">عند فتح القسم تظهر روابط السوق في القوائم والبحث وخريطة الموقع، ويُضاف قسم «خصوصية سوق 967» إلى سياسة الخصوصية تلقائيًا.</li>
    <li data-ok="true">الفتح من <Link href="/admin?tab=pages">لوحة التحرير ← صفحات الموقع ← ظهور الأقسام</Link>: فعّل «سوق 967».</li>
   </ul>
  </section>}
  <form className={styles.lookup} onSubmit={lookup}>
   <label htmlFor="market-number">إعلان برقمه</label>
   <input id="market-number" inputMode="numeric" value={number} onChange={event=>setNumber(event.target.value.replace(/\D/g,''))} placeholder="مثل 125"/>
   <button type="submit" className={styles.button} disabled={!number}><Search size={15} aria-hidden="true"/> اعرض</button>
  </form>
  {found&&<div className={styles.found}><ListingBox listing={found} role={role} busy={busy} run={run}/><button type="button" className={styles.link} onClick={()=>setFound(null)}>إغلاق</button></div>}
  <nav className={styles.tabs} aria-label="أقسام الإشراف">{VIEWS.map(item=><button key={item.id} type="button" aria-pressed={view===item.id} onClick={()=>{setView(item.id);setData(current=>current&&{counts:current.counts,role:current.role});}}>
   {item.label}{counts[item.count]>0&&<b>{counts[item.count]}</b>}</button>)}</nav>
  {(error||notice)&&<p className={error?styles.error:styles.success} role={error?'alert':'status'}>{error||notice}</p>}
  {view==='reports'&&<div className={styles.filters}>{[['open','مفتوحة'],['resolved','معالجة'],['dismissed','متجاهلة']].map(([value,name])=><button key={value} type="button" aria-pressed={status===value} onClick={()=>setStatus(value)}>{name}</button>)}</div>}
  {!data?<p className={styles.empty}>جارٍ التحميل…</p>
  :view==='pending'?(data.listings?.length?data.listings.map(item=><ListingBox key={item.id} listing={item} role={role} busy={busy} run={run}/>):<p className={styles.empty}>لا توجد إعلانات بانتظار المراجعة.</p>)
  :view==='reports'?(data.reports?.length?data.reports.map(item=><ReportBox key={item.id} report={item} role={role} busy={busy} run={run} readChat={readChat}/>):<p className={styles.empty}>لا توجد بلاغات هنا.</p>)
  :view==='alerts'?(data.alerts?.length?data.alerts.map(item=><article key={item.user.id} className={styles.card}><div className={styles.cardBody}>
    <p className={styles.kicker}><UserX size={14} aria-hidden="true"/> حظره {item.blockers} مستخدمين · آخرها {when(item.latest)}{item.banned?' · موقوف الآن':''}</p>
    <h3><Link href={'/market/seller/'+item.user.id} target="_blank">{item.user.name}</Link></h3>
    <p className={styles.meta}>{item.reasons.length?item.reasons.map(reason=>reason.label+' ('+reason.count+')').join(' · '):'حظر من الرسائل الخاصة دون سبب مسجل'}{item.reports?' · '+item.reports+' بلاغ':''}</p>
    <div className={styles.actions}>
     <Action label="رسالة تنبيه" fields="message" busy={busy} onRun={({text})=>run({action:'message',userId:item.user.id,message:text},'أُرسل التنبيه.')}/>
     {role==='management'&&!item.banned&&<Action label="إيقاف في السوق" fields="ban" tone="danger" busy={busy} onRun={({text,days})=>run({action:'ban',userId:item.user.id,days,reason:text},'أُوقف الحساب في السوق.')}/>}
    </div>
   </div></article>):<p className={styles.empty}>لا يوجد حساب حظره 3 مستخدمين أو أكثر.</p>)
  :view==='misses'?<MissesView data={data} busy={busy} run={run}/>
  :view==='brands'?<BrandsView brands={data.brands}/>
  :(data.bans?.length?data.bans.map(item=><article key={item.id} className={styles.card}><div className={styles.cardBody}>
    <p className={styles.kicker}><Ban size={14} aria-hidden="true"/> {item.until?'حتى '+when(item.until):'نهائي'} · منذ {when(item.createdAt)} · بواسطة {item.by}</p>
    <h3><Link href={'/market/seller/'+item.user.id} target="_blank">{item.user.name}</Link></h3>
    <p className={styles.note}>{item.reason}</p>
    {role==='management'&&<div className={styles.actions}><Action label="رفع الإيقاف" busy={busy} confirm="رفع الإيقاف عن هذا الحساب؟" onRun={()=>run({action:'lift',id:item.id},'رُفع الإيقاف.')}/></div>}
   </div></article>):<p className={styles.empty}>لا توجد إيقافات سارية.</p>)}
 </main>;
}
