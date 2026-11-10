import NextLink from 'next/link';
import OpenFoldOnHash from '@/components/OpenFoldOnHash';
import {Banknote, BarChart3, ChevronDown, Compass, Flame, GraduationCap, Handshake, LayoutGrid, MapPin, MapPinned, MessagesSquare, Newspaper, Sparkles, UsersRound} from 'lucide-react';
import SearchForm from '@/components/SearchForm';
import HomeSmartStart from '@/components/home/HomeSmartStart';
import Resilient from '@/components/front/Resilient';
import TodayFeed from '@/components/home/TodayFeed';
import OnThisDay from '@/components/home/OnThisDay';
import {onThisDay} from '@/lib/onThisDayServer';
import {buildTodayFeed} from '@/lib/todayFeed';
import {Shortcuts, SectionLauncher, BlockHead, GamesStrip, SchoolStrip, KnowledgeRail, NumbersRail, CommunityRows, InviteBanner} from '@/components/home/HomeBlocks';
import {formatCompact, formatNumber} from '@/lib/format';
import {utcDay, dailyGameUrl, dailyGameForDate, DAILY_GAME_TITLES} from '@/lib/dailyGame';
import {getLatestWorks, getLatestIssues, getRecentIndicators, getRecentCompanies, getRecentProfessionals, getSiteSettings} from '@/lib/data';
import {getPublicRates} from '@/lib/exchangeRatesServer';
import {serverDb} from '@/lib/supabase-server';
import {RATE_REGIONS, usableRates} from '@/lib/exchangeRates';
import {getDebateCatalog} from '@/lib/debateServer';
import {selectHomeContent, homeProjections} from '@/lib/homeContent';
import {visibleHomeKnowledge} from '@/lib/homeKnowledge';
import {pageIsVisible, sectionIsVisible} from '@/lib/pageVisibility';
import {formatArabicDate} from '@/lib/format';
import {pageMetadata} from '@/lib/seo';
import '@/app/foundation/editorial.css';
import styles from './front.module.css';
import home from './home.module.css';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({title:'967 | اليمن، أقرب إليك', description:'مساحة يمنية مفتوحة للمعرفة والإعلام والثقافة والبيانات والمشاركة المجتمعية.', path:'/'});

// Every source is bounded (a handful of rows) and settles on its own:
// one failed dataset empties one slot, never the page.
const settle = promise => promise.then(data => ({data, failed:false}), () => ({data:null, failed:true}));

export default async function Home() {
  const settings = await getSiteSettings();
  const visibleHistory = sectionIsVisible('history', settings.pageVisibility);
  const [works, issues, indicators, debates, companies, professionals, historyDay, exchange] = await Promise.all([
    settle(getLatestWorks(homeProjections.works, 8)),
    settle(getLatestIssues(homeProjections.issues, 2)),
    settle(getRecentIndicators(4)),
    getDebateCatalog().then(result => ({data:result.debates, failed:!result.available}), () => ({data:null, failed:true})),
    settle(getRecentCompanies(homeProjections.companies, 6)),
    settle(getRecentProfessionals(homeProjections.professionals, 6)),
    visibleHistory ? onThisDay().catch(() => null) : null,
    sectionIsVisible('services', settings.pageVisibility) ? getPublicRates(serverDb()).catch(() => null) : null,
  ]);
  // Today's dollar in both cities, only while the rates are recent.
  const dollarRates = exchange ? RATE_REGIONS.map(region => ({region, row: usableRates(exchange.latest)[region.id + ':USD']})).filter(item => item.row) : [];
  const content = selectHomeContent({works:works.data||[], issues:issues.data||[], indicators:indicators.data||[], debates:debates.data||[], companies:companies.data||[], professionals:professionals.data||[]});
  const visible = id => sectionIsVisible(id, settings.pageVisibility);
  const Link = ({href, ...props}) => pageIsVisible(href, settings.pageVisibility, settings.contentPages||[]) ? <NextLink href={href} {...props}/> : null;
  const knowledgeLinks = visibleHomeKnowledge(settings.pageVisibility, settings.contentPages||[]);
  const today = utcDay();
  const highlightList = visible('statistics') ? (indicators.data || []) : [];
  // The newest indicator may lead "Today"; the numbers band shows the others.
  const moreNumbers = highlightList.slice(1);
  // "Today": newest and most time-sensitive published items across the platform.
  const feed = buildTodayFeed({works:works.data||[], issues:issues.data||[], debates:debates.data||[], indicators:highlightList}, {isVisible:visible});
  const feedFailed = works.failed && debates.failed;

  const dailyGame = dailyGameForDate(today);
  const leadNumber = highlightList[0];
  const debate = content.debate;
  // "الآن": the few things worth one tap today. Each respects section visibility.
  const shortcuts = [
    visible('games') && {href: dailyGameUrl(today), label: 'تحدي اليوم', sub: DAILY_GAME_TITLES[dailyGame], icon: Flame, hue: 'var(--c-violet)'},
    dollarRates.length > 0 && {href: '/services/exchange-rates', label: 'سعر الصرف اليوم', sub: 'الدولار: ' + dollarRates.map(({region, row}) => region.name + ' ' + formatNumber(row.sell)).join(' · '), icon: Banknote, hue: 'var(--c-indigo)'},
    visible('school') && {href: '/school', label: 'تعلّم اليوم', sub: '15 مسارًا تفاعليًا', icon: GraduationCap, hue: 'var(--c-leaf)'},
    visible('debates') && debate && {href: '/debates/' + encodeURIComponent(debate.slug), label: debate.stage === 'live' ? 'مناظرة مباشرة' : 'مناظرة', sub: debate.title, icon: MessagesSquare, hue: 'var(--c-plum)', live: debate.stage === 'live'},
    leadNumber && {href: '/yemen-in-numbers/indicator/' + encodeURIComponent(leadNumber.slug), label: 'رقم اليوم', sub: leadNumber.name + ': ' + formatCompact(leadNumber.latestValue.value) + (leadNumber.unit ? ' ' + leadNumber.unit : '') + (leadNumber.latestValue.year ? ' (' + leadNumber.latestValue.year + ')' : ''), icon: BarChart3, hue: 'var(--c-indigo)'},
    visible('atlas') && {href: '/yemen-map', label: 'خريطة اليمن', sub: '22 محافظة ومديرياتها', icon: MapPinned, hue: 'var(--c-teal)'},
  ];

  return <div className={`ed-page ${home.home}`}>
    {/* 1 · Greeting: date, the editable title and description, search */}
    <section className={home.greet} aria-labelledby="home-title"><div className="ed-wrap">
      <p className={home.greetTop}><span className={home.pill}><span className={home.dot}/>{settings.heroEyebrow}</span><time dateTime={today}>{formatArabicDate(new Date(), {weekday:'long', day:'numeric', month:'long', timeZone:'Asia/Aden'})}</time></p>
      <h1 id="home-title" className={home.title}>{settings.heroTitle}{settings.heroHighlight && <> <span className={home.highlight}>{settings.heroHighlight}</span></>}</h1>
      <p className={home.lead}>{settings.heroDescription}</p>
      <div className={home.search}><SearchForm compact placeholder={settings.searchPlaceholder}/></div>
      {settings.pageVisibilityUnavailable && <p className="ed-unavailable" role="status">تعذر تحميل أقسام المنصة مؤقتًا. أعد تحديث الصفحة للمحاولة.</p>}
    </div></section>

    {/* «في مثل هذا اليوم»: a dated event from the history texts */}
    {historyDay && <div className={`ed-wrap ${home.block}`}><Resilient name="home-on-this-day" label="تعذّر عرض حدث اليوم." quiet><OnThisDay result={historyDay}/></Resilient></div>}

    {/* 2 · الآن: one-tap shortcuts */}
    <div className={`ed-wrap ${home.block}`}><Shortcuts items={shortcuts}/></div>

    {/* 3 · اليوم في 967: the newest and most important, whatever its type */}
    <section className={home.block} aria-labelledby="today-title"><div className="ed-wrap">
      <BlockHead id="today-title" icon={Newspaper} title="الجديد في 967" href="/search" linkLabel="كل المحتوى" Link={Link}/>
      <Resilient name="home-today" label="تعذّر عرض الجديد الآن."><TodayFeed feed={feed} failed={feedFailed}/></Resilient>
    </div></section>

    {/* 4 · تابع من حيث توقفت (members); guests get a one-line sign-in hint, since the shortcuts above are their doors */}
    <div className={`ed-wrap ${home.block}`}><HomeSmartStart membersOnly initialDate={today} knowledgeHref={knowledgeLinks[0]?.href||'/search'}/></div>

    {/* 5 · أقسام 967 as app icons */}
    <section id="home-sections" className={home.block} aria-labelledby="explore-title"><div className="ed-wrap">
      <BlockHead id="explore-title" icon={LayoutGrid} title="أقسام 967" href="/explore" linkLabel="استكشف"/>
      <SectionLauncher isVisible={href => pageIsVisible(href, settings.pageVisibility, settings.contentPages||[])}/>
    </div></section>

    {/* 6 · ألعاب 967 */}
    {visible('games')&&<section id="home-games" className={home.block} aria-labelledby="home-games-title"><div className="ed-wrap">
      <BlockHead id="home-games-title" icon={Sparkles} title="ألعاب 967" href="/games" linkLabel="كل الألعاب" hue="var(--c-violet)"/>
      <GamesStrip dailyHref={dailyGameUrl(today)} dailyTitle={DAILY_GAME_TITLES[dailyGame]}/>
    </div></section>}

    {/* 7 · مدرسة 967 */}
    {visible('school')&&<section id="home-school" className={home.block} aria-labelledby="home-school-title"><div className="ed-wrap">
      <BlockHead id="home-school-title" icon={GraduationCap} title="مدرسة 967" href="/school" linkLabel="كل المسارات" hue="var(--c-leaf)"/>
      <SchoolStrip/>
    </div></section>}

    {/* 8 · من المعرفة */}
    {knowledgeLinks.length > 0 && <section id="explore-knowledge" className={home.block} aria-labelledby="home-knowledge-title"><div className="ed-wrap">
      <BlockHead id="home-knowledge-title" icon={Compass} title="اعرف اليمن" href="/explore" linkLabel="المعرفة" hue="var(--c-teal)"/>
      <KnowledgeRail items={knowledgeLinks}/>
    </div></section>}

    {/* 9 · أرقام */}
    {visible('statistics') && moreNumbers.length > 0 && <section className={home.block} aria-labelledby="numbers-title"><div className="ed-wrap">
      <BlockHead id="numbers-title" icon={BarChart3} title="أرقام تهمّك" href="/yemen-in-numbers" linkLabel="اليمن بالأرقام" hue="var(--c-indigo)" Link={Link}/>
      <Resilient name="home-data" quiet><NumbersRail indicators={moreNumbers}/></Resilient>
    </div></section>}

    {/* 10 · من الناس ومن البلد */}
    {(visible('products')||visible('professionals')||visible('atlas'))&&<section className={home.block} aria-labelledby="community-title"><div className="ed-wrap">
      <BlockHead id="community-title" icon={UsersRound} title="من الناس ومن البلد" hue="var(--c-amber)"/>
      <Resilient name="home-community" quiet><CommunityRows company={content.company} professional={content.professional} showCompany={visible('products')} showProfessional={visible('professionals')} showAtlas={visible('atlas')}/></Resilient>
    </div></section>}

    {/* 11 · ساهم معنا */}
    {visible('contribute')&&<section className={home.block} id="contact" aria-labelledby="contact-title"><div className="ed-wrap">
      <InviteBanner eyebrow={settings.participationEyebrow} title={settings.participationTitle} label={settings.participationButtonLabel}/>
    </div></section>}

    {/* 12 · عن المبادرة ومشاريعها */}
    <section className={home.block} aria-label="عن المبادرة ومشاريعها"><div className={`ed-wrap ${styles.about}`}>
      <OpenFoldOnHash/>
      <details id="about" className={styles.fold}><summary><span><span className="ed-kicker">تعرّف على 967</span><h2>مساحة تتسع لنا جميعًا.</h2></span><ChevronDown size={22} aria-hidden="true"/></summary><div className={styles.foldBody}>
        <h3>{settings.aboutTitle}</h3><p>{settings.aboutDescription}</p>
        {settings.aboutTags?.length > 0 && <ul className={styles.tags}>{settings.aboutTags.map((tag, index) => <li key={index}>{tag}</li>)}</ul>}
        <h3>رؤيتنا ورسالتنا</h3><p>{settings.aboutVision}</p><h3>مجالات عملنا</h3><p>{settings.aboutFields}</p>
        <Link href="/about" className="ed-link">المزيد عن المبادرة</Link>
      </div></details>
      <details id="projects" className={styles.fold}><summary><span><span className="ed-kicker">من الفكرة إلى الأثر</span><h2>مسارات نعمل على تطويرها.</h2></span><ChevronDown size={22} aria-hidden="true"/></summary><div className={styles.foldBody}>
        <ul className={styles.projects}>{[
          {icon:MapPin, title:'967 في الشارع', status:'مخطط له', text:'لقاءات واستطلاعات ميدانية للاستماع إلى تجارب الناس وأسئلتهم.'},
          {icon:MessagesSquare, title:'مناظرات 967', status:settings.debatesProjectStatus, href:'/debates', text:'حوارات منظمة تتيح للرؤى المختلفة مساحة للفهم والنقاش.'},
          {icon:Handshake, title:'مشاريع مجتمعية', status:'مخطط لها', text:'مبادرات في المعرفة والخدمات والمشاركة تُعلن عند إطلاقها.'},
        ].filter(item => !item.href || pageIsVisible(item.href, settings.pageVisibility)).map(({icon:Icon, title, status, text, href}) => <li key={title}><span className={styles.projectIcon}><Icon size={20} aria-hidden="true"/></span><div><h3>{href ? <Link href={href}>{title}</Link> : title}</h3><p>{text}</p>{status && <span className="ed-status" data-tone="neutral">{status}</span>}</div></li>)}</ul>
      </div></details>
    </div></section>
  </div>;
}
