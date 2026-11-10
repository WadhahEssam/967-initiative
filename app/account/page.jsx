import AccountWorkspace from '@/components/account/AccountWorkspace';
import {pageMetadata} from '@/lib/seo';
export const metadata=pageMetadata({title:'حسابي',description:'مساحتك للمحفوظات والمساهمات والإشعارات.',path:'/account',noindex:true,nofollow:true});
const tabs=new Set(['overview','saved','collections','notifications','contributions','profile','settings']);
export default async function Page({searchParams}){const params=await searchParams;const tab=typeof params?.tab==='string'&&tabs.has(params.tab)?params.tab:'overview';return <AccountWorkspace initialTab={tab}/>;}
