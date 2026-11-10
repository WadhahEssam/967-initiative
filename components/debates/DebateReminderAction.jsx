'use client';
import Link from '@/components/SiteLink';
import {Bell,BellOff,CheckCircle2} from 'lucide-react';
import {useEffect,useState} from 'react';
import useAudience,{audienceRequest} from '@/components/debates/useAudience';
import {eligibleForDebateReminder} from '@/lib/debateNotificationRules';

export default function DebateReminderAction({debate}){
 const {user,ready}=useAudience();
 const [status,setStatus]=useState({subscribed:false,eligible:false,loading:true});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const isLive=debate.debate_type==='external_live';
 const fallbackEligible=eligibleForDebateReminder(debate);
 useEffect(()=>{
  let alive=true;
  setStatus({subscribed:false,eligible:fallbackEligible,loading:Boolean(user)});setError('');setNote('');
  if(!user)return()=>{alive=false;};
  audienceRequest('/api/debates/reminders?id='+encodeURIComponent(debate.id))
   .then(data=>{if(alive)setStatus({subscribed:!!data.subscribed,eligible:!!data.eligible,loading:false});})
   // A 403 (email not confirmed, suspended) is explained when the reader taps the button, not as an error on every page.
   .catch(e=>{if(alive){setStatus(current=>({...current,loading:false}));if(e.status!==403)setError(e.message);}});
  return()=>{alive=false;};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[user?.id,debate.id,fallbackEligible]);
 if(!ready||(!fallbackEligible&&!status.subscribed))return null;
 const label=isLive?'ذكّرني قبل البث':'أبلغني عند نشر التسجيل';
 const update=async()=>{
  if(busy)return;
  const enabled=!status.subscribed;
  setBusy(true);setError('');setNote('');
  try{
   const result=await audienceRequest('/api/debates/reminders',{id:debate.id,enabled});
   setStatus(current=>({...current,subscribed:result.subscribed}));
   setNote(enabled?'تم تفعيل التذكير داخل موقع 967.':'ألغيت التذكير لهذه المناظرة.');
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 return <div className="debate-reminder-action">
  {user?
   <button type="button" className={'debate-reminder-button'+(status.subscribed?' is-subscribed':'')}
    disabled={busy||status.loading||(!status.eligible&&!status.subscribed)}
    aria-pressed={status.subscribed} onClick={update}>
    {status.subscribed?<BellOff size={17}/>:<Bell size={17}/>}
    {status.loading?'جارٍ التحقق…':status.subscribed?'إلغاء التذكير':label}
   </button>:
   <Link className="debate-reminder-button" href={'/login?next='+encodeURIComponent('/debates/'+debate.slug)}>
    <Bell size={17}/>{label}
   </Link>}
  {status.subscribed&&!note&&<small className="debate-reminder-note"><CheckCircle2 size={14}/> التذكير مفعّل</small>}
  {note&&<small className="debate-reminder-note" role="status">{note}</small>}
  {error&&<small className="debate-reminder-error" role="alert">{error}</small>}
 </div>;
}
