/* eslint-disable @next/next/no-img-element -- avatars and covers are small, already-sized images. */
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {CalendarDays,MapPin,MessageCircle,Package,ShoppingBag,Star} from 'lucide-react';
import ListingCard from '@/components/market/ListingCard';
import RatingList from '@/components/market/RatingList';
import {getMarketPlaces} from '@/lib/market/places';
import {RATING_CRITERIA,MIN_RATINGS_SHOWN,ratingSummary,responseText} from '@/lib/market/ratings';
import {sellerProfile} from '@/lib/market/ratingsServer';
import {serverDb} from '@/lib/supabase-server';
import {formatArabicDate} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import styles from '@/components/market/Ratings.module.css';
import market from '@/components/market/Market.module.css';

export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function load(id){
 if(!UUID.test(id||''))return null;
 const db=serverDb();
 return db?sellerProfile(db,id,await getMarketPlaces()):null;
}
// A person's page: kept out of search engines, like member pages.
export async function generateMetadata({params}){
 const {id}=await params;
 const data=await load(id).catch(()=>null);
 return pageMetadata({title:data?data.seller.name+' — بائع في سوق 967':'سوق 967',description:'إعلانات البائع وتقييماته في سوق 967.',path:'/market/seller/'+id,noindex:true});
}

// The seller page: who they are, how buyers rated them, how they answer, and their listings
// (active, and sold: photo, title and when, without the price).
export default async function SellerPage({params,searchParams}){
 const {id}=await params;
 const tab=(await searchParams)?.tab==='sold'?'sold':'active';
 const data=await load(id);
 if(!data)notFound();
 const {seller,stats,active,sold,ratings}=data;
 const summary=ratingSummary(stats);
 const response=responseText(stats);
 return <div className={market.page}>
  <header className={styles.profile}>
   <span className={styles.avatar}>{seller.avatar?<img src={seller.avatar} alt="" width={72} height={72}/>:seller.name.trim().charAt(0)}</span>
   <div>
    <h1>{seller.name}</h1>
    <p className={styles.meta}>
     {seller.governorate&&<span><MapPin size={14} aria-hidden="true"/>{seller.governorate}</span>}
     <span><CalendarDays size={14} aria-hidden="true"/>عضو منذ {formatArabicDate(seller.since,{year:'numeric',month:'long'})}</span>
     <span><ShoppingBag size={14} aria-hidden="true"/>باع {stats.sold||0}</span>
    </p>
    <p className={styles.headline}><Star size={16} aria-hidden="true"/>{summary.text}</p>
    {response&&<p className={styles.meta}><span><MessageCircle size={14} aria-hidden="true"/>{response}</span></p>}
   </div>
  </header>
  {summary.shown&&<dl className={styles.breakdown}>{RATING_CRITERIA.map(item=><div key={item.key}>
   <dt>{item.label}</dt><dd><span className={styles.bar}><span style={{inlineSize:(Number(stats[item.key])/5*100)+'%'}}/></span>{Number(stats[item.key]).toFixed(1)}</dd>
  </div>)}</dl>}
  <nav className={styles.tabs} aria-label="إعلانات البائع">
   <Link href={'/market/seller/'+seller.id} aria-current={tab==='active'?'page':undefined}>الإعلانات النشطة ({active.length})</Link>
   <Link href={'/market/seller/'+seller.id+'?tab=sold'} aria-current={tab==='sold'?'page':undefined}>تم البيع ({sold.length})</Link>
  </nav>
  {tab==='active'?(active.length?<div className={market.grid}>{active.map(item=><ListingCard key={item.id} listing={item}/>)}</div>:<p className={styles.notice}>لا توجد إعلانات نشطة الآن.</p>)
   :(sold.length?<ul className={styles.soldList}>{sold.map(item=><li key={item.id}>
    <span className={styles.thumb}>{item.cover?<img src={item.cover} alt="" loading="lazy"/>:<Package size={22} aria-hidden="true"/>}</span>
    <div><strong>{item.title}</strong><small>بيع {formatArabicDate(item.soldAt,{year:'numeric',month:'long',day:'numeric'})}</small>{item.rating!==null&&<small className={styles.soldRating}>تقييم المشتري {item.rating} من 5</small>}</div>
   </li>)}</ul>:<p className={styles.notice}>لم يبع شيئًا عبر السوق بعد.</p>)}
  <h2 className={styles.sectionTitle}>التقييمات</h2>
  <RatingList sellerId={seller.id} initial={stats.ratings>=MIN_RATINGS_SHOWN?ratings:[]} count={Number(stats.ratings)||0}/>
 </div>;
}
