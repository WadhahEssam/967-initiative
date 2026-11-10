'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Eye,EyeOff,RefreshCw,Save} from 'lucide-react';
import {publicSections,sectionIsVisible} from '@/lib/pageVisibility';
import {inlineContentRequest} from '@/lib/inlineContentClient';
import useAdminEditor from './admin/useAdminEditor';

export default function PageVisibilityPanel({db}){
 const router=useRouter(),live=useRef(false),generation=useRef(0);
 const [sections,setSections]=useState(null),[original,setOriginal]=useState(''),[revision,setRevision]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null);
 const dirty=sections!==null&&JSON.stringify(sections)!==original;
 const editor=useAdminEditor({db,kind:'page',id:'site-visibility',value:sections,onRestore:setSections}),{markClean}=editor;
 const load=useCallback(async()=>{const version=++generation.current;setBusy(true);setNotice(null);try{const result=await inlineContentRequest(db,'/api/admin/page-visibility');if(live.current&&version===generation.current){setSections(result.sections);setOriginal(JSON.stringify(result.sections));setRevision(result.revision);markClean(result.sections);}}catch(error){if(live.current&&version===generation.current)setNotice({error:true,text:error.message});}finally{if(live.current&&version===generation.current)setBusy(false);}},[db,markClean]);
 useEffect(()=>{const counter=generation;live.current=true;load();return()=>{live.current=false;counter.current++;};},[load]);
 async function save(){if(busy||!dirty)return;setBusy(true);setNotice(null);try{const result=await inlineContentRequest(db,'/api/admin/page-visibility',{method:'PUT',body:{sections,revision}});if(live.current){setSections(result.sections);setOriginal(JSON.stringify(result.sections));setRevision(result.revision);markClean(result.sections);await editor.clearDraft();setNotice({text:'حُفظ ظهور الأقسام. تُطبَّق الحالة الجديدة عند فتح الصفحات أو تحديثها.'});router.refresh();}}catch(error){if(live.current)setNotice({error:true,text:error.message});}finally{if(live.current)setBusy(false);}}
 return <section className="page-visibility-panel"><header><div><h3><Eye size={20}/> ظهور أقسام الموقع</h3><p>إخفاء القسم يزيله من التنقل والرئيسية والبحث والفهرسة ويوقف صفحاته العامة. يبقى محتواه محفوظًا في لوحة التحرير ويمكن استعادته.</p></div><div className="debate-actions"><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>{if(!dirty||confirm('تجاهل تعديلات الظهور غير المحفوظة وتحميل المحفوظ؟'))load();}}><RefreshCw size={16}/> إعادة تحميل</button><button type="button" className="btn btn-primary" disabled={busy||!dirty} onClick={save}><Save size={16}/> {busy?'جارٍ التنفيذ…':'حفظ الظهور'}</button></div></header>
  {notice&&<p className={'feedback '+(notice.error?'error':'success')} role={notice.error?'alert':'status'}>{notice.text}</p>}
  {editor.draft&&<div className="editor-draft-restore"><span>مسودة خاصة لإعدادات الظهور</span><button type="button" disabled={busy||editor.draftBusy} onClick={editor.restoreDraft}>استعادة المسودة الخاصة</button></div>}{editor.draftMessage&&<p className="small-muted" role="status">{editor.draftMessage}</p>}
  {!sections?<p role="status">جارٍ تحميل إعدادات الظهور…</p>:<div className="page-visibility-grid">{publicSections.map(item=>{const visible=sectionIsVisible(item.id,sections),parentHidden=item.parent&&sections[item.parent]===false;return <div className={'page-visibility-item '+(!visible?'is-hidden':'')} key={item.id}><div>{visible?<Eye size={18}/>:<EyeOff size={18}/>}<strong>{item.title}</strong><small dir="ltr">{item.path}</small><span>{parentHidden?'مخفي لأن «'+(publicSections.find(parent=>parent.id===item.parent)?.title||'القسم الأعلى')+'» مخفي':visible?'ظاهر للزوار':'مخفي عن الزوار'}</span></div><button type="button" className="btn btn-outline" disabled={busy||parentHidden} aria-label={(sections[item.id]===false?'استعادة ':'إخفاء ')+item.title} onClick={()=>setSections(current=>({...current,[item.id]:current[item.id]===false}))}>{sections[item.id]===false?'استعادة الصفحة':'إخفاء الصفحة'}</button></div>;})}</div>}
 </section>;
}
