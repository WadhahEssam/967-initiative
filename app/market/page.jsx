import Link from 'next/link';
import {Car,Dumbbell,House,Package,PawPrint,Plus,Shirt,Smartphone,Sofa,Sun,Wrench} from 'lucide-react';
import ListingCard from '@/components/market/ListingCard';
import {CATEGORIES,findCategory} from '@/lib/market/catalog';
import {getMarketPlaces} from '@/lib/market/places';
import {latestListings} from '@/lib/market/listingsServer';
import {serverDb} from '@/lib/supabase-server';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'سوق 967',description:'سوق إعلانات مجانية بين الناس داخل اليمن: سيارات، عقارات، جوالات، طاقة شمسية والمزيد.',path:'/market'});
const ICONS={car:Car,home:House,phone:Smartphone,sun:Sun,sofa:Sofa,shirt:Shirt,paw:PawPrint,tools:Wrench,ball:Dumbbell,box:Package};

// Market home (phase 2): add-listing button, category icons and the newest listings.
// Search, filters and «your governorate first» come in phase 3.
export default async function MarketHome({searchParams}){
 const params=await searchParams;
 const category=findCategory(params?.category)?.key||null;
 const places=await getMarketPlaces();
 const db=serverDb();
 const listings=db?await latestListings(db,places,{category,limit:48}).catch(()=>[]):[];
 return <div className={styles.page}>
  <header className={styles.hero}>
   <div><h1>سوق 967</h1><p>بيع واشترِ داخل اليمن، مجانًا وبين الناس مباشرة.</p></div>
   <Link className={styles.add} href="/market/new"><Plus size={18} aria-hidden="true"/> أضف إعلانًا</Link>
  </header>
  <nav className={styles.categories} aria-label="الفئات">
   {CATEGORIES.map(item=>{const Icon=ICONS[item.icon]||Package;return <Link key={item.key} href={category===item.key?'/market':'/market?category='+item.key} className={category===item.key?styles.categoryLinkOn:styles.categoryLink} aria-current={category===item.key?'page':undefined}><Icon size={24} aria-hidden="true"/>{item.label}</Link>;})}
  </nav>
  <h2 className={styles.sectionTitle}>{category?findCategory(category).label:'أحدث الإعلانات'}</h2>
  {listings.length?<div className={styles.grid}>{listings.map(item=><ListingCard key={item.id} listing={item}/>)}</div>
   :<p className={styles.empty}>لا توجد إعلانات {category?'في هذه الفئة ':''}بعد. <Link href="/market/new">كن أول من ينشر إعلانًا</Link>.</p>}
 </div>;
}
