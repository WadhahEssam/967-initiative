'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ChevronDown,MapPin} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {normalizeSearch} from '@/lib/market/text';
import {ALL_YEMEN,PLACE_COOKIE} from '@/lib/market/search';
import Sheet from './Sheet';
import ui from './ui.module.css';
import styles from './Market.module.css';

const remember=value=>{document.cookie=PLACE_COOKIE+'='+encodeURIComponent(value)+'; path=/; max-age=31536000; samesite=lax';};

// Whose listings come first, as one small button beside «أحدث الإعلانات» (the server renders its
// label, so nothing moves while the page loads). Members get the governorate on their account the
// first time; visitors pick it once from the sheet and the choice is kept in a cookie.
export default function PlaceChooser({governorates,current}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const choose=value=>{remember(value);setOpen(false);router.refresh();};

 useEffect(()=>{
  if(current)return;
  let live=true;
  (async()=>{
   try{
    const db=browserDb();
    const {data}=db?await db.auth.getSession():{data:{}};
    if(!data?.session||!live)return;
    const {data:prefs}=await db.from('account_preferences').select('governorate').eq('user_id',data.session.user.id).maybeSingle();
    const key=normalizeSearch(prefs?.governorate||'');
    const match=key&&governorates.find(item=>normalizeSearch(item.name)===key);
    if(match&&live)choose(match.id);
   }catch{/* the visitor picks from the sheet */}
  })();
  return()=>{live=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[current]);

 const name=current===ALL_YEMEN?'كل اليمن':governorates.find(item=>item.id===current)?.name;
 return <>
  <button type="button" className={name?styles.place:styles.placeAsk} onClick={()=>setOpen(true)} aria-haspopup="dialog">
   <MapPin size={15} aria-hidden="true"/>{name||'اختر محافظتك'}<ChevronDown size={15} aria-hidden="true"/>
  </button>
  <Sheet open={open} title="أين تتصفح؟" onClose={()=>setOpen(false)}>
   <p className={styles.placeHint}>نعرض إعلانات المحافظة التي تختارها أولًا.</p>
   <div className={styles.placeList}>
    {[{id:ALL_YEMEN,name:'كل اليمن'},...governorates].map(item=><button key={item.id} type="button" className={ui.chip} aria-pressed={item.id===current} onClick={()=>choose(item.id)}>{item.name}</button>)}
   </div>
  </Sheet>
 </>;
}
