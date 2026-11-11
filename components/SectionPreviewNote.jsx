'use client';
import {useState} from 'react';
import {EyeOff} from 'lucide-react';

// Shown to editors who open a hidden section through the preview cookie.
export default function SectionPreviewNote(){
 const [busy,setBusy]=useState(false);
 async function stop(){
  setBusy(true);
  await fetch('/api/admin/section-preview',{method:'DELETE'}).catch(()=>null);
  location.reload();
 }
 return <div className="section-preview-note" role="note">
  <EyeOff size={16} aria-hidden="true"/>
  <span>معاينة للمحررين: هذا القسم مخفي عن الزوار.</span>
  <button type="button" onClick={stop} disabled={busy}>إنهاء المعاينة</button>
 </div>;
}
