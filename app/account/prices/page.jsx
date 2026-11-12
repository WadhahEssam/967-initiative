import MyPrices from '@/components/services/MyPrices';
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata({title:'مساهماتي في الأسعار',path:'/account/prices',noindex:true,nofollow:true});
export default function Page(){return <MyPrices/>;}
