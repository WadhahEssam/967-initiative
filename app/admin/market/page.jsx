import MarketModeration from '@/components/admin/MarketModeration';
import {pageMetadata} from '@/lib/seo';
export const metadata={...pageMetadata({title:'إشراف سوق 967 | إدارة 967',path:'/admin/market',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default function Page(){return <MarketModeration/>;}
