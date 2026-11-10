import Link from 'next/link';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {ChevronLeft,Clock,Eye,MapPin,ShieldCheck,Star} from 'lucide-react';
import ListingGallery from '@/components/market/ListingGallery';
import ListingContactBar from '@/components/market/ListingContactBar';
import ListingCard from '@/components/market/ListingCard';
import ListingActions from '@/components/market/ListingActions';
import Price from '@/components/market/Price';
import {ReportButton} from '@/components/market/SafetyDialogs';
import {conditionLabel,findCategory,findSubcategory} from '@/lib/market/catalog';
import {attributeText,listingHighlights} from '@/lib/market/listing';
import {formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import {getMarketPlaces} from '@/lib/market/places';
import {getPublicListing,similarListings} from '@/lib/market/listingsServer';
import {sellerStats} from '@/lib/market/ratingsServer';
import {ratingSummary,responseText} from '@/lib/market/ratings';
import {isBotAgent} from '@/lib/issueDownloads';
import {serverDb} from '@/lib/supabase-server';
import {formatArabicDate} from '@/lib/format';
import {pageMetadata,siteUrl} from '@/lib/seo';
import styles from '@/components/market/Market.module.css';

export const dynamic='force-dynamic';

async function load(number){
 const db=serverDb();
 if(!db)return null;
 const places=await getMarketPlaces();
 const listing=await getPublicListing(db,number,places);
 return listing?{db,places,listing}:null;
}

// Shared links show the cover photo, the title and the price.
export async function generateMetadata({params}){
 const {number}=await params;
 const data=await load(number).catch(()=>null);
 if(!data)return {};
 const {listing}=data;
 return pageMetadata({
  title:listing.title+' — '+formatPrice(listing.price,listing.currency),
  description:[listing.governorate,listing.district,conditionLabel(listing.condition),listingHighlights(listing).join(' · ')].filter(Boolean).join(' · '),
  path:listingPath(listing.number),
  image:listing.images?.[0]?.id?'/api/market/img/'+listing.images[0].id+'/full':undefined,
 });
}

// One view per visitor and listing every 6 hours; crawlers and link previews are not counted.
const seen=new Map();
async function countView(db,listing){
 const head=await headers();
 if(isBotAgent(head.get('user-agent')))return;
 const key=(head.get('x-forwarded-for')||'').split(',')[0].trim()+'|'+listing.id,now=Date.now();
 if(seen.size>20000)for(const [k,at] of seen)if(now-at>6*3600000)seen.delete(k);
 if(seen.has(key)&&now-seen.get(key)<6*3600000)return;
 seen.set(key,now);
 await db.rpc('market_count_view',{p_listing:listing.id}).then(()=>null,()=>null);
}

export default async function ListingPage({params}){
 const {number}=await params;
 const data=await load(number);
 if(!data)notFound();
 const {db,places,listing}=data;
 await countView(db,listing);
 const sub=findSubcategory(listing.category,listing.subcategory),category=findCategory(listing.category);
 // «الحالة» is optional for property and animals: rows without a value are left out.
 const specs=[['الفئة',[category?.label,sub?.label].filter(Boolean).join(' / ')],['الحالة',conditionLabel(listing.condition)],
  ...(sub?.fields||[]).filter(field=>field.key!=='area_unit').map(field=>[field.label,attributeText(sub,field.key,listing.attributes)])].filter(([,value])=>value);
 const [similar,stats]=await Promise.all([similarListings(db,listing,places).catch(()=>[]),sellerStats(db,listing.seller.id).catch(()=>({}))]);
 const rated=ratingSummary(stats),response=responseText(stats);
 const price=formatPrice(listing.price,listing.currency);
 // «معدّل» beside what the seller changed after publishing, and the old price after a drop.
 const edited=(part,force=false)=>(force||(listing.edited_fields||[]).includes(part))?<span className={styles.edited}>معدّل</span>:null;
 const dropped=Number(listing.previous_price)>Number(listing.price);
 return <div className={styles.listing} data-seller={listing.seller.id} data-seller-page="">
  <div className={styles.layout}>
   <ListingGallery images={listing.images} title={listing.title}>
    <ListingActions listingId={listing.id} title={listing.title} price={price} url={siteUrl(listingPath(listing.number))}/>
   </ListingGallery>
   <div className={styles.summary}>
    {listing.status!=='active'&&<p className={styles.status}>{listing.status==='reserved'?'محجوز حاليًا: يمكنك حفظه أو مراسلة البائع أو تقديم عرض.':'مباع'}</p>}
    <div className={styles.priceRow}>
     <Price price={listing.price} currency={listing.currency} className={styles.price} currencyClassName={styles.currency}/>
     {dropped&&<s className={styles.oldPrice}><Price price={listing.previous_price} currency={listing.currency}/></s>}
     {listing.negotiable&&<span className={styles.negotiable}>قابل للتفاوض</span>}{edited('price')}
    </div>
    <h1 className={styles.title}>{listing.title}{edited('title')}</h1>
    <p className={styles.where}><span><MapPin size={14} aria-hidden="true"/>{[listing.governorate,listing.district].filter(Boolean).join(' · ')}{edited('place')}</span><span><Clock size={14} aria-hidden="true"/>{timeAgo(listing.published_at)}</span></p>
    {listingHighlights(listing).length>0&&<ul className={styles.highlights}>{listingHighlights(listing).map(item=><li key={item}>{item}</li>)}</ul>}
    <Link href={'/market/seller/'+listing.seller.id} className={styles.seller}>
     <span className={styles.avatar} aria-hidden="true">{listing.seller.name.trim().charAt(0)}</span>
     <span className={styles.sellerText}>
      <strong>{listing.seller.name}</strong>
      <small>{rated.shown?<><Star size={13} aria-hidden="true" className={styles.star}/> {rated.text}</>:rated.text}{listing.seller.sold?' · باع '+listing.seller.sold:''}</small>
      <small>{response||(listing.seller.since?'عضو منذ '+formatArabicDate(listing.seller.since,{year:'numeric',month:'long'}):'')}</small>
     </span>
     <ChevronLeft size={18} aria-hidden="true" className={styles.sellerGo}/>
    </Link>
   </div>
  </div>
  <section className={styles.block}>
   {listing.description&&<><h2>الوصف{edited('description')}</h2><p className={styles.description}>{listing.description}</p></>}
   <h2>المواصفات{(listing.edited_fields||[]).some(part=>['details','condition'].includes(part))&&edited('details',true)}</h2>
   <dl className={styles.specs}>{specs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <p className={styles.safety}><ShieldCheck size={16} aria-hidden="true"/> قابل البائع في مكان عام، ولا تحوّل أي مبلغ قبل المعاينة.</p>
   <div className={styles.facts}><span>رقم الإعلان {listing.number}</span><span><Eye size={13} aria-hidden="true"/> {listing.views} مشاهدة</span>{listing.saves>0&&<span>حفظه {listing.saves}</span>}<ReportButton target="listing" ids={{listingId:listing.id}} ownerId={listing.seller.id} label="إبلاغ عن الإعلان"/></div>
   {similar.length>0&&<><h2>إعلانات مشابهة</h2><div className={styles.grid}>{similar.map(item=><ListingCard key={item.id} listing={item}/>)}</div></>}
  </section>
  <ListingContactBar listingId={listing.id} sellerId={listing.seller.id} title={listing.title} amount={listing.price} currency={listing.currency} closed={listing.status==='sold'}
   whatsapp={listing.status==='sold'?null:listing.whatsapp} negotiable={listing.negotiable&&Number(listing.price)>0&&['active','reserved'].includes(listing.status)} url={siteUrl(listingPath(listing.number))}/>
 </div>;
}
