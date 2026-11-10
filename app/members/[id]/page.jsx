import MemberProfile from '@/components/members/MemberProfile';
import {pageMetadata} from '@/lib/seo';
import {UUID_RE} from '@/lib/privateMessaging';
import {notFound} from 'next/navigation';

export const metadata={...pageMetadata({title:'الملف الشخصي',description:'عرض حساب عضو في مبادرة 967 والتواصل معه.',path:'/members',noindex:true,nofollow:true}),referrer:'no-referrer'};
export default async function MemberPage({params}){
 const {id}=await params;
 if(!UUID_RE.test(id||''))notFound();
 return <MemberProfile memberId={id}/>;
}
