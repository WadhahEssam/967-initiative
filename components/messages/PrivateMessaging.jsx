'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {ArrowRight,Ban,Bell,BellOff,Check,CheckCheck,ChevronLeft,Inbox,MailPlus,MessageCircle,RefreshCcw,Search,Send,Settings2,ShieldAlert,Store,UserRound,Pin,PinOff,Trash2,X} from 'lucide-react';
import useAudience from '@/components/debates/useAudience';
import {browserDb} from '@/lib/supabase';
import {REPORT_REASONS,isMessageRead} from '@/lib/privateMessaging';
import {shouldSendComposerEnter,composerHeight} from '@/lib/messageComposer';
import {buildMessageTimeline,messageClock} from '@/lib/messageTimeline';
import {placeMessageMenu} from '@/lib/messageMenuPlacement';
import MemberLink from '@/components/members/MemberLink';
import ProfileAvatar from '@/components/design/ProfileAvatar';
import MarketChats from '@/components/market/MarketChats';
import useMarketChatCount from '@/components/market/useMarketChatCount';
import styles from './PrivateMessaging.module.css';

const date=value=>value?new Intl.DateTimeFormat('ar',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'';
const defaults={discoverable:true,allow_requests:true,notify_messages:true};

// Back to the page the visitor came from; with no earlier page on this site, go home.
function goBack(){let sameSite=false;try{sameSite=Boolean(sessionStorage.getItem('967-came-from'))||Boolean(document.referrer)&&new URL(document.referrer).origin===location.origin;}catch{}if(sameSite&&history.length>1)history.back();else location.assign('/');}
export default function PrivateMessaging(){
 const {user,ready}=useAudience();
 // «سوق 967» chats: their own tab and count, shown only to members who can use the market.
 const market=useMarketChatCount(ready&&user?user.id:null);
 const [tab,setTab]=useState('inbox'),[items,setItems]=useState([]);
 // /messages?tab=market opens the market tab (links from listings and «إعلاناتي»).
 useEffect(()=>{const wanted=new URLSearchParams(window.location.search).get('tab');if(wanted==='market'||wanted==='settings')setTab(wanted);},[]);
 const [selected,setSelected]=useState(null),[thread,setThread]=useState(null);
 const [query,setQuery]=useState(''),[results,setResults]=useState([]);
 const [settings,setSettings]=useState(defaults),[blocked,setBlocked]=useState([]);
 const [draft,setDraft]=useState(''),[intro,setIntro]=useState('');
 const [dialog,setDialog]=useState(null),[reason,setReason]=useState('harassment'),[detail,setDetail]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [messageMenu,setMessageMenu]=useState(null),[menuPosition,setMenuPosition]=useState(null),[editing,setEditing]=useState(null),[copyToast,setCopyToast]=useState(0);
 const [replying,setReplying]=useState(null),[historical,setHistorical]=useState(false),[jumpTo,setJumpTo]=useState(null);
 const [threadSearchOpen,setThreadSearchOpen]=useState(false),[threadSearchTerm,setThreadSearchTerm]=useState('');
 const [threadSearchHits,setThreadSearchHits]=useState([]),[threadSearchHasMore,setThreadSearchHasMore]=useState(false),[threadSearchNextBefore,setThreadSearchNextBefore]=useState(null);
 const [threadSearchLoading,setThreadSearchLoading]=useState(false),[threadSearchError,setThreadSearchError]=useState('');
 const threadSearchSeq=useRef(0);
 const historicalRef=useRef(false);
 // Freeze the first-unread position for this visit, even after POST read.
 const unreadMarkerRef=useRef({conversation:null,initialized:false,message:null});
 const scrollToLatestRequestedRef=useRef(false);
 const [showLatestJump,setShowLatestJump]=useState(false);
 const [convMenu,setConvMenu]=useState(null),convMenuRef=useRef(null),convTouchRef=useRef({});
 const messageMenuRef=useRef(null),lastTapRef=useRef(null),touchStartRef=useRef(null);
 const messagesRef=useRef(null),composerRef=useRef(null);
 const resizeComposer=useCallback(()=>{
  const field=composerRef.current;
  if(!field)return;
  field.style.height='auto';
  const threadHeight=field.closest('section')?.clientHeight||window.innerHeight;
  const {height,overflow}=composerHeight(field.scrollHeight,window.innerHeight,threadHeight);
  field.style.height=height+'px';
  field.style.overflowY=overflow;
 },[]);
 useLayoutEffect(()=>{resizeComposer();},[draft,selected,thread?.conversation?.status,resizeComposer]);
 useEffect(()=>{
  const onResize=()=>resizeComposer();
  window.addEventListener('resize',onResize);
  return()=>window.removeEventListener('resize',onResize);
 },[resizeComposer]);
 const scrollStateRef=useRef({conversation:null,lastMessage:null});
 const live=useRef({user:null,selected:null});
 live.current={user:user?.id||null,selected};

 const request=useCallback(async (mode='inbox',payload=null)=>{
  const db=browserDb();
  if(!db)throw Error('خدمة الحسابات غير متاحة.');
  const {data,error}=await db.auth.getSession();
  if(error||!data.session?.access_token)throw Error('انتهت جلسة تسجيل الدخول.');
  const isAction=!!payload;
  const res=await fetch('/api/messages'+(isAction?'':('?'+mode)),{
   method:isAction?'POST':'GET',
   headers:{Authorization:'Bearer '+data.session.access_token,...(isAction?{'Content-Type':'application/json'}:{})},
   body:isAction?JSON.stringify(payload):undefined,cache:'no-store'
  });
  const body=await res.json();
  if(!res.ok)throw Error(body.error||'تعذر تنفيذ الطلب.');
  // Refresh the shared header badge immediately after reads, sends or decisions.
  if(isAction&&typeof window!=='undefined')window.dispatchEvent(new Event('967:messages-changed'));
  return body;
 },[]);

 const reload=useCallback(async()=>{
  if(!live.current.user)return;
  const owner=live.current.user;
  try{const data=await request('mode=inbox');if(live.current.user===owner)setItems(data.conversations||[]);}
  catch(e){if(live.current.user===owner)setError(e.message);}
 },[request]);
 const open=useCallback(async(id,changeUrl=true)=>{
  if(!id||!live.current.user)return;
  const owner=live.current.user;
  if(live.current.selected!==id||unreadMarkerRef.current.conversation!==id){
   setMessageMenu(null);setEditing(null);setReplying(null);setJumpTo(null);
   historicalRef.current=false;setHistorical(false);setThreadSearchOpen(false);setThreadSearchTerm('');
   unreadMarkerRef.current={conversation:id,initialized:false,message:null};
   scrollStateRef.current={conversation:null,lastMessage:null};
   scrollToLatestRequestedRef.current=false;
   setShowLatestJump(false);
  }
  setSelected(id);setThread(previous=>previous?.conversation?.id===id?previous:null);setError('');
  if(changeUrl&&typeof window!=='undefined')history.replaceState(null,'','/messages?conversation='+encodeURIComponent(id));
  try{
   const data=await request('mode=thread&id='+encodeURIComponent(id));
   if(live.current.user!==owner||live.current.selected!==id)return;
   // Only the initial thread response may set the marker. Subsequent polls,
   // edits and read confirmations must not remove it.
   if(unreadMarkerRef.current.conversation===id&&!unreadMarkerRef.current.initialized)
    unreadMarkerRef.current={conversation:id,initialized:true,message:data.first_unread_message||null};
   setThread(data);
   if(data.conversation?.status==='accepted'){
    await request('',{action:'read',conversation:id});
    reload();
   }
  }catch(e){if(live.current.user===owner&&live.current.selected===id)setError(e.message);}
 },[request,reload]);

 useEffect(()=>{
  if(!ready||!user){
   unreadMarkerRef.current={conversation:null,initialized:false,message:null};
   setItems([]);setSelected(null);setThread(null);return;
  }
  setLoading(true);
  const params=new URLSearchParams(window.location.search);
  const requested=params.get('conversation');
  const contactId=params.get('to');
  Promise.all([request('mode=inbox'),request('mode=settings')]).then(([data,opts])=>{
   if(live.current.user!==user.id)return;
   setItems(data.conversations||[]);
   setSettings(opts.settings||defaults);
   setBlocked(opts.blocked||[]);
   if(requested&&/^[0-9a-f-]{36}$/i.test(requested))open(requested,false);
   else if(contactId&&/^[0-9a-f-]{36}$/i.test(contactId)){
    const existing=(data.conversations||[]).find(c=>c.partner_id===contactId);
    if(existing){setTab('inbox');open(existing.id);}
    else request('mode=contact&id='+encodeURIComponent(contactId)).then(contact=>{
     if(live.current.user===user.id){setDialog({type:'request',person:contact.person});setTab('inbox');}
    }).catch(failure=>{if(live.current.user===user.id)setError(failure.message);});
   }
  }).catch(e=>{if(live.current.user===user.id)setError(e.message);})
    .finally(()=>{if(live.current.user===user.id)setLoading(false);});
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[ready,user?.id,request,open]);

 useEffect(()=>{
  if(!user||!ready)return;
  const update=()=>{if(document.visibilityState==='visible'){reload();if(live.current.selected&&!historicalRef.current)open(live.current.selected,false);}};
  const timer=setInterval(update,45000);
  window.addEventListener('focus',update);
  return()=>{clearInterval(timer);window.removeEventListener('focus',update);};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[ready,user?.id,open,reload]);

 // One Realtime subscription ONLY while a thread is open. No costly global sockets.
 useEffect(()=>{
  if(!thread||thread.conversation?.status!=='accepted'||!selected)return;
  const db=browserDb();
  const channel=db?.channel('private-messages-'+selected)
   .on('postgres_changes',{event:'*',schema:'public',table:'private_messages',filter:'conversation_id=eq.'+selected},
    ()=>{if(document.visibilityState==='visible'&&!historicalRef.current)open(selected,false);})
   .subscribe();
  return()=>{if(channel)db.removeChannel(channel);};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the open conversation and its status; thread changes on every poll
 },[selected,thread?.conversation?.status,open]);

 const updateLatestJump=()=>{
  const box=messagesRef.current;
  if(box)setShowLatestJump(box.scrollHeight-box.scrollTop-box.clientHeight>95);
 };
 useEffect(()=>{
  const box=messagesRef.current;
  if(!box||tab!=='inbox'||!selected||thread?.conversation?.status!=='accepted'){
   if(!selected||tab!=='inbox')scrollStateRef.current={conversation:null,lastMessage:null};
   return;
  }
  const lastMessage=thread.messages?.[thread.messages.length-1]?.id||null;
  const previous=scrollStateRef.current;
  if(scrollToLatestRequestedRef.current){
   box.scrollTop=box.scrollHeight;
   scrollToLatestRequestedRef.current=false;
  }else if(previous.conversation!==selected){
   const divider=box.querySelector('[data-unread-separator]');
   if(divider){
    // On opening, show the beginning of the unread portion rather than
    // skipping to the very last message.
    const target=divider.getBoundingClientRect().top-box.getBoundingClientRect().top;
    box.scrollTop=Math.max(0,box.scrollTop+target-12);
   }else box.scrollTop=box.scrollHeight;
  }else if(previous.lastMessage!==lastMessage&&!historicalRef.current){
   const distance=box.scrollHeight-box.scrollTop-box.clientHeight;
   if(distance<150)box.scrollTop=box.scrollHeight;
  }
  scrollStateRef.current={conversation:selected,lastMessage};
  setShowLatestJump(box.scrollHeight-box.scrollTop-box.clientHeight>95);
 },[tab,selected,thread]);

 // Keep navigation inside the message scroller; do not scroll the site page.
 useEffect(()=>{
  if(!jumpTo||!messagesRef.current)return;
  const box=messagesRef.current;
  const original=Array.from(box.querySelectorAll('[data-message-bubble]'))
   .find(item=>item.dataset.messageBubble===jumpTo.id);
  if(!original)return;
  const boxRect=box.getBoundingClientRect(),targetRect=original.getBoundingClientRect();
  const top=box.scrollTop+(targetRect.top-boxRect.top)-(box.clientHeight-targetRect.height)/2;
  box.scrollTo({top:Math.max(0,top),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const timer=window.setTimeout(()=>setJumpTo(null),2200);
  return()=>window.clearTimeout(timer);
 },[jumpTo,thread?.messages]);

 // Read receipts come from the other participant's server-owned last-read time.
 // Poll only while the conversation is on screen; no global Realtime sockets.
 useEffect(()=>{
  if(!ready||!user||tab!=='inbox'||!selected||thread?.conversation?.status!=='accepted')return;
  let cancelled=false,inFlight=false;
  const refresh=async()=>{
   if(document.visibilityState==='hidden'||inFlight)return;
   inFlight=true;
   const owner=live.current.user,conversation=selected;
   try{
    const data=await request('mode=receipt&id='+encodeURIComponent(conversation));
    if(!cancelled&&live.current.user===owner&&live.current.selected===conversation)
     setThread(old=>old?.conversation?.id===conversation?{...old,partner_last_read_at:data.partner_last_read_at,pinned_message:data.pinned_message||null}:old);
   }catch{ /* Keep the last confirmed receipt and retry on the next refresh. */ }
   finally{inFlight=false;}
  };
  const timer=window.setInterval(refresh,15000);
  window.addEventListener('focus',refresh);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[ready,user?.id,tab,selected,thread?.conversation?.status,request]);

 // Debounced search uses the server, so older messages not currently
 // loaded by the conversation scroller still appear in the results.
 useEffect(()=>{
  const searchSeq=threadSearchSeq,sequence=++searchSeq.current;
  const term=threadSearchTerm.trim().slice(0,60);
  setThreadSearchHits([]);setThreadSearchHasMore(false);setThreadSearchNextBefore(null);setThreadSearchError('');
  if(!threadSearchOpen||!selected||tab!=='inbox'||thread?.conversation?.status!=='accepted'||term.length<2){
   setThreadSearchLoading(false);return;
  }
  setThreadSearchLoading(true);
  const owner=live.current.user,conversation=selected;
  const timer=window.setTimeout(()=>{
   request('mode=thread-search&id='+encodeURIComponent(conversation)+'&q='+encodeURIComponent(term))
    .then(data=>{
     if(threadSearchSeq.current!==sequence||live.current.user!==owner||live.current.selected!==conversation)return;
     setThreadSearchHits(data.matches||[]);
     setThreadSearchHasMore(Boolean(data.hasMore));
     setThreadSearchNextBefore(data.nextBefore||null);
    })
    .catch(error=>{if(threadSearchSeq.current===sequence)setThreadSearchError(error.message);})
    .finally(()=>{if(threadSearchSeq.current===sequence)setThreadSearchLoading(false);});
  },300);
  return()=>{window.clearTimeout(timer);searchSeq.current++;};
 },[threadSearchOpen,threadSearchTerm,selected,tab,thread?.conversation?.status,request]);

 useEffect(()=>{
  if(!user||tab!=='search'||query.trim().length<2){setResults([]);return;}
  let active=true;
  const timer=setTimeout(()=>{
   request('mode=search&q='+encodeURIComponent(query.trim())).then(data=>{
    if(active)setResults(data.users||[]);
   }).catch(e=>{if(active)setError(e.message);});
  },300);
  return()=>{active=false;clearTimeout(timer);};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in account changes, not on every session token refresh
 },[user?.id,tab,query,request]);

 const run=async(payload,callback)=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await request('',payload);
   if(callback)await callback(result);
   else await reload();
   return result;
  }catch(e){setError(e.message);return null;}
  finally{setBusy(false);}
 };
 const unread=items.reduce((sum,x)=>sum+Number(x.unread||0),0);
 const pending=items.filter(x=>x.status==='pending'&&x.requested_by!==user?.id);
 const visible=items.filter(x=>x.status==='accepted'||x.status==='pending'&&x.requested_by===user?.id);
 const backToList=()=>{
  unreadMarkerRef.current={conversation:null,initialized:false,message:null};
  scrollStateRef.current={conversation:null,lastMessage:null};
  scrollToLatestRequestedRef.current=false;
  setShowLatestJump(false);setSelected(null);setThread(null);setMessageMenu(null);
  setEditing(null);setReplying(null);setJumpTo(null);setThreadSearchOpen(false);
  setThreadSearchTerm('');historicalRef.current=false;setHistorical(false);
  history.replaceState(null,'','/messages');
 };
 const selectTab=name=>{setTab(name);setError('');setNotice('');if(name!=='inbox')backToList();};
 const onComposerKeyDown=event=>{
  if(!shouldSendComposerEnter(event,window.matchMedia('(max-width: 680px)').matches))return;
  event.preventDefault();
  if(!busy&&selected&&draft.trim())event.currentTarget.form?.requestSubmit();
 };
 const send=async event=>{
  event.preventDefault();
  if(!selected||!draft.trim())return;
  const text=draft.trim();
  const result=await run({action:'send',conversation:selected,text,...(replying?{message:replying.id}:{})},async()=>{setDraft('');setReplying(null);historicalRef.current=false;setHistorical(false);scrollToLatestRequestedRef.current=true;await open(selected,false);await reload();});
  if(!result)setDraft(text);
 };
 // Double click on desktop or double tap on touchscreens opens message actions.
 const openMessageMenu=message=>{
  if(!message?.deleted_at&&!editing){setMenuPosition(null);setMessageMenu(message.id);}
 };
 const onMessageTouchStart=(event,id)=>{
  if(event.touches.length!==1){touchStartRef.current=null;return;}
  const touch=event.touches[0];
  touchStartRef.current={id,x:touch.clientX,y:touch.clientY};
 };
 const onMessageTouchEnd=(event,message)=>{
  if(message.deleted_at||event.touches.length||!event.changedTouches.length)return;
  const start=touchStartRef.current,touch=event.changedTouches[0];
  touchStartRef.current=null;
  if(start?.id!==message.id||Math.hypot(start.x-touch.clientX,start.y-touch.clientY)>14)return;
  const now=Date.now(),prior=lastTapRef.current;
  if(prior?.id===message.id&&now-prior.at<=380&&Math.hypot(prior.x-touch.clientX,prior.y-touch.clientY)<30){
   event.preventDefault();
   lastTapRef.current=null;
   openMessageMenu(message);
  }else lastTapRef.current={id:message.id,at:now,x:touch.clientX,y:touch.clientY};
 };
 // Use a fixed body portal so the menu is never clipped by overflow-y:auto.
 useLayoutEffect(()=>{
  if(!messageMenu)return;
  const pane=messagesRef.current,menu=messageMenuRef.current;
  if(!pane||!menu)return;
  const position=()=>{
   const bubble=Array.from(pane.querySelectorAll('[data-message-bubble]')).find(el=>el.dataset.messageBubble===messageMenu);
   if(!bubble)return;
   setMenuPosition(placeMessageMenu(
    bubble.getBoundingClientRect(),pane.getBoundingClientRect(),
    menu.offsetWidth,menu.offsetHeight,window.innerWidth,window.innerHeight
   ));
  };
  position();
  pane.addEventListener('scroll',position,{passive:true});
  window.addEventListener('resize',position);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(position):null;
  if(observer){observer.observe(pane);observer.observe(menu);}
  return()=>{
   pane.removeEventListener('scroll',position);
   window.removeEventListener('resize',position);
   observer?.disconnect();
  };
 },[messageMenu,thread?.messages]);
 useEffect(()=>{
  if(!messageMenu)return;
  const dismiss=event=>{
   if(messageMenuRef.current?.contains(event.target))return;
   const bubble=event.target.closest?.('[data-message-bubble]');
   if(bubble?.dataset.messageBubble!==messageMenu)setMessageMenu(null);
  };
  const escape=event=>{if(event.key==='Escape')setMessageMenu(null);};
  document.addEventListener('pointerdown',dismiss);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
 },[messageMenu]);
 useEffect(()=>{
  if(!copyToast)return;
  const timeout=window.setTimeout(()=>setCopyToast(0),500);
  return()=>window.clearTimeout(timeout);
 },[copyToast]);
 const copyMessage=async message=>{
  setMessageMenu(null);
  try{
   await navigator.clipboard.writeText(message.body);
   setCopyToast(value=>value+1);
  }catch{setError('تعذر نسخ الرسالة. تحقق من إذن الحافظة.');}
 };
 const replyToMessage=message=>{
  setMessageMenu(null);
  setReplying({id:message.id,sender_id:message.sender_id,body:message.body,deleted_at:message.deleted_at});
  composerRef.current?.focus();
 };
 const jumpToOriginal=async id=>{
  if(!selected)return;
  setMessageMenu(null);setError('');
  if(thread?.messages?.some(m=>m.id===id)){setJumpTo({id,nonce:Date.now()});return;}
  try{
   const owner=live.current.user,conversation=selected;
   const data=await request('mode=thread&id='+encodeURIComponent(conversation)+'&around='+encodeURIComponent(id));
   if(owner!==live.current.user||conversation!==live.current.selected)return;
   historicalRef.current=true;setHistorical(true);setThread(data);setJumpTo({id,nonce:Date.now()});
  }catch(e){setError(e.message);}
 };
 const loadMoreThreadSearch=async()=>{
  const conversation=selected,term=threadSearchTerm.trim(),before=threadSearchNextBefore;
  if(!conversation||!before||!threadSearchHasMore||threadSearchLoading)return;
  const sequence=threadSearchSeq.current,owner=live.current.user;
  setThreadSearchLoading(true);
  try{
   const data=await request('mode=thread-search&id='+encodeURIComponent(conversation)+
    '&q='+encodeURIComponent(term)+'&before='+encodeURIComponent(before));
   if(sequence!==threadSearchSeq.current||owner!==live.current.user||conversation!==live.current.selected)return;
   setThreadSearchHits(previous=>{
    const existing=new Set(previous.map(m=>m.id));
    return [...previous,...(data.matches||[]).filter(m=>!existing.has(m.id))];
   });
   setThreadSearchHasMore(Boolean(data.hasMore));
   setThreadSearchNextBefore(data.nextBefore||null);
  }catch(error){if(sequence===threadSearchSeq.current)setThreadSearchError(error.message);}
  finally{if(sequence===threadSearchSeq.current)setThreadSearchLoading(false);}
 };
 const showSearchResult=message=>{
  setThreadSearchOpen(false);setThreadSearchTerm('');
  void jumpToOriginal(message.id);
 };
 const returnToLatest=async()=>{
  if(historicalRef.current){
   historicalRef.current=false;setHistorical(false);setJumpTo(null);
   scrollToLatestRequestedRef.current=true;
   await open(selected,false);
   return;
  }
  const box=messagesRef.current;
  if(box){
   box.scrollTo({top:box.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   setShowLatestJump(false);
  }
 };
 const selectedMenuMessage=thread?.messages?.find(m=>m.id===messageMenu);
 const togglePin=async(message,remove=false)=>{
  setMessageMenu(null);
  if(!selected||!message?.id)return;
  const conversation=selected;
  await run({action:remove?'unpin':'pin',conversation,message:message.id},async()=>{
   // Read the authoritative shared pin; works even when viewing older history.
   const state=await request('mode=receipt&id='+encodeURIComponent(conversation));
   if(live.current.selected===conversation)
    setThread(old=>old?.conversation?.id===conversation?
     {...old,pinned_message:state.pinned_message||null}:old);
  });
 };
 const editMessage=message=>{setMessageMenu(null);setEditing({id:message.id,text:message.body});};
 const saveMessageEdit=async event=>{
  event.preventDefault();
  if(!editing?.text.trim()||!selected)return;
  await run({action:'edit',conversation:selected,message:editing.id,text:editing.text.trim()},async()=>{
   setEditing(null);await open(selected,false);await reload();
  });
 };
 const deleteMessage=async message=>{
  setMessageMenu(null);
  if(!window.confirm('هل تريد حذف هذه الرسالة لدى الطرفين؟'))return;
  await run({action:'delete',conversation:selected,message:message.id},async()=>{
   setEditing(null);await open(selected,false);await reload();
  });
 };
 const approve=(action,id)=>run({action,conversation:id},async()=>{setTab('inbox');await reload();await open(id);});
 const create=async target=>{
  if(!intro.trim())return;
  await run({action:'request',target,text:intro.trim()},async(result)=>{
   setIntro('');setDialog(null);setNotice('تم إرسال طلب المحادثة. لا يمكنك إرسال المزيد قبل القبول.');
   setTab('inbox');await reload();await open(result.id);
  });
 };
 const review=async()=>{
  if(!dialog?.conversation)return;
  const payload={action:'report',conversation:dialog.conversation,reason,text:detail};
  if(dialog.message)payload.message=dialog.message;
  await run(payload,async()=>{setDialog(null);setDetail('');setNotice('تم إرسال البلاغ للمراجعة.');});
 };
 // Conversation options: double click, right click or the menu key on desktop; double tap or press-and-hold on touch.
 const openConvMenu=(c,el)=>{
  const r=el.getBoundingClientRect(),below=window.innerHeight-r.bottom>200;
  setConvMenu({id:c.id,style:{...(below?{top:Math.round(r.bottom-6)}:{bottom:Math.round(window.innerHeight-r.top-6)}),right:Math.max(8,Math.round(window.innerWidth-r.right+12))}});
 };
 const onConvTouchStart=(event,c)=>{
  const t=event.touches[0],state=convTouchRef.current,el=event.currentTarget;
  clearTimeout(state.hold);
  if(event.touches.length!==1){state.start=null;return;}
  state.start={id:c.id,x:t.clientX,y:t.clientY};state.held=false;
  state.hold=setTimeout(()=>{state.held=true;clearTimeout(state.single);openConvMenu(c,el);},520);
 };
 const onConvTouchMove=event=>{const state=convTouchRef.current,t=event.touches[0];if(state.start&&Math.hypot(state.start.x-t.clientX,state.start.y-t.clientY)>12){clearTimeout(state.hold);state.start=null;}};
 const onConvTouchEnd=(event,c)=>{
  const state=convTouchRef.current,el=event.currentTarget;clearTimeout(state.hold);
  if(!state.start||state.start.id!==c.id){state.held=false;return;}
  state.start=null;event.preventDefault();
  if(state.held){state.held=false;return;}
  const now=Date.now();
  if(state.lastId===c.id&&now-state.lastAt<=320){clearTimeout(state.single);state.lastId=null;openConvMenu(c,el);return;}
  state.lastId=c.id;state.lastAt=now;clearTimeout(state.single);
  state.single=setTimeout(()=>{state.lastId=null;open(c.id);},320);
 };
 useEffect(()=>{
  if(!convMenu)return;
  const away=event=>{if(!convMenuRef.current?.contains(event.target))setConvMenu(null);};
  const key=event=>{if(event.key==='Escape')setConvMenu(null);};
  const scroll=()=>setConvMenu(null);
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',key);window.addEventListener('scroll',scroll,true);
  requestAnimationFrame(()=>convMenuRef.current?.querySelector('button')?.focus());
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key);window.removeEventListener('scroll',scroll,true);};
 },[convMenu]);
 useEffect(()=>()=>{clearTimeout(convTouchRef.current.hold);clearTimeout(convTouchRef.current.single);},[]);
 // Clearing hides the messages for this member only; the other member keeps the history.
 const clearConversation=c=>{
  if(!window.confirm('مسح المحادثة مع '+c.partner_name+'؟ تختفي الرسائل من عندك فقط، ويحتفظ الطرف الآخر بنسخته.'))return;
  run({action:'clear',conversation:c.id},async()=>{
   if(selected===c.id)backToList();
   setNotice('تم مسح المحادثة.');await reload();
  });
 };
 const toggleMute=c=>run({action:c.muted?'unmute':'mute',conversation:c.id},async()=>{
  setNotice(c.muted?'عادت تنبيهات هذه المحادثة.':'لن تصلك تنبيهات هذه المحادثة.');await reload();
 });
 const block=async(account,unblock=false)=>{
  if(!unblock&&!window.confirm('حظر '+account.name+' ومنعه من التواصل معك؟'))return;
  await run({action:unblock?'unblock':'block',target:account.id},async()=>{
   setDialog(null);setNotice(unblock?'تم رفع الحظر.':'تم حظر المستخدم.');
   await reload();
   if(selected)open(selected,false);
  });
 };
 const saveSettings=()=>run({action:'settings',...settings},async()=>{
  setNotice('تم حفظ إعدادات الرسائل.');
  const data=await request('mode=settings');setBlocked(data.blocked||[]);
 });

 return <div className={styles.page} dir="rtl"><div className={styles.wrap}>
  <header className={styles.heading}><div><span className={styles.kicker}>تواصل الأعضاء</span><h1>الرسائل الخاصة</h1><p>محادثاتك وطلبات التواصل في مكان واحد.</p></div><div className={styles.headingLinks}><button type="button" className={styles.accountLink} onClick={goBack}><ArrowRight size={16} aria-hidden="true"/> العودة</button><Link href="/account" className={styles.accountLink}><UserRound size={15} aria-hidden="true"/> حسابي</Link></div></header>
  {!ready?<div className={styles.gate}>جارٍ التحقق من الحساب…</div>:!user?
   <div className={styles.gate}><ShieldAlert size={29}/><h2>سجّل الدخول أولًا</h2><p>الرسائل الخاصة متاحة للمستخدمين المسجلين فقط.</p><Link href="/login">تسجيل الدخول</Link></div>:
  <div className={styles.layout} data-view={tab} data-chat-open={tab==='inbox'&&Boolean(selected)}>
   <nav className={styles.tabs} aria-label="أقسام الرسائل">
    <button type="button" data-active={tab==='inbox'} aria-pressed={tab==='inbox'} onClick={()=>selectTab('inbox')}><MessageCircle size={19}/><span>المحادثات</span>{unread>0&&<b>{unread}</b>}</button>
    {(market.available||tab==='market')&&<button type="button" data-active={tab==='market'} aria-pressed={tab==='market'} onClick={()=>selectTab('market')}><Store size={19}/><span>السوق</span>{market.unread>0&&<b>{market.unread}</b>}</button>}
    <button type="button" data-active={tab==='requests'} aria-pressed={tab==='requests'} onClick={()=>selectTab('requests')}><Inbox size={19}/><span>الطلبات</span>{pending.length>0&&<b>{pending.length}</b>}</button>
    <button type="button" data-active={tab==='search'} aria-pressed={tab==='search'} onClick={()=>selectTab('search')}><MailPlus size={19}/><span>محادثة جديدة</span></button>
    <button type="button" data-active={tab==='settings'} aria-pressed={tab==='settings'} onClick={()=>selectTab('settings')}><Settings2 size={19}/><span>الخصوصية</span></button>
   </nav>
   {(error||notice||loading)&&<div className={styles.statusArea} aria-live="polite">
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {notice&&<p className={styles.success} role="status">{notice}</p>}
    {loading&&<p className={styles.hint}>جارٍ تحميل الرسائل…</p>}
   </div>}
   {tab==='market'?<MarketChats onCount={market.setUnread}/>:<div className={styles.workspace}>
   <aside className={styles.sidebar} aria-label="محتوى قسم الرسائل">
    {tab==='inbox'&&<div className={styles.listHeading}><strong>المحادثات <small>{visible.length}</small></strong><button type="button" onClick={()=>selectTab('search')} aria-label="بدء محادثة جديدة"><MailPlus size={17}/><span>جديدة</span></button></div>}
    <div className={styles.list}>
     {tab==='inbox'&&<>{visible.map(c=><button type="button" className={styles.conversationCard} key={c.id} data-active={selected===c.id} onClick={()=>open(c.id)} aria-label={'فتح المحادثة مع '+c.partner_name} data-menu-open={convMenu?.id===c.id||undefined} aria-haspopup="menu" title="اضغط مرتين لعرض خيارات المحادثة"
       onDoubleClick={event=>{event.preventDefault();openConvMenu(c,event.currentTarget);}}
       onContextMenu={event=>{event.preventDefault();openConvMenu(c,event.currentTarget);}}
       onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();openConvMenu(c,event.currentTarget);}}}
       onTouchStart={event=>onConvTouchStart(event,c)} onTouchMove={onConvTouchMove} onTouchEnd={event=>onConvTouchEnd(event,c)}>
      <ProfileAvatar name={c.partner_name} src={c.avatar_url} className={styles.conversationAvatar}/>
      <span className={styles.conversationText}>
       <strong>{c.partner_name}</strong>
       <span>{c.status==='pending'?'في انتظار قبول الطلب':c.last_excerpt||'فتح المحادثة'}</span>
      </span>
      {c.muted&&<BellOff size={15} className={styles.mutedIcon} role="img" aria-label="التنبيهات معطلة"/>}
      {Number(c.unread)>0&&<b className={styles.unread}>{c.unread}</b>}
      <ChevronLeft size={17} aria-hidden="true"/>
     </button>)}
      {!visible.length&&<div className={styles.emptyState}><MessageCircle size={28}/><h3>لا توجد محادثات بعد</h3><p>ابدأ بطلب محادثة مع عضو آخر في 967.</p><button type="button" className={styles.primary} onClick={()=>selectTab('search')}><MailPlus size={17}/> محادثة جديدة</button></div>}</>}
     {tab==='requests'&&<><div className={styles.sectionIntro}><h2>طلبات المحادثة</h2><p>اقبل الطلب لبدء تبادل الرسائل.</p></div>{pending.map(c=><article className={styles.requestCard} key={c.id}>
      <MemberLink id={c.partner_id} name={c.partner_name} avatarUrl={c.avatar_url}/><p>{c.intro}</p><small>{date(c.requested_at)}</small>
      <div><button disabled={busy} onClick={()=>approve('accept',c.id)}><Check size={15}/> قبول</button><button disabled={busy} onClick={()=>run({action:'decline',conversation:c.id},reload)}><X size={15}/> رفض</button></div>
      <button className={styles.linkButton} onClick={()=>setDialog({type:'report',conversation:c.id})}>إبلاغ عن الطلب</button>
     </article>)}{!pending.length&&<div className={styles.emptyState}><Inbox size={28}/><h3>لا توجد طلبات جديدة</h3><p>ستظهر طلبات التواصل هنا عند وصولها.</p></div>}</>}
     {tab==='search'&&<><div className={styles.sectionIntro}><h2>محادثة جديدة</h2><p>ابحث عن عضو ثم أرسل له طلب تواصل.</p></div><label className={styles.search}><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن عضو بالاسم…" maxLength={60}/></label>
      <p className={styles.hint}>اكتب حرفين على الأقل. تظهر الحسابات التي تسمح بالبحث وطلبات المحادثة فقط.</p>
      {results.map(p=><div key={p.id} className={styles.personRow}>
       <MemberLink id={p.id} name={p.name} avatarUrl={p.avatar_url} className={styles.personLink}/>
       <button type="button" className={styles.openConversation} onClick={()=>setDialog({type:'request',person:p})}><MailPlus size={15}/> طلب محادثة</button>
      </div>)}
      {query.trim().length>=2&&!results.length&&<p className={styles.empty}>لا توجد نتائج مطابقة.</p>}</>}
     {tab==='settings'&&<div className={styles.settings}><div className={styles.sectionIntro}><h2>الخصوصية والإشعارات</h2><p>اختر من يمكنه العثور عليك والتواصل معك.</p></div>
      <label><input type="checkbox" checked={settings.allow_requests} onChange={e=>setSettings(s=>({...s,allow_requests:e.target.checked}))}/> استقبال طلبات المحادثة</label>
      <label><input type="checkbox" checked={settings.discoverable} onChange={e=>setSettings(s=>({...s,discoverable:e.target.checked}))}/> إظهار اسمي في البحث عن المستخدمين</label>
      <label><input type="checkbox" checked={settings.notify_messages} onChange={e=>setSettings(s=>({...s,notify_messages:e.target.checked}))}/> إشعارات الرسائل داخل الموقع (تنبيه صوتي عند وصول رسالة)</label>
      <button className={styles.primary} disabled={busy} onClick={saveSettings}>حفظ التفضيلات</button>
      <h3>المستخدمون المحظورون</h3>{blocked.map(b=><div key={b.id} className={styles.blocked}><MemberLink id={b.id} name={b.name} showAvatar={false}/><button disabled={busy} onClick={()=>block(b,true)}>رفع الحظر</button></div>)}
      {!blocked.length&&<p className={styles.hint}>لا توجد حسابات محظورة.</p>}
     </div>}
    </div>
   </aside>
   <main className={styles.threadArea}>
    {tab==='inbox'&&selected&&thread?<section className={styles.thread}>
     <header className={styles.threadHeader}><button type="button" className={styles.backToList} onClick={backToList} aria-label="العودة إلى قائمة المحادثات"><ArrowRight size={20}/><span>العودة</span></button><div><MemberLink id={thread.conversation.partner_id} name={thread.conversation.partner_name} avatarUrl={thread.conversation.avatar_url}/><small>{thread.conversation.status==='accepted'?'محادثة خاصة':'طلب محادثة'}</small></div>
      <div>{thread.conversation.status==='accepted'&&<button type="button" title="بحث داخل المحادثة" aria-label="بحث داخل المحادثة" aria-expanded={threadSearchOpen} aria-controls="conversation-message-search" onClick={()=>{setThreadSearchOpen(open=>!open);setThreadSearchTerm('');}}><Search size={18}/></button>}
      <button type="button" title="إبلاغ" onClick={()=>setDialog({type:'report',conversation:selected})}><ShieldAlert size={18}/></button>
      <button type="button" title="حظر المستخدم" onClick={()=>block({id:thread.conversation.partner_id,name:thread.conversation.partner_name})}><Ban size={18}/></button></div></header>
     {thread.conversation.status==='accepted'&&thread.pinned_message&&
      <div className={styles.pinnedBar} role="group" aria-label="الرسالة المثبتة">
       <button type="button" className={styles.pinnedJump}
        onClick={()=>void jumpToOriginal(thread.pinned_message.id)}
        aria-label="الانتقال إلى الرسالة المثبتة">
        <Pin size={17} aria-hidden="true"/>
        <span className={styles.pinnedSummary}>
         <strong>رسالة مثبتة · {thread.pinned_message.sender_id===user.id?'أنت':thread.conversation.partner_name}</strong>
         <span>{thread.pinned_message.body}</span>
        </span>
       </button>
       <button type="button" className={styles.pinnedUnpin} disabled={busy}
        onClick={()=>togglePin(thread.pinned_message,true)} title="إلغاء تثبيت الرسالة" aria-label="إلغاء تثبيت الرسالة">
        <PinOff size={17} aria-hidden="true"/>
       </button>
      </div>}
     {threadSearchOpen&&thread.conversation.status==='accepted'&&
      <section id="conversation-message-search" className={styles.threadSearch} aria-label="البحث داخل المحادثة">
       <div className={styles.threadSearchControls}>
        <label className={styles.threadSearchField}><Search size={16} aria-hidden="true"/>
         <input type="search" maxLength={60} value={threadSearchTerm} autoFocus
          onChange={event=>setThreadSearchTerm(event.target.value)} placeholder="ابحث داخل هذه المحادثة…" aria-label="نص البحث داخل المحادثة"/>
        </label>
        <button type="button" className={styles.closeThreadSearch} onClick={()=>{setThreadSearchOpen(false);setThreadSearchTerm('');}} aria-label="إغلاق البحث"><X size={18}/></button>
       </div>
       {threadSearchTerm.trim().length<2?
        <p className={styles.threadSearchHint}>اكتب حرفين على الأقل للبحث في جميع رسائل المحادثة.</p>:
        <div className={styles.threadSearchResults} aria-live="polite">
         {threadSearchLoading&&!threadSearchHits.length&&<p className={styles.threadSearchHint}>جارٍ البحث…</p>}
         {threadSearchError&&<p className={styles.threadSearchError} role="alert">{threadSearchError}</p>}
         {!threadSearchLoading&&!threadSearchError&&!threadSearchHits.length&&<p className={styles.threadSearchHint}>لم يتم العثور على رسائل مطابقة.</p>}
         {threadSearchHits.map(message=>
          <button key={message.id} type="button" className={styles.threadSearchHit} onClick={()=>showSearchResult(message)}>
           <span><strong>{message.sender_id===user.id?'أنت':thread.conversation.partner_name}</strong><time>{date(message.created_at)}</time></span>
           <span>{message.body}</span>
          </button>
         )}
         {threadSearchHasMore&&<button type="button" className={styles.moreThreadSearch} disabled={threadSearchLoading} onClick={loadMoreThreadSearch}>
          {threadSearchLoading?'جارٍ التحميل…':'عرض نتائج أقدم'}
         </button>}
        </div>}
      </section>}
     {thread.conversation.status==='accepted'?<>
      <div className={styles.messages} ref={messagesRef} onScroll={updateLatestJump} aria-label="الرسائل">
       {thread.hasMore&&<button className={styles.older} disabled={busy} onClick={async()=>{
        const data=await request('mode=thread&id='+selected+'&before='+encodeURIComponent(thread.nextBefore));
        setThread(t=>t&&t.conversation.id===selected?{...t,messages:[...data.messages,...t.messages],hasMore:data.hasMore,nextBefore:data.nextBefore}:t);
       }}>تحميل رسائل أقدم</button>}
       {buildMessageTimeline(thread.messages,unreadMarkerRef.current.message).map(entry=>entry.kind==='day'?
        <div key={entry.key} className={styles.daySeparator} role="separator" aria-label={entry.label}><time dateTime={entry.day}>{entry.label}</time></div>:
        entry.kind==='unread'?
        <div key={entry.key} className={styles.unreadSeparator} data-unread-separator role="separator" aria-label="رسائل جديدة">
         <span>{entry.label}</span>
        </div>:
        <div key={entry.key} className={styles.bubbleRow} data-own={entry.message.sender_id===user.id} data-highlighted={jumpTo?.id===entry.message.id||undefined}>
         <div className={styles.bubble} data-message-bubble={entry.message.id}
          tabIndex={entry.message.deleted_at?-1:0} role="group" aria-label="رسالة، اضغط Enter لعرض خياراتها"
          onKeyDown={event=>{if(event.target===event.currentTarget&&!entry.message.deleted_at&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openMessageMenu(entry.message);}}}
          onDoubleClick={event=>{event.preventDefault();openMessageMenu(entry.message);}}
          onTouchStart={event=>onMessageTouchStart(event,entry.message.id)}
          onTouchEnd={event=>onMessageTouchEnd(event,entry.message)}>
          {editing?.id===entry.message.id?
           <form className={styles.editMessage} onSubmit={saveMessageEdit}>
            <textarea rows={3} maxLength={2000} aria-label="تعديل الرسالة" value={editing.text} onChange={event=>setEditing(value=>({...value,text:event.target.value}))} autoFocus/>
            <div><button type="submit" disabled={busy||!editing.text.trim()}>حفظ</button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>إلغاء</button></div>
           </form>:
           <>
            {entry.message.reply_to_message_id&&entry.message.reply&&<button type="button" className={styles.messageQuote}
             onClick={event=>{event.stopPropagation();void jumpToOriginal(entry.message.reply_to_message_id);}}
             onDoubleClick={event=>event.stopPropagation()}
             onTouchStart={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}
             aria-label="الانتقال إلى الرسالة المقتبسة">
             <strong>{entry.message.reply.sender_id===user.id?'أنت':thread.conversation.partner_name}</strong>
             <span>{entry.message.reply.deleted_at?'حذفت الرسالة':entry.message.reply.body}</span>
            </button>}
            <div className={styles.bubbleContent}>
             <time dateTime={entry.message.created_at} dir="ltr">{messageClock(entry.message.created_at)}</time>
             {entry.message.sender_id===user.id&&<span className={styles.deliveryStatus}
              data-read={isMessageRead(entry.message,user.id,thread.partner_last_read_at)||undefined}
              title={isMessageRead(entry.message,user.id,thread.partner_last_read_at)?'تمت القراءة':'تم الإرسال'}
              aria-label={isMessageRead(entry.message,user.id,thread.partner_last_read_at)?'تمت قراءة الرسالة':'تم إرسال الرسالة'}>
              {isMessageRead(entry.message,user.id,thread.partner_last_read_at)?<CheckCheck size={13} aria-hidden="true"/>:<Check size={13} aria-hidden="true"/>}
             </span>}
             {entry.message.edited_at&&!entry.message.deleted_at&&<span className={styles.editedLabel}>معدل</span>}
             <p className={entry.message.deleted_at?styles.deletedText:undefined}>{entry.message.deleted_at?'حذفت الرسالة':entry.message.body}</p>
             {entry.message.sender_id!==user.id&&!entry.message.deleted_at&&<button type="button" aria-label="الإبلاغ عن هذه الرسالة" title="الإبلاغ عن هذه الرسالة" onClick={()=>setDialog({type:'report',conversation:selected,message:entry.message.id})}><ShieldAlert size={13}/></button>}
            </div>
           </>}
         </div>
        </div>)}
       {!thread.messages.length&&<p className={styles.empty}>المحادثة جاهزة. اكتب أول رسالة.</p>}
      </div>
      {(historical||showLatestJump)&&<button type="button" className={styles.latest} onClick={returnToLatest}>الانتقال إلى أحدث رسالة</button>}
      {replying&&<div className={styles.replyDraft}>
       <div><strong>الرد على {replying.sender_id===user.id?'رسالتك':thread.conversation.partner_name}</strong>
       <span>{replying.deleted_at?'حذفت الرسالة':replying.body}</span></div>
       <button type="button" aria-label="إلغاء الرد" onClick={()=>setReplying(null)}><X size={18}/></button>
      </div>}
      <form className={styles.composer} onSubmit={send}><div className={styles.composerField}><textarea ref={composerRef} rows={1} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={onComposerKeyDown} placeholder="اكتب رسالتك…" aria-label="نص الرسالة"/></div><button type="submit" disabled={busy||!draft.trim()} aria-label="إرسال الرسالة"><Send size={19}/> إرسال</button></form>
     </>:<div className={styles.empty}><Bell size={26}/><h3>بانتظار الموافقة</h3><p>{thread.conversation.intro}</p><p>يمكن إرسال رسائل جديدة بعد قبول الطرف الآخر فقط.</p></div>}
    </section>:tab==='inbox'&&selected?<div className={styles.threadLoading} role="status">{error?'تعذر فتح المحادثة. يمكنك العودة للقائمة.':'جارٍ فتح المحادثة…'}<button type="button" onClick={backToList}>العودة للمحادثات</button></div>:tab==='inbox'?<div className={styles.placeholder}><MessageCircle size={35}/><h2>اختر محادثة للبدء</h2><p>ستظهر الرسائل هنا عند اختيار أي محادثة من القائمة.</p><button type="button" onClick={()=>selectTab('search')} className={styles.secondaryButton}><MailPlus size={17}/> محادثة جديدة</button></div>:null}
   </main>
   </div>}
  </div>}
  {messageMenu&&selectedMenuMessage&&!selectedMenuMessage.deleted_at&&typeof document!=='undefined'&&createPortal(
   <div ref={messageMenuRef} className={styles.messageMenu} dir="rtl" role="group" aria-label="خيارات الرسالة"
    style={menuPosition||{visibility:'hidden'}}>
    <button type="button" onClick={()=>replyToMessage(selectedMenuMessage)}>رد</button>
    {selectedMenuMessage.sender_id===user?.id&&<button type="button" onClick={()=>editMessage(selectedMenuMessage)}>تعديل</button>}
    <button type="button" onClick={()=>copyMessage(selectedMenuMessage)}>نسخ</button>
    <button type="button" onClick={()=>togglePin(selectedMenuMessage,thread?.pinned_message?.id===selectedMenuMessage.id)}>
     {thread?.pinned_message?.id===selectedMenuMessage.id?'إلغاء التثبيت':'تثبيت'}
    </button>
    {selectedMenuMessage.sender_id===user?.id&&<button type="button" className={styles.deleteAction} onClick={()=>deleteMessage(selectedMenuMessage)}>حذف</button>}
   </div>,document.body)}
  {convMenu&&(()=>{const c=items.find(item=>item.id===convMenu.id);if(!c||typeof document==='undefined')return null;const close=()=>setConvMenu(null);return createPortal(
   <div ref={convMenuRef} className={styles.conversationMenu} style={convMenu.style} dir="rtl" role="menu" aria-label={'خيارات المحادثة مع '+c.partner_name}>
    <strong>{c.partner_name}</strong>
    {Number(c.unread)>0&&<button type="button" role="menuitem" disabled={busy} onClick={()=>{close();run({action:'read',conversation:c.id});}}><CheckCheck size={16} aria-hidden="true"/> تعليم كمقروءة</button>}
    <button type="button" role="menuitem" disabled={busy} onClick={()=>{close();toggleMute(c);}}>{c.muted?<><Bell size={16} aria-hidden="true"/> تشغيل التنبيهات</>:<><BellOff size={16} aria-hidden="true"/> تعطيل التنبيهات</>}</button>
    <button type="button" role="menuitem" onClick={()=>{close();setDialog({type:'report',conversation:c.id});}}><ShieldAlert size={16} aria-hidden="true"/> الإبلاغ</button>
    {c.status==='accepted'&&<button type="button" role="menuitem" className={styles.deleteAction} disabled={busy} onClick={()=>{close();clearConversation(c);}}><Trash2 size={16} aria-hidden="true"/> مسح المحادثة</button>}
    {!c.blocked&&<button type="button" role="menuitem" className={styles.deleteAction} disabled={busy} onClick={()=>{close();block({id:c.partner_id,name:c.partner_name});}}><Ban size={16} aria-hidden="true"/> حظر المستخدم</button>}
   </div>,document.body);})()}
  {copyToast>0&&<div key={copyToast} className={styles.copyToast} role="status">تم النسخ</div>}
  {dialog&&<div className={styles.modalBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setDialog(null);}}><section className={styles.modal} role="dialog" aria-modal="true" aria-label={dialog.type==='request'?'طلب محادثة':'الإبلاغ عن إساءة'}>
   <header><h2>{dialog.type==='request'?'طلب محادثة مع '+dialog.person.name:'الإبلاغ عن محتوى'}</h2><button onClick={()=>setDialog(null)} disabled={busy} aria-label="إغلاق"><X size={19}/></button></header>
   {dialog.type==='request'?<><p>اكتب رسالة تعريفية واحدة. لن تتمكن من إرسال المزيد حتى قبول الطلب.</p>
    <textarea value={intro} maxLength={500} rows={4} onChange={e=>setIntro(e.target.value)} placeholder="مرحبًا، أود التواصل معك بشأن…"/>
    <button className={styles.primary} disabled={busy||!intro.trim()} onClick={()=>create(dialog.person.id)}>إرسال الطلب</button></>:
    <><p>عند إرسال البلاغ، تستطيع الإدارة مراجعة الرسائل السابقة في هذه المحادثة حتى وقت البلاغ للتحقق من السياق. تُسجّل عمليات اطلاع الإدارة.</p>
    <label>سبب البلاغ<select value={reason} onChange={e=>setReason(e.target.value)}>{Object.entries(REPORT_REASONS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <textarea rows={3} maxLength={1000} value={detail} onChange={e=>setDetail(e.target.value)} placeholder="ملاحظات إضافية (اختيارية)"/>
    <button className={styles.primary} disabled={busy} onClick={review}>إرسال البلاغ</button></>}
   {error&&<p className={styles.error} role="alert">{error}</p>}
  </section></div>}
 </div></div>;
}
