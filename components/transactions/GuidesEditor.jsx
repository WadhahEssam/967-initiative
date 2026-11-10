'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowDown,ArrowUp,CalendarCheck,Copy,Eye,Pencil,Plus,X} from 'lucide-react';
import LoginLink from '@/components/LoginLink';
import {currentSession} from '@/lib/browserSession';
import {formatArabicDate} from '@/lib/format';
import {GUIDE_CATEGORIES,GUIDE_REGIONS,GUIDE_STATUSES,STEP_KINDS,emptyVariant,guideIsStale} from '@/lib/transactionGuides';
import GuideView,{StepArt} from './GuideView';
import styles from './Transactions.module.css';

const ENDPOINT='/api/transactions/guides';
async function call(method,body){
 const session=await currentSession();
 if(!session)return {status:401,json:{}};
 const response=await fetch(ENDPOINT,{method,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,json:await response.json().catch(()=>({}))};
}
const blank=()=>({slug:'',title:'',summary:'',audience:'',category:'identity',status:'draft',variants:Object.fromEntries(GUIDE_REGIONS.map(region=>[region.id,emptyVariant()])),sources:[],verifiedAt:'',verifiedBy:'',editorNote:'',faqs:[],related:[],featured:false});
const editable=guide=>({...blank(),...guide,verifiedAt:guide.verifiedAt||'',variants:Object.fromEntries(GUIDE_REGIONS.map(region=>[region.id,{...emptyVariant(),...(guide.variants?.[region.id]||{})}]))});
const today=()=>new Date(Date.now()+3*3600e3).toISOString().slice(0,10);
const statusName=id=>GUIDE_STATUSES.find(status=>status.id===id)?.name||id;

function Lines({label,hint,value,onChange,rows=4}){
 return <label className={styles.field}>{label}{hint&&<small>{hint}</small>}<textarea rows={rows} value={(value||[]).join('\n')} onChange={event=>onChange(event.target.value.split('\n'))}/></label>;
}
function Field({label,hint,...props}){
 return <label className={styles.field}>{label}{hint&&<small>{hint}</small>}<input {...props}/></label>;
}

// Writing and checking the transaction guides. A guide is written as a draft, sent for checking,
// and published only with its verification date. Nothing is deleted: a guide is unpublished by
// moving it back to draft.
export default function GuidesEditor(){
 const [state,setState]=useState({kind:'loading'});
 const [guide,setGuide]=useState(null);
 const [region,setRegion]=useState('sanaa');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState(null);
 const [dirty,setDirty]=useState(false);
 const [preview,setPreview]=useState(false);
 const load=useCallback(async()=>{
  try{
   const {status,json}=await call('GET');
   if(status===401)return setState({kind:'login'});
   if(status===403)return setState({kind:'denied',message:json.error});
   if(status!==200)return setState({kind:'error',message:json.error||'تعذر تحميل الأدلة.'});
   setState({kind:'ready',guides:json.guides});
  }catch{setState({kind:'error',message:'تعذر الاتصال. تحقق من الشبكة وأعد المحاولة.'});}
 },[]);
 useEffect(()=>{load();},[load]);
 const open=next=>{
  if(dirty&&!confirm('لديك تغييرات غير محفوظة. هل تتركها؟'))return;
  setGuide(next?editable(next):blank());setRegion('sanaa');setMessage(null);setDirty(false);setPreview(false);
 };
 const close=()=>{
  if(dirty&&!confirm('لديك تغييرات غير محفوظة. هل تتركها؟'))return;
  setGuide(null);setMessage(null);setDirty(false);setPreview(false);
 };
 const set=patch=>{setGuide(previous=>({...previous,...patch}));setDirty(true);};
 const setVariant=patch=>{setGuide(previous=>({...previous,variants:{...previous.variants,[region]:{...previous.variants[region],...patch}}}));setDirty(true);};
 const variant=guide?.variants[region];
 const setStep=(index,patch)=>setVariant({steps:variant.steps.map((step,i)=>i===index?{...step,...patch}:step)});
 const moveStep=(index,delta)=>{const steps=[...variant.steps],[step]=steps.splice(index,1);steps.splice(index+delta,0,step);setVariant({steps});};
 async function save(){
  setBusy(true);setMessage(null);
  try{
   const {status,json}=await call(guide.id?'PATCH':'POST',{id:guide.id,guide});
   if(status!==200)return setMessage({tone:'error',text:json.error||'تعذر حفظ الدليل.'});
   setGuide(editable(json.guide));setDirty(false);
   setMessage({tone:'ok',text:json.guide.status==='published'?'حُفظ الدليل، ويظهر للزوار متى كان «دليل المعاملات» مفعّلًا.':'حُفظ الدليل ('+statusName(json.guide.status)+'). لا يراه الزوار.'});
   await load();
  }catch{setMessage({tone:'error',text:'تعذر الاتصال؛ لم يُحفظ الدليل. أعد المحاولة.'});}
  finally{setBusy(false);}
 }
 if(state.kind==='loading')return <p role="status">جارٍ التحميل…</p>;
 if(state.kind==='login')return <p className={styles.message} data-tone="warning">سجّل الدخول بالحساب المخوّل بتحرير الأدلة. <LoginLink href="/login">تسجيل الدخول</LoginLink></p>;
 if(state.kind==='denied')return <p className={styles.message} data-tone="error">{state.message||'حسابك غير مخوّل بتحرير الأدلة.'} اطلب من إدارة 967 إضافة حسابك.</p>;
 if(state.kind==='error')return <p className={styles.message} data-tone="error" role="alert">{state.message} <button type="button" className={styles.secondary} onClick={load}>إعادة المحاولة</button></p>;
 if(!guide)return <div className={styles.editor}>
  <div className={styles.editorBar}><h2>الأدلة ({state.guides.length})</h2><button type="button" className={styles.primary} onClick={()=>open(null)}><Plus size={16} aria-hidden="true"/> دليل جديد</button></div>
  {state.guides.length?<ul className={styles.guideList}>{state.guides.map(item=><li key={item.id}>
   <button type="button" onClick={()=>open(item)}>
    <span><strong>{item.title}</strong><small dir="ltr">/transactions/{item.slug}</small></span>
    <span className={styles.status} data-status={item.status}>{statusName(item.status)}</span>
    <small>{item.verifiedAt?'تحقق: '+formatArabicDate(item.verifiedAt)+(guideIsStale(item.verifiedAt)?' (قديم)':''):'لم يُتحقق منه'}</small>
    <Pencil size={16} aria-hidden="true"/>
   </button>
  </li>)}</ul>:<p>لا توجد أدلة بعد.</p>}
 </div>;
 const other=GUIDE_REGIONS.find(item=>item.id!==region);
 return <div className={styles.editor}>
  <div className={styles.editorBar}>
   <button type="button" className={styles.secondary} onClick={close}><X size={16} aria-hidden="true"/> كل الأدلة</button>
   <h2>{guide.title||'دليل جديد'}</h2>
   <button type="button" className={styles.secondary} aria-pressed={preview} onClick={()=>setPreview(value=>!value)}><Eye size={16} aria-hidden="true"/> {preview?'عودة للتحرير':'معاينة'}</button>
  </div>
  {preview?<div className={styles.previewBox}><p className={styles.previewLabel}>معاينة: هكذا يراه الزائر</p><div className={styles.headRow}><h1 style={{margin:0}}>{guide.title}</h1></div>{guide.summary&&<p>{guide.summary}</p>}<GuideView guide={guide} preview/></div>:<form className={styles.editorForm} onSubmit={event=>{event.preventDefault();save();}}>
   <fieldset className={styles.panel}>
    <legend>الأساسيات</legend>
    <div className={styles.grid2}>
     <Field label="عنوان المعاملة" required value={guide.title} onChange={event=>set({title:event.target.value})} placeholder="مثل: استخراج جواز السفر"/>
     <Field label="الرابط المختصر" hint="بالإنجليزية، مثل passport" required dir="ltr" value={guide.slug} onChange={event=>set({slug:event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})}/>
     <label className={styles.field}>التصنيف<select value={guide.category} onChange={event=>set({category:event.target.value})}>{GUIDE_CATEGORIES.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
     <label className={styles.field}>الحالة<select value={guide.status} onChange={event=>set({status:event.target.value})}>{GUIDE_STATUSES.map(status=><option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
    </div>
    <label className={styles.field}>وصف مختصر<textarea rows={2} value={guide.summary} onChange={event=>set({summary:event.target.value})}/></label>
    <label className={styles.field}>لمن هذه المعاملة<textarea rows={2} value={guide.audience} onChange={event=>set({audience:event.target.value})}/></label>
    <label className={styles.check}><input type="checkbox" checked={guide.featured} onChange={event=>set({featured:event.target.checked})}/> تظهر في «الأكثر طلبًا» أعلى الفهرس</label>
   </fieldset>
   <fieldset className={styles.panel}>
    <legend>الإجراءات حسب المدينة</legend>
    <div className={styles.regionBar}>
     <div className={styles.regions} role="group" aria-label="المدينة">{GUIDE_REGIONS.map(item=><button key={item.id} type="button" aria-pressed={region===item.id} onClick={()=>setRegion(item.id)}>{item.name}{guide.variants[item.id].steps.length?' ('+guide.variants[item.id].steps.length+')':''}</button>)}</div>
     <button type="button" className={styles.secondary} onClick={()=>{if(confirm('نسخ كل ما في '+other.name+' إلى '+GUIDE_REGIONS.find(item=>item.id===region).name+'؟ سيُستبدل ما هنا.'))setVariant(structuredClone(guide.variants[other.id]));}}><Copy size={16} aria-hidden="true"/> انسخ من {other.name}</button>
    </div>
    <div className={styles.grid2}>
     <Field label="الجهة" value={variant.authority} onChange={event=>setVariant({authority:event.target.value})} placeholder="مثل: مصلحة الهجرة والجوازات"/>
     <Field label="المكان" value={variant.place} onChange={event=>setVariant({place:event.target.value})}/>
     <Field label="رابط الموقع على الخريطة" dir="ltr" value={variant.mapUrl} onChange={event=>setVariant({mapUrl:event.target.value})} placeholder="https://maps.google.com/…"/>
     <Field label="أوقات الدوام" value={variant.hours} onChange={event=>setVariant({hours:event.target.value})}/>
     <Field label="الرسوم" value={variant.fees} onChange={event=>setVariant({fees:event.target.value})} hint="اكتبها كما يدفعها الناس، مع العملة"/>
     <Field label="المدة المتوقعة" value={variant.duration} onChange={event=>setVariant({duration:event.target.value})}/>
     <Field label="هل ينوب عنك أحد؟" value={variant.delegate} onChange={event=>setVariant({delegate:event.target.value})} hint="مثل: نعم بتوكيل موثق، أو لا، الحضور شخصي"/>
     <Field label="الخدمة الإلكترونية" value={variant.online} onChange={event=>setVariant({online:event.target.value})} hint="إن وُجد حجز أو تقديم عبر الإنترنت"/>
    </div>
    <Lines label="الأوراق المطلوبة" hint="ورقة في كل سطر" value={variant.documents} onChange={documents=>setVariant({documents})} rows={5}/>
    <div className={styles.stepsEditor}>
     <h3>الخطوات</h3>
     {variant.steps.map((step,index)=><div key={index} className={styles.stepEdit}>
      <StepArt kind={step.kind} number={index+1}/>
      <div className={styles.stepFields}>
       <div className={styles.grid2}>
        <label className={styles.field}>نوع الخطوة (يحدد الرسم)<select value={step.kind} onChange={event=>setStep(index,{kind:event.target.value})}>{STEP_KINDS.map(kind=><option key={kind.id} value={kind.id}>{kind.name}</option>)}</select></label>
        <Field label="عنوان الخطوة" required value={step.title} onChange={event=>setStep(index,{title:event.target.value})}/>
       </div>
       <label className={styles.field}>الشرح<textarea rows={2} value={step.text} onChange={event=>setStep(index,{text:event.target.value})}/></label>
       <div className={styles.stepTools}>
        <button type="button" disabled={!index} onClick={()=>moveStep(index,-1)} aria-label={'انقل الخطوة '+(index+1)+' للأعلى'}><ArrowUp size={15} aria-hidden="true"/></button>
        <button type="button" disabled={index===variant.steps.length-1} onClick={()=>moveStep(index,1)} aria-label={'انقل الخطوة '+(index+1)+' للأسفل'}><ArrowDown size={15} aria-hidden="true"/></button>
        <button type="button" onClick={()=>setVariant({steps:variant.steps.filter((_,i)=>i!==index)})}>إزالة الخطوة</button>
       </div>
      </div>
     </div>)}
     <button type="button" className={styles.secondary} onClick={()=>setVariant({steps:[...variant.steps,{kind:'visit',title:'',text:''}]})}><Plus size={16} aria-hidden="true"/> أضف خطوة</button>
    </div>
    <div className={styles.grid2}>
     <Lines label="نصائح توفر الوقت" hint="نصيحة في كل سطر" value={variant.tips} onChange={tips=>setVariant({tips})}/>
     <Lines label="أخطاء شائعة" hint="خطأ في كل سطر" value={variant.mistakes} onChange={mistakes=>setVariant({mistakes})}/>
    </div>
   </fieldset>
   <fieldset className={styles.panel}>
    <legend>أسئلة شائعة ومعاملات مرتبطة</legend>
    <p className={styles.help}>الأسئلة واحدة للمدينتين. اكتب السؤال كما يسأله الناس.</p>
    {guide.faqs.map((item,index)=><div key={index} className={styles.stepEdit}>
     <div className={styles.stepFields}>
      <Field label={'السؤال '+(index+1)} value={item.q} onChange={event=>set({faqs:guide.faqs.map((faq,i)=>i===index?{...faq,q:event.target.value}:faq)})}/>
      <label className={styles.field}>الجواب<textarea rows={2} value={item.a} onChange={event=>set({faqs:guide.faqs.map((faq,i)=>i===index?{...faq,a:event.target.value}:faq)})}/></label>
      <div className={styles.stepTools}><button type="button" onClick={()=>set({faqs:guide.faqs.filter((_,i)=>i!==index)})}>إزالة السؤال</button></div>
     </div>
    </div>)}
    <button type="button" className={styles.secondary} style={{justifySelf:'start'}} onClick={()=>set({faqs:[...guide.faqs,{q:'',a:''}]})}><Plus size={16} aria-hidden="true"/> أضف سؤالًا</button>
    <div className={styles.field}>معاملات مرتبطة (حتى 6)<div className={styles.relatedPick}>{state.guides.filter(item=>item.slug!==guide.slug).map(item=><label key={item.id} className={styles.check}><input type="checkbox" checked={guide.related.includes(item.slug)} disabled={!guide.related.includes(item.slug)&&guide.related.length>=6} onChange={event=>set({related:event.target.checked?[...guide.related,item.slug]:guide.related.filter(slug=>slug!==item.slug)})}/> {item.title}</label>)}</div></div>
   </fieldset>
   <fieldset className={styles.panel}>
    <legend>التحقق والنشر</legend>
    <p className={styles.help}>لا يُنشر الدليل قبل أن يتحقق منه شخص يعرف الإجراءات في المدينة، ويُكتب تاريخ التحقق. الزائر يرى التاريخ، ولا يرى اسم من تحقق ولا ملاحظة المحررين.</p>
    <div className={styles.grid2}>
     <div className={styles.field}>تاريخ التحقق<div className={styles.inline}><input type="date" value={guide.verifiedAt} max={today()} onChange={event=>set({verifiedAt:event.target.value})} aria-label="تاريخ التحقق"/><button type="button" className={styles.secondary} onClick={()=>set({verifiedAt:today()})}><CalendarCheck size={16} aria-hidden="true"/> تحققت اليوم</button></div></div>
     <Field label="من تحقق (لا يظهر للزوار)" value={guide.verifiedBy} onChange={event=>set({verifiedBy:event.target.value})}/>
    </div>
    <Lines label="المصادر" hint="مصدر في كل سطر، روابط أو أسماء جهات" value={guide.sources} onChange={sources=>set({sources})} rows={3}/>
    <label className={styles.field}>ملاحظة للمحررين (لا تظهر للزوار)<textarea rows={2} value={guide.editorNote} onChange={event=>set({editorNote:event.target.value})}/></label>
   </fieldset>
   <div className={styles.saveBar}>
    {message&&<p className={styles.message} data-tone={message.tone} role={message.tone==='error'?'alert':'status'}>{message.text}</p>}
    <span className={styles.dirty}>{dirty?'تغييرات غير محفوظة':'لا تغييرات'}</span>
    <button className={styles.primary} disabled={busy}>{busy?'جارٍ الحفظ…':'احفظ ('+statusName(guide.status)+')'}</button>
   </div>
  </form>}
 </div>;
}
