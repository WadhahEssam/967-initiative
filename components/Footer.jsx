import NextLink from 'next/link';
import {pageIsVisible} from '@/lib/pageVisibility';
import {memberCountLabel} from '@/lib/memberCountLabel';
import {ArrowUpLeft, ChevronDown} from 'lucide-react';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import {defaultSiteSettings} from '@/lib/siteSettings';
import {contentPagePath} from '@/lib/contentPages';
import {navSections} from '@/lib/navigation';

// Closed <details> content is not keyboard-accessible even if CSS shows it.
// Two responsive structures: plain link lists on wide screens, disclosures on phones.
function FooterGroup({title, children}) {
  return <>
    <div className="ed-footer-group ed-footer-desktop"><h3>{title}</h3><ul>{children}</ul></div>
    <details className="ed-footer-group ed-footer-fold"><summary><h3>{title}</h3><ChevronDown size={17} aria-hidden="true"/></summary><ul>{children}</ul></details>
  </>;
}

// Footer-only additions to the shared vocabulary.
const extras = {
  school: [['/school/courses/musnad', 'تعلم خط المسند'], ['/school/courses/arud', 'تعلم علم العروض']],
  initiative: [['/contribute?type=تصحيح%20معلومة', 'أرسل تصحيحاً'], ['/admin', 'دخول المحررين']],
};

export default function Footer({settings = defaultSiteSettings, memberCount = null}) {
  const members = memberCountLabel(memberCount);
  const pages = (settings.contentPages || []).filter(page => page.showInFooter && page.isPublished !== false);
  const visible = href => pageIsVisible(href, settings.pageVisibility, settings.contentPages || []);
  const item = ([href, label]) => visible(href) ? <li key={href}><NextLink href={href}>{label}</NextLink></li> : null;
  const socials = [{key: 'instagram', label: 'إنستغرام'}, {key: 'youtube', label: 'يوتيوب'}, {key: 'facebook', label: 'فيسبوك'}, {key: 'tiktok', label: 'تيك توك'}].filter(entry => settings[entry.key]);
  const groupLinks = section => {
    if (section.id !== 'initiative') return [...section.links, ...(extras[section.id] || [])];
    const managed = pages.filter(page => !['privacy', 'terms'].includes(page.slug)).map(page => [contentPagePath(page), page.title]);
    return [...managed, ['/#projects', 'مشاريعنا'], ['/contribute', 'ساهم معنا'], ...extras.initiative];
  };
  const groups = navSections.map(section => ({...section, links: groupLinks(section).filter(([href]) => visible(href))})).filter(section => section.links.length);
  return <footer className="ed-footer"><div className="ed-footer-inner">
    <div className="ed-footer-about">
      <NextLink href="/" className="ed-footer-brand" aria-label="مبادرة 967 — الرئيسية"><BrandLogo light className="ed-footer-mark"/></NextLink>
      <h2>{settings.footerTitle}</h2>
      <p>{settings.footerDescription}</p>
      {members && <p className="ed-footer-members">انضمّ إلى مجتمع 967 حتى الآن <strong>{members}</strong>.{visible('/register') && <> <NextLink href="/register">انضم إلينا</NextLink></>}</p>}
      {socials.length > 0 && <ul className="ed-footer-socials" aria-label="حسابات 967">{socials.map(({key, label}) => <li key={key}><a href={settings[key]} target="_blank" rel="noopener noreferrer">{label}<ArrowUpLeft size={14} aria-hidden="true"/><span className="sr-only"> (يفتح في نافذة جديدة)</span></a></li>)}</ul>}
    </div>
    <div className="ed-footer-groups" style={{'--footer-groups': Math.min(groups.length, 8)}}>{groups.map(section => <FooterGroup key={section.id} title={section.label}>{section.links.map(item)}</FooterGroup>)}</div>
    <div className="ed-footer-bottom">
      <span>© {new Date().getFullYear()} مبادرة 967</span>
      <span className="ed-footer-motto">المعرفة تجمعنا، والمشاركة تقرّبنا.</span>
      <ThemeToggle labelled className="ed-footer-theme"/>
      <nav className="ed-footer-policy" aria-label="الخصوصية والشروط">{pages.filter(page => ['privacy', 'terms'].includes(page.slug)).map(page => visible(contentPagePath(page)) ? <NextLink key={page.id} href={contentPagePath(page)}>{page.title}</NextLink> : null)}{visible('/search') && <NextLink href="/search">ابحث في المنصة</NextLink>}</nav>
    </div>
  </div></footer>;
}
