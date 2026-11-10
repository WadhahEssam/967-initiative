'use client';
import './DebateArena.css';
import {useCallback,useEffect,useRef,useState} from 'react';
import MemberLink from '@/components/members/MemberLink';
import {formatNumber} from '@/lib/format';
import {MessageCircle,HelpCircle,Reply,Flag,Pencil,Trash2,RefreshCw,Send} from 'lucide-react';
import ValidatedForm,{FormInput,FormTextarea,FormSelect,FormLabel} from './ValidatedForm';
import {COMMENT_RULES,COMMENT_STATUSES,QUESTION_STATUSES,httpsUrl} from '@/lib/debates';
import {UUID} from '@/lib/debates';
import {formatArabicDate} from '@/lib/format';
import {Pin} from 'lucide-react';
import {useInlineEditor} from '@/components/inline/InlineEditorProvider';
import InlineActions from '@/components/inline/InlineActions';
import {questionsAvailable,recordingHasPublished,QUESTIONS_AFTER_RECORDING_MESSAGE} from '@/lib/debates';
import DebateReportDialog from './DebateReportDialog';
import useDebateDraft from './useDebateDraft';

const empty=()=>({comments:{items:[],total:0,page:0},questions:{items:[],total:0,page:0}});
const merge=(a,b)=>[...new Map([...a,...b].map(item=>[item.id,item])).values()];
export default function DebateArena({debate,user,ready,account,canParticipate,busy,act,gate,refreshVersion,myPage,setMyPage,refreshAccount}){
 const [sources,setSources]=useState(empty),[filter,setFilter]=useState('all'),[compose,setCompose]=useState('comment'),[order,setOrder]=useState('newest'),[visible,setVisible]=useState(20),[loading,setLoading]=useState(true),[more,setMore]=useState(false),[error,setError]=useState(''),[reply,setReply]=useState(null),[editing,setEditing]=useState(null);
 const revision=useRef(0),viewRevision=useRef(0),processedChange=useRef(0),hashVersion=useRef(0);
 const [focused,setFocused]=useState(null);
 const focusedRecord=useRef(null);focusedRecord.current=focused;
 const inline=useInlineEditor(),loadedPages=useRef({comments:1,questions:1});loadedPages.current={comments:Math.max(1,sources.comments.page),questions:Math.max(1,sources.questions.page)};
 const closed=debate.publication_status==='archived'||debate.stage==='cancelled';
 const [draft,setDraft]=useDebateDraft(debate.id,user?.id,ready),[draftNotice,setDraftNotice]=useState(''),[reporting,setReporting]=useState(null),[syncError,setSyncError]=useState('');
 const questionDraft=draft.question,commentDraft=draft.comment;
 const setQuestionDraft=value=>setDraft(current=>({...current,question:typeof value==='function'?value(current.question):value}));
 const setCommentDraft=value=>setDraft(current=>({...current,comment:typeof value==='function'?value(current.comment):value}));
 const refreshOwn=useRef(refreshAccount);refreshOwn.current=refreshAccount;
 const allowQuestions=questionsAvailable(debate),recordingClosed=recordingHasPublished(debate);
 useEffect(()=>{if(!allowQuestions)setCompose('comment');},[allowQuestions]);
 useEffect(()=>{setDraftNotice('');},[debate.id,user?.id]);
 function useQuestionAsComment(){const combined=commentDraft?(commentDraft.includes(questionDraft.body)?commentDraft:commentDraft+'\n'+questionDraft.body):questionDraft.body;if(combined.length>5000){setDraftNotice('النص يتجاوز الحد المسموح للتعليق. انسخ السؤال وراجع مسودة تعليقك.');return;}setCommentDraft(combined);setCompose('comment');requestAnimationFrame(()=>document.getElementById('comment-body')?.focus());}
 async function copyQuestionDraft(){try{await navigator.clipboard.writeText(questionDraft.body);setDraftNotice('نُسخ نص السؤال.');}catch{setDraftNotice('تعذر النسخ التلقائي. يمكنك تحديد النص ونسخه من هنا.');}}

 const read=useCallback(async(kind,page,signal)=>{const response=await fetch('/api/debates?'+new URLSearchParams({discussion:kind,debate:debate.id,page:String(page),order}),{cache:'no-store',signal}).catch(error=>{if(error?.name==='AbortError')throw error;throw Error('تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.');});if(!response.ok)throw Error('تعذر تحميل المشاركات. حاول مجدداً.');const data=await response.json();return {...data,page};},[debate.id,order]);
 const reload=useCallback(async()=>{const current=++revision.current;setLoading(true);setError('');setMore(false);try{const [comments,questions]=await Promise.all([read('comments',1),read('questions',1)]);if(current===revision.current){setSources({comments,questions});setVisible(20);}}catch(err){if(current===revision.current)setError(err.message);}finally{if(current===revision.current)setLoading(false);}},[read]);
 useEffect(()=>{const guard=revision;reload();return()=>{guard.current++;};},[reload,refreshVersion]);
 useEffect(()=>{
  let stopped=false,timer=null,controller=null;
  async function sync(){
   if(stopped||document.hidden||navigator.onLine===false)return;
   controller?.abort();controller=new AbortController();const current=++revision.current;setMore(false);
   const anchor=[...document.querySelectorAll('.arena-post')].find(node=>{const rect=node.getBoundingClientRect();return rect.bottom>0&&rect.top<window.innerHeight;}),anchorTop=anchor?.getBoundingClientRect().top;
   try{const entries=await Promise.all(['comments','questions'].map(async kind=>{const pages=await Promise.all(Array.from({length:loadedPages.current[kind]},(_,index)=>read(kind,index+1,controller.signal)));return [kind,{...pages.at(-1),items:merge([],pages.flatMap(page=>page.items)),total:pages[0].total}];}));
    if(stopped||current!==revision.current)return;setSources(Object.fromEntries(entries));setLoading(false);setSyncError('');
    // Recheck linked records too; never retain a focused item after moderation.
    const focus=focusedRecord.current;if(focus){const response=await fetch('/api/debates?'+new URLSearchParams({target:focus.kind==='question'?'questions':'comments',debate:debate.id,id:focus.id}),{cache:'no-store',signal:controller.signal});if(response.ok){const result=await response.json();if(!stopped&&current===revision.current)setFocused(result?{...result.item,kind:focus.kind}:null);}}
    requestAnimationFrame(()=>{if(stopped||!anchor?.isConnected)return;const delta=anchor.getBoundingClientRect().top-anchorTop;if(Math.abs(delta)>1)window.scrollBy(0,delta);});
    refreshOwn.current?.();
   }catch(err){if(!stopped&&err.name!=='AbortError')setSyncError('توقف التحديث التلقائي مؤقتاً. سنحاول مجدداً عند عودة الاتصال.');}
   finally{if(!stopped&&!document.hidden){clearTimeout(timer);timer=setTimeout(sync,15000);}}
  }
  function resume(){clearTimeout(timer);if(document.hidden){controller?.abort();return;}sync();}
  timer=setTimeout(sync,15000);document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
  return()=>{stopped=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);};
 },[read,debate.id]);
 useEffect(()=>{
  const change=inline.lastChange;if(!inline.revision||inline.revision===processedChange.current||!change||change.debate_id&&change.debate_id!==debate.id||change.kind==='debate'&&change.id&&change.id!==debate.id)return;
  if(!['comments','questions','reports','debate'].includes(change.kind))return;
  processedChange.current=inline.revision;
  const focus=focusedRecord.current;if(focus&&(change.id===focus.id||change.item?.id===focus.id))window.dispatchEvent(new CustomEvent('967:inline-focus',{detail:{kind:focus.kind==='question'?'questions':'comments',id:focus.id,debate_id:debate.id}}));
  const current=++revision.current;setMore(false);
  const update=async()=>{try{const entries=await Promise.all(['comments','questions'].map(async kind=>{const pages=await Promise.all(Array.from({length:loadedPages.current[kind]},(_,index)=>read(kind,index+1)));return [kind,{...pages.at(-1),items:pages.flatMap(page=>page.items),total:pages[0].total}];}));if(current===revision.current){setSources(Object.fromEntries(entries));setError('');setLoading(false);}}catch(err){if(current===revision.current){setError(err.message);setLoading(false);}}};update();
 },[inline.revision,inline.lastChange,debate.id,read]);
 function chooseFilter(value){viewRevision.current++;setFilter(value);setVisible(20);setFocused(null);if(value!=='comments'&&order!=='newest')setOrder('newest');}
 useEffect(()=>{
  const guard=hashVersion;
  const reveal=async event=>{
   const detail=event?.detail;if(detail?.debate_id&&detail.debate_id!==debate.id)return;
   const hash=detail?.id?'#'+(detail.kind==='questions'?'question-':'comment-')+detail.id:location.hash,current=++guard.current;
   if(hash==='#questions'||hash==='#comments'){setCompose(hash==='#questions'?'question':'comment');requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView({block:'start'}));return;}
   const match=hash.match(/^#(comment|question)-(.+)$/);if(!match||!UUID.test(match[2]))return;
   const kind=match[1]==='question'?'questions':'comments';
   try{const response=await fetch('/api/debates?'+new URLSearchParams({target:kind,debate:debate.id,id:match[2],order:'newest'}),{cache:'no-store'});if(!response.ok)throw Error('تعذر الوصول إلى المشاركة المحددة.');const result=await response.json();if(current!==guard.current)return;if(!result){setFocused(null);setError('المشاركة المحددة غير متاحة للعامة حالياً.');return;}setFilter(kind);setFocused({...result.item,kind:kind==='questions'?'question':'comment'});setError('');requestAnimationFrame(()=>document.getElementById(match[1]+'-'+match[2])?.scrollIntoView({block:'center'}));}catch(err){if(current===guard.current)setError(err.message);}
  };
  reveal();window.addEventListener('hashchange',reveal);window.addEventListener('967:inline-focus',reveal);return()=>{guard.current++;window.removeEventListener('hashchange',reveal);window.removeEventListener('967:inline-focus',reveal);};
 },[debate.id]);
 const all=[...sources.comments.items.map(item=>({...item,kind:'comment'})),...sources.questions.items.map(item=>({...item,kind:'question'}))];
 const mine=[...(account?.debate_comments.items||[]).map(item=>({...item,kind:'comment',own:true})),...(account?.debate_questions.items||[]).map(item=>({...item,kind:'question',own:true}))];
 const candidates=(filter==='mine'?mine:all.filter(item=>filter==='all'||item.kind===(filter==='comments'?'comment':'question'))).sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||(filter==='comments'&&order==='oldest'?1:-1)*(Date.parse(a.created_at)-Date.parse(b.created_at))||a.id.localeCompare(b.id));
 const items=filter==='mine'?candidates:candidates.slice(0,visible);
 const displayedItems=focused&&filter!=='mine'&&!items.some(item=>item.id===focused.id)?[focused,...items]:items;
 // Replies sit right under their comment (oldest first) when that comment is in the list.
 const shownIds=new Set(displayedItems.filter(i=>i.kind==='comment').map(i=>i.id));
 const isThreaded=i=>filter!=='mine'&&i.kind==='comment'&&i.parent_id&&shownIds.has(i.parent_id);
 const repliesOf=new Map();for(const i of displayedItems)if(isThreaded(i))repliesOf.set(i.parent_id,[...(repliesOf.get(i.parent_id)||[]),{...i,threaded:true}]);
 const threadedItems=displayedItems.filter(i=>!isThreaded(i)).flatMap(i=>[i,...(repliesOf.get(i.id)||[]).sort((x,y)=>Date.parse(x.created_at)-Date.parse(y.created_at))]);
 const total=filter==='mine'?(account?.debate_comments.total||0)+(account?.debate_questions.total||0):filter==='all'?sources.comments.total+sources.questions.total:sources[filter].total;
 async function loadMore(){
  const current=revision.current,view=viewRevision.current;setMore(true);setError('');
  try{
   const kinds=filter==='all'?['comments','questions']:[filter];
   const updates=await Promise.all(kinds.map(async kind=>{const source=sources[kind],shown=items.filter(item=>item.kind===(kind==='comments'?'comment':'question')).length;if(source.items.length-shown>=20||source.items.length>=source.total)return [kind,source];const next=await read(kind,source.page+1);return [kind,{...next,items:merge(source.items,next.items)}];}));
   if(current===revision.current){setSources(previous=>({...previous,...Object.fromEntries(updates)}));if(view===viewRevision.current)setVisible(n=>n+20);}
  }catch(err){if(current===revision.current)setError(err.message);}finally{if(current===revision.current)setMore(false);}
 }
 function beginReply(item){setReply(item);setCompose('comment');requestAnimationFrame(()=>{document.getElementById('comment-body')?.focus();document.getElementById('arena-composer')?.scrollIntoView({block:'center',behavior:'smooth'});});}
 function afterPost(){chooseFilter('all');setOrder('newest');setReply(null);}
 function report(item){if(!user){location.assign('/login?next='+encodeURIComponent('/debates/'+debate.slug+'#discussion'));return;}setReporting(item);}
 return <section id="discussion" className="debate-arena">
  <div className="arena-heading"><div><span className="eyebrow">مساحة لكل رأي</span><h2>ساحة النقاش</h2><p>فكرتك تضيف زاوية جديدة للحوار.</p></div><span className="arena-total"><MessageCircle size={17} aria-hidden="true"/>{formatNumber(sources.comments.total+sources.questions.total)} مشاركة</span></div>
  <div className="arena-layout"><div className="arena-compose-column">
  <div className="arena-composer" id="arena-composer"><div className="arena-compose-topline"><div className="arena-compose-heading"><span className="debate-person-avatar" aria-hidden="true">{(account?.profile?.display_name||'م').charAt(0)}</span><div><strong>{account?.profile?.display_name||'شارك في الحوار'}</strong><small>تعليق أو سؤال، في مكان واحد.</small></div></div>
   <div className="arena-compose-switch" aria-label="نوع مشاركتك"><button type="button" aria-label="كتابة تعليق" aria-pressed={compose==='comment'} onClick={()=>setCompose('comment')}><MessageCircle size={16}/> تعليق</button><button type="button" aria-label="طرح سؤال" aria-pressed={compose==='question'} onClick={()=>setCompose('question')}><HelpCircle size={16}/> سؤال</button></div></div>
   {(compose!=='question'||allowQuestions)&&gate(compose==='question'?'questions':'comments')}
   {compose==='comment'&&account?.profile?.comments_restricted&&<p className="inline-error" role="status">إضافة التعليقات مقيدة لهذا الحساب. ما زالت بقية وظائف الحساب متاحة وفق صلاحياتك.</p>}
   {compose==='question'&&account?.profile?.questions_restricted&&<p className="inline-error" role="status">إرسال الأسئلة مقيد لهذا الحساب. ما زالت بقية وظائف الحساب متاحة وفق صلاحياتك.</p>}
   <div id="comments" hidden={compose!=='comment'}>{debate.comments_open&&!closed?<>{reply&&<div className="arena-reply-preview"><span>رد على {reply.display_name}: {reply.body.slice(0,100)}</span><button type="button" onClick={()=>setReply(null)}>إلغاء الرد</button></div>}<ValidatedForm className="debate-form arena-compose-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await act({action:'comment',data:{debate_id:debate.id,body:new FormData(form).get('body'),parent_id:reply?.id||null}},'نُشر تعليقك في ساحة النقاش.')){form.reset();setCommentDraft('');afterPost();}}}><fieldset disabled={busy||!ready||Boolean(user)&&(!canParticipate||account?.profile?.comments_restricted)}><FormLabel required htmlFor="comment-body">{reply?'اكتب رداً':'أضف تعليقاً'}</FormLabel><FormTextarea id="comment-body" name="body" aria-describedby="comment-count" value={commentDraft} onChange={event=>setCommentDraft(event.target.value)} required minLength={2} maxLength={5000} rows={2} placeholder="ما رأيك في المواقف المطروحة؟"/><small id="comment-count" className="arena-character-count">{formatNumber(commentDraft.length)} / {formatNumber(5000)}</small><button className="btn btn-primary" disabled={busy||!canParticipate||account?.profile?.comments_restricted}><Send size={15}/> نشر التعليق</button></fieldset></ValidatedForm></>:<p className="small-muted">إضافة تعليقات مغلقة.</p>}</div>
   <div id="questions" hidden={compose!=='question'}>{allowQuestions?<><p className="arena-compose-hint">يمكنك توجيه سؤالك إلى أحد المشاركين أو إلى الجميع قبل نشر التسجيل.</p><ValidatedForm className="debate-form arena-compose-form" onSubmit={async event=>{event.preventDefault();if(await act({action:'question',data:{debate_id:debate.id,body:questionDraft.body,participant_id:questionDraft.participant_id||null,axis:questionDraft.axis,anonymous:questionDraft.anonymous}},'نُشر سؤالك في ساحة النقاش.')){setQuestionDraft({body:'',participant_id:'',axis:'',anonymous:false});afterPost();}}}><fieldset disabled={busy||!ready||Boolean(user)&&(!canParticipate||account?.profile?.questions_restricted)}>
    <FormLabel required htmlFor="question-body">اكتب سؤالك</FormLabel><FormTextarea id="question-body" name="body" aria-describedby="question-count" value={questionDraft.body} onChange={event=>setQuestionDraft(current=>({...current,body:event.target.value}))} required minLength={10} maxLength={2000} rows={3} placeholder="ما الذي تودّ أن يوضّحه المشاركون؟"/><small id="question-count" className="arena-character-count">{formatNumber(questionDraft.body.length)} / {formatNumber(2000)}</small>
    <div className="debate-form-columns"><FormLabel>إلى من توجه سؤالك؟<FormSelect name="participant_id" value={questionDraft.participant_id} onChange={event=>setQuestionDraft(current=>({...current,participant_id:event.target.value}))}><option value="">الجميع</option>{debate.participants.map(participant=><option value={participant.id} key={participant.id}>{participant.speaker.name}</option>)}</FormSelect></FormLabel>
    {debate.axes.length>0&&<FormLabel>محور السؤال<FormSelect name="axis" value={questionDraft.axis} onChange={event=>setQuestionDraft(current=>({...current,axis:event.target.value}))}><option value="">عام</option>{debate.axes.map(axis=><option key={axis}>{axis}</option>)}</FormSelect></FormLabel>}</div>
    <FormLabel className="debate-check"><FormInput name="anonymous" type="checkbox" checked={questionDraft.anonymous} onChange={event=>setQuestionDraft(current=>({...current,anonymous:event.target.checked}))}/><span>انشر السؤال باسم «مشارك» بدلاً من اسم العرض</span></FormLabel><button className="btn btn-primary" disabled={busy||!canParticipate||account?.profile?.questions_restricted}><Send size={15}/> نشر السؤال</button>
   </fieldset></ValidatedForm></>:<div className="arena-question-closed" role="status"><p>{recordingClosed?QUESTIONS_AFTER_RECORDING_MESSAGE:'استقبال الأسئلة مغلق حالياً وفق إعدادات المناظرة.'}</p><button type="button" className="btn btn-outline" onClick={()=>{setCompose('comment');requestAnimationFrame(()=>document.getElementById('comment-body')?.focus());}}>كتابة تعليق</button></div>}</div>
   {!allowQuestions&&questionDraft.body&&<div className="arena-question-draft" role="status">{compose!=='question'&&<p>{recordingClosed?QUESTIONS_AFTER_RECORDING_MESSAGE:'توقف استقبال الأسئلة. بقيت مسودتك محفوظة هنا.'}</p>}<strong>مسودة سؤالك غير المرسل</strong><p className="debate-prose" tabIndex={0}>{questionDraft.body}</p><div className="debate-actions"><button type="button" onClick={copyQuestionDraft}>نسخ النص</button><button type="button" onClick={useQuestionAsComment}>استخدام النص في تعليق</button></div>{draftNotice&&<p>{draftNotice}</p>}</div>}
   <details className="arena-rules"><summary>قواعد الحوار</summary><p>{COMMENT_RULES}</p></details>
  </div>
  </div><div className="arena-feed-column"><div className="arena-feed-toolbar"><div className="arena-filters" aria-label="تصفية ساحة النقاش">{[['all','الكل'],['comments','التعليقات'],['questions','الأسئلة'],...(user?[['mine','مشاركاتي']]:[])].map(([value,label])=><button key={value} aria-label={label} aria-pressed={filter===value} onClick={()=>chooseFilter(value)}>{label}<span className="arena-filter-count">{formatNumber(value==='all'?sources.comments.total+sources.questions.total:value==='mine'?(account?.debate_comments.total||0)+(account?.debate_questions.total||0):sources[value].total)}</span></button>)}</div><div className="arena-feed-tools"><label>ترتيب التعليقات<select aria-label="ترتيب التعليقات" value={order} onChange={e=>{setOrder(e.target.value);setFilter('comments');setVisible(20);viewRevision.current++;}}><option value="newest">الأحدث</option><option value="oldest">الأقدم</option></select></label><button className="arena-refresh" disabled={loading} onClick={reload} aria-label="تحديث ساحة النقاش"><RefreshCw size={16}/></button></div></div>
  {syncError&&<p className="small-muted" role="status">{syncError}</p>}{error&&<p className="feedback error" role="alert">{error} <button onClick={reload}>إعادة المحاولة</button></p>}
  {focused&&<div className="arena-focus-notice" role="status"><span>المشاركة المحددة من الرابط</span><button type="button" onClick={()=>setFocused(null)}>إنهاء تحديد المشاركة</button></div>}<p className="arena-results-note" role="status">{loading?'جارٍ تحديث المشاركات…':`عرض ${formatNumber(displayedItems.length)} من ${formatNumber(total)} مشاركة`}</p><div className="arena-feed" aria-busy={loading&&filter!=='mine'}>{loading&&filter!=='mine'&&<p className="arena-empty" role="status">جارٍ تحميل المشاركات…</p>}{!loading&&items.length===0&&<div className="arena-empty"><MessageCircle size={24}/><p>{filter==='mine'?'ستجد هنا أسئلتك وتعليقاتك وحالة ظهورها.':'ابدأ الحوار بتعليق أو سؤال يحترم اختلاف الآراء.'}</p></div>}{threadedItems.map(item=>{
   const question=item.kind==='question',own=item.own,name=own?(question&&item.anonymous?'مشارك':account?.profile?.display_name||'أنت'):item.display_name;
   const parent=item.parent_id&&sources.comments.items.find(c=>c.id===item.parent_id);
   return <article className={'arena-post'+(item.parent_id?' arena-post-reply':'')+(item.threaded?' arena-post-threaded':'')+(focused?.id===item.id?' arena-post-focused':'')} data-kind={item.kind} data-pinned={item.pinned||undefined} key={item.kind+item.id} id={(question?'question-':'comment-')+item.id}><div className="arena-post-header"><MemberLink id={item.member_id} name={name} avatarUrl={!question?httpsUrl(item.avatar_url):null} className="arena-post-member"/><div>{own&&<small>أنت</small>}<time dateTime={item.created_at}>{formatArabicDate(item.created_at)}</time></div><span className={'arena-post-kind'+(question?' question':'')}>{question?<HelpCircle size={13}/>:<MessageCircle size={13}/>} {question?'سؤال':'تعليق'}</span>{inline.enabled&&<div className="inline-post-tools"><InlineActions label={question?'إشراف على السؤال':'إشراف على التعليق'} target={{kind:question?'questions':'comments',id:item.id,debate_id:debate.id,title:question?'سؤال في المناظرة':'تعليق في المناظرة',href:'/debates/'+debate.slug}}/></div>}</div>
    {item.pinned&&(!item.status||item.status==='approved')&&<span className="inline-pinned-label"><Pin size={13}/> تعليق مثبت</span>}
    {own&&<span className="arena-post-status">{question?QUESTION_STATUSES[item.status]:COMMENT_STATUSES[item.status]}</span>}{!own&&question&&<span className="arena-post-status">{QUESTION_STATUSES[item.status]}</span>}
    {item.threaded&&<span className="arena-reply-to"><Reply size={12} aria-hidden="true"/> رد على {parent?.display_name||'التعليق'}</span>}{item.parent_id&&!item.threaded&&<a className="arena-reply-context" href={'#comment-'+item.parent_id}>{parent?'رد على '+parent.display_name+': '+parent.body.slice(0,100):'رد على تعليق سابق'}</a>}
    {editing?.id===item.id?<ValidatedForm className="debate-form" onSubmit={async e=>{e.preventDefault();if(await act({action:'comment_edit',id:item.id,data:{body:new FormData(e.currentTarget).get('body')}},'حُفظت تعديلات تعليقك.'))setEditing(null);}}><FormLabel>تعديل تعليقي<FormTextarea name="body" value={editing.body} onChange={e=>setEditing(current=>({...current,body:e.target.value}))} required minLength={2} maxLength={5000}/></FormLabel><div className="arena-post-actions"><button className="btn btn-primary" disabled={busy}>حفظ التعديل</button><button type="button" onClick={()=>setEditing(null)}>إلغاء</button></div></ValidatedForm>:<p className="arena-post-body">{item.body}</p>}
    {question&&(item.axis||item.participant_id)&&<div className="arena-question-context">{item.participant_id&&<span>إلى: {debate.participants.find(p=>p.id===item.participant_id)?.speaker.name||'المشاركين'}</span>}{item.axis&&<span>{item.axis}</span>}</div>}
    {!question&&<div className="arena-post-actions">{own?item.status!=='deleted'&&<><button disabled={busy||!canParticipate} onClick={()=>setEditing({id:item.id,body:item.body})}><Pencil size={14}/> تعديل</button><button disabled={busy} onClick={async()=>{if(confirm('حذف تعليقك؟')&&await act({action:'comment_delete',id:item.id},'حُذف تعليقك.'))setEditing(current=>current?.id===item.id?null:current);}}><Trash2 size={14}/> حذف</button></>:<>{!item.parent_id&&<button disabled={closed||!debate.comments_open} onClick={()=>beginReply(item)}><Reply size={15}/> رد</button>}<button disabled={busy} onClick={()=>report(item)}><Flag size={14}/> إبلاغ</button></>}</div>}
   </article>;
  })}</div>
  {filter!=='mine'&&!loading&&items.length<total&&<button className="arena-load-more" disabled={more} onClick={loadMore}>{more?'جارٍ التحميل…':'عرض مشاركات أخرى'}</button>}
  {filter==='mine'&&Math.max(account?.debate_comments.total||0,account?.debate_questions.total||0)>20&&<nav className="debate-actions arena-own-pages" aria-label="صفحات مشاركاتي"><button disabled={myPage===1||busy} onClick={()=>setMyPage(n=>n-1)}>السابق</button><span>صفحة {myPage}</span><button disabled={myPage*20>=Math.max(account.debate_comments.total,account.debate_questions.total)||busy} onClick={()=>setMyPage(n=>n+1)}>التالي</button></nav>}
  </div></div>
  {reporting&&<DebateReportDialog item={reporting} onClose={()=>setReporting(null)} submit={act}/>}
 </section>;
}
