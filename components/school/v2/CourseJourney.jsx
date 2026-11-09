'use client';
// مدرسة 967 — الإصدار الثاني: خريطة رحلة المسار. وحدات، عقد بحسب نوع الدرس، نجوم الإتقان، وزر متابعة واحد.
// الفتح بالإكمال كما في الخادم؛ الزائر يرى الدرس الأول مفتوحًا والباقي يحتاج حسابًا.
import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, BookOpen, FlaskConical, Hammer, Signpost, Search, Sparkles, Trophy, LockKeyhole, Star, MapPin, LogIn, UserRoundPlus} from 'lucide-react';
import {currentSession} from '@/lib/browserSession';
import {journeyUnits, journeyState} from '@/lib/schoolJourney';
import styles from './CourseJourney.module.css';

const TEMPLATE = {
  story: {icon: BookOpen, label: 'قصة'},
  lab: {icon: FlaskConical, label: 'مختبر'},
  build: {icon: Hammer, label: 'ابنِ بنفسك'},
  decision: {icon: Signpost, label: 'مسار قرارات'},
  spot: {icon: Search, label: 'اكتشف الخطأ'},
  mixed: {icon: Sparkles, label: 'متنوع'},
};
const ZIG = [0, 1, 2, 1];

function Stars({n, label}) {
  return <span className={styles.stars} aria-label={label ?? `${n} من 3 نجوم`}>
    {[1, 2, 3].map(i => <Star key={i} size={14} aria-hidden="true" fill={i <= n ? 'currentColor' : 'none'} data-on={i <= n || undefined}/>)}
  </span>;
}

export default function CourseJourney({backHref, slug, title, description, units: authoredUnits, capstone, stages, fixtures = null}) {
  const [progress, setProgress] = useState({loading: true, guest: false, error: '', stages: null, staff: false});
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = {session: await currentSession()};
        const token = data?.session?.access_token;
        if (!token) { if (alive) setProgress({loading: false, guest: true, error: '', stages: null, staff: false}); return; }
        const res = await fetch('/api/school/custom?slug=' + encodeURIComponent(slug), {cache: 'no-store', headers: {Authorization: 'Bearer ' + token}});
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw Error(json.error || 'تعذر قراءة تقدمك.');
        if (alive) setProgress({loading: false, guest: false, error: '', stages: json.stages, staff: Boolean(json.staffPreview)});
      } catch (e) { if (alive) setProgress({loading: false, guest: false, error: e.message, stages: null, staff: false}); }
    })();
    return () => { alive = false; };
  }, [slug]);

  const units = useMemo(() => journeyUnits(stages, authoredUnits), [stages, authoredUnits]);
  const state = useMemo(() => journeyState(stages, progress), [stages, progress]);
  const href = index => '/school/courses/' + slug + '/' + (index + 1) + (fixtures?.[index] ? '?fixture=' + fixtures[index] : '');
  const back = '/school/courses/' + slug;
  const current = stages.find(s => s.index === state.current);

  return <div className={styles.journey} dir="rtl">
    {backHref && <Link className={styles.back} href={backHref}><ArrowRight size={16} aria-hidden="true"/> جميع المسارات</Link>}
    <header className={styles.head}>
      <div className={styles.headText}>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        <p className={styles.stats}>{progress.guest ? `${stages.length} درسًا · الدرس الأول مفتوح للجميع` : `${state.done} من ${stages.length} درسًا · ${state.stars} نجوم`}</p>
        <div className={styles.bar} role="progressbar" aria-label="تقدمك في المسار" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={state.done}><span style={{width: (stages.length ? state.done / stages.length * 100 : 0) + '%'}}/></div>
      </div>
      {current && !progress.loading && !progress.error && <Link className={styles.continue} href={href(current.index)}>
        {state.done === 0 ? 'ابدأ' : 'تابع'}: الدرس {current.index + 1} · {current.title} <ArrowLeft size={18} aria-hidden="true"/>
      </Link>}
      {state.finished && <p className={styles.finished}><Trophy size={18} aria-hidden="true"/> أنهيت دروس هذا المسار. يمكنك العودة إلى أي درس لرفع نجومه.</p>}
      {progress.guest && <div className={styles.guest}>
        <p>أنشئ حسابًا لتحفظ تقدمك ونجومك وتفتح بقية الدروس.</p>
        <div><Link href={'/register?next=' + encodeURIComponent(back)}><UserRoundPlus size={16} aria-hidden="true"/> إنشاء حساب</Link><Link href={'/login?next=' + encodeURIComponent(back)}><LogIn size={16} aria-hidden="true"/> تسجيل الدخول</Link></div>
      </div>}
      {progress.loading && <p className={styles.muted} role="status">جارٍ تحميل تقدمك…</p>}
      {progress.error && <p className={styles.error} role="alert">تعذر تحميل تقدمك: {progress.error}</p>}
    </header>

    {units.map((unit, u) => {
      const items = unit.stages.map(i => stages.find(s => s.index === i)).filter(Boolean);
      const doneCount = items.filter(s => state.byIndex[s.index]?.done).length;
      const allLocked = items.every(s => state.byIndex[s.index]?.status === 'locked');
      const body = <ol className={styles.nodes}>
        {items.map((s, k) => {
          const st = state.byIndex[s.index] || {status: 'locked', stars: 0};
          const tpl = s.index === capstone ? {icon: Trophy, label: 'مشروع ختامي'} : TEMPLATE[s.template] || {icon: BookOpen, label: 'درس'};
          const Icon = st.status === 'locked' ? LockKeyhole : tpl.icon;
          const meta = [tpl.label, s.minutes ? `${s.minutes} دقائق` : ''].filter(Boolean).join(' · ');
          const inner = <>
            <span className={styles.node} aria-hidden="true"><Icon size={26} strokeWidth={1.8}/></span>
            <span className={styles.nodeText}>
              {st.status === 'current' && <span className={styles.here}><MapPin size={13} aria-hidden="true"/> أنت هنا</span>}
              <strong>{s.title}</strong>
              <small>{meta}</small>
              {st.done && <Stars n={st.stars}/>}
              {st.status === 'locked' && <small className={styles.lockNote}>{progress.guest ? 'يحتاج حسابًا' : 'يُفتح بعد إكمال الدرس السابق'}</small>}
            </span>
          </>;
          return <li key={s.index} className={styles.item} data-status={st.status} data-zig={ZIG[k % 4]}>
            {st.status === 'locked' || st.status === 'pending'
              ? <div className={styles.link} aria-disabled="true">{inner}</div>
              : <Link className={styles.link} href={href(s.index)} aria-label={`الدرس ${s.index + 1}: ${s.title}${st.done ? `، ${st.stars} من 3 نجوم` : st.status === 'current' ? '، أنت هنا' : ''}`}>{inner}</Link>}
          </li>;
        })}
      </ol>;
      const headText = <><span className={styles.unitNo}>الوحدة {u + 1}</span><h2>{unit.title}</h2>
        <span className={styles.unitState}>{doneCount === items.length && items.length ? 'مكتملة' : allLocked ? `${items.length} دروس مقفلة` : `${doneCount} من ${items.length}`}</span></>;
      return <section key={u} className={styles.unit} aria-label={`الوحدة ${u + 1}: ${unit.title}`} data-locked={allLocked || undefined}>
        {allLocked && !progress.loading
          ? <details className={styles.unitDetails}><summary className={styles.unitHead}>{headText}</summary>{body}</details>
          : <><div className={styles.unitHead}>{headText}</div>{body}</>}
      </section>;
    })}
  </div>;
}
