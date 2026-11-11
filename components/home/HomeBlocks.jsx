import NextLink from 'next/link';
import {
  ArrowLeft, Banknote, BarChart3, BookOpen, BrainCircuit, Briefcase, CalendarDays, ChevronLeft, Compass, Film, Flame, Gamepad2,
  GraduationCap, HandHeart, Landmark, LayoutGrid, ListChecks, MapPinned, MessagesSquare, Package, PenTool, ScrollText, Stethoscope,
  Store, Swords, Telescope, Trophy, UsersRound,
} from 'lucide-react';
import {formatCompact, formatYear} from '@/lib/format';
import {valueStatusLabels} from '@/lib/yemenNumbers';
import styles from './HomeBlocks.module.css';

// Home page building blocks (redesign v2, batch A). App-style, icon-led and
// compact: every block shows content in a row or a small tile, never a banner.
// Visibility is decided by the page (a `Link` that renders null when hidden).

/* ---------- "الآن": horizontal shortcut tiles ---------- */
export function Shortcuts({items}) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return <nav className={styles.shortcuts} aria-label="اختصارات اليوم">
    <ul>{list.map(({href, label, sub, icon: Icon, hue, live}) => <li key={href}>
      <NextLink href={href} className={styles.shortcut} style={{'--hue': hue}}>
        <span className={styles.shortcutIcon}><Icon size={22} strokeWidth={1.8} aria-hidden="true"/>{live && <i className={styles.liveDot} aria-hidden="true"/>}</span>
        <strong>{label}</strong>
        {sub && <small>{sub}</small>}
      </NextLink>
    </li>)}</ul>
  </nav>;
}

/* ---------- Section launcher: every part of 967 as an app icon ---------- */
// Everyday services first (each shows only while its section is visible).
export const launcherItems = [
  {href: '/market', label: 'السوق', icon: Store, hue: 'var(--c-ember)'},
  {href: '/services', label: 'الخدمات', icon: Banknote, hue: 'var(--c-indigo)'},
  {href: '/transactions', label: 'المعاملات', icon: ListChecks, hue: 'var(--c-teal)'},
  {href: '/works', label: 'الأعمال', icon: Film, hue: 'var(--c-ember)'},
  {href: '/debates', label: 'المناظرات', icon: MessagesSquare, hue: 'var(--c-plum)'},
  {href: '/magazine', label: 'المجلة', icon: BookOpen, hue: 'var(--c-ember)'},
  {href: '/yemen-in-numbers', label: 'الأرقام', icon: BarChart3, hue: 'var(--c-indigo)'},
  {href: '/yemen-map', label: 'الخريطة', icon: MapPinned, hue: 'var(--c-teal)'},
  {href: '/yemen-history', label: 'التاريخ', icon: ScrollText, hue: 'var(--c-teal)'},
  {href: '/yemeni-figures', label: 'الشخصيات', icon: UsersRound, hue: 'var(--c-teal)'},
  {href: '/yemen-ranking', label: 'الترتيب', icon: Trophy, hue: 'var(--c-indigo)'},
  {href: '/school', label: 'المدرسة', icon: GraduationCap, hue: 'var(--c-leaf)'},
  {href: '/games', label: 'الألعاب', icon: Gamepad2, hue: 'var(--c-violet)'},
  {href: '/yemeni-products', label: 'المنتجات', icon: Package, hue: 'var(--c-amber)'},
  {href: '/universities', label: 'الجامعات', icon: Landmark, hue: 'var(--c-amber)'},
  {href: '/medical-centers', label: 'الصحة', icon: Stethoscope, hue: 'var(--c-amber)'},
  {href: '/professionals', label: 'المهنيون', icon: Briefcase, hue: 'var(--c-amber)'},
  {href: '/contribute', label: 'ساهم', icon: HandHeart, hue: 'var(--c-plum)'},
];
// isVisible(href) is decided on the server, so hidden sections leave no gap.
export function SectionLauncher({isVisible}) {
  const tiles = launcherItems.filter(({href}) => isVisible(href)).slice(0, 11).map(({href, label, icon: Icon, hue}) =>
    <li key={href}><NextLink href={href} className={styles.app} style={{'--hue': hue}}><span className={styles.appIcon}><Icon size={22} strokeWidth={1.8} aria-hidden="true"/></span><span className={styles.appLabel}>{label}</span></NextLink></li>);
  return <ul className={styles.launcher}>
    {tiles}
    <li><NextLink href="/explore" className={styles.app} style={{'--hue': 'var(--c-ink-2)'}}><span className={styles.appIcon}><LayoutGrid size={22} strokeWidth={1.8} aria-hidden="true"/></span><span className={styles.appLabel}>الكل</span></NextLink></li>
  </ul>;
}

/* ---------- Section heading used by every block ---------- */
export function BlockHead({id, icon: Icon, title, href, linkLabel, hue = 'var(--c-accent)', Link = NextLink}) {
  return <div className={styles.head} style={{'--hue': hue}}>
    <h2 id={id}>{Icon && <span className={styles.headIcon}><Icon size={16} strokeWidth={2} aria-hidden="true"/></span>}{title}</h2>
    {href && <Link href={href} className={styles.more}>{linkLabel || 'الكل'} <ChevronLeft size={16} aria-hidden="true"/></Link>}
  </div>;
}

/* ---------- Games: a compact arcade card ---------- */
const gamePreviews = [
  {href: '/games/quiz', label: 'اختبر معرفتك', icon: BookOpen},
  {href: '/games/map', label: 'أين تقع؟', icon: MapPinned},
  {href: '/games/timeline', label: 'رتّب التاريخ', icon: ScrollText},
  {href: '/games/who', label: 'من أنا؟', icon: UsersRound},
];
export function GamesStrip({dailyHref, dailyTitle}) {
  return <div className={styles.arcade}>
    <div className={styles.arcadeTop}>
      <span className={styles.arcadeBadge}><Flame size={14} aria-hidden="true"/> تحدي اليوم</span>
      <strong className={styles.arcadeTitle}>{dailyTitle}</strong>
      <small>10 مهام · 7 ثوانٍ لكل مهمة · محاولة واحدة ونتيجة موثقة</small>
      <div className={styles.arcadeActions}>
        <NextLink href={dailyHref} className={styles.arcadePlay}><Gamepad2 size={18} aria-hidden="true"/> العب الآن</NextLink>
        <NextLink href="/games/leaderboard" className={styles.arcadeGhost}><Trophy size={16} aria-hidden="true"/> المتصدرون</NextLink>
      </div>
    </div>
    <ul className={styles.arcadeGames} aria-label="ألعاب للبدء">
      {gamePreviews.map(({href, label, icon: Icon}) => <li key={href}><NextLink href={href}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/><span>{label}</span></NextLink></li>)}
      <li><NextLink href="/games"><Swords size={20} strokeWidth={1.8} aria-hidden="true"/><span>كل الألعاب التسع</span></NextLink></li>
    </ul>
  </div>;
}

/* ---------- School: tracks as compact rows with progress meters ---------- */
const schoolTracks = [
  {href: '/school/writing', title: 'الكتابة والأدب', description: 'المسند والخط العربي والعروض', icon: PenTool, stations: 36},
  {href: '/school/nature', title: 'الفلك والطبيعة', description: 'الفضاء والطقس والأرض', icon: Telescope, stations: 48},
  {href: '/school/logic', title: 'المنطق والتفكير', description: 'الاستدلال والمغالطات والبوابات', icon: BrainCircuit, stations: 48},
  {href: '/school/civic', title: 'السياسة والاقتصاد', description: 'الحكم والاقتصاد والقرار', icon: Landmark, stations: 48},
];
export function SchoolStrip() {
  return <div className={styles.school}>
    <p className={styles.schoolLead}><GraduationCap size={18} aria-hidden="true"/> 15 مسارًا و180 محطة تفاعلية. تعلّم، جرّب، وتابع تقدمك.</p>
    <ul className={styles.rows}>
      {schoolTracks.map(({href, title, description, icon: Icon, stations}) => <li key={href}><NextLink href={href} className={styles.row} style={{'--hue': 'var(--c-leaf)'}}>
        <span className={styles.rowIcon}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span>
        <span className={styles.rowText}><strong>{title}</strong><small>{description}</small></span>
        <span className={styles.rowMeta}><bdi>{stations}</bdi> محطة</span>
        <ChevronLeft size={18} className={styles.rowChevron} aria-hidden="true"/>
      </NextLink></li>)}
    </ul>
  </div>;
}

/* ---------- Knowledge: a swipeable rail of small cards ---------- */
const knowledgeIcons = {history: ScrollText, atlas: Compass, figures: UsersRound, statistics: BarChart3, ranking: Trophy};
const knowledgeHues = {history: 'var(--c-ember)', atlas: 'var(--c-leaf)', figures: 'var(--c-violet)', statistics: 'var(--c-teal)', ranking: 'var(--c-indigo)'};
export function KnowledgeRail({items}) {
  return <ul className={styles.rail}>{items.map(item => {
    const Icon = knowledgeIcons[item.id] || Compass;
    return <li key={item.id}><NextLink href={item.href} className={styles.railCard} data-knowledge-id={item.id} style={{'--hue': knowledgeHues[item.id] || 'var(--c-accent)'}}>
      <span className={styles.railIcon}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span>
      <strong>{item.title}</strong>
      <small>{item.description}</small>
      <span className={styles.railGo}>افتح <ArrowLeft size={14} aria-hidden="true"/></span>
    </NextLink></li>;
  })}</ul>;
}

/* ---------- Numbers: a rail of compact stat tiles ---------- */
export function NumbersRail({indicators}) {
  return <ul className={styles.rail}>{indicators.map(indicator => {
    const value = indicator.latestValue;
    return <li key={indicator.id}><NextLink href={'/yemen-in-numbers/indicator/' + encodeURIComponent(indicator.slug)} className={`${styles.railCard} ${styles.stat}`} style={{'--hue': 'var(--c-indigo)'}}>
      <small className={styles.statDomain}>{indicator.domain?.name || 'اليمن بالأرقام'}</small>
      <strong>{indicator.name}</strong>
      <span className={styles.statValue}><bdi>{formatCompact(value.value)}</bdi> <small>{indicator.unit}</small></span>
      <small>{formatYear(value.year)} · {valueStatusLabels[value.value_status] || 'قيمة منشورة'}</small>
    </NextLink></li>;
  })}</ul>;
}

/* ---------- Directories & places: compact rows ---------- */
export function CommunityRows({company, professional, showCompany, showProfessional, showAtlas}) {
  const rows = [];
  if (showCompany && company) rows.push({href: '/yemeni-products/' + encodeURIComponent(company.id), icon: Package, title: company.name, sub: [company.category, company.location].filter(Boolean).join(' · ') || 'دليل المنتجات اليمنية', hue: 'var(--c-amber)'});
  if (showProfessional && professional) rows.push({href: '/professionals/' + encodeURIComponent(professional.id), icon: Briefcase, title: professional.fullName, sub: [professional.professionTitle, professional.location].filter(Boolean).join(' · ') || 'دليل المهنيين', hue: 'var(--c-amber)'});
  if (showAtlas) rows.push({href: '/yemen-map', icon: MapPinned, title: 'كل مكان في اليمن، له حكاية', sub: 'المحافظات والمديريات والشخصيات على الخريطة', hue: 'var(--c-teal)'});
  if (!rows.length) return null;
  return <ul className={styles.rows}>{rows.map(({href, icon: Icon, title, sub, hue}) => <li key={href}><NextLink href={href} className={styles.row} style={{'--hue': hue}}>
    <span className={styles.rowIcon}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span>
    <span className={styles.rowText}><strong>{title}</strong><small>{sub}</small></span>
    <ChevronLeft size={18} className={styles.rowChevron} aria-hidden="true"/>
  </NextLink></li>)}</ul>;
}

/* ---------- Participation invite ---------- */
export function InviteBanner({eyebrow, title, label}) {
  return <NextLink href="/contribute" className={styles.invite}>
    <span className={styles.inviteIcon}><HandHeart size={22} strokeWidth={1.8} aria-hidden="true"/></span>
    <span className={styles.rowText}><small>{eyebrow}</small><strong id="contact-title">{title}</strong></span>
    <span className={styles.inviteCta}>{label} <ArrowLeft size={15} aria-hidden="true"/></span>
  </NextLink>;
}

export const shortcutIcons = {Flame, GraduationCap, MessagesSquare, BarChart3, MapPinned, CalendarDays};
