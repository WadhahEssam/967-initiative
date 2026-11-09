import Link from 'next/link';
import {cookies} from 'next/headers';
import {Car,Dumbbell,House,Package,PawPrint,Shirt,Smartphone,Sofa,Sun,Wrench} from 'lucide-react';
import ListingCard from '@/components/market/ListingCard';
import MarketTopBar from '@/components/market/MarketTopBar';
import PlaceChooser from '@/components/market/PlaceChooser';
import {CATEGORIES} from '@/lib/market/catalog';
import {getMarketPlaces} from '@/lib/market/places';
import {ALL_YEMEN,PLACE_COOKIE} from '@/lib/market/search';
import {searchListings} from '@/lib/market/searchServer';
import {serverDb} from '@/lib/supabase-server';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'سوق 967',description:'سوق إعلانات مجانية بين الناس داخل اليمن: سيارات، عقارات، جوالات، طاقة شمسية والمزيد.',path:'/market'});
const ICONS={car:Car,home:House,phone:Smartphone,sun:Sun,sofa:Sofa,shirt:Shirt,paw:PawPrint,tools:Wrench,ball:Dumbbell,box:Package};
// Short names under the category icons (the full name is the link's label).
const SHORT={real_estate:'عقارات',vehicles:'مركبات',electronics:'إلكترونيات',solar:'طاقة شمسية',home:'المنزل',fashion:'أزياء',animals:'حيوانات',equipment:'معدات',hobbies:'رياضة وكتب',other:'أخرى'};
// Fewer listings than this in the visitor's governorate: show other governorates too.
const FEW=8;

// Market home, phone first: the market bar (search, then the member's places), the ten categories
// at a glance, and listings from the first screen. The visitor's governorate comes first; others
// follow when it has few listings. «بِع» floats within thumb reach.
export default async function MarketHome(){
 const places=await getMarketPlaces();
 const saved=(await cookies()).get(PLACE_COOKIE)?.value;
 const home=places.governorates.some(item=>item.id===saved)?saved:saved===ALL_YEMEN?ALL_YEMEN:null;
 const homeName=places.governorates.find(item=>item.id===home)?.name;
 const db=serverDb();
 const empty={cards:[],more:false};
 const local=db?await searchListings(db,places,{gov:home||ALL_YEMEN},{limit:24}).catch(()=>empty):empty;
 const others=db&&homeName&&local.cards.length<FEW?await searchListings(db,places,{gov:ALL_YEMEN},{limit:16,notGovernorate:home}).catch(()=>empty):empty;
 return <div className={styles.page}>
  <h1 className="sr-only">سوق 967: بيع واشترِ داخل اليمن</h1>
  <MarketTopBar/>
  <nav className={styles.categories} aria-label="الفئات">
   {CATEGORIES.map(item=>{const Icon=ICONS[item.icon]||Package;return <Link key={item.key} href={'/market/search?category='+item.key} className={styles.category} aria-label={item.label} prefetch={false}>
    <span className={styles.categoryIcon}><Icon size={22} aria-hidden="true"/></span><span aria-hidden="true">{SHORT[item.key]||item.label}</span>
   </Link>;})}
  </nav>
  <div className={styles.feedHead}>
   <h2 className={styles.sectionTitle}>أحدث الإعلانات</h2>
   <PlaceChooser governorates={places.governorates} current={home}/>
  </div>
  {local.cards.length?<div className={styles.grid}>{local.cards.map((item,index)=><ListingCard key={item.id} listing={item} index={index}/>)}</div>
   :<p className={styles.empty}>لا توجد إعلانات {homeName?'في '+homeName+' ':''}بعد. <Link href="/market/new">كن أول من ينشر إعلانًا</Link>.</p>}
  {local.more&&<Link className={styles.more} href={'/market/search'+(home?'?gov='+home:'')}>عرض كل الإعلانات</Link>}
  {others.cards.length>0&&<>
   <div className={styles.feedHead}><h2 className={styles.sectionTitle}>من محافظات أخرى</h2><Link href={'/market/search?gov='+ALL_YEMEN} className={styles.headLink}>كل اليمن</Link></div>
   <div className={styles.grid}>{others.cards.map(item=><ListingCard key={item.id} listing={item}/>)}</div>
  </>}
 </div>;
}
