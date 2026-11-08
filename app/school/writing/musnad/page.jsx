import {notFound,permanentRedirect} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
// The course is now a card course on the shared journey map; this old address stays for links and bookmarks.
export const dynamic='force-dynamic';
export default async function OldMusnadCourse(){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 permanentRedirect('/school/courses/musnad');
}
