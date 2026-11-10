import Link from 'next/link';
import {ArrowLeft, Banknote, BookOpen, Compass, Gamepad2, GraduationCap, Handshake, Library, PlayCircle} from 'lucide-react';
import SearchForm from '@/components/SearchForm';
import ThemeToggle from '@/components/ThemeToggle';
import {getSiteSettings} from '@/lib/data';
import {resolveNavSections, utilityLinks} from '@/lib/navigation';
import {contentPagePath} from '@/lib/contentPages';
import {pageIsVisible} from '@/lib/pageVisibility';
import {pageMetadata} from '@/lib/seo';
import styles from './explore.module.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({title: 'استكشف 967', description: 'كل أقسام منصة 967 في مكان واحد: الإعلام والمعرفة والمدرسة والألعاب والأدلة والمبادرة.', path: '/explore'});

const ICONS = {media: PlayCircle, knowledge: Compass, school: GraduationCap, games: Gamepad2, directories: Library, services: Banknote, initiative: Handshake};
const HUES = {media: 'var(--c-ember)', knowledge: 'var(--c-teal)', school: 'var(--c-leaf)', games: 'var(--c-violet)', directories: 'var(--c-amber)', services: 'var(--c-indigo)', initiative: 'var(--c-plum)'};

// The phone "استكشف" tab: search first, then every visible section as a card
// with its own links. It replaces digging through the menu sheet.
export default async function ExplorePage() {
  const settings = await getSiteSettings();
  const pages = settings.contentPages || [];
  const contentLinks = pages.filter(page => pageIsVisible(contentPagePath(page), settings.pageVisibility, pages)).map(page => ({slug: page.slug, title: page.title, href: contentPagePath(page)}));
  const sections = resolveNavSections({contentLinks, visibility: settings.pageVisibility, pages});
  const savedVisible = pageIsVisible(utilityLinks.saved[0], settings.pageVisibility, pages);
  return <div className={`ed-page ed-wrap ${styles.page}`}>
    <header className={styles.head}>
      <h1>استكشف 967</h1>
      <p>كل أقسام المنصة في مكان واحد. ابحث، أو اختر من أين تبدأ.</p>
      <div className={styles.search}><SearchForm placeholder="ابحث عن مكان، شخصية، رقم أو عمل…"/></div>
    </header>
    <ul className={styles.grid}>
      {sections.map(section => {
        const Icon = ICONS[section.id] || BookOpen;
        return <li key={section.id} className={styles.card} style={{'--hue': HUES[section.id] || 'var(--c-accent)'}}>
          <div className={styles.cardHead}>
            <span className={styles.icon}><Icon size={22} aria-hidden="true"/></span>
            <div><h2>{section.label}</h2><p>{section.description}</p></div>
          </div>
          <ul className={styles.links}>
            {section.links.map(([href, label]) => <li key={href}><Link href={href}>{label}<ArrowLeft size={16} aria-hidden="true"/></Link></li>)}
          </ul>
        </li>;
      })}
    </ul>
    <section className={styles.utility} aria-label="أدوات">
      {savedVisible && <Link href={utilityLinks.saved[0]} className={styles.pill}>{utilityLinks.saved[1]}</Link>}
      <span className={styles.theme}><span>المظهر</span><ThemeToggle/></span>
    </section>
  </div>;
}
