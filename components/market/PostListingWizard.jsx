'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Car,Check,ChevronLeft,ChevronRight,Dumbbell,House,ImagePlus,Package,PawPrint,Shirt,Smartphone,Sofa,Star,Sun,Trash2,Wrench} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {CATEGORIES,CONDITIONS,CURRENCIES,OTHER,findSubcategory} from '@/lib/market/catalog';
import {listingCompleteness,listingHighlights,suggestTitle} from '@/lib/market/listing';
import {formatPrice,listingPath} from '@/lib/market/format';
import {compressForUpload} from '@/lib/market/clientImage';
import {marketApi} from '@/lib/market/clientApi';
import styles from './PostListing.module.css';

const ICONS={car:Car,home:House,phone:Smartphone,sun:Sun,sofa:Sofa,shirt:Shirt,paw:PawPrint,tools:Wrench,ball:Dumbbell,box:Package};
const STEPS=['الصور','ماذا تبيع؟','التفاصيل','السعر والحالة','المراجعة والنشر'];
const LOCAL_KEY='967-market-draft';
const MAX_PHOTOS=10;

const api=(path,options={})=>marketApi(path,{signInMessage:'سجّل الدخول لإضافة إعلان.',...options});
const empty=value=>value===undefined||value===null||value==='';

function Chips({options,value,onChange,label}){
 return <div className={styles.chips} role="radiogroup" aria-label={label}>{options.map(option=><button type="button" key={option.value} role="radio" aria-checked={value===option.value} className={value===option.value?styles.chipOn:styles.chip} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>;
}

// One field of a subcategory, answered with taps where possible.
function Field({field,attributes,setAttribute}){
 const value=attributes[field.key];
 const label=<span className={styles.fieldLabel}>{field.label}{field.required&&<b aria-hidden="true"> *</b>}{field.unit&&<small> ({field.unit})</small>}</span>;
 if(field.type==='select')return <div className={styles.field}>{label}<Chips label={field.label} options={field.options} value={value} onChange={v=>setAttribute(field.key,v)}/></div>;
 if(field.type==='brand'||field.type==='model'){
  const list=field.type==='brand'?field.brands:(field.models[attributes[field.dependsOn]]||[]);
  if(field.type==='model'&&!attributes[field.dependsOn])return null;
  const options=[...list,{value:OTHER,label:'أخرى'}];
  return <div className={styles.field}>{label}
   {list.length?<Chips label={field.label} options={options} value={value} onChange={v=>setAttribute(field.key,v)}/>:null}
   {(value===OTHER||!list.length)&&<input className={styles.input} value={attributes[field.key+'_other']||''} maxLength={40} placeholder={'اكتب '+field.label} onChange={e=>{setAttribute(field.key,OTHER);setAttribute(field.key+'_other',e.target.value);}}/>}
  </div>;
 }
 if(field.type==='number')return <label className={styles.field}>{label}<input className={styles.input} inputMode="decimal" dir="ltr" value={value??''} onChange={e=>setAttribute(field.key,e.target.value)}/></label>;
 return <label className={styles.field}>{label}<input className={styles.input} value={value??''} maxLength={field.maxLength||80} onChange={e=>setAttribute(field.key,e.target.value)}/></label>;
}

export default function PostListingWizard({places}){
 const [step,setStep]=useState(0);
 const [session,setSession]=useState(undefined);
 const [defaults,setDefaults]=useState(null);
 const [photos,setPhotos]=useState([]);
 const [form,setForm]=useState({category:'',subcategory:'',attributes:{},price:'',currency:'',negotiable:true,condition:'',governorate_id:'',district_id:'',title:'',titleEdited:false,description:'',show_whatsapp:false});
 const [phone,setPhone]=useState('');
 const [acceptTerms,setAcceptTerms]=useState(false);
 const [confirmGenuine,setConfirmGenuine]=useState(false);
 const [needs,setNeeds]=useState({});
 const [draftId,setDraftId]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(null);
 const fileInput=useRef(null);
 const sub=findSubcategory(form.category,form.subcategory);
 const set=patch=>setForm(current=>({...current,...patch}));
 const setAttribute=(key,value)=>setForm(current=>({...current,attributes:{...current.attributes,[key]:value}}));

 // Session, then the seller's defaults (place, currency, phone and terms on file) and any saved draft.
 useEffect(()=>{
  const db=browserDb();if(!db){setSession(null);return;}
  let live=true;
  db.auth.getSession().then(async({data})=>{
   if(!live)return;setSession(data.session||null);if(!data.session)return;
   try{
    const draft=new URLSearchParams(location.search).get('draft');
    const result=await api('/api/market/listings'+(draft?'?draft='+encodeURIComponent(draft):''));
    if(!live)return;
    setDefaults(result.defaults);
    if(result.draft){
     const d=result.draft;setDraftId(d.id);
     setPhotos((d.images||[]).map(image=>({id:image.id,thumb:'/api/market/img/'+image.id+'/thumb'})));
     set({category:d.category,subcategory:d.subcategory,attributes:d.attributes||{},price:d.price??'',currency:d.currency||'',negotiable:d.negotiable,condition:d.condition||'',governorate_id:d.governorate_id||'',district_id:d.district_id||'',title:d.title||'',titleEdited:Boolean(d.title),description:d.description||'',show_whatsapp:d.show_whatsapp});
    }else{
     const saved=JSON.parse(localStorage.getItem(LOCAL_KEY)||'null');
     if(saved?.form){setForm(saved.form);setPhotos(saved.photos||[]);setDraftId(saved.draftId||null);setStep(Math.min(saved.step||0,3));}
     else set({currency:result.defaults.currency||'',governorate_id:result.defaults.governorate_id||'',district_id:result.defaults.district_id||''});
    }
   }catch(e){if(live)setError(e.message);}
  }).catch(()=>live&&setSession(null));
  return()=>{live=false;};
 },[]);

 // Autosave: in the browser at once, and as a server draft once a category is chosen.
 const uploaded=photos.filter(p=>p.id);
 const payload=useMemo(()=>({category:form.category,subcategory:form.subcategory,attributes:form.attributes,price:form.price,currency:form.currency||null,negotiable:form.negotiable,condition:form.condition||null,governorate_id:form.governorate_id||null,district_id:form.district_id||null,title:form.title,description:form.description,show_whatsapp:form.show_whatsapp}),[form]);
 useEffect(()=>{
  if(done||session===undefined)return;
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify({form,photos:uploaded,draftId,step}));}catch{/* private mode */}
  if(!session||!form.subcategory)return;
  const timer=setTimeout(async()=>{
   try{const result=await api('/api/market/listings',{method:'POST',body:{action:'save',id:draftId,data:payload,images:uploaded.map(p=>p.id)}});setDraftId(result.listing.id);}
   catch{/* the next change retries; the browser copy keeps everything */}
  },1500);
  return()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[payload,uploaded.length,session]);

 // The suggested title follows brand, model and year until the seller edits it.
 useEffect(()=>{if(!form.titleEdited&&sub)set({title:suggestTitle(form)});
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[form.attributes,form.subcategory]);

 const addPhotos=useCallback(async files=>{
  const room=MAX_PHOTOS-photos.length;
  for(const file of [...files].slice(0,room)){
   const key=Math.random().toString(36).slice(2);
   setPhotos(list=>[...list,{key,uploading:true,preview:URL.createObjectURL(file)}]);
   try{
    const form=new FormData();form.append('file',await compressForUpload(file));
    const result=await api('/api/market/images',{method:'POST',form});
    setPhotos(list=>list.map(p=>p.key===key?{id:result.id,thumb:result.thumb}:p));
   }catch(e){setPhotos(list=>list.filter(p=>p.key!==key));setError(e.message);}
  }
 },[photos.length]);
 const makeCover=index=>setPhotos(list=>[list[index],...list.filter((_,i)=>i!==index)]);
 const removePhoto=index=>setPhotos(list=>list.filter((_,i)=>i!==index));

 const missingRequired=sub?sub.fields.filter(f=>f.required&&(empty(form.attributes[f.key])||(form.attributes[f.key]===OTHER&&empty(form.attributes[f.key+'_other'])))):[];
 const canNext=[uploaded.length>0&&!photos.some(p=>p.uploading),Boolean(sub),missingRequired.length===0,!empty(form.price)&&Boolean(form.currency)&&Boolean(form.condition)&&Boolean(form.district_id),true][step];
 // What still blocks «التالي», said plainly under the buttons.
 const waiting=photos.some(p=>p.uploading)?'انتظر حتى يكتمل رفع الصور.'
  :['أضف صورة واحدة على الأقل.','اختر الفئة والقسم.',missingRequired.length?'أكمل: '+missingRequired.map(f=>f.label).join('، ')+'.':'',
   'أكمل: '+[empty(form.price)&&'السعر',!form.currency&&'العملة',!form.condition&&'الحالة',!form.district_id&&'المحافظة والمديرية'].filter(Boolean).join('، ')+'.'][step]||'';
 const districts=places.districts.filter(d=>d.governorateId===form.governorate_id);

 async function publish(){
  setBusy(true);setError('');
  try{
   const result=await api('/api/market/listings',{method:'POST',body:{action:'publish',id:draftId,data:payload,images:uploaded.map(p=>p.id),acceptTerms,confirmGenuine,phone:phone||null}});
   try{localStorage.removeItem(LOCAL_KEY);}catch{/* ignore */}
   setDone(result.listing);window.scrollTo(0,0);
  }catch(e){
   if(e.code==='TERMS_REQUIRED')setNeeds(n=>({...n,terms:true}));
   else if(e.code==='PHONE_REQUIRED'||e.field==='phone')setNeeds(n=>({...n,phone:true}));
   else if(e.code==='CONFIRM_GENUINE')setNeeds(n=>({...n,genuine:true}));
   if(e.field&&!['phone','title'].includes(e.field)){const at=e.field==='images'?0:['category','subcategory'].includes(e.field)?1:['price','currency','condition','governorate_id','district_id'].includes(e.field)?3:2;setStep(at);}
   setError(e.message);
  }finally{setBusy(false);}
 }

 if(session===undefined)return <p className={styles.state} role="status">جارٍ التحميل…</p>;
 if(!session)return <div className={styles.state}><h1>أضف إعلانك في سوق 967</h1><p>سجّل الدخول بحسابك في 967 لتنشر إعلانًا مجانيًا.</p><Link className={styles.primary} href="/login?next=/market/new">تسجيل الدخول</Link></div>;

 if(done){
  const url=typeof location!=='undefined'?location.origin+listingPath(done.number):listingPath(done.number);
  const percent=listingCompleteness({...payload,images:uploaded});
  return <div className={styles.done}>
   <span className={styles.doneIcon}><Check size={34} aria-hidden="true"/></span>
   <h1>{done.status==='pending_review'?'إعلانك قيد المراجعة':'تم نشر إعلانك'}</h1>
   {done.status==='pending_review'?<p>احتوى الإعلان على كلمات تحتاج مراجعة قبل نشره. سيصلك إشعار بعد المراجعة.</p>:<p>رقم الإعلان {done.number}. إعلانك مكتمل {percent}%، وأكمل تفاصيله ليظهر في نتائج بحث أكثر.</p>}
   <div className={styles.doneActions}>
    {done.status!=='pending_review'&&<a className={styles.whatsapp} href={'https://wa.me/?text='+encodeURIComponent(form.title+' — '+url)} target="_blank" rel="noopener noreferrer">شارك عبر واتساب</a>}
    {done.status!=='pending_review'&&<Link className={styles.secondary} href={listingPath(done.number)}>عرض الإعلان</Link>}
    <button type="button" className={styles.secondary} onClick={()=>location.reload()}>أضف إعلانًا آخر</button>
   </div>
  </div>;
 }

 return <div className={styles.wizard}>
  <div className={styles.progress} aria-hidden="true">{STEPS.map((_,i)=><span key={i} className={i<=step?styles.progressOn:''}/>)}</div>
  <p className={styles.stepMeta}>الخطوة {step+1} من {STEPS.length}</p>
  <h1 className={styles.question}>{['أضف صور ما تبيعه','ماذا تبيع؟','التفاصيل الأساسية','السعر والحالة','راجع إعلانك وانشره'][step]}</h1>
  {error&&<p className={styles.error} role="alert">{error}</p>}

  {step===0&&<section>
   <p className={styles.hint}>من 1 إلى 10 صور. الصورة الأولى هي الغلاف.</p>
   <div className={styles.photos}>
    {photos.map((photo,index)=><figure key={photo.id||photo.key} className={styles.photo}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={photo.thumb||photo.preview} alt={'صورة '+(index+1)}/>
     {photo.uploading?<span className={styles.photoBusy}>جارٍ الرفع…</span>:<>
      {index===0?<span className={styles.cover}>الغلاف</span>:<button type="button" className={styles.photoTool} onClick={()=>makeCover(index)} aria-label="اجعلها الغلاف"><Star size={15}/></button>}
      <button type="button" className={styles.photoRemove} onClick={()=>removePhoto(index)} aria-label="احذف الصورة"><Trash2 size={15}/></button>
     </>}
    </figure>)}
    {photos.length<MAX_PHOTOS&&<button type="button" className={styles.addPhoto} onClick={()=>fileInput.current?.click()}><ImagePlus size={30} aria-hidden="true"/><span>أضف صورًا</span><small>من الكاميرا أو المعرض</small></button>}
   </div>
   <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={e=>{addPhotos(e.target.files);e.target.value='';}}/>
  </section>}

  {step===1&&<section>
   <div className={styles.categories}>{CATEGORIES.map(category=>{const Icon=ICONS[category.icon]||Package;return <button type="button" key={category.key} className={form.category===category.key?styles.categoryOn:styles.category} onClick={()=>set({category:category.key,subcategory:category.subcategories.length===1?category.subcategories[0].key:'',attributes:{},titleEdited:false})}><Icon size={28} aria-hidden="true"/><span>{category.label}</span></button>;})}</div>
   {form.category&&CATEGORIES.find(c=>c.key===form.category).subcategories.length>1&&<><h2 className={styles.subhead}>القسم</h2>
    <Chips label="القسم" options={CATEGORIES.find(c=>c.key===form.category).subcategories.map(s=>({value:s.key,label:s.label}))} value={form.subcategory} onChange={v=>set({subcategory:v,attributes:{},titleEdited:false})}/></>}
  </section>}

  {step===2&&sub&&<section>
   {sub.fields.some(f=>f.required)?sub.fields.filter(f=>f.required).map(field=><Field key={field.key} field={field} attributes={form.attributes} setAttribute={setAttribute}/>)
    :<p className={styles.hint}>لا توجد تفاصيل إلزامية لهذا القسم. يمكنك إضافة وصف في الخطوة الأخيرة.</p>}
   {sub.fields.some(f=>!f.required)&&<details className={styles.optional}><summary>تفاصيل اختيارية تزيد ظهور إعلانك</summary>
    {sub.fields.filter(f=>!f.required).map(field=><Field key={field.key} field={field} attributes={form.attributes} setAttribute={setAttribute}/>)}
   </details>}
  </section>}

  {step===3&&<section>
   <label className={styles.field}><span className={styles.fieldLabel}>السعر<b aria-hidden="true"> *</b></span><input className={styles.price} inputMode="decimal" dir="ltr" value={form.price} placeholder="0" onChange={e=>set({price:e.target.value})}/></label>
   <div className={styles.field}><span className={styles.fieldLabel}>العملة<b aria-hidden="true"> *</b></span><Chips label="العملة" options={CURRENCIES} value={form.currency} onChange={v=>set({currency:v})}/></div>
   <div className={styles.field}><span className={styles.fieldLabel}>نوع السعر</span><Chips label="نوع السعر" options={[{value:'yes',label:'قابل للتفاوض'},{value:'no',label:'سعر نهائي'}]} value={form.negotiable?'yes':'no'} onChange={v=>set({negotiable:v==='yes'})}/></div>
   <div className={styles.field}><span className={styles.fieldLabel}>الحالة<b aria-hidden="true"> *</b></span><Chips label="الحالة" options={CONDITIONS} value={form.condition} onChange={v=>set({condition:v})}/></div>
   <div className={styles.twoCols}>
    <label className={styles.field}><span className={styles.fieldLabel}>المحافظة<b aria-hidden="true"> *</b></span><select className={styles.input} value={form.governorate_id} onChange={e=>set({governorate_id:e.target.value,district_id:''})}><option value="">اختر</option>{places.governorates.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label className={styles.field}><span className={styles.fieldLabel}>المديرية<b aria-hidden="true"> *</b></span><select className={styles.input} value={form.district_id} disabled={!form.governorate_id} onChange={e=>set({district_id:e.target.value})}><option value="">اختر</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   </div>
   <p className={styles.hint}>لا يظهر عنوانك الدقيق، فقط المحافظة والمديرية.</p>
  </section>}

  {step===4&&<section>
   <article className={styles.preview}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {uploaded[0]&&<img src={uploaded[0].thumb} alt="" className={styles.previewImage}/>}
    <div className={styles.previewBody}>
     <strong className={styles.previewPrice}>{formatPrice(form.price,form.currency)}{form.negotiable&&<small> · قابل للتفاوض</small>}</strong>
     <span>{form.title||'—'}</span>
     <small>{listingHighlights({...form}).join(' · ')}</small>
     <small>{places.governorates.find(g=>g.id===form.governorate_id)?.name} · {places.districts.find(d=>d.id===form.district_id)?.name}</small>
    </div>
   </article>
   <label className={styles.field}><span className={styles.fieldLabel}>العنوان<b aria-hidden="true"> *</b></span><input className={styles.input} value={form.title} maxLength={120} onChange={e=>set({title:e.target.value,titleEdited:true})}/></label>
   <label className={styles.field}><span className={styles.fieldLabel}>الوصف <small>(اختياري)</small></span><textarea className={styles.textarea} rows={4} maxLength={4000} value={form.description} placeholder="مثل: سبب البيع، الملحقات، أي عيوب" onChange={e=>set({description:e.target.value})}/></label>
   <label className={styles.check}><input type="checkbox" checked={form.show_whatsapp} onChange={e=>set({show_whatsapp:e.target.checked})}/><span>أظهر زر واتساب في الإعلان</span></label>
   {form.show_whatsapp&&(needs.phone||!defaults?.hasPhone)&&<label className={styles.field}><span className={styles.fieldLabel}>رقم جوالك (يظهر عبر زر واتساب فقط)</span><input className={styles.input} inputMode="tel" dir="ltr" placeholder="77xxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/></label>}
   {(needs.terms||defaults&&!defaults.termsAccepted)&&<label className={styles.check}><input type="checkbox" checked={acceptTerms} onChange={e=>setAcceptTerms(e.target.checked)}/><span>قرأت <Link href="/market/terms" target="_blank">شروط استخدام سوق 967</Link> وأوافق عليها</span></label>}
   {needs.genuine&&<label className={styles.check}><input type="checkbox" checked={confirmGenuine} onChange={e=>setConfirmGenuine(e.target.checked)}/><span>أؤكد أن إعلاناتي حقيقية</span></label>}
   <p className={styles.safety}>البيع والشراء بين الأطراف مباشرة. لا تحوّل أي مبلغ قبل المعاينة.</p>
  </section>}

  <div className={styles.bar}>
   {step<4&&!canNext&&waiting&&<p className={styles.waiting} role="status">{waiting}</p>}
   {step>0&&<button type="button" className={styles.back} onClick={()=>setStep(s=>s-1)}><ChevronRight size={18} aria-hidden="true"/> رجوع</button>}
   {step<4?<button type="button" className={styles.primary} disabled={!canNext} onClick={()=>{setError('');setStep(s=>s+1);window.scrollTo(0,0);}}>التالي <ChevronLeft size={18} aria-hidden="true"/></button>
    :<button type="button" className={styles.primary} disabled={busy||((needs.terms||defaults&&!defaults.termsAccepted)&&!acceptTerms)} onClick={publish}>{busy?'جارٍ النشر…':'انشر الإعلان'}</button>}
  </div>
 </div>;
}
