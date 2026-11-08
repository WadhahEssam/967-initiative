import {shareCardPath} from '@/lib/shareCard';
import ContextBackLink from '@/components/ContextBackLink';
import Image from 'next/image';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {
  ArrowUpLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ExternalLink,
  Factory,
  Globe2,
  Mail,
  MapPin,
  MapPinned,
  Boxes,
  PackageCheck,
  Phone,
  Ruler,
  Scale,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {getYemeniCompanies, getYemeniCompany} from '@/lib/data';
import {relatedProjections} from '@/lib/relatedContent';
import {formatNumber,formatArabicDate} from '@/lib/format';
import {detailPath, pageMetadata} from '@/lib/seo';
import {breadcrumbSchema, JsonLd} from '@/lib/seo-schema';
import InlineTarget from '@/components/inline/InlineTarget';
import {buildCorrectionHref} from '@/lib/contributions';
import ContentReadingAction from '@/components/reading/ContentReadingAction';

export const dynamic = 'force-dynamic';

const currencyLabels = {YER: 'ر.ي', SAR: 'ر.س', USD: 'USD'};
const hasValue = value => value !== null && value !== undefined && value !== '';

export async function generateMetadata({params}) {
  const {id} = await params;
  const company = await getYemeniCompany(id);
  if (!company) notFound();
  return pageMetadata({
    title: `${company.name} | منتجات يمنية`,
    description: company.summary,
    path:detailPath('yemeni-products', company.id),
    noindex:company.isDemo,
    image:shareCardPath('company',company.id,company.name,company.summary,company.productDetails?.length),
  });
}

function ProfileFact({icon: Icon, label, value, ltr = false}) {
  if (!hasValue(value)) return null;
  return <div className="company-profile-fact">
    <Icon size={18}/><div><span>{label}</span><strong dir={ltr ? 'ltr' : undefined}>{value || 'غير متوفر — قيد التحقق'}</strong></div>
  </div>;
}

function CompanyProductEntry({product,index}) {
  return <article className={product.imageUrl ? 'has-image' : ''} key={product.name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {product.imageUrl && <div className="company-product-image"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 580px) 100vw, 170px"/></div>}
              <div className="company-product-content"><h3>{product.name}</h3><p>{product.description}</p>{product.sources?.length?<small><a href={product.sources[0].url} target="_blank" rel="noopener noreferrer">مصدر بيانات المنتج: {product.sources[0].title} <ExternalLink size={12}/></a></small>:<small className="small-muted" role="note">لم يُرفق مصدر مستقل لهذا المنتج؛ التفاصيل تحتاج إلى توثيق.</small>}{product.format && <small><PackageCheck size={14}/>{product.format}</small>}
                {(product.size || product.weight || hasValue(product.quantity)) && <div className="company-product-specs">
                  {product.size && <span><Ruler size={14}/><b>الحجم</b>{product.size}</span>}
                  {product.weight && <span><Scale size={14}/><b>الوزن</b>{product.weight}</span>}
                  {hasValue(product.quantity) && <span><Boxes size={14}/><b>الكمية</b>{formatNumber(product.quantity)}</span>}
                </div>}
                {(hasValue(product.wholesalePrice) || hasValue(product.retailPrice)) && <div className="company-product-prices">
                  <CircleDollarSign size={18}/>
                  {hasValue(product.wholesalePrice) && <span><b>سعر الجملة</b>{formatNumber(product.wholesalePrice, {maximumFractionDigits: 2})} {currencyLabels[product.currency] || product.currency}</span>}
                  {hasValue(product.retailPrice) && <span><b>سعر التجزئة</b>{formatNumber(product.retailPrice, {maximumFractionDigits: 2})} {currencyLabels[product.currency] || product.currency}</span>}<small className="small-muted">الأسعار دون تاريخ سريان موثق؛ تأكد من المنشأة قبل الشراء.</small>
                </div>}
              </div>
            </article>;
}

export default async function YemeniCompanyPage({params}) {
  const {id} = await params;
  const company = await getYemeniCompany(id);
  if (!company) notFound();
  const companies = await getYemeniCompanies(relatedProjections.companies);
  const related = companies.filter(item => item.id !== company.id && item.category === company.category).slice(0, 2);
  const mapQuery = [company.address, company.location, 'اليمن'].filter(Boolean).join('، ');
  const googleMapsUrl = company.googleMapsUrl || (company.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : null);

  return <>
    <InlineTarget kind="company" id={company.databaseId} slug={company.id} title={company.name} href={detailPath('yemeni-products',company.id)} isDemo={company.isDemo}/>
    <JsonLd data={breadcrumbSchema([{name:'منتجات يمنية', path:'/yemeni-products'}, {name:company.name, path:detailPath('yemeni-products', company.id)}])}/>
    <section className="company-profile-hero">
      {company.imageUrl && <div className="company-profile-image"><Image src={company.imageUrl} alt={company.imageUrl.includes('/wiki/Special:FilePath/') ? 'صورة توضيحية لفئة منتجات '+company.name : 'صورة '+company.name} fill priority unoptimized={company.imageUrl.includes('/wiki/Special:FilePath/')} sizes="(max-width: 800px) 100vw, 52vw" style={{objectPosition: company.imagePosition}}/>{company.imageUrl.includes('/wiki/Special:FilePath/')&&<span style={{position:'absolute',top:14,right:14,zIndex:2,color:'#fff',background:'rgba(16,25,38,.86)',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600}}>صورة توضيحية — ليست صورة الشركة</span>}</div>}
      <div className="company-profile-copy">
        <ContextBackLink fallback="/yemeni-products#directory" label="العودة إلى دليل المنتجات"/>
        <div className="company-profile-tags"><span>{company.category}</span>{company.scale&&<span>{company.scale}</span>}<span><MapPin size={13}/>{company.location}</span></div>
        <h1>{company.name}</h1>
        <p>{company.summary}</p>
        <div className="company-profile-status"><span/> {company.isDemo ? 'ملف تجريبي — بيانات الهوية والتواصل غير الموثقة موضحة بوضوح.' : company.sources?.length ? 'معلومات مستندة إلى مصادر منشورة — روابط المصادر وتاريخ مراجعتها أدناه.' : 'ملف منشور من لوحة التحرير — يُحدّث عند توفر معلومات أحدث.'}</div>
      </div>
    </section>

    <section className="company-profile-body">
      <div className="container company-profile-layout">
        <div className="company-profile-main">
          <ContentReadingAction kind="company" href={detailPath('yemeni-products',company.id)} title={company.name}/>
          {company.story && <section>
            <span className="eyebrow">قصة المنشأة</span>
            <h2>عن {company.name}</h2>
            <p className="company-profile-lead">{company.story}</p>
          </section>}

          <section>
            <div className="company-section-heading"><div><span className="eyebrow">المنتجات</span><h2>ماذا تقدم المنشأة؟</h2></div><strong>عدد المنتجات: {formatNumber(company.productDetails.length)}</strong></div>
            <div className="company-product-list">{company.productDetails.slice(0,8).map((product,index)=><CompanyProductEntry key={product.name} product={product} index={index}/>)}</div>
            {company.productDetails.length>8&&<details className="company-more-products">
              <summary>عرض {formatNumber(company.productDetails.length-8)} منتجًا إضافيًا</summary>
              <div className="company-product-list">{company.productDetails.slice(8).map((product,index)=><CompanyProductEntry key={product.name} product={product} index={index+8}/>)}</div>
            </details>}
          </section>

          {(company.impact || company.strengths.length>0) && <section className="company-impact-section">
            <span className="eyebrow">القيمة المحلية</span>
            <h2>الأثر في الصناعة والتجارة</h2>
            <p>{company.impact}</p>
            <div>{company.strengths.map(item => <span key={item}><Factory size={15}/>{item}</span>)}</div>
          </section>}

          {company.markets.length>0 && <section>
            <span className="eyebrow">قنوات البيع</span>
            <h2>الأسواق التي تخدمها</h2>
            <div className="company-markets">{company.markets.map(item => <span key={item}><Store size={17}/>{item}</span>)}</div>
          </section>}
          {company.sources?.length>0 && <section className="company-sources">
            <span className="eyebrow">المعلومات والمراجع</span><h2>مصادر بيانات المنشأة والمنتجات</h2>
            <p className="small-muted">تاريخ المراجعة يخص المعلومات المنشورة في المصدر، ولا يؤكد حالة التشغيل الحالية أو توفر المنتجات.</p>
            <ul>{company.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={15}/></a>{source.reviewedAt&&<small>تاريخ المراجعة: {formatArabicDate(source.reviewedAt)}</small>}</li>)}</ul>
          </section>}
        </div>

        <aside className="company-profile-aside">
          <div className="company-profile-panel">
            <h2>بيانات المنشأة</h2>
            <ProfileFact icon={Building2} label="الاسم القانوني" value={company.legalName}/>
            <ProfileFact icon={BriefcaseBusiness} label="نوع المنشأة" value={company.entityType}/>
            <ProfileFact icon={UsersRound} label="الملكية" value={company.ownership}/>
            <ProfileFact icon={UserRound} label="المالك أو المؤسس" value={company.owner}/>
            <ProfileFact icon={UserRound} label="الرئيس التنفيذي" value={company.ceo}/>
            <ProfileFact icon={CalendarDays} label="سنة التأسيس" value={company.founded}/>
            <ProfileFact icon={UsersRound} label="حجم الفريق" value={company.teamSize}/>
          </div>

          {(company.address||company.website||company.email||company.phone||googleMapsUrl) && <div className="company-profile-panel">
            <h2>العنوان والتواصل</h2>
            <ProfileFact icon={MapPin} label="العنوان" value={company.address}/>
            <ProfileFact icon={Globe2} label="الموقع الإلكتروني" value={company.website} ltr/>
            <ProfileFact icon={Mail} label="البريد الإلكتروني" value={company.email} ltr/>
            <ProfileFact icon={Phone} label="الهاتف" value={company.phone} ltr/>
            {(company.website || googleMapsUrl) && <div className="company-contact-links">
              {company.phone && <a className="company-website-link company-phone-link" href={`tel:${company.phone.split(/[\/،؛,]/)[0].replace(/[^+0-9]/g,'')}`}>اتصل بالشركة <Phone size={16}/></a>}
               {company.email && <a className="company-website-link company-email-link" href={`mailto:${company.email.trim()}`}>إرسال بريد إلكتروني <Mail size={16}/></a>}
               {googleMapsUrl && <a className="company-website-link company-maps-link" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">{company.googleMapsUrl?'فتح الموقع في خرائط Google':'بحث العنوان في خرائط Google'} <MapPinned size={16}/></a>}
              {company.website && <a className="company-website-link" href={company.website} target="_blank" rel="noopener noreferrer">زيارة الموقع الإلكتروني <ExternalLink size={15}/></a>}
            </div>}
          </div>}

          <div className="company-correction">
            <strong>هل تمثل هذه المنشأة؟</strong>
            <p>يمكن إرسال البيانات الرسمية وروابط التواصل لتوثيق الملف وتحديثه.</p>
            <Link href={buildCorrectionHref({title:company.name,path:detailPath('yemeni-products',company.id),id:company.databaseId||company.id})}>تحديث بيانات الشركة <ArrowUpLeft size={15}/></Link>
          </div>
        </aside>
      </div>
    </section>

    {related.length > 0 && <section className="company-related">
      <div className="container"><div className="company-related-head"><div><span className="eyebrow">من القطاع نفسه</span><h2>منشآت مشابهة</h2></div><Link href="/yemeni-products#directory" className="text-link">عرض الدليل كاملاً <ArrowUpLeft size={16}/></Link></div>
      <div className="company-related-grid">{related.map(item => <Link href={'/yemeni-products/' + item.id} key={item.id}>
        <div><span>{item.location}</span><h3>{item.name}</h3><p>{item.summary}</p></div><ArrowUpLeft size={21}/>
      </Link>)}</div></div>
    </section>}
  </>;
}
