import {notFound} from 'next/navigation';
import PilotBrowser from '@/components/school/v2/PilotBrowser';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'تجربة مدرسة 967 الجديدة',path:'/school/pilot',noindex:true,nofollow:true});
export default async function SchoolPilotPage(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 return <PilotBrowser/>;
}
