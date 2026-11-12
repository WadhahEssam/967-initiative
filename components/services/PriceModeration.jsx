'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,BadgeCheck,Ban,Check,RefreshCw,Search,X} from 'lucide-react';
import {inlineContentRequest} from '@/lib/inlineContentClient';
import {formatNumber} from '@/lib/format';
import {formatRateTime} from '@/lib/exchangeRates';
import styles from './Services.module.css';

// «المُبلّغ المحلي», the editors' panel (inside the admin tab «الأسعار»): alerts, held reports to
// accept or reject, reporters (search, verified anchors, silent bans), recomputing, and the log.
// Members never see any of this, and nothing here is ever shown to them.

const API='/api/admin/prices';
const when=at=>formatRateTime(at,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const ACTIONS={accept_report:'قبول بلاغ',reject_report:'رفض بلاغ',clear_review:'إلغاء قرار',ban:'حظر صامت',unban:'رفع الحظر',anchor_on:'توثيق مرساة',anchor_off:'إلغاء مرساة',resolve_alert:'معالجة تنبيه',recompute:'إعادة حساب',anchor_price:'سعر مرساة',hide_anchor:'إخفاء سعر مرساة',show_anchor:'إظهار سعر مرساة'};
const GRADES={very_close:'قريب جدًا',close:'قريب',far:'بعيد',very_far:'بعيد جدًا'};
const STATUS={counted:'محتسب',held:'معلّق',outlier:'شاذ',ignored:'لم يُحتسب',pending:'جديد'};
function alertDetail(alert){
 const d=alert.details||{};
 if(alert.type==='fast_move')return 'من '+formatNumber(d.from)+' إلى '+formatNumber(d.to);
 if(alert.type==='anchor_gap')return 'السعر '+formatNumber(d.price)+' · المرساة '+formatNumber(d.anchor);
 if(alert.type==='held_surge')return formatNumber(d.held)+' بلاغًا معلّقًا';
 if(alert.type==='spread')return 'شراء '+formatNumber(d.buy)+' · بيع '+formatNumber(d.sell);
 if(alert.type==='anchor_misses')return (alert.reporter||'')+' · '+formatNumber(d.streak)+' مرات';
 return '';
}

function ReporterTag({person}){
 return <>
  {person.anchor&&<span className={styles.modTag} data-tone="ok"><BadgeCheck size={13} aria-hidden="true"/> مرساة{person.anchorName?': '+person.anchorName:''}</span>}
  {person.banned&&<span className={styles.modTag} data-tone="danger"><Ban size={13} aria-hidden="true"/> محظور{person.banReason==='auto'?' تلقائيًا':''}</span>}
 </>;
}

function Reporter({db,userId,onChanged,onClose}){
 const [data,setData]=useState(null);
 const [error,setError]=useState('');
 const [anchorName,setAnchorName]=useState('');
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setData(await inlineContentRequest(db,API+'?reporter='+encodeURIComponent(userId)));}catch(failure){setError(failure.message);}},[db,userId]);
 useEffect(()=>{load();},[load]);
 async function act(change){
  if(change==='ban'&&!confirm('حظر صامت: تبقى بلاغات هذا الحساب محفوظة ولا تؤثر في السعر، ولا يُبلَّغ صاحبه. متابعة؟'))return;
  setBusy(true);setError('');
  try{await inlineContentRequest(db,API,{method:'POST',body:{action:'reporter',userId,change,anchorName}});await load();onChanged();}
  catch(failure){setError(failure.message);}
  finally{setBusy(false);}
 }
 if(error&&!data)return <p className={styles.message} data-tone="error">{error}</p>;
 if(!data)return <p role="status">جارٍ التحميل…</p>;
 const person=data.reporter;
 return <div className={styles.modReporter}>
  <div className={styles.modRowHead}><strong>{person.name}</strong><ReporterTag person={person}/><button type="button" className={styles.modIcon} onClick={onClose} aria-label="إغلاق"><X size={16}/></button></div>
  <p className={styles.modMeta}>النقاط {formatNumber(person.score)} من 100 · {formatNumber(person.reports)} بلاغًا · المتوافق {person.agreeingShare===null?'—':person.agreeingShare+'%'}{person.jumpsFirst?' · سبق إلى '+formatNumber(person.jumpsFirst)+' قفزة':''}</p>
  <div className={styles.actions}>
   {person.banned?<button type="button" className={styles.modButton} disabled={busy} onClick={()=>act('unban')}>رفع الحظر</button>:<button type="button" className={styles.modButton} data-tone="danger" disabled={busy} onClick={()=>act('ban')}><Ban size={15} aria-hidden="true"/> حظر صامت</button>}
   {person.anchor?<button type="button" className={styles.modButton} disabled={busy} onClick={()=>act('anchor_off')}>إلغاء المرساة</button>:<>
    <input className={styles.modInput} value={anchorName} onChange={event=>setAnchorName(event.target.value)} placeholder="اسم الصرّاف أو المحل" maxLength={80} aria-label="اسم المرساة"/>
    <button type="button" className={styles.modButton} disabled={busy} onClick={()=>act('anchor_on')}><BadgeCheck size={15} aria-hidden="true"/> توثيق كمرساة</button>
   </>}
  </div>
  {error&&<p className={styles.message} data-tone="error">{error}</p>}
  {data.reports.length?<ul className={styles.history}>{data.reports.map(report=><li key={report.id}>
   <time>{when(report.createdAt)}</time><span>{report.confirmation?'تأكيد · ':''}{report.what}</span><strong>{formatNumber(report.value)}</strong>
   <span>{STATUS[report.status]||report.status}{report.review?' · '+(report.review==='accepted'?'قُبل':'رُفض'):''}</span>
   {report.agreement&&<span>{GRADES[report.agreement]} ({report.delta>0?'+':''}{formatNumber(report.delta)})</span>}
  </li>)}</ul>:<p className={styles.modMeta}>لا توجد بلاغات بعد.</p>}
 </div>;
}

export default function PriceModeration({db}){
 const [state,setState]=useState({kind:'loading'});
 const [message,setMessage]=useState(null);
 const [query,setQuery]=useState('');
 const [results,setResults]=useState(null);
 const [selected,setSelected]=useState(null);
 const [busy,setBusy]=useState(false);
 const [reset,setReset]=useState(false);
 const load=useCallback(async()=>{
  try{setState({kind:'ready',...await inlineContentRequest(db,API)});}
  catch(error){setState({kind:'error',message:error.message});}
 },[db]);
 useEffect(()=>{load();},[load]);
 async function post(body,done){
  setBusy(true);setMessage(null);
  try{const result=await inlineContentRequest(db,API,{method:'POST',body});setMessage({tone:'ok',text:done(result)});await load();}
  catch(error){setMessage({tone:'error',text:error.message});}
  finally{setBusy(false);}
 }
 async function search(event){
  event.preventDefault();setResults(null);
  try{setResults((await inlineContentRequest(db,API+'?q='+encodeURIComponent(query))).results);}
  catch(error){setMessage({tone:'error',text:error.message});}
 }
 if(state.kind==='loading')return <p role="status">جارٍ التحميل…</p>;
 if(state.kind==='error')return <p className={styles.message} data-tone="error">{state.message}</p>;
 const pick=userId=>setSelected(userId);
 return <div className={styles.entry}>
  {message&&<p className={styles.message} data-tone={message.tone} role="status">{message.text}</p>}

  <section className={styles.entryCity} aria-labelledby="price-alerts">
   <h2 id="price-alerts"><AlertTriangle size={20} aria-hidden="true"/> التنبيهات ({formatNumber(state.alerts.length)})</h2>
   {state.alerts.length?<ul className={styles.history}>{state.alerts.map(alert=><li key={alert.id}>
    <time>{when(alert.createdAt)}</time><strong>{alert.label}</strong><span>{alert.what}</span><span>{alertDetail(alert)}</span>
    {alert.reporterId&&<button type="button" onClick={()=>pick(alert.reporterId)}>المبلّغ</button>}
    <button type="button" disabled={busy} onClick={()=>post({action:'resolve',alertId:alert.id},()=>'عُولج التنبيه.')}>عولج</button>
   </li>)}</ul>:<p className={styles.modMeta}>لا توجد تنبيهات مفتوحة.</p>}
  </section>

  <section className={styles.entryCity} aria-labelledby="price-held">
   <h2 id="price-held">بلاغات معلّقة ({formatNumber(state.held.length)})</h2>
   <p className={styles.modMeta}>بلاغات بعيدة عن السعر الحالي خلال آخر يومين، لم تُحتسب. «قبول» يجعل البلاغ يُحتسب، و«رفض» يلغي أثره. لا يُبلَّغ صاحب البلاغ بأي قرار.</p>
   {state.held.length?<ul className={styles.history}>{state.held.map(report=><li key={report.id}>
    <time>{when(report.createdAt)}</time><span>{report.confirmation?'تأكيد · ':''}{report.what}</span>
    <strong>{formatNumber(report.value)}</strong>
    <span>السعر {report.price===null?'—':formatNumber(report.price)}{report.gap!==null&&<> ({report.gap>0?'+':''}{formatNumber(report.gap)}%)</>}</span>
    <button type="button" className={styles.modLink} onClick={()=>pick(report.userId)}>{report.name} · {formatNumber(report.score)}</button>
    {report.anchor&&<span className={styles.modTag} data-tone="ok">مرساة</span>}{report.banned&&<span className={styles.modTag} data-tone="danger">محظور</span>}
    {report.source&&<span>«{report.source}»</span>}
    <span className={styles.modButtons}>
     <button type="button" disabled={busy} onClick={()=>post({action:'review',reportId:report.id,review:'accepted'},()=>'قُبل البلاغ وأُعيد حساب السعر.')}><Check size={14} aria-hidden="true"/> قبول</button>
     <button type="button" disabled={busy} onClick={()=>post({action:'review',reportId:report.id,review:'rejected'},()=>'رُفض البلاغ.')}><X size={14} aria-hidden="true"/> رفض</button>
    </span>
   </li>)}</ul>:<p className={styles.modMeta}>لا توجد بلاغات معلّقة.</p>}
  </section>

  <section className={styles.entryCity} aria-labelledby="price-reporters">
   <h2 id="price-reporters">المبلّغون</h2>
   <form onSubmit={search} className={styles.actions}>
    <input className={styles.modInput} style={{flex:'1 1 220px'}} value={query} onChange={event=>setQuery(event.target.value)} placeholder="الاسم أو البريد الإلكتروني" aria-label="ابحث عن مبلّغ"/>
    <button className={styles.modButton}><Search size={15} aria-hidden="true"/> ابحث</button>
   </form>
   {results&&(results.length?<ul className={styles.history}>{results.map(person=><li key={person.userId}><button type="button" className={styles.modLink} onClick={()=>pick(person.userId)}>{person.name}</button><span>{formatNumber(person.score)} نقطة · {formatNumber(person.reports)} بلاغًا</span><ReporterTag person={person}/></li>)}</ul>:<p className={styles.modMeta}>لا نتائج.</p>)}
   {selected&&<Reporter key={selected} db={db} userId={selected} onChanged={load} onClose={()=>setSelected(null)}/>}
   <h3 className={styles.modSub}>المرساة الموثّقة ({formatNumber(state.anchors.length)})</h3>
   {state.anchors.length?<ul className={styles.history}>{state.anchors.map(person=><li key={person.userId}><button type="button" className={styles.modLink} onClick={()=>pick(person.userId)}>{person.name}</button><span>{person.anchorName}</span><span>{formatNumber(person.score)} نقطة</span></li>)}</ul>:<p className={styles.modMeta}>لا يوجد صرّافون أو تجار موثّقون بعد. ابحث عن الحساب ثم «توثيق كمرساة».</p>}
   <h3 className={styles.modSub}>المحظورون صامتًا ({formatNumber(state.banned.length)})</h3>
   {state.banned.length?<ul className={styles.history}>{state.banned.map(person=><li key={person.userId}><button type="button" className={styles.modLink} onClick={()=>pick(person.userId)}>{person.name}</button><span>{formatNumber(person.score)} نقطة · {formatNumber(person.reports)} بلاغًا</span><span>{person.banReason==='auto'?'تلقائيًا':'بقرار محرر'}</span></li>)}</ul>:<p className={styles.modMeta}>لا يوجد.</p>}
  </section>

  <section className={styles.entryCity} aria-labelledby="price-recompute">
   <h2 id="price-recompute">إعادة الحساب</h2>
   <p className={styles.modMeta}>يُحسب السعر تلقائيًا مع كل بلاغ وكل سعر مرساة. استخدم هذا بعد قرارات كثيرة، أو «من سعر المرساة» لبدء الحساب من آخر سعر أدخله الفريق.</p>
   <label className={styles.modCheck}><input type="checkbox" checked={reset} onChange={event=>setReset(event.target.checked)}/> من سعر المرساة</label>
   <div className={styles.actions}>
    <button type="button" className={styles.modButton} disabled={busy} onClick={()=>post({action:'recompute',kind:'rate',reset},result=>'أُعيد حساب أسعار الصرف'+(result.changed?' وتغيّر '+result.changed+' سعرًا.':' دون تغيير.'))}><RefreshCw size={15} aria-hidden="true"/> أسعار الصرف</button>
    <button type="button" className={styles.modButton} disabled={busy} onClick={()=>post({action:'recompute',kind:'food',reset},result=>'أُعيد حساب أسعار المواد'+(result.changed?' وتغيّر '+result.changed+' سعرًا.':' دون تغيير.'))}><RefreshCw size={15} aria-hidden="true"/> المواد الأساسية</button>
   </div>
  </section>

  <section className={styles.entryCity} aria-labelledby="price-log">
   <h2 id="price-log">سجل الإجراءات</h2>
   {state.log.length?<ul className={styles.history}>{state.log.map(entry=><li key={entry.id}><time>{when(entry.createdAt)}</time><strong>{entry.actor}</strong><span>{ACTIONS[entry.action]||entry.action}</span><span dir="auto">{entry.target}</span>{entry.note&&<span>«{entry.note}»</span>}</li>)}</ul>:<p className={styles.modMeta}>لا توجد إجراءات بعد.</p>}
  </section>
 </div>;
}
