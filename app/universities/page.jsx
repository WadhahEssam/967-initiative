import Link from '@/components/SiteLink';
import {ArrowUpLeft,GraduationCap} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import InstitutionDirectory from '@/components/InstitutionDirectory';
import {getUniversities} from '@/lib/data';
import {institutionListItems} from '@/lib/institutionDirectories';
import {formatNumber} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'دليل الجامعات والمعاهد',description:'دليل موثق للجامعات والكليات والمعاهد اليمنية مع البحث والتصفية حسب المحافظة والنوع والجهة.',path:'/universities'});

export default async function UniversitiesPage(){
 const institutions=await getUniversities();
 const governorates=new Set(institutions.map(item=>item.governorate).filter(Boolean));
 return <><PageIntro tone="primary" category="دليل التعليم العالي" title="دليل الجامعات والمعاهد" description="ابحث في المؤسسات التعليمية اليمنية التي أمكن توثيق هويتها من أدلة رسمية ومؤسسية. الحقول غير المنشورة في المصادر تُترك فارغة ولا يعني الإدراج اعتماد المؤسسة أو استمرار عملها.">
  <div className="directory-summary"><span>المؤسسات المنشورة: <strong>{formatNumber(institutions.length)}</strong></span><span>المحافظات المغطاة: <strong>{formatNumber(governorates.size)}</strong></span><Link href="/contribute?type=اقتراح%20جامعة%20أو%20معهد">اقترح مؤسسة تعليمية <ArrowUpLeft size={15}/></Link></div>
 </PageIntro><section className="institution-disclosure"><div className="container"><GraduationCap size={22}/><p><strong>ملاحظة التحقق:</strong> الظهور في دليل حكومي أو مؤسسي يثبت وجود الاسم في ذلك المصدر فقط؛ ولا يُعرض بصفته اعتمادًا أكاديميًا ما لم يوجد دليل صريح على الاعتماد.</p></div></section><section className="section institution-directory-section" id="universities-directory"><div className="container"><InstitutionDirectory kind="university" items={institutionListItems(institutions,'university')}/></div></section></>;
}
