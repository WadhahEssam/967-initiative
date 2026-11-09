'use client';
/* eslint-disable @next/next/no-img-element -- chat photos are signed private links and listing covers are 480 px thumbnails; next/image would add nothing. */
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Check,HandCoins,ImagePlus,Package,Send,ShieldCheck,Star,Store,X} from 'lucide-react';
import OfferForm from './OfferForm';
import {marketApi} from '@/lib/market/clientApi';
import {compressForUpload} from '@/lib/market/clientImage';
import {OFFER_STATUS_LABELS} from '@/lib/market/chat';
import {STATUS_LABELS,formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import styles from './MarketChats.module.css';

const SAFETY_KEY='967-market-safety-seen';
const clock=value=>new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const setUrl=params=>{const url=new URL(location.href);for(const key of ['chat','listing'])url.searchParams.delete(key);url.searchParams.set('tab','market');for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);history.replaceState(null,'',url);};

// «السوق» tab of the messages page: one chat per buyer and listing, with price offers and
// reservations. Polls while visible (no always-on socket): the open chat every 10 s, the list every 30 s.
export default function MarketChats({onCount}){
 const [chats,setChats]=useState(null);
 const [filter,setFilter]=useState('all');
 const [listingFor,setListingFor]=useState(null);
 const [openId,setOpenId]=useState(null);
 const [draft,setDraft]=useState(null);
 const [thread,setThread]=useState(null);
 const [error,setError]=useState('');
 const countRef=useRef(onCount);
 countRef.current=onCount;
 const loadList=useCallback(async()=>{
  try{const result=await marketApi('/api/market/chats');setChats(result.chats);countRef.current?.(result.chats.reduce((sum,chat)=>sum+Number(chat.unread||0),0));}
  catch(e){setError(e.message);setChats(current=>current||[]);}
 },[]);
 const loadThread=useCallback(async(id,{quiet=false}={})=>{
  try{const result=await marketApi('/api/market/chats?chat='+encodeURIComponent(id));setThread(result);if(!quiet)setError('');}
  catch(e){if(!quiet){setError(e.message);setThread(null);}}
 },[]);

 // Start from the address: ?chat=<id> opens a chat, ?listing=<id> starts one about a listing.
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const chat=params.get('chat'),listing=params.get('listing'),only=params.get('for');
  if(only&&UUID.test(only))setListingFor(only);
  loadList();
  if(chat&&UUID.test(chat))setOpenId(chat);
  else if(listing&&UUID.test(listing))marketApi('/api/market/chats?listing='+encodeURIComponent(listing)).then(result=>{
   if(result.chatId){setOpenId(result.chatId);setUrl({chat:result.chatId});}else setDraft({listingId:listing,...result});
  }).catch(e=>setError(e.message));
 },[loadList]);
 useEffect(()=>{if(openId){setDraft(null);loadThread(openId);}else setThread(null);},[openId,loadThread]);
 useEffect(()=>{
  const tick=()=>{if(document.visibilityState!=='visible')return;if(openId)loadThread(openId,{quiet:true});};
  const list=()=>{if(document.visibilityState==='visible')loadList();};
  const a=setInterval(tick,10000),b=setInterval(list,30000);
  return()=>{clearInterval(a);clearInterval(b);};
 },[openId,loadThread,loadList]);

 const choose=id=>{setOpenId(id);setUrl({chat:id});setChats(list=>list?.map(chat=>chat.id===id?{...chat,unread:0}:chat));};
 const back=()=>{setOpenId(null);setDraft(null);setUrl({});loadList();};
 const visible=(chats||[]).filter(chat=>(!listingFor||chat.listing?.id===listingFor)&&(filter==='all'||(filter==='selling'?chat.role==='seller':chat.role==='buyer')));
 const showing=Boolean(openId||draft);

 return <div className={styles.shell} data-open={showing||undefined}>
  <aside className={styles.list} aria-label="محادثات السوق">
   <div className={styles.filters} role="group" aria-label="عرض">
    {[['all','الكل'],['selling','أبيع'],['buying','أشتري']].map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
    {listingFor&&<button type="button" aria-pressed="true" onClick={()=>{setListingFor(null);const url=new URL(location.href);url.searchParams.delete('for');history.replaceState(null,'',url);}}>إعلان واحد <X size={12} aria-hidden="true"/></button>}
   </div>
   {chats===null?<p className={styles.muted}>جارٍ التحميل…</p>:!visible.length?<div className={styles.emptyList}><Store size={26} aria-hidden="true"/><p>{filter==='selling'?'لم تصلك رسائل على إعلاناتك بعد.':'لا توجد محادثات في السوق بعد.'}</p><Link href="/market">تصفح السوق</Link></div>:
   <ul>{visible.map(chat=><li key={chat.id}>
    <button type="button" className={styles.item} data-active={chat.id===openId||undefined} onClick={()=>choose(chat.id)}>
     <span className={styles.thumb}>{chat.listing?.cover?<img src={chat.listing.cover} alt="" loading="lazy"/>:<Package size={20} aria-hidden="true"/>}</span>
     <span className={styles.itemText}>
      <strong>{chat.listing?.title||'إعلان غير متاح'}</strong>
      <small>{chat.role==='seller'?'مشترٍ: ':'البائع: '}{chat.partnerName}</small>
      <span>{chat.lastFromMe?'أنت: ':''}{chat.preview||'محادثة جديدة'}</span>
     </span>
     <span className={styles.itemMeta}><small>{timeAgo(chat.lastMessageAt)}</small>{chat.unread>0&&<b>{chat.unread}</b>}</span>
    </button>
   </li>)}</ul>}
  </aside>
  <section className={styles.thread} aria-label="المحادثة">
   {error&&<p className={styles.formError} role="alert">{error}</p>}
   {thread?<ChatThread key={thread.chat.id} data={thread} onBack={back} reload={()=>{loadThread(thread.chat.id,{quiet:true});loadList();}}/>
    :draft?<ChatThread draft={draft} onBack={back} onStarted={id=>{setUrl({chat:id});setOpenId(id);loadList();}}/>
    :openId?<p className={styles.muted}>جارٍ فتح المحادثة…</p>
    :<div className={styles.placeholder}><Store size={32} aria-hidden="true"/><h2>محادثات السوق</h2><p>اختر محادثة، أو راسل بائعًا من صفحة أي إعلان.</p></div>}
  </section>
 </div>;
}

function ChatThread({data=null,draft=null,onBack,reload,onStarted}){
 const listing=data?.listing||draft?.listing;
 const role=data?.chat.role||'buyer';
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [offering,setOffering]=useState(false);
 const [countering,setCountering]=useState(null);
 const [photo,setPhoto]=useState(null);
 const [safety,setSafety]=useState(false);
 const end=useRef(null);
 const fileInput=useRef(null);
 const count=data?.messages.length||0;
 useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[count]);
 useEffect(()=>{try{setSafety(!localStorage.getItem(SAFETY_KEY));}catch{setSafety(true);}},[]);
 const dismissSafety=()=>{setSafety(false);try{localStorage.setItem(SAFETY_KEY,'1');}catch{/* private mode */}};
 const target=data?{chatId:data.chat.id}:{listingId:draft.listingId};
 const act=async(body,after)=>{
  setBusy(true);setError('');
  try{const result=await marketApi('/api/market/chats',{method:'POST',body});after?.(result);if(!data&&result.chatId)onStarted?.(result.chatId);else reload?.();window.dispatchEvent(new Event('967:messages-changed'));return true;}
  catch(e){setError(e.message);return false;}
  finally{setBusy(false);}
 };
 const send=async event=>{
  event.preventDefault();
  if(!text.trim()&&!photo?.id)return;
  if(await act({action:'message',...target,body:text,imageId:photo?.id||null}))
   {setText('');setPhoto(null);}
 };
 const pickPhoto=async file=>{
  if(!file)return;
  setPhoto({uploading:true,preview:URL.createObjectURL(file)});setError('');
  try{
   const form=new FormData();form.append('file',await compressForUpload(file),'photo.jpg');
   const result=await marketApi('/api/market/images',{method:'POST',form});
   setPhoto(current=>current?{...current,uploading:false,id:result.id}:null);
  }catch(e){setPhoto(null);setError(e.message);}
 };
 const answer=(offerId,kind,amount)=>act({action:'answer',offerId,answer:kind,amount});
 const status=listing?.status;
 return <div className={styles.chat}>
  <header className={styles.chatHead}>
   <button type="button" className={styles.back} onClick={onBack} aria-label="العودة إلى المحادثات"><ArrowRight size={18}/></button>
   {listing&&<Link href={listingPath(listing.number)} className={styles.listingCard}>
    <span className={styles.thumb}>{listing.cover?<img src={listing.cover} alt=""/>:<Package size={20} aria-hidden="true"/>}</span>
    <span><strong>{listing.title}</strong><small>{formatPrice(listing.price,listing.currency)}{status&&status!=='active'?' · '+(STATUS_LABELS[status]||status):''}</small></span>
   </Link>}
   <span className={styles.partner}>{data?.chat.partnerName||draft?.sellerName}</span>
  </header>
  {status==='sold'&&<p className={styles.banner}>تم البيع. تبقى المحادثة مقروءة.</p>}
  {data?.rating?.canRate&&<Link href={'/market/rate/'+data.chat.id} className={styles.rateBanner}><Star size={16} aria-hidden="true"/> قيّم تعاملك مع البائع</Link>}
  {status==='reserved'&&role==='buyer'&&(data?.listing.reservedForMe?<p className={styles.bannerGood}>البائع حجز الإعلان لك.</p>:<p className={styles.banner}>الإعلان محجوز حاليًا، ويمكنك مراسلة البائع أو تقديم عرض.</p>)}
  {safety&&<div className={styles.safety} role="note">
   <ShieldCheck size={18} aria-hidden="true"/>
   <div><strong>البيع والشراء على مسؤولية الطرفين.</strong><p>قابل الطرف الآخر في مكان عام، ولا تحوّل أي مبلغ قبل المعاينة.</p></div>
   <button type="button" onClick={dismissSafety} aria-label="إخفاء التنبيه"><X size={16}/></button>
  </div>}
  <ol className={styles.messages} aria-live="polite">
   {!data&&<li className={styles.system}>اكتب أول رسالة للبائع عن هذا الإعلان.</li>}
   {data?.messages.map(message=>message.kind==='system'?<li key={message.id} className={styles.system}>{message.body}<time>{clock(message.createdAt)}</time></li>
    :message.kind==='offer'?<li key={message.id} className={message.mine?styles.mine:styles.theirs}>
     <OfferCard offer={data.offers[message.offerId]} note={message.body} listing={listing} role={role} busy={busy} mine={message.mine}
      onAnswer={answer} countering={countering===message.offerId} setCountering={value=>setCountering(value?message.offerId:null)}
      onReserve={()=>act({action:'reserve',chatId:data.chat.id})} reservedForBuyer={status==='reserved'&&data.listing.reservedForOther===false}/>
     <time>{clock(message.createdAt)}</time>
    </li>
    :<li key={message.id} className={message.mine?styles.mine:styles.theirs}>
     {message.image&&<a href={message.image.full} target="_blank" rel="noopener noreferrer" className={styles.photo}><img src={message.image.thumb} alt="صورة مرسلة" width={message.image.w} height={message.image.h} loading="lazy"/></a>}
     {message.body&&<p>{message.body}</p>}
     <time>{clock(message.createdAt)}</time>
    </li>)}
   <li ref={end} aria-hidden="true"/>
  </ol>
  {error&&<p className={styles.formError} role="alert">{error}</p>}
  {offering?<OfferForm price={listing?.price} currency={listing?.currency} busy={busy} onCancel={()=>setOffering(false)}
    onSubmit={async(amount,note)=>{if(await act({action:'offer',...target,amount,note}))setOffering(false);}}/>
  :data?.chat.closed?<p className={styles.closed}>لا يمكن مراسلة هذا المستخدم.</p>
  :<form className={styles.composer} onSubmit={send}>
   {photo&&<span className={styles.pending}><img src={photo.preview} alt=""/>{photo.uploading?<small>جارٍ الرفع…</small>:<button type="button" onClick={()=>setPhoto(null)} aria-label="إزالة الصورة"><X size={14}/></button>}</span>}
   <button type="button" className={styles.icon} onClick={()=>fileInput.current?.click()} aria-label="إرسال صورة" disabled={busy||photo?.uploading}><ImagePlus size={19}/></button>
   <input ref={fileInput} type="file" accept="image/*" hidden onChange={event=>{pickPhoto(event.target.files?.[0]);event.target.value='';}}/>
   <textarea rows={1} value={text} maxLength={2000} placeholder="اكتب رسالة…" aria-label="الرسالة" onChange={event=>setText(event.target.value)}
    onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&window.matchMedia('(pointer:fine)').matches){event.preventDefault();event.currentTarget.form.requestSubmit();}}}/>
   {(data?data.canOffer:draft?.canOffer)&&<button type="button" className={styles.offerButton} onClick={()=>setOffering(true)} disabled={busy}><HandCoins size={17} aria-hidden="true"/> عرض سعر</button>}
   <button type="submit" className={styles.send} disabled={busy||photo?.uploading||(!text.trim()&&!photo?.id)} aria-label="إرسال"><Send size={18}/></button>
  </form>}
 </div>;
}

function OfferCard({offer,note,listing,role,busy,mine,onAnswer,countering,setCountering,onReserve,reservedForBuyer}){
 if(!offer)return null;
 const open=offer.status==='pending';
 const theirs=offer.fromRole!==role;
 return <div className={styles.offer} data-status={offer.status}>
  <small>{offer.fromRole==='seller'?'سعر مقابل من البائع':'عرض سعر'}</small>
  <strong>{formatPrice(offer.amount,offer.currency)}</strong>
  {listing&&<span className={styles.offerOriginal}>سعر الإعلان {formatPrice(listing.price,listing.currency)}</span>}
  {note&&<p>{note}</p>}
  <span className={styles.offerStatus}>{offer.status==='accepted'?<><Check size={14} aria-hidden="true"/> {OFFER_STATUS_LABELS.accepted}</>:OFFER_STATUS_LABELS[offer.status]}</span>
  {open&&theirs&&!countering&&<div className={styles.offerButtons}>
   <button type="button" className={styles.primary} disabled={busy} onClick={()=>onAnswer(offer.id,'accept')}>قبول</button>
   <button type="button" className={styles.ghost} disabled={busy} onClick={()=>onAnswer(offer.id,'reject')}>رفض</button>
   {role==='seller'&&<button type="button" className={styles.ghost} disabled={busy} onClick={()=>setCountering(true)}>سعر مقابل</button>}
  </div>}
  {countering&&<OfferForm counter price={listing?.price} currency={offer.currency} minimum={offer.amount} busy={busy} onCancel={()=>setCountering(false)}
   onSubmit={async amount=>{await onAnswer(offer.id,'counter',amount);setCountering(false);}}/>}
  {open&&mine&&<button type="button" className={styles.link} disabled={busy} onClick={()=>onAnswer(offer.id,'withdraw')}>سحب العرض</button>}
  {offer.status==='accepted'&&role==='seller'&&!reservedForBuyer&&listing?.status!=='sold'&&<div className={styles.offerButtons}>
   <button type="button" className={styles.primary} disabled={busy} onClick={onReserve}>احجز الإعلان لهذا المشتري</button>
  </div>}
  {offer.status==='accepted'&&<small className={styles.offerHint}>قبول العرض اتفاق مبدئي غير ملزم، والصفقة تتم بالمعاينة.</small>}
 </div>;
}
