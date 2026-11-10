import Link from 'next/link';
import RatingForm from '@/components/market/RatingForm';
import {pageMetadata} from '@/lib/seo';
import market from '@/components/market/Market.module.css';

export const metadata=pageMetadata({title:'قيّم البائع — سوق 967',description:'قيّم تعاملك مع بائع في سوق 967.',path:'/market/rate',noindex:true});

export default async function RatePage({params}){
 const {chatId}=await params;
 return <div className={market.page}>
  <nav className={market.crumbs} aria-label="مسار الصفحة"><Link href="/market">سوق 967</Link></nav>
  <h1 className={market.pageTitle}>قيّم البائع</h1>
  <RatingForm chatId={chatId}/>
 </div>;
}
