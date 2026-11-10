import ContributionsDashboard from '@/components/admin/ContributionsDashboard';
import {pageMetadata} from '@/lib/seo';
export const metadata={...pageMetadata({title:'مساهمات الفريق',description:'سجل العمليات التحريرية ومساهمات الفريق.',path:'/admin/contributions',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default function ContributionsPage(){return <ContributionsDashboard/>;}
