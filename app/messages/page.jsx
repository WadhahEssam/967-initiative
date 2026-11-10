import PrivateMessaging from '@/components/messages/PrivateMessaging';
import {pageMetadata} from '@/lib/seo';
export const metadata={...pageMetadata({title:'الرسائل الخاصة',description:'طلبات المحادثات والرسائل الخاصة بين أعضاء 967.',path:'/messages',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default function MessagesPage(){return <PrivateMessaging/>;}
