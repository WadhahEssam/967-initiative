import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import {pageMetadata} from '@/lib/seo';
export const metadata={...pageMetadata({title:'تحليلات الاستخدام',description:'إحصاءات مجمعة للمحررين عن زيارات الأقسام والتعلم والبحث.',path:'/admin/analytics',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default function AnalyticsPage(){return <AnalyticsDashboard/>;}
