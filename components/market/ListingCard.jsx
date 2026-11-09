import Link from 'next/link';
import {Package} from 'lucide-react';
import {formatPrice,listingPath,timeAgo} from '@/lib/market/format';
import styles from './Market.module.css';

// One listing in a grid: photo, price, title, place and age. Photos load only near the viewport.
export default function ListingCard({listing}){
 return <Link href={listingPath(listing.number)} className={styles.card}>
  <span className={styles.cardImage}>
   {/* Covers are already small WebP thumbnails (480 px), so next/image would add nothing. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   {listing.cover?<img src={listing.cover} alt="" loading="lazy" decoding="async"/>:<Package size={34} aria-hidden="true"/>}
   {listing.status==='reserved'&&<span className={styles.badge}>محجوز</span>}
   {listing.status==='sold'&&<span className={styles.badgeSold}>مباع</span>}
  </span>
  <span className={styles.cardBody}>
   <strong className={styles.cardPrice}>{formatPrice(listing.price,listing.currency)}</strong>
   <span className={styles.cardTitle}>{listing.title}</span>
   <small className={styles.cardMeta}>{[listing.governorate,listing.district].filter(Boolean).join(' · ')}{listing.publishedAt&&' · '+timeAgo(listing.publishedAt)}</small>
  </span>
 </Link>;
}
