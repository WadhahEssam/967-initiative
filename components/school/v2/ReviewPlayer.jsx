'use client';
// مدرسة 967 — مراجعة اليوم: 5 بطاقات من دروس أنهيتها، محاولة واحدة لكل بطاقة ثم الشرح. لا نقاط ولا أثر على التقدم.
import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import useFullScreenDialog from './useFullScreenDialog';
import Link from 'next/link';
import {X, Check, RotateCcw, CalendarCheck2} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import CardVisual from './CardVisual';
import CardTask, {taskReady} from './CardTask';
import styles from './CardLessonPlayer.module.css';

const REASON = {due: 'راجِع خطأك', mistake: 'خطأ سابق', practice: 'تدريب'};

async function call(method, body) {
  const db = browserDb(), {data} = await db?.auth.getSession() || {};
  const token = data?.session?.access_token;
  if (!token) return {guest: true};
  const res = await fetch('/api/school/review', {method, cache: 'no-store', headers: {Authorization: 'Bearer ' + token, ...(body ? {'Content-Type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(json.error || 'تعذر الاتصال بالمراجعة.');
  return json;
}

function Review() {
  const [mode, setMode] = useState('loading'); // loading | login | empty | playing | done | error
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    call('GET').then(r => {
      if (!alive) return;
      if (r.guest) return setMode('login');
      setItems(r.items || []); setMode(r.items?.length ? 'playing' : 'empty');
    }).catch(e => { if (alive) { setError(e.message); setMode('error'); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const item = items[index];
  const key = item ? item.slug + ':' + item.stage + ':' + item.cardId : '';
  const fb = results[key];
  const check = useCallback(async () => {
    if (!item || busy || !taskReady(item.card.task, values[key])) return;
    setBusy(true); setError('');
    try {
      const r = await call('POST', {action: 'check', slug: item.slug, stage: item.stage, cardId: item.cardId, answer: values[key]});
      if (r.guest) { setMode('login'); return; } // انتهت الجلسة أثناء المراجعة
      setResults(s => ({...s, [key]: r}));
    }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [item, busy, values, key]);
  const next = () => { if (index < items.length - 1) setIndex(i => i + 1); else setMode('done'); };

  if (mode === 'loading') return <div className={styles.shell}><p className={styles.center}>جارٍ تحضير مراجعة اليوم…</p></div>;
  if (mode !== 'playing') {
    const right = Object.values(results).filter(r => r.correct).length;
    const copy = {
      login: ['سجّل الدخول لمراجعة دروسك', 'المراجعة تعتمد على الدروس التي أنهيتها.'],
      empty: ['لا مراجعة اليوم', 'أنهِ دروسًا جديدة، وستعود إليك أخطاؤك هنا بعد يوم و3 أيام و7 أيام لتثبيتها.'],
      error: ['تعذر فتح المراجعة', error],
      done: ['أنهيت مراجعة اليوم', `${right} من ${items.length} إجابات صحيحة. عُد غدًا لمراجعة جديدة.`],
    }[mode];
    return <div className={styles.shell} dir="rtl"><div className={styles.center}>
      <CalendarCheck2 size={44} aria-hidden="true"/>
      <h1 className={styles.doneTitle}>{copy[0]}</h1><p>{copy[1]}</p>
      <div className={styles.doneActions}>
        {mode === 'login' && <Link className={styles.primary} href={'/login?next=' + encodeURIComponent('/school/review')}>تسجيل الدخول</Link>}
        <Link className={mode === 'login' ? styles.secondary : styles.primary} href="/school">العودة إلى المدرسة</Link>
      </div>
    </div></div>;
  }

  const primary = fb ? {label: index === items.length - 1 ? 'أنهِ المراجعة' : 'التالية', action: next, enabled: true}
    : {label: 'تحقق', action: check, enabled: !busy && taskReady(item.card.task, values[key])};
  return <div className={styles.shell} dir="rtl">
    <div className={styles.top}>
      <Link href="/school" className={styles.iconButton} aria-label="إغلاق المراجعة"><X size={22} aria-hidden="true"/></Link>
      <div className={styles.segments} role="progressbar" aria-label="تقدم المراجعة" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={index + 1}>
        {items.map((it, i) => <span key={i} data-state={i < index || results[it.slug + ':' + it.stage + ':' + it.cardId] ? 'done' : i === index ? 'current' : undefined}/>)}
      </div>
      <span className={styles.iconSpacer}/>
    </div>
    <section className={styles.stage} key={key} aria-label={'السؤال ' + (index + 1) + ' من ' + items.length}>
      <span className={styles.tag}>{REASON[item.reason] || 'مراجعة'} · {item.lessonTitle}</span>
      {item.card.title && <h1 className={styles.cardTitle}>{item.card.title}</h1>}
      <CardVisual visual={item.card.visual} task={item.card.task} value={values[key]}/>
      <CardTask task={item.card.task} value={values[key]} onChange={v => setValues(s => ({...s, [key]: v}))} locked={Boolean(fb || busy)} feedback={fb}/>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    {fb && <section className={styles.sheet} data-tone={fb.correct ? 'right' : 'reveal'} role="status" aria-live="polite">
      <strong>{fb.correct ? <><Check size={22} aria-hidden="true"/> أحسنت، ثبّتّها!</> : <><RotateCcw size={20} aria-hidden="true"/> هذه الإجابة الصحيحة</>}</strong>
      {fb.explain && <p>{fb.explain}</p>}
      {!fb.correct && item.again && <p>ستعود إليك هذه البطاقة بعد {item.again} {item.again === 1 ? 'يوم' : 'أيام'}.</p>}
    </section>}
    <div className={styles.bottom}>
      <button type="button" className={styles.primary} disabled={!primary.enabled} onClick={primary.action}>{busy ? '…' : primary.label}</button>
    </div>
  </div>;
}

// Full-screen modal dialog, like the lesson player (useFullScreenDialog).
export default function ReviewPlayer() {
  const host = useFullScreenDialog('مراجعة اليوم');
  if (!host) return <div className={styles.shell}><p className={styles.center}>جارٍ تحضير مراجعة اليوم…</p></div>;
  return createPortal(<Review/>, host);
}
