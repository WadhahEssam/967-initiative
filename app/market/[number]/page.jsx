import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {Clock,Eye,MapPin} from 'lucide-react';
import ListingGallery from '@/components/market/ListingGallery';
import ListingContactBar from '@/components/market/ListingContactBar';
import ListingCard from '@/components/market/ListingCard';
import {conditionLabel,findCategory,findSubcategory} from '@/lib/market/catalog';
import {attributeText,listingHighlights} from '@/lib/market/listing';
import {formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import {getMarketPlaces} from '@/lib/market/places';
import {getPublicListing,similarListings} from '@/lib/market/listingsServer';
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
 const specs=[['الفئة',[category?.label,sub?.label].filter(Boolean).join(' / ')],['الحالة',conditionLabel(listing.condition)],
  ...(sub?.fields||[]).filter(field=>field.key!=='area_unit').map(field=>[field.label,attributeText(sub,field.key,listing.attributes)]).filter(([,value])=>value)];
 const similar=await similarListings(db,listing,places).catch(()=>[]);
 const price=formatPrice(listing.price,listing.currency);
 return <div className={styles.listing}>
  <div className={styles.layout}>
   <ListingGallery images={listing.images} title={listing.title}/>
   <div className={styles.summary}>
    {listing.status!=='active'&&<span className={styles.status}>{listing.status==='reserved'?'محجوز':'مباع'}</span>}
    <div><span className={styles.price}>{price}</span>{listing.negotiable&&<span className={styles.negotiable}>قابل للتفاوض</span>}</div>
    <h1 className={styles.title}>{listing.title}</h1>
    <div className={styles.where}><span><MapPin size={14} aria-hidden="true"/>{[listing.governorate,listing.district].filter(Boolean).join(' · ')}</span><span><Clock size={14} aria-hidden="true"/>{timeAgo(listing.published_at)}</span></div>
    {listingHighlights(listing).length>0&&<div className={styles.highlights}>{listingHighlights(listing).map(item=><span key={item}>{item}</span>)}</div>}
    <div className={styles.seller}>
     <span className={styles.avatar} aria-hidden="true">{listing.seller.name.trim().charAt(0)}</span>
     <div><strong>{listing.seller.name}</strong>
      <small>{listing.seller.since?'عضو منذ '+formatArabicDate(listing.seller.since,{year:'numeric',month:'long'}):''}{listing.seller.sold?' · باع '+listing.seller.sold+' في السوق':''}</small>
      <small>لا توجد تقييمات بعد</small>
     </div>
    </div>
   </div>
  </div>
  <section className={styles.block}>
   {listing.description&&<><h2>الوصف</h2><p className={styles.description}>{listing.description}</p></>}
   <h2>المواصفات</h2>
   <dl className={styles.specs}>{specs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <p className={styles.safety}>قابل البائع في مكان عام، ولا تحوّل أي مبلغ قبل المعاينة.</p>
   <div className={styles.facts}><span>رقم الإعلان {listing.number}</span><span><Eye size={13} aria-hidden="true"/> {listing.views} مشاهدة</span>{listing.saves>0&&<span>حفظه {listing.saves}</span>}</div>
   {similar.length>0&&<><h2>إعلانات مشابهة</h2><div className={styles.grid}>{similar.map(item=><ListingCard key={item.id} listing={item}/>)}</div></>}
  </section>
  <ListingContactBar listingId={listing.id} title={listing.title} price={price} whatsapp={listing.whatsapp} negotiable={listing.negotiable&&listing.status==='active'} url={siteUrl(listingPath(listing.number))}/>
 </div>;
}
