import NotificationCenter from '@/components/notifications/NotificationCenter';
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata({title:'الإشعارات',description:'تابع الإشعارات والمهام والرسائل الخاصة في مكان واحد.',path:'/notifications',noindex:true,nofollow:true});
export default function Page(){return <NotificationCenter/>;}
