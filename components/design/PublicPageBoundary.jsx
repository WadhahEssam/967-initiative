import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';

export default async function PublicPageBoundary({section,children}){
 const settings=await getSiteSettings();
 // sectionGate يرمي خطأً مؤقتًا (5xx) إذا تعذرت قراءة الإعدادات، بدل 404.
 if(!sectionGate(section,settings))notFound();
 return children;
}
