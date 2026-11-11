import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import {pageMetadata} from '@/lib/seo';
export const metadata={...pageMetadata({title:'إحصاءات الموقع',description:'إحصاءات زيارات الموقع لحسابات الإدارة.',path:'/admin/analytics',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default function AnalyticsPage(){return <AnalyticsDashboard/>;}
