import KnowledgeTheme from '@/components/knowledge/KnowledgeTheme';
import KnowledgeNavigation from '@/components/knowledge/KnowledgeNavigation';
import ContextBackLink from '@/components/ContextBackLink';
import JumpNav from '@/components/knowledge/JumpNav';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import Image from 'next/image';
import {toLatinDigits} from '@/lib/format';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {
  ArrowUpLeft,
  AtSign,
  BookOpenText,
  CalendarDays,
  ExternalLink,
  Facebook,
  Globe2,
  Landmark,
  MapPinned,
  Youtube,
} from 'lucide-react';
import {getYemeniFigure, getYemeniFigures, getSiteSettings} from '@/lib/data';
import {sectionIsVisible,sectionGate} from '@/lib/pageVisibility';
import {detailPath, pageMetadata} from '@/lib/seo';
import {breadcrumbSchema, figureSchema, JsonLd} from '@/lib/seo-schema';
import FigureDossier from '@/components/FigureDossier';
import InlineTarget from '@/components/inline/InlineTarget';
import CorrectionLink from '@/components/CorrectionLink';
import {relatedProjections} from '@/lib/relatedContent';
import {readHistoryCatalog} from '@/lib/historyRepository';
import {serverDb} from '@/lib/supabase-server';
import {figureCrossLinks} from '@/lib/knowledgeConnections';
import CrossSectionPaths from '@/components/knowledge/CrossSectionPaths';
import {hasFigureImageProvenance} from '@/lib/contentEvidence';

export const dynamic = 'force-dynamic';

function figureInitials(name) {
  return String(name || '').split(/\s+/).filter(word => !['الملكة', 'الملك', 'بن', 'بنت'].includes(word)).slice(0, 2)
    .map(word => word.replace(/^ال/, '').slice(0, 1)).join(' ');
}

function socialLinks(figure) {
  return [
    {url: figure.website, label: 'الموقع الإلكتروني', icon: Globe2},
    {url: figure.facebookUrl, label: 'فيسبوك', icon: Facebook},
    {url: figure.instagramUrl, label: 'إنستغرام', icon: AtSign},
    {url: figure.xUrl, label: 'منصة X', icon: AtSign},
    {url: figure.youtubeUrl, label: 'يوتيوب', icon: Youtube},
  ].filter(item => item.url);
}

export async function generateMetadata({params}) {
  const {slug} = await params;
  const figure = await getYemeniFigure(slug);
  if (!figure || !sectionGate('figures',await getSiteSettings())) notFound();

  const title = `${figure.fullName} | شخصيات يمنية`;
  const description = toLatinDigits(figure.shortBio || figure.knownFor);
  return pageMetadata({title, description, path:detailPath('yemeni-figures', figure.slug), noindex:figure.isDemo, image:hasFigureImageProvenance(figure,figure.profile?.gallery?.find(photo=>photo.url===figure.imageUrl))?figure.imageUrl:null, type:'profile'});
}

function ProfileFact({icon: Icon, label, value, ltr = false}) {
  if (!value) return null;
  return <div className="figure-profile-fact">
    <dt><Icon size={18}/>{label}</dt><dd dir={ltr ? 'ltr' : undefined}>{value}</dd>
  </div>;
}

export default async function YemeniFigureProfilePage({params}) {
  const {slug} = await params;
  const [figure, figures, settings] = await Promise.all([getYemeniFigure(slug), getYemeniFigures(relatedProjections.figures),getSiteSettings()]);
  if (!figure || !sectionGate('figures',settings)) notFound();

  const historyEntries=sectionIsVisible('history',settings.pageVisibility)
    ?await readHistoryCatalog(serverDb()).then(result=>result.entries).catch(()=>[]):[];
  const crossLinks=figureCrossLinks(figure,{visibility:settings.pageVisibility,historyEntries,figures});
  const links = socialLinks(figure);
  const hasDossier=figure.profile&&['sections','facts','timeline','works','gallery','notes'].some(key=>figure.profile[key]?.length);
  const portrait=figure.profile?.gallery.find(photo=>photo.url===figure.imageUrl);
  const sourceCount=figure.profile?.sources?.length||figure.sources?.length||0;
  const hasAttributedPortrait=hasFigureImageProvenance(figure,portrait);
  const related = figures
    .filter(item => item.id !== figure.id && (item.field === figure.field || (figure.governorateId && item.governorateId === figure.governorateId)))
    .sort((a, b) => {
      const aScore = Number(a.field === figure.field) * 2 + Number(a.governorateId === figure.governorateId);
      const bScore = Number(b.field === figure.field) * 2 + Number(b.governorateId === figure.governorateId);
      return bScore - aScore;
    })
    .slice(0, 3);

  return <KnowledgeTheme area="figures"><div className="figure-profile-page">
    <InlineTarget kind="figure" id={figure.id} slug={figure.slug} title={figure.fullName} href={detailPath('yemeni-figures',figure.slug)} isDemo={figure.isDemo}/>
    <JsonLd data={figureSchema(figure)}/>
    <JsonLd data={breadcrumbSchema([{name:'شخصيات يمنية', path:'/yemeni-figures'}, {name:figure.fullName, path:detailPath('yemeni-figures', figure.slug)}])}/>

    <section className="figure-profile-hero">
      <div className="container figure-profile-hero-grid">
        <div className="figure-profile-copy">
          <ContextBackLink fallback="/yemeni-figures" label="العودة إلى شخصيات يمنية"/>
          <div className="figure-profile-tags">
            <span>{figure.era}</span>
            <span>{figure.field}</span>
            {figure.governorateName&&<span><MapPinned size={14}/>{figure.governorateName}</span>}
          </div>
          <h1>{figure.fullName}</h1>
          {figure.isDemo && <p className="data-disclosure">ملف توضيحي من الكتالوج التجريبي للمشروع. يحتاج إلى مراجعة المصادر والبيانات قبل اعتماده؛ لا يمثل ملفاً موثقاً منشوراً.</p>}
          <strong>{toLatinDigits(figure.knownFor)}</strong>
          <p>{toLatinDigits(figure.shortBio)}</p>
          <div className="figure-profile-reading-path">
            <a href="#figure-profile-content">ابدأ قراءة السيرة <ArrowUpLeft size={16} aria-hidden="true"/></a>
            <a href="#figure-sources">المصادر والمراجع <BookOpenText size={16} aria-hidden="true"/></a>
            {sourceCount>0&&<span>{sourceCount} مصادر مسجلة</span>}
          </div>
          {links.length > 0 && <nav className="figure-profile-socials" aria-label={`روابط ${figure.fullName}`}>
            {links.map(({url, label, icon: Icon}) => <a href={url} target="_blank" rel="noopener noreferrer" key={label}><Icon size={17}/><span>{label}</span><ExternalLink size={13}/></a>)}
          </nav>}
        </div>

        <div className="figure-profile-portrait" data-kind={portrait?.kind||'portrait'}>
          {hasAttributedPortrait
            ? <Image src={figure.imageUrl} alt={figure.profile?.gallery.find(photo=>photo.url===figure.imageUrl)?.alt||`صورة ${figure.fullName}`} fill priority sizes="(max-width: 850px) 100vw, 42vw" unoptimized={figure.imageUrl.startsWith('http')}/>
            : <span className="figure-profile-initials" aria-hidden="true">{figureInitials(figure.fullName)}</span>}
          <div><span>{{context:'صورة سياقية مرتبطة بالسيرة',artwork:'تصوير فني',document:'وثيقة تاريخية'}[portrait?.kind]||figure.field}</span><strong>{figure.fullName}</strong>{figure.imageSourceUrl&&<a href={figure.imageSourceUrl} title={figure.imageCredit} target="_blank" rel="noopener noreferrer">مصدر الصورة وحقوقها</a>}</div>
        </div>
      </div>
    </section>
    <JumpNav items={[
      {href: '#figure-profile-content', title: 'السيرة', icon: 'text'},
      hasDossier && figure.profile.timeline?.length > 0 && {href: '#figure-timeline', title: 'المحطات', icon: 'timeline'},
      hasDossier && figure.profile.works?.length > 0 && {href: '#figure-works', title: 'الأعمال', icon: 'reading'},
      hasDossier && figure.profile.gallery?.length > 0 && {href: '#figure-gallery', title: 'الصور', icon: 'gallery'},
      {href: '#figure-sources', title: 'المصادر', icon: 'sources'},
      {href: '#figure-quick-facts', title: 'معلومات سريعة', icon: 'card'},
    ]}/>
    <KnowledgeNavigation/>

    <section className="figure-profile-body">
      <div className="container figure-profile-layout" id="figure-profile-content">
        <div className="figure-profile-main">
          <ContentReadingAction kind="figure" href={detailPath('yemen-map/figures',figure.slug)} title={figure.fullName}/>
          {hasDossier ? <FigureDossier profile={figure.profile} figure={figure}/> : <>
          <section>
            <span className="eyebrow">السيرة والتعريف</span>
            <h2>عن {figure.fullName}</h2>
            <p className="figure-profile-biography">{toLatinDigits(figure.biographyText||figure.shortBio)}</p>
          </section>

          {(figure.birthYear || figure.deathYear || figure.timeline?.length > 0) && <section><span className="eyebrow">محطات من السيرة</span><h2>التسلسل الزمني</h2><ol className="figure-timeline">{[
            ...(figure.birthYear ? [{year:figure.birthYear,title:'الميلاد'}] : []),
            ...(figure.timeline || []),
            ...(figure.deathYear ? [{year:figure.deathYear,title:'الوفاة'}] : []),
          ].sort((a,b)=>Number(a.year)-Number(b.year)).map((item,index)=><li key={index}><time>{item.year}</time><div><strong>{item.title}</strong>{item.description&&<p>{item.description}</p>}</div></li>)}</ol></section>}

          <section id="figure-sources"><span className="eyebrow">المراجع</span><h2>مصادر الملف</h2>{figure.sources?.length ? <ul>{figure.sources.map(item=><li key={item.url}><a className="text-link" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<ExternalLink size={14}/></a></li>)}</ul> : <p className="small-muted">لم تُرفق مراجع تفصيلية بهذا الملف بعد. <Link className="text-link" href="/contribute?type=اقتراح%20شخصية%20أو%20معلومة%20تاريخية">ساهم بمصدر أو تصحيح</Link></p>}</section>

          <section className="figure-profile-significance">
            <BookOpenText size={27}/>
            <div><span className="eyebrow">معروف بـ</span><h2>{toLatinDigits(figure.knownFor)}</h2><p>يُصنّف هذا الملف ضمن {figure.field} ويرتبط بمحافظة {figure.governorateName} في دليل شخصيات يمنية.</p></div>
          </section>
          </>}
          <CrossSectionPaths items={crossLinks} id="figure-cross-paths" title="ضع السيرة في سياق أوسع"/>
        </div>

        <aside className="figure-profile-aside" id="figure-quick-facts">
          <div className="figure-profile-facts">
            <h2>معلومات سريعة</h2>
            <dl>
              <ProfileFact icon={Landmark} label="الفترة" value={figure.era}/>
              <ProfileFact icon={BookOpenText} label="المجال" value={figure.field}/>
              <ProfileFact icon={MapPinned} label="المحافظة المرتبطة" value={figure.governorateName}/>
              <ProfileFact icon={CalendarDays} label="سنة الميلاد" value={figure.birthYear} ltr/>
              <ProfileFact icon={CalendarDays} label="سنة الوفاة" value={figure.deathYear} ltr/>
            </dl>
          </div>
          <Link className="figure-profile-directory-link" href="/yemeni-figures">استعراض جميع الشخصيات <ArrowUpLeft size={17}/></Link>

          <CorrectionLink title={figure.fullName} path={detailPath('yemeni-figures',figure.slug)} id={figure.id}/>
        </aside>
      </div>
    </section>

    {related.length > 0 && <section className="figure-profile-related">
      <div className="container">
        <div className="figure-profile-related-head"><div><span className="eyebrow">شخصيات مرتبطة</span><h2>ملفات أخرى للاستكشاف</h2></div><Link className="text-link" href="/yemeni-figures">عرض الدليل <ArrowUpLeft size={16}/></Link></div>
        <div className="figure-profile-related-grid">{related.map(item => <Link href={`/yemeni-figures/${item.slug}`} key={item.id}>
          <div><span>{[item.field,item.governorateName].filter(Boolean).join(' · ')}</span><h3>{item.fullName}</h3><p>{toLatinDigits(item.knownFor)}</p></div><ArrowUpLeft size={20}/>
        </Link>)}</div>
      </div>
    </section>}
  </div></KnowledgeTheme>;
}
