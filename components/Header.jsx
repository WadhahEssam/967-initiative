'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Bookmark, ChevronDown, ChevronRight, Compass, Gamepad2, GraduationCap, House, Menu, Search, UserRound, X} from 'lucide-react';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';
import useSessionDb from './useSessionDb';
import {usePageVisibility} from './PageVisibilityProvider';
import {resolveNavSections, utilityLinks} from '@/lib/navigation';
import {appBarPlace} from '@/lib/appBar';
import {messageBadgeCount,messageBadgeLabel} from '@/lib/messageBadge';
import NotificationBell from './notifications/NotificationBell';
import {advanceMessageAlert,playMessageChime} from '@/lib/messageSound';
import {readEditorFlag, writeEditorFlag} from './editorFlag';
import {createRefreshThrottle} from '@/lib/authEvents';

// Masthead: one row on wide screens, a menu sheet below 1100px.
// Sections come from lib/navigation.js, shared with the footer and home doors.
export default function Header({actionLabel = 'ساهم معنا', contentLinks = []}) {
  const {visibility, isVisible} = usePageVisibility();
  const {db, ready: sessionReady} = useSessionDb();
  const sections = useMemo(() => resolveNavSections({contentLinks, visibility}).filter(section => !section.footerOnly).map(section => ({...section, links: section.links.filter(([href]) => isVisible(href))})).filter(section => section.links.length), [contentLinks, visibility, isVisible]);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [sessionUserId, setSessionUserId] = useState(null);
  const [messageCounts, setMessageCounts] = useState({unread:0,requests:0});
  const [latestConversation, setLatestConversation] = useState(null);
  const messageAudioRef = useRef(null);
  const messageAlertRef = useRef({initialized:false,latest:0});
  // Read by the message poll without restarting it on every navigation.
  const pathRef = useRef(path);
  useEffect(() => {pathRef.current = path;}, [path]);
  const header = useRef(null);
  // Remembers that the visitor reached this page from another page of the site (used by back buttons).
  const lastPath = useRef(null);
  useEffect(() => { if (lastPath.current && lastPath.current !== path) { try { sessionStorage.setItem('967-came-from', lastPath.current); } catch {} } lastPath.current = path; }, [path]);
  const toggle = useRef(null);
  const mobileToggle = useRef(null);
  const menuOpener = useRef(null);
  const toggleMenu = event => {if (!open) menuOpener.current=event.currentTarget; setOpen(value=>!value);};
  const closeDisclosures = () => header.current?.querySelectorAll('details[open]').forEach(item => item.removeAttribute('open'));
  const close = () => {setOpen(false); closeDisclosures();};
  useEffect(() => {setOpen(false); closeDisclosures();}, [path]);
  useEffect(() => {
    if (open) header.current?.querySelector('#main-navigation a, #main-navigation input')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const mobile = window.matchMedia('(max-width: 1179px)');
    if (!mobile.matches) {setOpen(false); return;}
    // The sheet scrolls on its own; background content and footer must not take focus.
    const oldOverflow = document.body.style.overflow;
    const background = [document.getElementById('content'), document.querySelector('.ed-footer')].filter(Boolean);
    const previous = background.map(node => node.inert);
    document.body.style.overflow = 'hidden';
    background.forEach(node => {node.inert = true;});
    const onViewportChange = () => {if (!mobile.matches) setOpen(false);};
    mobile.addEventListener('change', onViewportChange);
    return () => {
      mobile.removeEventListener('change', onViewportChange);
      document.body.style.overflow = oldOverflow;
      background.forEach((node, index) => {node.inert = previous[index];});
    };
  }, [open]);
  useEffect(() => {
    if (!db) {if (sessionReady) setSignedIn(false); return;}
    let active = true;
    let sessionChanged = false;
    let requestId = 0;
    const timers = new Set();
    const updateSession = session => {
      if (!active) return;
      const currentRequest = ++requestId;
      setSignedIn(Boolean(session?.user));
      setSessionUserId(session?.user?.id || null);
      setCanEdit(false);
      if (!session?.user) return;
      // The edit link only decides what the menu shows (every editing API checks the role on the
      // server), so a recent answer is reused instead of querying the editors table on every page.
      const cached = readEditorFlag(session.user.id);
      if (cached !== null) { setCanEdit(cached); return; }
      // Run database calls after Supabase has released its auth event lock.
      const timer = window.setTimeout(async () => {
        timers.delete(timer);
        if (!active || currentRequest !== requestId) return;
        try {
          let {data, error} = await db.from('editors').select('user_id,role').eq('user_id', session.user.id).maybeSingle();
          // Match the dashboard's compatibility with installations predating editor roles.
          if (error && /role/i.test(error.message || '') && ['42703', 'PGRST204'].includes(error.code)) {
            const legacy = await db.from('editors').select('user_id').eq('user_id', session.user.id).maybeSingle();
            data = legacy.data ? {...legacy.data, role: 'admin'} : null;
            error = legacy.error;
          }
          const allowed = !error && Boolean(data) && ['admin', 'management'].includes(data.role);
          if (!error) writeEditorFlag(session.user.id, allowed);
          if (active && currentRequest === requestId) setCanEdit(allowed);
        } catch {
          if (active && currentRequest === requestId) setCanEdit(false);
        }
      }, 0);
      timers.add(timer);
    };
    const {data: {subscription}} = db.auth.onAuthStateChange((_event, session) => {
      sessionChanged = true;
      updateSession(session);
    });
    db.auth.getSession().then(({data}) => {
      if (active && !sessionChanged) updateSession(data.session);
    }).catch(() => {
      if (active && !sessionChanged) updateSession(null);
    });
    return () => {active = false; requestId++; timers.forEach(timer => window.clearTimeout(timer)); subscription.unsubscribe();};
  }, [db, sessionReady]);
  // A click or key press unlocks audio where browser policy permits it.
  // Never try to bypass browser autoplay restrictions or create an audio
  // context merely because a new message arrived.
  useEffect(() => {
    messageAlertRef.current={initialized:false,latest:0};
    if (!sessionUserId) {
      const old=messageAudioRef.current;
      messageAudioRef.current=null;
      if(old)void old.close().catch(()=>{});
      return;
    }
    const unlock = () => {
      try {
        const AudioContextClass=window.AudioContext||window.webkitAudioContext;
        if(!AudioContextClass)return;
        let context=messageAudioRef.current;
        if(!context||context.state==='closed'){
          context=new AudioContextClass();
          messageAudioRef.current=context;
        }
        if(context.state==='suspended')void context.resume().catch(()=>{});
      }catch{/* Some browsers restrict Web Audio even after interaction. */}
    };
    window.addEventListener('pointerdown',unlock,{passive:true});
    window.addEventListener('keydown',unlock);
    return () => {
      window.removeEventListener('pointerdown',unlock);
      window.removeEventListener('keydown',unlock);
    };
  },[sessionUserId]);
  // The header badge uses a summary request while the page is visible: once on sign-in, every
  // minute, when a message action announces a change, and on returning to the tab (at most every
  // 15 s, since focus and visibilitychange both fire). Navigating between pages does not refetch.
  // No always-on Realtime socket is required on the Supabase free tier.
  useEffect(() => {
    if (!db || !sessionUserId) {
      setMessageCounts({unread:0,requests:0});
      return;
    }
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (!active || pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const {data,error} = await db.auth.getSession();
        if (!active) return;
        const session = data?.session;
        if (error || !session?.access_token || session.user?.id !== sessionUserId) {
          setMessageCounts({unread:0,requests:0});
          return;
        }
        const response = await fetch('/api/messages?mode=summary', {
          headers:{Authorization:'Bearer '+session.access_token},
          cache:'no-store',
        });
        if (!active) return;
        if (response.ok) {
          const result = await response.json();
          if (active) {
            setMessageCounts({unread:result.unread,requests:result.requests,market:result.market});
            setLatestConversation(result.latest||null);
            // «سوق 967» shows its own chat count from this same summary (no second request).
            window.__967MarketUnread=Number(result.market)||0;
            window.dispatchEvent(new CustomEvent('967:market-unread',{detail:window.__967MarketUnread}));
            const decision=advanceMessageAlert(messageAlertRef.current,result,pathRef.current);
            messageAlertRef.current=decision.state;
            if(decision.play)playMessageChime(messageAudioRef.current);
          }
        } else if (response.status===401 || response.status===403) {
          setMessageCounts({unread:0,requests:0});
        }
      } catch {
        // Retain the last confirmed badge if the network temporarily fails.
      } finally {
        pending = false;
      }
    };
    const returning = createRefreshThrottle(15000);
    const onReturn = () => {if (document.visibilityState==='visible' && returning.due()) {returning.mark(); void refresh();}};
    returning.mark();
    void refresh();
    const timer = window.setInterval(refresh,60000);
    const onVisibility = onReturn;
    window.addEventListener('focus',onReturn);
    window.addEventListener('967:messages-changed',refresh);
    document.addEventListener('visibilitychange',onVisibility);
    return () => {
      active=false;
      window.clearInterval(timer);
      window.removeEventListener('focus',onReturn);
      window.removeEventListener('967:messages-changed',refresh);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  }, [db,sessionUserId]);
  const newMessageCount=messageBadgeCount(messageCounts);
  const messageCountText=messageBadgeLabel(newMessageCount);
  const messageLinkLabel=newMessageCount
    ? 'الرسائل الخاصة — '+newMessageCount+' رسالة أو طلب محادثة غير مقروء'
    : 'الرسائل الخاصة';

  useEffect(() => {
    const onKey = event => {
      const disclosure = header.current?.querySelector('.ed-nav-group[open]');
      const mobileOpen = toggle.current?.getAttribute('aria-expanded') === 'true' || mobileToggle.current?.getAttribute('aria-expanded') === 'true';
      if (event.key === 'Escape' && (mobileOpen || disclosure)) {
        close();
        if (mobileOpen) {
          const trigger=menuOpener.current;
          (trigger?.getClientRects().length ? trigger : (mobileToggle.current?.getClientRects().length ? mobileToggle.current : toggle.current))?.focus();
        } else disclosure?.querySelector('summary')?.focus();
      }
    };
    const onClick = event => {if (!header.current?.contains(event.target)) close();};
    const onFocus = event => {if (!header.current?.contains(event.target)) close();};
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    document.addEventListener('focusin', onFocus);
    return () => {document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onClick); document.removeEventListener('focusin', onFocus);};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners are attached once; close() only calls state setters and DOM queries
  }, []);
  const active = href => href !== '/' && !href.includes('#') && (path === href || path.startsWith(href + '/'));
  const sectionActive = section => section.links.some(([href]) => active(href));
  const mobileSectionActive = id => sections.some(section => section.id === id && sectionActive(section));
  // Sections without their own tab live behind the phone menu button, so its
  // label tells screen-reader users which of those sections they are in.
  const mobileMenuSection = sections.find(section => !['media','knowledge'].includes(section.id) && sectionActive(section));
  const onlyOneOpen = event => {if (event.currentTarget.open) header.current?.querySelectorAll('.ed-nav-group[open]').forEach(item => {if (item !== event.currentTarget) item.removeAttribute('open');});};
  // Signing in from the header returns to this page.
  const loginHref = path && path !== '/' && !/^\/(login|register|forgot-password|update-password|auth)(\/|$)/.test(path) ? '/login?next=' + encodeURIComponent(path) : '/login';
  const account = signedIn === true ? (canEdit ? utilityLinks.editor : utilityLinks.account) : signedIn === false ? [loginHref, utilityLinks.login[1]] : null;
  const savedVisible = isVisible(utilityLinks.saved[0]);
  // Timed games, lesson stages, the PDF reader and admin keep the whole screen.
  const immersive = /^\/(games\/.+|school\/.+\/.+|magazine\/.+|admin)/.test(path || '');
  // App bar (phones): where you are, and on detail pages a tap back to the list.
  const place = appBarPlace(path);
  // Phone tabs are jobs, not content types: today, explore, learn, play, you.
  const exploreActive = path === '/explore' || path === '/search' || ['media', 'knowledge', 'directories', 'services', 'initiative'].some(id => mobileSectionActive(id));
  const youHref = signedIn ? '/account' : loginHref;
  const youActive = /^\/(account|messages|notifications|read-later|login|register)(\/|$)/.test(path || '');

  return <header className="ed-header" ref={header} data-open={open || undefined} data-tabbar={!immersive || undefined}>
    <div className="ed-header-inner">
      <button ref={mobileToggle} type="button" className="ed-tool ed-menu-toggle ed-mobile-menu-toggle" aria-controls="main-navigation" aria-label={open ? 'إغلاق القائمة' : mobileMenuSection ? 'فتح القائمة، القسم الحالي: '+mobileMenuSection.label : 'فتح القائمة'} aria-expanded={open} onClick={toggleMenu}>{open ? <X size={22} aria-hidden="true"/> : <Menu size={22} aria-hidden="true"/>}</button>
      <Link href="/" className="ed-brand" onClick={close} aria-label="مبادرة 967 — الرئيسية"><BrandLogo priority className="ed-brand-mark"/></Link>
      {place && (place.isRoot
        ? <span className="ed-appbar-place" aria-hidden="true">{place.label}</span>
        : <Link href={place.href} className="ed-appbar-place ed-appbar-back" onClick={close} aria-label={'رجوع إلى '+place.label}><ChevronRight size={18} aria-hidden="true"/>{place.label}</Link>)}
      <nav id="main-navigation" className="ed-nav" aria-label="التنقل الرئيسي">
        <form action="/search" role="search" className="ed-nav-search">
          <label htmlFor="menu-search" className="sr-only">ابحث في منصة 967</label>
          <Search size={18} aria-hidden="true"/>
          <input id="menu-search" name="q" type="search" placeholder="ابحث في منصة 967" maxLength={150} suppressHydrationWarning/>
          <button type="submit">ابحث</button>
        </form>
        <ul className="ed-nav-list">
          {sections.map(section => <li key={section.id} className="ed-nav-item" data-section={section.id}>
            {section.standalone && <Link className="ed-nav-direct" href={section.links[0][0]} aria-current={active(section.links[0][0]) || sectionActive(section) ? 'page' : undefined} onClick={close}>{section.label}</Link>}
            <details className="ed-nav-group" data-standalone={section.standalone || undefined} data-active={sectionActive(section) || undefined} onToggle={onlyOneOpen}>
              <summary>{section.label}<ChevronDown size={15} aria-hidden="true"/></summary>
              <div className="ed-nav-panel">
                <p className="ed-nav-lead">{section.description}</p>
                <ul>{section.links.map(([href, label]) => <li key={href}><Link href={href} aria-current={active(href) ? 'page' : undefined} onClick={close}>{label}</Link></li>)}</ul>
              </div>
            </details>
          </li>)}
        </ul>
        <div className="ed-nav-utility">
          {savedVisible && <Link href={utilityLinks.saved[0]} onClick={close}>{utilityLinks.saved[1]}</Link>}
          {signedIn && <Link href="/messages" aria-label={messageLinkLabel} aria-current={path==='/messages'?'page':undefined} onClick={close}>الرسائل{newMessageCount>0&&<span className="ed-message-menu-count" aria-hidden="true">{messageCountText}</span>}</Link>}
          {signedIn && <Link href="/notifications" aria-current={path==='/notifications'?'page':undefined} onClick={close}>الإشعارات</Link>}
          {account && <Link href={account[0]} aria-current={path === account[0] ? 'page' : undefined} onClick={close}>{account[1]}</Link>}
          <ThemeToggle labelled/>
          {isVisible('/contribute') && <Link href="/contribute" onClick={close}>{actionLabel}</Link>}
        </div>
      </nav>
      <div className="ed-tools">
        {/* One icon for notifications and private messages: the latest conversation sits on top. */}
        {signedIn&&<NotificationBell userId={sessionUserId} onNavigate={close} messages={{count:newMessageCount,latest:latestConversation}}/>}
        <Link href="/search" className="ed-tool ed-tool-icon ed-top-search" aria-label="البحث في المنصة" aria-current={path === '/search' ? 'page' : undefined} onClick={close}><Search size={20} aria-hidden="true"/></Link>
        {savedVisible && <Link href={utilityLinks.saved[0]} className="ed-tool ed-tool-icon ed-wide-only" aria-label={utilityLinks.saved[1]} title={utilityLinks.saved[1]} aria-current={path === utilityLinks.saved[0] ? 'page' : undefined} onClick={close}><Bookmark size={19} aria-hidden="true"/></Link>}
        {account && <Link href={account[0]} className="ed-tool ed-tool-text ed-wide-only" aria-current={path === account[0] ? 'page' : undefined} onClick={close}>{account[1]}</Link>}
        {isVisible('/contribute') && <Link href="/contribute" className="ed-tool ed-tool-cta ed-wide-only" onClick={close}>{actionLabel}</Link>}
        <button ref={toggle} type="button" className="ed-tool ed-menu-toggle" aria-controls="main-navigation" aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={open} onClick={toggleMenu}>{open ? <X size={22} aria-hidden="true"/> : <Menu size={22} aria-hidden="true"/>}<span className="ed-menu-word" aria-hidden="true">{open ? 'إغلاق' : 'القائمة'}</span></button>
      </div>
    </div>
    {/* Phones: five jobs — today, explore everything, learn, play, and you. */}
    {!immersive && <nav className="ed-tabbar" aria-label="التنقل السريع">
      <Link href="/" aria-current={path === '/' ? 'page' : undefined} onClick={close}><House size={21} aria-hidden="true"/><span>اليوم</span></Link>
      <Link href="/explore" aria-current={exploreActive ? 'page' : undefined} onClick={close}><Compass size={21} aria-hidden="true"/><span>استكشف</span></Link>
      {isVisible('/school') && <Link href="/school" aria-current={active('/school') ? 'page' : undefined} onClick={close}><GraduationCap size={21} aria-hidden="true"/><span>تعلّم</span></Link>}
      {isVisible('/games') && <Link href="/games" aria-current={active('/games') ? 'page' : undefined} onClick={close}><Gamepad2 size={21} aria-hidden="true"/><span>العب</span></Link>}
      <Link href={youHref} aria-current={youActive ? 'page' : undefined} aria-label={signedIn && newMessageCount > 0 ? 'أنت، '+messageLinkLabel : 'أنت: حسابك ومحفوظاتك ورسائلك'} onClick={close}><UserRound size={21} aria-hidden="true"/><span>أنت</span>{signedIn && newMessageCount > 0 && <span className="ed-tab-badge" aria-hidden="true">{messageCountText}</span>}</Link>
    </nav>}
  </header>;
}
