import Link from 'next/link';
import SafeImage from '@/components/front/SafeImage';
import {ArrowLeft, BarChart3, BookOpen, MessagesSquare, PlayCircle} from 'lucide-react';
import {formatArabicDate, formatCompact, formatYear} from '@/lib/format';
import styles from './TodayFeed.module.css';

const ICONS = {work: PlayCircle, debate: MessagesSquare, issue: BookOpen, indicator: BarChart3};
const HUES = {work: 'var(--c-ember)', debate: 'var(--c-plum)', issue: 'var(--c-ember)', indicator: 'var(--c-indigo)'};

function When({item}) {
  if (!item.date) return null;
  const label = formatArabicDate(item.date, {day: 'numeric', month: 'long', year: 'numeric'});
  return label ? <time dateTime={item.date}>{label}</time> : null;
}

function Figure({item}) {
  if (!item.figure) return null;
  return <p className={styles.figure}><bdi>{formatCompact(item.figure.value)}</bdi>{item.figure.unit && <span> {item.figure.unit}</span>}{formatYear(item.figure.year) && <small> · {formatYear(item.figure.year)}</small>}</p>;
}

function Lead({item}) {
  const Icon = ICONS[item.kind] || PlayCircle;
  return <Link href={item.href} className={styles.lead} style={{'--hue': HUES[item.kind]}}>
    {item.image
      ? <span className={styles.leadMedia}><SafeImage src={item.image} sizes="(max-width: 900px) calc(100vw - 32px), 680px" priority quality={60} placeholder={<span className={styles.fallback} aria-hidden="true"/>}/></span>
      : <span className={styles.leadMedia} data-empty><Icon size={40} aria-hidden="true"/></span>}
    <span className={styles.leadBody}>
      <span className={styles.kicker}><Icon size={15} aria-hidden="true"/>{item.label}{item.live && <b className={styles.live}>مباشر</b>}{item.meta && !item.live && <span className={styles.meta}>· {item.meta}</span>}</span>
      <strong className={styles.leadTitle}>{item.title}</strong>
      {item.summary && <span className={styles.summary}>{item.summary}</span>}
      <Figure item={item}/>
      <span className={styles.foot}><When item={item}/><span className={styles.go}>افتح <ArrowLeft size={15} aria-hidden="true"/></span></span>
    </span>
  </Link>;
}

function Row({item}) {
  const Icon = ICONS[item.kind] || PlayCircle;
  return <li><Link href={item.href} className={styles.row} style={{'--hue': HUES[item.kind]}}>
    {item.image
      ? <span className={styles.thumb}><SafeImage src={item.image} sizes="64px" quality={60} placeholder={<span className={styles.fallback} aria-hidden="true"/>}/></span>
      : <span className={styles.thumb} data-empty><Icon size={22} aria-hidden="true"/></span>}
    <span className={styles.rowBody}>
      <span className={styles.kicker}>{item.label}{item.live && <b className={styles.live}>مباشر</b>}{item.meta && !item.live && <span className={styles.meta}>· {item.meta}</span>}</span>
      <strong className={styles.rowTitle}>{item.title}</strong>
      <Figure item={item}/>
      <When item={item}/>
    </span>
  </Link></li>;
}

export default function TodayFeed({feed, failed = false}) {
  if (!feed?.lead) {
    return <div className={styles.empty} role="status">{failed ? 'تعذر تحميل الجديد الآن. أعد تحميل الصفحة بعد قليل.' : 'لا جديد منشورًا اليوم. استكشف أقسام المنصة من الأسفل.'}</div>;
  }
  return <div className={styles.feed}>
    <Lead item={feed.lead}/>
    {feed.rest.length > 0 && <ul className={styles.list}>{feed.rest.map(item => <Row key={item.key} item={item}/>)}</ul>}
  </div>;
}
