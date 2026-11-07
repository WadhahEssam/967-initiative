// فحص جاهزية لـCoolify: 200 فقط حين يقرأ الخادم إعدادات الأقسام من قاعدة البيانات فعلًا.
// أثناء الإقلاع البارد بعد النشر تفشل القراءة أحيانًا، فيعيد 503 ولا يحوّل Coolify الزوار إلى النسخة الجديدة بعد.
// لا يكشف أي بيانات أو أسرار.
import {getSiteSettings} from '@/lib/data';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 const settings=await getSiteSettings();
 const ready=!settings.pageVisibilityUnavailable;
 return Response.json({ok:ready},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
}
