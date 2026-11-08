'use client';
// مدرسة 967 — الإصدار الثاني: مشغّل دروس البطاقات بملء الشاشة.
// المسجّل: البدء والتصحيح والإنهاء عبر /api/school/custom (المفاتيح على الخادم).
// الزائر: الدرس الأول فقط، يُصحح في المتصفح ويُحفظ محليًا، بلا نقاط.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import useFullScreenDialog from './useFullScreenDialog';
import Link from 'next/link';
import {X, Lightbulb, Check, RotateCcw, Star, ArrowLeft} from 'lucide-react';
import {browserDb} from '@/lib/supabase';
import {applyCardCheck, finishCards} from '@/lib/schoolCardProgress';
import CardVisual from './CardVisual';
import CardTask, {taskReady} from './CardTask';
import styles from './CardLessonPlayer.module.css';

const guestKey = (slug, index) => `967-school-v2:${slug}:${index}`;
const readLocal = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

async function api(body) {
  const db = browserDb(), {data} = await db?.auth.getSession() || {};
  const token = data?.session?.access_token;
  if (!token) return {guest: true};
  const res = await fetch('/api/school/custom', {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(json.error || 'تعذر الاتصال بالمدرسة.');
  return json;
}

// preview: معاينة المحرر — تصحيح محلي بلا خادم ولا حفظ، والإغلاق يعود إلى المحرر (onClose).
function Player({slug, stageIndex, lesson, guestSnapshot, courseTitle, hasNext, preview = false, onClose, closeLabel = 'العودة إلى المحرر'}) {
  const cards = lesson.cards;
  const mapHref = '/school/courses/' + slug;
  const [mode, setMode] = useState('loading'); // loading | playing | done | login | error
  const [attempt, setAttempt] = useState(null);
  const [progress, setProgress] = useState({});
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const [feedback, setFeedback] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState(null);
  const touch = useRef(null);
  const guest = !attempt;
  const card = cards[index];
  const fb = feedback[card?.id];
  const cardDone = !card?.task || progress[card.id]?.done;

  const firstOpen = useCallback(state => { const i = cards.findIndex(c => c.task && !state[c.id]?.done); return i < 0 ? cards.length - 1 : i; }, [cards]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (preview) { setProgress({}); setIndex(0); setMode('playing'); return; }
        const started = await api({action: 'start', slug, stage: stageIndex});
        if (!alive) return;
        if (started.guest) {
          if (!guestSnapshot) { setMode('login'); return; }
          const saved = readLocal(guestKey(slug, stageIndex))?.cards || {};
          setProgress(saved); setIndex(firstOpen(saved)); setMode('playing'); return;
        }
        const a = started.attempt;
        setAttempt(a); setProgress(a.cards || {}); setIndex(firstOpen(a.cards || {})); setMode('playing');
      } catch (e) { if (alive) { setError(e.message); setMode('error'); } }
    })();
    return () => { alive = false; };
  }, [slug, stageIndex, guestSnapshot, firstOpen, preview]);

  // وضع التركيز: إخفاء تمرير الصفحة خلف المشغّل.
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; }; }, []);

  const check = useCallback(async () => {
    if (!card?.task || busy || !taskReady(card.task, values[card.id])) return;
    setBusy(true); setError('');
    try {
      let outcome;
      if (guest) {
        const local = applyCardCheck(guestSnapshot, {cards: progress}, card.id, values[card.id]);
        if (local.error) throw Error(local.error);
        if (!preview) writeLocal(guestKey(slug, stageIndex), {cards: local.draft.cards});
        setProgress(local.draft.cards); outcome = local.result;
      } else {
        outcome = await api({action: 'check', slug, attemptId: attempt.id, cardId: card.id, answer: values[card.id]});
        setProgress(p => ({...p, [card.id]: {first: p[card.id]?.first ?? outcome.correct, done: outcome.done, tries: outcome.tries}}));
      }
      setFeedback(f => ({...f, [card.id]: outcome}));
      if (!outcome.correct && !outcome.done) setHint(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [card, busy, values, guest, guestSnapshot, progress, slug, stageIndex, attempt, preview]);

  const finish = useCallback(async () => {
    setBusy(true); setError('');
    try {
      if (guest) {
        const r = finishCards(guestSnapshot, {cards: progress});
        if (r.error) throw Error(r.error);
        setResult({...r, guest: !preview, preview});
      } else setResult(await api({action: 'submit', slug, attemptId: attempt.id}));
      setMode('done');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [guest, guestSnapshot, progress, slug, attempt, preview]);

  const next = useCallback(() => {
    setHint(false);
    if (index < cards.length - 1) setIndex(i => i + 1); else finish();
  }, [index, cards.length, finish]);

  const retry = useCallback(() => { setFeedback(f => ({...f, [card.id]: undefined})); }, [card]);

  const primary = useMemo(() => {
    if (!card) return null;
    if (!card.task || cardDone) return {label: index === cards.length - 1 ? 'أنهِ الدرس' : 'متابعة', action: next, enabled: !busy};
    if (fb && !fb.correct && !fb.done) return {label: 'حاول مرة أخرى', action: retry, enabled: true};
    return {label: 'تحقق', action: check, enabled: !busy && taskReady(card.task, values[card.id])};
  }, [card, cardDone, fb, index, cards.length, next, retry, check, busy, values]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Enter' && primary?.enabled && mode === 'playing' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); primary.action(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary, mode]);

  // لا سحب بين البطاقات من داخل مؤشر أو مختبر: السحب هناك جزء من التفاعل.
  const onTouchStart = e => { touch.current = e.target.closest?.('[data-noswipe],input,textarea') ? null : e.touches[0]?.clientX ?? null; };
  const onTouchEnd = e => {
    const start = touch.current; touch.current = null;
    const end = e.changedTouches[0]?.clientX; if (start == null || end == null) return;
    if (start - end > 70 && cardDone) next();            // سحب إلى اليسار: التالي
    if (end - start > 70 && index > 0) { setHint(false); setIndex(i => i - 1); } // سحب إلى اليمين: السابق للمراجعة
  };

  if (mode === 'loading') return <div className={styles.shell}><p className={styles.center}>جارٍ تحضير الدرس…</p></div>;
  if (mode === 'login' || mode === 'error') return <div className={styles.shell} dir="rtl">
    <div className={styles.center}>
      <h1 className={styles.doneTitle}>{mode === 'login' ? 'سجّل الدخول لتتابع هذا الدرس' : 'تعذر فتح الدرس'}</h1>
      <p>{mode === 'login' ? 'الدرس الأول من كل مسار مفتوح للجميع؛ أنشئ حسابًا لتتابع وتحفظ تقدمك ونقاطك.' : error}</p>
      {mode === 'login' && <div className={styles.doneActions}>
        <Link className={styles.primary} href={'/register?next=' + encodeURIComponent('/school/courses/' + slug + '/' + (stageIndex + 1))}>أنشئ حسابًا</Link>
        <Link className={styles.secondary} href={'/login?next=' + encodeURIComponent('/school/courses/' + slug + '/' + (stageIndex + 1))}>تسجيل الدخول</Link>
      </div>}
      <Link className={styles.secondary} href={mapHref}>العودة إلى خريطة المسار</Link>
    </div>
  </div>;

  if (mode === 'done') return <div className={styles.shell} dir="rtl">
    <section className={styles.doneHero}>
      <div className={styles.stars} aria-label={`${result.stars} من 3 نجوم`}>
        {[1, 2, 3].map(n => <Star key={n} size={n === 2 ? 58 : 44} aria-hidden="true" fill={n <= result.stars ? 'currentColor' : 'none'} data-on={n <= result.stars || undefined}/>)}
      </div>
      <h1 className={styles.doneTitle}>أنهيت درس «{lesson.title}»</h1>
      <p>{result.firstTry} من {result.total} إجابات صحيحة من أول محاولة</p>
      {!result.guest && !result.preview && !result.alreadySubmitted && <span className={styles.badge}>أُضيف إلى تقدمك</span>}
      {result.preview && <span className={styles.badge}>معاينة: لم يُحفظ شيء</span>}
    </section>
    <section className={styles.summary} aria-label="ما تعلمته">
      <h2>ما تعلمته</h2>
      <ol>{lesson.summary.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </section>
    {result.guest && <section className={styles.guestNote}>
      <p>أنشئ حسابًا لتحفظ تقدمك وتجمع النقاط وتتابع بقية الدروس.</p>
      <Link className={styles.primary} href={'/register?next=' + encodeURIComponent(mapHref)}>أنشئ حسابًا مجانًا</Link>
    </section>}
    <div className={styles.doneActions}>
      {preview && <button type="button" className={styles.primary} onClick={onClose}>{closeLabel}</button>}
      {!preview && hasNext && !result.guest && <Link className={styles.primary} href={'/school/courses/' + slug + '/' + (stageIndex + 2)}>الدرس التالي <ArrowLeft size={18} aria-hidden="true"/></Link>}
      {!preview && <Link className={styles.secondary} href={mapHref}>العودة إلى خريطة المسار</Link>}
    </div>
  </div>;

  return <div className={styles.shell} dir="rtl" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <div className={styles.top}>
      {preview
        ? <button type="button" className={styles.iconButton} style={{border: 0, background: 'transparent', cursor: 'pointer'}} aria-label="إغلاق المعاينة" onClick={onClose}><X size={22} aria-hidden="true"/></button>
        : <Link href={mapHref} className={styles.iconButton} aria-label={'إغلاق الدرس والعودة إلى ' + courseTitle}><X size={22} aria-hidden="true"/></Link>}
      <div className={styles.segments} role="progressbar" aria-label="تقدم الدرس" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={index + 1}>
        {cards.map((c, i) => <span key={c.id} data-state={i < index || progress[c.id]?.done ? 'done' : i === index ? 'current' : undefined}/>)}
      </div>
      {card?.task?.hint && !cardDone ? <button type="button" className={styles.hintButton} aria-pressed={hint} aria-label="تلميح" onClick={() => setHint(v => !v)}><Lightbulb size={20} aria-hidden="true"/></button> : <span className={styles.iconSpacer}/>}
    </div>

    <section className={styles.stage} key={card.id} aria-label={'البطاقة ' + (index + 1) + ' من ' + cards.length}>
      {card.role === 'hook' && <span className={styles.tag}>تحدٍّ</span>}
      {card.title && <h1 className={styles.cardTitle}>{card.title}</h1>}
      {card.text && <p className={styles.cardText}>{card.text}</p>}
      <CardVisual visual={card.visual} task={card.task} value={values[card.id]}/>
      <CardTask task={card.task} value={values[card.id]} onChange={v => setValues(s => ({...s, [card.id]: v}))} locked={Boolean(cardDone || (fb && !fb.correct && !fb.done) || busy)} feedback={fb}/>
      {hint && card.task?.hint && !cardDone && <p className={styles.hint} role="note"><Lightbulb size={16} aria-hidden="true"/> {card.task.hint}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>

    {fb && <section className={styles.sheet} data-tone={fb.correct ? 'right' : fb.done ? 'reveal' : 'wrong'} role="status" aria-live="polite">
      <strong>{fb.correct ? <><Check size={22} aria-hidden="true"/> أحسنت!</> : fb.done ? 'لا بأس، هذه الإجابة الصحيحة' : <><RotateCcw size={20} aria-hidden="true"/> ليست هذه. فكّر مرة أخرى</>}</strong>
      {fb.explain && <p>{fb.explain}</p>}
      {!fb.correct && !fb.done && card.task?.hint && <p>تلميح: {card.task.hint}</p>}
    </section>}

    <div className={styles.bottom}>
      <button type="button" className={styles.primary} disabled={!primary?.enabled} onClick={() => primary?.action()}>{busy ? '…' : primary?.label}</button>
    </div>
  </div>;
}

// يُرسم المشغّل داخل body مباشرة: عنصر main في الموقع يعزل الطبقات (isolation)، فيبقى الرأس فوق أي طبقة ثابتة داخله.
// المشغّل نافذة حوارية تملأ الشاشة (useFullScreenDialog): ما خلفه من الموقع يصبح inert ما دام مفتوحًا.
export default function CardLessonPlayer(props) {
  const host = useFullScreenDialog(props.lesson?.title ? 'درس: ' + props.lesson.title : 'درس');
  if (!host) return <div className={styles.shell}><p className={styles.center}>جارٍ تحضير الدرس…</p></div>;
  return createPortal(<Player {...props}/>, host);
}
