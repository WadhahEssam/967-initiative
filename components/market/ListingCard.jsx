import Link from 'next/link';
import {Package} from 'lucide-react';
import CardImage from './CardImage';
import {formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import styles from './Market.module.css';

// One listing in a grid, in the order buyers decide: photo, price, title, then where and when.
// `index` < 4 loads the photo at once (the first screen); the others load as they come near.
export default function ListingCard({listing,index=99}){
 const place=listing.district||listing.governorate;
 return <Link href={listingPath(listing.number)} className={styles.card} data-seller={listing.sellerId||undefined} prefetch={false}>
  <span className={styles.cardImage}>
   {listing.cover?<CardImage src={listing.cover} eager={index<4} priority={index<2}/>:<Package size={34} aria-hidden="true"/>}
   {listing.status==='reserved'&&<span className={styles.badge}>محجوز</span>}
   {listing.status==='sold'&&<span className={styles.badgeSold}>مباع</span>}
  </span>
  <span className={styles.cardBody}>
   <strong className={styles.cardPrice}>{formatPrice(listing.price,listing.currency)}</strong>
   <span className={styles.cardTitle}>{listing.title}</span>
   <small className={styles.cardMeta}>{[place,listing.publishedAt&&timeAgo(listing.publishedAt)].filter(Boolean).join(' · ')}</small>
  </span>
 </Link>;
}
