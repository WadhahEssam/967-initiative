import {notFound,permanentRedirect} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';
// Old lesson addresses open the same lesson in the card player.
export const dynamic='force-dynamic';
export default async function OldMusnadStage({params}){
 const settings=await getSiteSettings();
 if(!sectionGate('school',settings))notFound();
 const {stage:raw}=await params;
 if(!/^(?:[1-9]|1[0-2])$/.test(raw))notFound();
 permanentRedirect('/school/courses/musnad/'+raw);
}
