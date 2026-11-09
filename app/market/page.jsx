import Link from 'next/link';
import {cookies} from 'next/headers';
import {Bell,Car,Dumbbell,Heart,House,Package,PawPrint,Plus,Shirt,Smartphone,Sofa,Sun,Wrench} from 'lucide-react';
import ListingCard from '@/components/market/ListingCard';
import MarketSearchBar from '@/components/market/MarketSearchBar';
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
// Fewer listings than this in the visitor's governorate: show other governorates too.
const FEW=8;

// Market home, in the spec's order: search, categories, the newest listings in the visitor's
// governorate, then listings from other governorates when theirs are few.
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
  <header className={styles.hero}>
   <div><h1>سوق 967</h1><p>بيع واشترِ داخل اليمن، مجانًا وبين الناس مباشرة.</p></div>
   <Link className={styles.add} href="/market/new"><Plus size={18} aria-hidden="true"/> أضف إعلانًا</Link>
  </header>
  <MarketSearchBar/>
  <nav className={styles.quickLinks} aria-label="روابط السوق">
   <Link href="/market/favourites"><Heart size={15} aria-hidden="true"/> المفضلة</Link>
   <Link href="/market/saved-searches"><Bell size={15} aria-hidden="true"/> بحوثي المحفوظة</Link>
  </nav>
  <nav className={styles.categories} aria-label="الفئات">
   {CATEGORIES.map(item=>{const Icon=ICONS[item.icon]||Package;return <Link key={item.key} href={'/market/search?category='+item.key} className={styles.categoryLink}><Icon size={24} aria-hidden="true"/>{item.label}</Link>;})}
  </nav>
  <PlaceChooser governorates={places.governorates} current={home}/>
  <div className={styles.sectionHead}>
   <h2 className={styles.sectionTitle}>{homeName?'أحدث الإعلانات في '+homeName:'أحدث الإعلانات'}</h2>
   {local.cards.length>0&&<Link href="/market/search">عرض الكل</Link>}
  </div>
  {local.cards.length?<div className={styles.grid}>{local.cards.map(item=><ListingCard key={item.id} listing={item}/>)}</div>
   :<p className={styles.empty}>لا توجد إعلانات {homeName?'في '+homeName+' ':''}بعد. <Link href="/market/new">كن أول من ينشر إعلانًا</Link>.</p>}
  {others.cards.length>0&&<>
   <div className={styles.sectionHead}><h2 className={styles.sectionTitle}>من محافظات أخرى</h2><Link href={'/market/search?gov='+ALL_YEMEN}>كل اليمن</Link></div>
   <div className={styles.grid}>{others.cards.map(item=><ListingCard key={item.id} listing={item}/>)}</div>
  </>}
 </div>;
}
