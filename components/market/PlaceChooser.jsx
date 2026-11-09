'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {MapPin} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {normalizeSearch} from '@/lib/market/text';
import {PLACE_COOKIE} from '@/lib/market/search';
import styles from './Market.module.css';

const remember=value=>{document.cookie=PLACE_COOKIE+'='+encodeURIComponent(value)+'; path=/; max-age=31536000; samesite=lax';};

// Whose listings come first. Members: the governorate on their account. Visitors: asked once, and
// the answer is kept in a cookie so the server can show their governorate first.
export default function PlaceChooser({governorates,current}){
 const router=useRouter();
 const [asking,setAsking]=useState(false);
 const [changing,setChanging]=useState(false);
 const choose=value=>{remember(value);setAsking(false);setChanging(false);router.refresh();};

 useEffect(()=>{
  if(current)return;
  let live=true;
  (async()=>{
   try{
    const db=browserDb();
    const {data}=db?await db.auth.getSession():{data:{}};
    if(data?.session){
     const {data:prefs}=await db.from('account_preferences').select('governorate').eq('user_id',data.session.user.id).maybeSingle();
     const key=normalizeSearch(prefs?.governorate||'');
     const match=key&&governorates.find(item=>normalizeSearch(item.name)===key);
     if(match&&live){choose(match.id);return;}
    }
   }catch{/* ask instead */}
   if(live)setAsking(true);
  })();
  return()=>{live=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[current]);

 const select=<select className={styles.placeSelect} defaultValue="" aria-label="اختر محافظتك" onChange={event=>event.target.value&&choose(event.target.value)}>
  <option value="" disabled>اختر محافظتك</option>
  {governorates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
 </select>;

 if(asking)return <div className={styles.placeAsk} role="region" aria-label="محافظتك">
  <p><MapPin size={16} aria-hidden="true"/> أين تسكن؟ نعرض لك إعلانات محافظتك أولًا.</p>
  <div className={styles.placeAskActions}>{select}<button type="button" className={styles.placeAll} onClick={()=>choose('all')}>كل اليمن</button></div>
 </div>;
 if(!current)return null;
 const name=governorates.find(item=>item.id===current)?.name;
 return <div className={styles.placeBar}>
  {changing?select:<>
   <button type="button" className={name?styles.placeOn:styles.placeOff} onClick={()=>name?null:setChanging(true)} aria-pressed={Boolean(name)}><MapPin size={14} aria-hidden="true"/>{name||'محافظتي'}</button>
   <button type="button" className={name?styles.placeOff:styles.placeOn} onClick={()=>choose('all')} aria-pressed={!name}>كل اليمن</button>
   <button type="button" className={styles.placeChange} onClick={()=>setChanging(true)}>تغيير</button>
  </>}
 </div>;
}
