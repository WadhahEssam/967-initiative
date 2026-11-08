'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {BarChart3,BookOpen,CheckCircle2,ClipboardList,History,Plus,RefreshCw,Save,ShieldCheck,Upload} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import styles from '@/app/school/studio/studio.module.css';
import {SCHOOL_SCRIPT_OPTIONS,schoolScriptForStage} from '@/lib/schoolCalligraphySamples';
import {GATE_TYPES} from '@/lib/schoolThinkingLabs';
import {SCIENCE_MODEL_IDS,SCIENCE_LABS} from '@/lib/schoolScienceModels';
import {CIVIC_LABS} from '@/lib/schoolCivicModels';
import {getCivicActivity} from '@/lib/schoolCivicActivities';
import CardLessonEditor from '@/components/school/v2/editor/CardLessonEditor';
import CourseUnitsEditor from '@/components/school/v2/editor/CourseUnitsEditor';
import {starterLesson} from '@/lib/schoolCardStarters';
const defaultDoc={
 course:()=>({title:'',description:'',category:'الكتابة والأدب'}),
 stage:()=>({title:'',subtitle:'',intro:'',tips:[]}),
 question:()=>({kind:'choice',prompt:'',target:'',options:['','','',''],answerIndex:0,explanation:''})
};
async function api(method,body,view=''){
 const db=browserDb(),{data,error}=await db?.auth.getSession()||{};
 if(error||!data?.session?.access_token)throw Error('سجّل الدخول بحساب الإدارة.');
 const response=await fetch('/api/school/studio'+(view?'?view='+view:''),{
  method,cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'تعذر الاتصال بالمحرر.');
 return result;
}
const itemVersion=item=>item?.version||0;
const status=item=>!item?'لم تُنشأ':!item.published?'مسودة':'منشور — النسخة '+item.published_version;
export default function SchoolStudio(){
 const [state,setState]=useState({loading:true,data:null,error:''});
 const [mode,setMode]=useState('content');
 const [kind,setKind]=useState('course');
 const [slug,setSlug]=useState('musnad');
 const [stage,setStage]=useState(0);
 const [question,setQuestion]=useState('');
 const [form,setForm]=useState(defaultDoc.course());
 const [creating,setCreating]=useState(false);
 const [newSlug,setNewSlug]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [report,setReport]=useState(null);
 const [reportError,setReportError]=useState('');
 const load=useCallback(async()=>{
  const data=await api('GET');setState({loading:false,data,error:''});return data;
 },[]);
 useEffect(()=>{let active=true;api('GET').then(data=>{if(active)setState({loading:false,data,error:''});})
  .catch(e=>{if(active)setState({loading:false,data:null,error:e.message});});return()=>{active=false;};},[]);
 const data=state.data;
 const courses=useMemo(()=>data?.courses||[],[data]);
 const stages=data?.stages||[];
 const questions=data?.questions||[];
 const course=courses.find(x=>x.slug===slug);
 const stageRow=stages.find(x=>x.course_slug===slug&&x.stage_index===stage);
 const questionRow=questions.find(x=>x.id===question&&x.course_slug===slug&&x.stage_index===stage);
 const virtual=data?.builtIn?.find(x=>x.slug===slug)?.stages?.find(x=>x.index===stage);
 const item=kind==='course'?course:kind==='stage'?stageRow:questionRow;
 const initial=kind==='course'?course?.draft:kind==='stage'?(stageRow?.draft||virtual&&{
  title:virtual.title,subtitle:virtual.subtitle||'',intro:virtual.intro||'',tips:virtual.tips||[]
 }):questionRow?.draft;
 function choose(nextKind,nextSlug=slug,nextStage=stage,nextQuestion=''){
  const c=courses.find(x=>x.slug===nextSlug);
  const st=stages.find(x=>x.course_slug===nextSlug&&x.stage_index===nextStage);
  const q=questions.find(x=>x.id===nextQuestion);
  const virt=data?.builtIn?.find(x=>x.slug===nextSlug)?.stages?.find(x=>x.index===nextStage);
  const draft=nextKind==='course'?c?.draft:nextKind==='stage'?(st?.draft||virt&&{title:virt.title,subtitle:virt.subtitle||'',intro:virt.intro||'',tips:virt.tips||[]}):q?.draft;
  setSlug(nextSlug);setKind(nextKind);setStage(nextStage);setQuestion(nextQuestion);setCreating(false);
  setForm(draft||defaultDoc[nextKind]());setNotice('');
 }
 useEffect(()=>{if(data&&courses.length&&!course&&!creating){
  const c=courses[0];setSlug(c.slug);setKind('course');setForm(c.draft);
 }},[data,course,courses,creating]);
 async function save(action){
  if(busy)return;
  if(action==='publish'&&JSON.stringify(form)!==JSON.stringify(initial)){setNotice('احفظ التعديلات كمسودة أولًا، ثم انشرها.');return;}
  const targetSlug=creating?newSlug:slug;
  const version=creating?0:itemVersion(item);
  if(!targetSlug){setNotice('اختر اسمًا لاتينيًا للمسار.');return;}
  setBusy(true);setNotice('');
  try{
   const questionId=kind==='question'?(question||crypto.randomUUID()):null;
   await api('POST',{kind,action,slug:targetSlug,stageIndex:stage,id:questionId,version,...(action==='save'?{draft:form}:{})});
   const refreshed=await load();
   setSlug(targetSlug);setCreating(false);
   if(kind==='question')setQuestion(questionId);
   if(action==='save')setNotice('حُفظت المسودة بنجاح. النسخة المنشورة لم تتغير.');
   else setNotice('نُشرت النسخة الجديدة للمتعلمين.');
   if(kind==='course')setForm(refreshed.courses.find(x=>x.slug===targetSlug)?.draft||form);
   if(kind==='stage')setForm(refreshed.stages.find(x=>x.course_slug===targetSlug&&x.stage_index===stage)?.draft||form);
   if(kind==='question')setForm(refreshed.questions.find(x=>x.id===questionId)?.draft||form);
  }catch(e){setNotice(e.message||'تعذر حفظ المحتوى.');}
  finally{setBusy(false);}
 }
 async function showAnalytics(){
  setMode('analytics');setReportError('');
  try{setReport(await api('GET',null,'analytics'));}catch(e){setReportError(e.message);}
 }
 const isDirty=JSON.stringify(form)!==JSON.stringify(initial||defaultDoc[kind]());
 return <div className={styles.workspace}><div className="container">
  {state.loading&&<p role="status">جارٍ التحقق من الصلاحيات وتحميل محرر المدرسة…</p>}
  {state.error&&<div className={styles.error} role="alert">{state.error} <button type="button" onClick={()=>{setState({loading:true,data:null,error:''});load().catch(e=>setState({loading:false,data:null,error:e.message}));}}>إعادة المحاولة</button></div>}
  {data&&<>
   <div className={styles.tabs}>
    <button aria-pressed={mode==='content'} onClick={()=>setMode('content')}><BookOpen size={18}/> المحتوى والأسئلة</button>
    <button aria-pressed={mode==='analytics'} onClick={showAnalytics}><BarChart3 size={18}/> التحليلات</button>
    <button aria-pressed={mode==='history'} onClick={()=>setMode('history')}><History size={18}/> سجل التغييرات</button>
   </div>
   {mode==='content'&&<div className={styles.columns}>
    <aside className={styles.sidebar}><h2>المسارات</h2>
     {courses.map(c=><button className={slug===c.slug&&!creating?styles.activeCourse:''} type="button" key={c.slug} onClick={()=>choose('course',c.slug,0)}>{c.draft.title}<small>{c.slug} · {status(c)}</small></button>)}
     <button className={styles.newButton} onClick={()=>{
      setCreating(true);setNewSlug('');setKind('course');setForm(defaultDoc.course());setNotice('');
     }}><Plus size={17}/> مسار جديد</button>
     <h2>المحطات</h2>
     {Array.from({length:12},(_,index)=>index).map(index=>{
      const s=stages.find(x=>x.course_slug===slug&&x.stage_index===index);
      const virtualStage=data.builtIn.find(x=>x.slug===slug)?.stages?.find(x=>x.index===index);
      if(!course||(!s&&!virtualStage&&index>0&&!stages.some(x=>x.course_slug===slug&&x.stage_index===index-1)))return null;
      return <button key={index} type="button" className={kind==='stage'&&stage===index?styles.activeCourse:''}
       onClick={()=>choose('stage',slug,index)}>{index+1}. {s?.draft?.title||virtualStage?.title||'محطة جديدة'}<small>{status(s)}</small></button>;
     })}
    </aside>
    <section className={styles.editor}>
     <div className={styles.editorTop}><div><span>{kind==='course'?'إدارة المسار':kind==='stage'?'تحرير المحطة':'بنك الأسئلة'}</span>
      <h2>{creating?'مسار جديد':kind==='course'?course?.draft.title:kind==='stage'?(stageRow?.draft.title||virtual?.title||'محطة جديدة'):(questionRow?.draft.prompt||'سؤال جديد')}</h2></div>
      <span className={styles.status}>{status(item)}</span></div>
     {creating&&<label>معرّف المسار (بالإنجليزية دون مسافات)<input value={newSlug} maxLength={40} onChange={e=>setNewSlug(e.target.value.toLowerCase())} placeholder="history-of-yemen"/></label>}
     {kind==='course'&&<>
      <label>اسم المسار<input value={form.title||''} maxLength={90} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
      <label>القسم<input value={form.category||''} maxLength={60} onChange={e=>setForm(v=>({...v,category:e.target.value}))}/></label>
      <label>وصف المسار<textarea value={form.description||''} rows={3} maxLength={700} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
      <CourseUnitsEditor key={slug} value={form} onChange={setForm}/>
     </>}
     {kind==='stage'&&form.format===2&&<CardLessonEditor key={slug+':'+stage} value={form} onChange={setForm} slug={slug||'preview'}/>}
     {kind==='stage'&&form.format!==2&&<button type="button" className={styles.secondary}
      onClick={()=>{if(window.confirm('سيُستبدل محتوى هذه المحطة بدرس بطاقات جديد (لن يتغير المنشور حتى تنشر). هل تتابع؟'))setForm(starterLesson(form.title&&form.title.length>=3?form.title:'عنوان الدرس'));}}>
      تحويل إلى درس بطاقات (الإصدار الثاني)</button>}
     {kind==='stage'&&form.format!==2&&<>
      <label>اسم المحطة<input value={form.title||''} maxLength={90} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
      {course?.draft?.category==='الكتابة والأدب'&&<label>الخط الذي سيظهر في أمثلة المحطة
       <select value={form.script||schoolScriptForStage(slug,stage)}
        onChange={e=>setForm(v=>({...v,script:e.target.value}))}>
        {SCHOOL_SCRIPT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
       </select>
      </label>}
      <label>الوصف المختصر<input value={form.subtitle||''} maxLength={180} onChange={e=>setForm(v=>({...v,subtitle:e.target.value}))}/></label>
      <label>مقدمة الدرس<textarea value={form.intro||''} rows={6} maxLength={2500} onChange={e=>setForm(v=>({...v,intro:e.target.value}))}/></label>
      <label>نصائح الدرس (نصيحة في كل سطر، بحد أقصى 10)<textarea value={(form.tips||[]).join('\n')} rows={5}
       onChange={e=>setForm(v=>({...v,tips:e.target.value.split('\n').filter(Boolean)}))}/></label>
      <div className={styles.bankHead}><h3>الشرح المتدرّج قبل الاختبار</h3>
       <button type="button" onClick={()=>setForm(v=>({...v,lessons:[...(v.lessons||[]),
        {title:'',body:'',example:'',note:''}]}))} disabled={(form.lessons||[]).length>=8}>
        <Plus size={15}/> إضافة صفحة شرح
       </button></div>
      <p className={styles.muted}>اعرض القواعد والأمثلة التي يحتاج إليها الطالب قبل أسئلة المحطة. تظهر الصفحات بالتسلسل، ثم الورشة، ثم الاختبار. عند إضافة صفحات، يلزم أن يكون عددها من صفحتين إلى ثمان.</p>
      {(form.lessons||[]).map((lesson,i)=><div key={i} className={styles.guidedEditorPanel}>
       <div className={styles.bankHead}><h3>صفحة الشرح {i+1}</h3>
        <button type="button" onClick={()=>setForm(v=>({...v,lessons:v.lessons.filter((_,n)=>n!==i)}))}>حذف الصفحة</button></div>
       <label>عنوان الفكرة<input maxLength={100} value={lesson.title||''} onChange={e=>setForm(v=>({...v,lessons:v.lessons.map((x,n)=>n===i?{...x,title:e.target.value}:x)}))}/></label>
       {course?.draft?.category==='الكتابة والأدب'&&<label>الخط المستخدم في المثال
        <select value={lesson.script||form.script||schoolScriptForStage(slug,stage)}
         onChange={e=>setForm(v=>({...v,lessons:v.lessons.map((x,n)=>n===i?{...x,script:e.target.value}:x)}))}>
         {SCHOOL_SCRIPT_OPTIONS.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
       </label>}
       <label>الشرح المفصل<textarea maxLength={1700} rows={5} value={lesson.body||''} onChange={e=>setForm(v=>({...v,lessons:v.lessons.map((x,n)=>n===i?{...x,body:e.target.value}:x)}))}/></label>
       <label>مثال محلول<input maxLength={220} value={lesson.example||''} onChange={e=>setForm(v=>({...v,lessons:v.lessons.map((x,n)=>n===i?{...x,example:e.target.value}:x)}))}/></label>
       <label>ملاحظة توضيحية للمثال<textarea maxLength={420} rows={2} value={lesson.note||''} onChange={e=>setForm(v=>({...v,lessons:v.lessons.map((x,n)=>n===i?{...x,note:e.target.value}:x)}))}/></label>
      </div>)}
      <div className={styles.bankHead}><h3>المختبر التفاعلي للمحطة</h3></div>
      <label>نوع المختبر
       <select value={form.lab?.kind||'none'} onChange={e=>setForm(v=>({...v,
        lab:e.target.value==='morse'?{kind:'morse',sample:'SOS'}:
        e.target.value==='gates'?{kind:'gates',gate:'AND'}:
        e.target.value==='science'?{kind:'science',model:'solar-scale',scenario:v.title||'مختبر العلوم'}:
        e.target.value==='civic'?{kind:'civic',model:'institutions',scenario:v.title||'مختبر القرار'}:undefined
       }))}>
        <option value="none">بدون مختبر</option>
        <option value="morse">مورس — إرسال وفك رموز</option>
        <option value="gates">البوابات — جدول الحقيقة</option>
        <option value="science">مختبر علمي — الفلك والطبيعة</option>
        <option value="civic">مختبر القرار — السياسة والاقتصاد</option>
       </select>
      </label>
      {form.lab?.kind==='morse'&&<label>الرسالة الافتراضية في مختبر مورس (حروف لاتينية وأرقام)
       <input dir="ltr" maxLength={30} value={form.lab.sample||''}
        onChange={e=>setForm(v=>({...v,lab:{...v.lab,sample:e.target.value.toUpperCase()}}))}/>
      </label>}
      {form.lab?.kind==='gates'&&<label>البوابة التي يتدرب عليها الطالب
       <select value={form.lab.gate} onChange={e=>setForm(v=>({...v,lab:{...v.lab,gate:e.target.value}}))}>
        {GATE_TYPES.map(g=><option value={g} key={g}>{g}</option>)}
       </select>
      </label>}
      {form.lab?.kind==='civic'&&<>
       <label>نوع النموذج السياسي أو الاقتصادي
        <select value={form.lab.model} onChange={e=>setForm(v=>({...v,lab:{...v.lab,model:e.target.value}}))}>
         {Object.entries(CIVIC_LABS).map(([id,lab])=><option key={id} value={id}>{lab.title}</option>)}
        </select>
       </label>
       <label>عنوان سيناريو المحطة<input maxLength={110} value={form.lab.scenario||''}
        onChange={e=>setForm(v=>({...v,lab:{...v.lab,scenario:e.target.value}}))}/></label>
      </>}

      {form.lab?.kind==='civic'&&<section className={styles.guidedEditorPanel}>
       <div className={styles.bankHead}><h3>تخصيص النشاط العملي لهذه المحطة</h3>
        {!form.lab.activity&&<button type="button" onClick={()=>setForm(v=>({...v,lab:{...v.lab,
         activity:getCivicActivity(slug,stage)?structuredClone(getCivicActivity(slug,stage)):undefined}}))}>
         ربط النشاط المقترح بالمحطة</button>}
       </div>
       <p className={styles.muted}>الطالب يرى النشاط المنشور مع هذه المحطة فقط. التعديل هنا لا يغير مختبر محطات أخرى. الأسئلة الرسمية تُدار وتُصحح بشكل مستقل.</p>
       {form.lab.activity&&<>
        <p className={styles.muted}>نوع النشاط: {({case:'تحليل حالة صحيحة',paths:'مقارنة جميع الخيارات',steps:'ترتيب خطوات',numbers:'تجربة حسابية'})[form.lab.activity.kind]||'نشاط'}</p>
        <label>عنوان النشاط<input maxLength={110} value={form.lab.activity.title||''}
         onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,title:e.target.value}}}))}/></label>
        <label>الموقف الذي يقرأه الطالب<textarea rows={4} maxLength={900} value={form.lab.activity.story||''}
         onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,story:e.target.value}}}))}/></label>
        {form.lab.activity.kind!=='steps'&&<label>السؤال التطبيقي<textarea rows={2} maxLength={350} value={form.lab.activity.question||''}
         onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,question:e.target.value}}}))}/></label>}
        {form.lab.activity.kind==='case'&&<>
         <p className={styles.muted}>حالة تحليل موضوعية: اختر الإجابة المبنية على الوقائع، دون تقييم الرأي السياسي.</p>
         {form.lab.activity.choices.map((choice,i)=><label key={i}>الخيار {i+1}
          <input maxLength={180} value={choice} onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,
           choices:v.lab.activity.choices.map((x,j)=>j===i?e.target.value:x)}}}))}/></label>)}
         <label>الإجابة القائمة على المعطيات<select value={form.lab.activity.correctIndex}
          onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,correctIndex:Number(e.target.value)}}}))}>
          {form.lab.activity.choices.map((_,i)=><option key={i} value={i}>الخيار {i+1}</option>)}
         </select></label>
        </>}
        {form.lab.activity.kind==='paths'&&form.lab.activity.choices.map((pair,i)=><div key={i}>
         <label>عنوان الجانب {i+1}<input maxLength={100} value={pair[0]}
          onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,
           choices:v.lab.activity.choices.map((x,j)=>j===i?[e.target.value,x[1]]:x)}}}))}/></label>
         <label>أثر هذا الجانب<textarea rows={2} maxLength={450} value={pair[1]}
          onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,
           choices:v.lab.activity.choices.map((x,j)=>j===i?[x[0],e.target.value]:x)}}}))}/></label>
        </div>)}
        {form.lab.activity.kind==='steps'&&form.lab.activity.steps.map((stepText,i)=><label key={i}>
         الإجراء {i+1} في تسلسله الصحيح<input maxLength={200} value={stepText}
          onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,
           steps:v.lab.activity.steps.map((x,j)=>j===i?e.target.value:x)}}}))}/></label>)}
        {form.lab.activity.kind==='numbers'&&<p className={styles.muted}>المعادلة وحدود المنزلقات محفوظة كما هي لضمان صحة الحساب. يمكنك تعديل عنوان النشاط وسؤاله وسيناريو التطبيق وشرح نتائجه هنا.</p>}
        <label>شرح الإجابة أو حدود الاستنتاج<textarea rows={4} maxLength={1000} value={form.lab.activity.explain||''}
         onChange={e=>setForm(v=>({...v,lab:{...v.lab,activity:{...v.lab.activity,explain:e.target.value}}}))}/></label>
       </>}
      </section>}
      {form.lab?.kind==='science'&&<>
       <label>نوع النموذج العلمي
        <select value={form.lab.model} onChange={e=>setForm(v=>({...v,lab:{...v.lab,model:e.target.value}}))}>
         {SCIENCE_MODEL_IDS.map(id=><option key={id} value={id}>{SCIENCE_LABS[id].title}</option>)}
        </select>
       </label>
       <label>اسم التجربة المرتبطة بالمحطة
        <input maxLength={110} value={form.lab.scenario||''}
         onChange={e=>setForm(v=>({...v,lab:{...v.lab,scenario:e.target.value}}))}/>
       </label>
      </>}
      {['science','civic'].includes(form.lab?.kind)&&<div className={styles.scienceSourceFields}>
       <label>اسم المصدر العلمي
        <input maxLength={120} value={form.source?.title||''} onChange={e=>setForm(v=>({...v,source:{...v.source,title:e.target.value}}))}/>
       </label>
       <label>رابط مرجعي من مصدر علمي أو مؤسسي معتمد
        <input dir="ltr" maxLength={450} value={form.source?.url||''} onChange={e=>setForm(v=>({...v,source:{...v.source,url:e.target.value}}))}/>
       </label>
      </div>}
      <div className={styles.bankHead}><h3>ورشة الكتابة العملية</h3>
       <button type="button" onClick={()=>setForm(v=>({...v,practice:v.practice?undefined:{model:'',focus:'',instructions:''}}))}>
        {form.practice?'إزالة ورشة الكتابة':'إضافة ورشة كتابة'}</button></div>
      {form.practice&&<>
       <label>نموذج الكلمة أو الجملة<input maxLength={140} value={form.practice.model||''} onChange={e=>setForm(v=>({...v,practice:{...v.practice,model:e.target.value}}))}/></label>
       <label>الخط المستخدم في نموذج التدريب
        <select value={form.practice.script||form.script||schoolScriptForStage(slug,stage)}
         onChange={e=>setForm(v=>({...v,practice:{...v.practice,script:e.target.value}}))}>
         {SCHOOL_SCRIPT_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
       </label>
       <label>هدف ورشة الكتابة<input maxLength={100} value={form.practice.focus||''} onChange={e=>setForm(v=>({...v,practice:{...v.practice,focus:e.target.value}}))}/></label>
       <label>تعليمات التدريب اليدوي<textarea rows={3} maxLength={650} value={form.practice.instructions||''} onChange={e=>setForm(v=>({...v,practice:{...v.practice,instructions:e.target.value}}))}/></label>
      </>}
      <div className={styles.bankHead}><h3><ClipboardList size={19}/> أسئلة المحطة</h3>
       <button type="button" onClick={()=>choose('question',slug,stage)}>إضافة سؤال <Plus size={15}/></button></div>
      <p className={styles.muted}>المحطات الجديدة تحتاج إلى ستة أسئلة منشورة قبل إتاحتها. الاختبارات القديمة تبقى محفوظة.</p>
      <div className={styles.questionRows}>{questions.filter(q=>q.course_slug===slug&&q.stage_index===stage).map(q=>
       <button key={q.id} type="button" onClick={()=>choose('question',slug,stage,q.id)}>{q.draft.prompt}<small>{status(q)}</small></button>)}</div>
     </>}
     {kind==='question'&&<>
      <p className={styles.muted}>أسئلة اختيار وترتيب واستدعاء كتابي، مع حفظ الإجابات الصحيحة في الخادم فقط. تبقى التمارين العملية للمسند والعروض.</p>
      <label>نوع السؤال<select value={form.kind||'choice'} onChange={e=>{
       const kind=e.target.value;setForm(v=>({...defaultDoc.question(),prompt:v.prompt,target:v.target,explanation:v.explanation,kind,
        ...(kind==='order'?{tokens:['خطوة أ','خطوة ب','خطوة ج'],answer:['خطوة أ','خطوة ب','خطوة ج']}:{})
       }));
      }}>
       <option value="choice">اختيار من متعدد</option><option value="order">ترتيب عناصر</option><option value="type">كتابة إجابة قصيرة</option>
      </select></label>
      <label>نص السؤال<textarea value={form.prompt||''} rows={3} maxLength={350} onChange={e=>setForm(v=>({...v,prompt:e.target.value}))}/></label>
      <label>مادة السؤال / المثال (اختياري)<textarea value={form.target||''} rows={2} maxLength={500} onChange={e=>setForm(v=>({...v,target:e.target.value}))}/></label>
      {(form.kind||'choice')==='choice'&&<>
       {(form.options||['','','','']).map((option,i)=><label key={i}>الخيار {i+1}<input value={option} maxLength={150} onChange={e=>setForm(v=>({...v,options:v.options.map((x,j)=>i===j?e.target.value:x)}))}/></label>)}
       <label>الإجابة الصحيحة<select value={form.answerIndex??0} onChange={e=>setForm(v=>({...v,answerIndex:Number(e.target.value)}))}>{[0,1,2,3].map(i=><option value={i} key={i}>الخيار {i+1}</option>)}</select></label>
      </>}
      {form.kind==='order'&&<>
       <label>العناصر التي سيختارها الطالب (عنصر في كل سطر)
        <textarea rows={4} value={(form.tokens||[]).join('\n')} onChange={e=>setForm(v=>({...v,tokens:e.target.value.split('\n')}))}/></label>
       <label>الترتيب الصحيح (العناصر نفسها مرتبة، عنصر في كل سطر)
        <textarea rows={4} value={(form.answer||[]).join('\n')} onChange={e=>setForm(v=>({...v,answer:e.target.value.split('\n')}))}/></label>
      </>}
      {form.kind==='type'&&<label>الإجابة النصية المقبولة<input maxLength={80} value={form.answer||''}
       onChange={e=>setForm(v=>({...v,answer:e.target.value}))}/></label>}
      <label>تفسير الإجابة<textarea value={form.explanation||''} rows={3} maxLength={800} onChange={e=>setForm(v=>({...v,explanation:e.target.value}))}/></label>
     </>}
     <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>save('save')}><Save size={17}/> {busy?'جارٍ الحفظ…':'حفظ مسودة'}</button>
      {!creating&&item&&<button type="button" disabled={busy||isDirty||item.published_version===item.version} onClick={()=>save('publish')}><Upload size={17}/> نشر النسخة</button>}
      {kind==='question'&&<button type="button" className={styles.secondary} onClick={()=>choose('stage',slug,stage)}>العودة للمحطة</button>}
     </div>
     {notice&&<p role="status" className={styles.notice}>{notice}</p>}
     <p className={styles.helper}><ShieldCheck size={16}/> لا تُغيّر المسودة المحتوى المنشور. تُطبّق النسخة الجديدة بعد الضغط على «نشر» فقط.</p>
    </section>
   </div>}
   {mode==='analytics'&&<section className={styles.report}>
    <h2>تحليلات التعلم</h2><p>إحصاءات إجمالية دون أسماء الطلاب أو إجاباتهم الشخصية. تعتمد على آخر 3000 محاولة مصححة.</p>
    {reportError&&<p className={styles.error} role="alert">{reportError}</p>}
    {!report&&!reportError&&<p role="status">جارٍ تحميل التحليلات…</p>}
    {report&&<><p className={styles.muted}>عينة التقرير: {report.sampleSize} محاولة{report.truncated?' (النتائج الأقدم خارج التقرير)':''}</p>
     <h3>نجاح المحطات</h3><div className={styles.tableScroll}><table><thead><tr><th>المسار</th><th>المحطة</th><th>المحاولات</th><th>النجاح</th><th>متوسط الدرجة</th></tr></thead>
      <tbody>{report.stages.map(x=><tr key={x.course+':'+x.stage}><td>{x.course}</td><td>{x.stage+1}</td><td>{x.attempts}</td><td>{x.passRate}%</td><td>{x.meanScore} / 6</td></tr>)}</tbody></table></div>
     <h3>الأسئلة الأكثر صعوبة</h3><div className={styles.tableScroll}><table><thead><tr><th>المسار / المحطة</th><th>السؤال</th><th>المشاهدات</th><th>الأخطاء</th></tr></thead>
      <tbody>{report.questions.map((x,i)=><tr key={i}><td>{x.course} / {x.stage+1}</td><td>{x.prompt}</td><td>{x.asked}</td><td>{x.wrongRate}%</td></tr>)}</tbody></table></div></>}
   </section>}
   {mode==='history'&&<section className={styles.report}><h2>سجل المحتوى</h2>
    <p>آخر 60 عملية إنشاء أو تعديل أو نشر، محفوظة تلقائيًا مع الوقت ومعرّف المحرر.</p>
    <div className={styles.tableScroll}><table><thead><tr><th>الوقت</th><th>المحرر</th><th>العنصر</th><th>الإجراء</th></tr></thead>
    <tbody>{data.audit.map(a=><tr key={a.id}><td>{new Date(a.changed_at).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'})}</td>
     <td><code dir="ltr">{a.actor_id?.slice(0,8)||'نظام'}</code></td><td>{a.entity_key}</td><td>{a.action==='published'?'نشر':a.action==='created'?'إنشاء':'تعديل'}</td></tr>)}</tbody></table></div>
   </section>}
  </>}
 </div></div>;
}
