import {notFound} from 'next/navigation';
import ReviewPlayer from '@/components/school/v2/ReviewPlayer';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata={...pageMetadata({title:'مراجعة اليوم — مدرسة 967',path:'/school/review'}),robots:{index:false,follow:false}};
export default async function SchoolReviewPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <ReviewPlayer/>;
}
