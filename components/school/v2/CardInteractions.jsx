'use client';
// مدرسة 967 — الإصدار الثاني: تفاعلات المرحلة 2 (ترتيب، توصيل، تصنيف، مؤشر، نقر على صورة، تصحيح خطأ، ملء فراغ، مختبر).
// كل التفاعلات تعمل بالنقر (تناسب اللمس ولوحة المفاتيح وقارئ الشاشة)، وتعرض الصواب بعد انتهاء المحاولتين.
import {useState} from 'react';
import dynamic from 'next/dynamic';
import {Check, FlaskConical, ArrowDown, Delete, RotateCcw} from 'lucide-react';
import {MUSNAD_ALPHABET} from '@/lib/schoolMusnad';
import CardVisual from './CardVisual';
import styles from './CardInteractions.module.css';

const MorseLab = dynamic(() => import('../MorseLab'), {ssr: false});
const LogicGatesLab = dynamic(() => import('../LogicGatesLab'), {ssr: false});
const ScienceLab = dynamic(() => import('../ScienceLab'), {ssr: false});
const CivicLab = dynamic(() => import('../CivicLab'), {ssr: false});

const fmt = n => typeof n === 'number' ? n.toLocaleString('en-US') : '';
const revealOf = feedback => feedback?.done && !feedback.correct ? feedback.reveal : undefined;

// ترتيب: اضغط العناصر بالترتيب فتنتقل إلى «ترتيبك»؛ اضغط عنصرًا مرتبًا لإعادته.
export function OrderTask({task, value, onChange, locked, feedback}) {
  const placed = Array.isArray(value) ? value : [];
  const pool = task.items.map((_, i) => i).filter(i => !placed.includes(i));
  const reveal = revealOf(feedback);
  return <div className={styles.block}>
    <ol className={styles.orderList} aria-label="ترتيبك">
      {task.items.map((_, slot) => {
        const item = placed[slot];
        return <li key={slot} className={styles.orderSlot} data-filled={item !== undefined || undefined}>
          <span className={styles.slotNo}>{slot + 1}</span>
          {item !== undefined
            ? <button type="button" className={styles.chip} disabled={locked} onClick={() => onChange(placed.filter(i => i !== item))} aria-label={task.items[item] + '، اضغط لإزالته من الترتيب'}>{task.items[item]}</button>
            : <span className={styles.slotEmpty}>{slot === placed.length ? 'اضغط العنصر التالي' : ''}</span>}
        </li>;
      })}
    </ol>
    {pool.length > 0 && <div className={styles.pool} aria-label="العناصر غير المرتبة">
      {pool.map(i => <button type="button" key={i} className={styles.chip} disabled={locked} onClick={() => onChange([...placed, i])}>{task.items[i]}</button>)}
    </div>}
    {Array.isArray(reveal) && <div className={styles.reveal}><strong>الترتيب الصحيح</strong><ol>{reveal.map(i => <li key={i}>{task.items[i]}</li>)}</ol></div>}
  </div>;
}

// توصيل: اختر عنصرًا من اليمين ثم ما يناسبه من اليسار. الرقم نفسه يظهر على الطرفين.
export function MatchTask({task, value, onChange, locked, feedback}) {
  const pairs = Array.isArray(value) ? value : Array(task.left.length).fill(null);
  const [active, setActive] = useState(null);
  const reveal = revealOf(feedback);
  const ownerOf = r => pairs.findIndex(p => p === r);
  const pickRight = r => {
    if (active === null) { const owner = ownerOf(r); if (owner >= 0) { const next = [...pairs]; next[owner] = null; onChange(next); } return; }
    const next = pairs.map(p => p === r ? null : p); next[active] = r; onChange(next);
    const free = next.findIndex(p => p === null); setActive(free >= 0 ? free : null);
  };
  return <div className={styles.block}>
    <div className={styles.match}>
      <div className={styles.matchCol} role="group" aria-label="العناصر">
        {task.left.map((label, i) => <button type="button" key={i} className={styles.matchItem} aria-pressed={active === i} disabled={locked}
          data-pair={pairs[i] !== null && pairs[i] !== undefined ? i % 6 : undefined} onClick={() => setActive(i)}>
          <span className={styles.pairNo}>{i + 1}</span><span>{label}</span>
        </button>)}
      </div>
      <div className={styles.matchCol} role="group" aria-label="ما يناسبها">
        {task.right.map((label, r) => {
          const owner = ownerOf(r);
          return <button type="button" key={r} className={styles.matchItem} disabled={locked} data-pair={owner >= 0 ? owner % 6 : undefined}
            aria-label={label + (owner >= 0 ? '، موصول بالعنصر ' + (owner + 1) : '')} onClick={() => pickRight(r)}>
            <span className={styles.pairNo}>{owner >= 0 ? owner + 1 : '–'}</span><span>{label}</span>
          </button>;
        })}
      </div>
    </div>
    {!locked && <p className={styles.helper}>{active === null ? 'اختر عنصرًا من العمود الأول.' : `اختر ما يناسب العنصر ${active + 1}.`}</p>}
    {Array.isArray(reveal) && <div className={styles.reveal}><strong>التوصيل الصحيح</strong><ul>{reveal.map((r, i) => <li key={i}>{task.left[i]} ← {task.right[r]}</li>)}</ul></div>}
  </div>;
}

// تصنيف: اختر عنصرًا ثم اضغط المجموعة المناسبة. اضغط عنصرًا داخل مجموعة لإعادته.
// بعد اختيار عنصر تبرز أسماء المجموعات (لون ونبض وعبارة «ضعه هنا») حتى تتضح الخطوة التالية.
export function BucketsTask({task, value, onChange, locked, feedback}) {
  const places = Array.isArray(value) ? value : Array(task.items.length).fill(null);
  const [active, setActive] = useState(null);
  const reveal = revealOf(feedback);
  const unsorted = task.items.map((_, i) => i).filter(i => places[i] === null || places[i] === undefined);
  const selected = active !== null && unsorted.includes(active) ? active : null;
  const armed = !locked && selected !== null;
  const place = b => {
    if (selected === null) return;
    const next = [...places]; next[selected] = b; onChange(next);
    setActive(null);
  };
  return <div className={styles.block}>
    {unsorted.length > 0 && <div className={styles.pool} aria-label="عناصر لم تُصنَّف بعد">
      {unsorted.map(i => <button type="button" key={i} className={styles.chip} aria-pressed={selected === i} disabled={locked} onClick={() => setActive(selected === i ? null : i)}>{task.items[i]}</button>)}
    </div>}
    {!locked && unsorted.length > 0 && <p className={styles.helper} data-step={armed ? 2 : 1} aria-live="polite">
      {armed ? <>الخطوة 2: اضغط اسم المجموعة المناسبة <ArrowDown size={14} aria-hidden="true"/></> : 'الخطوة 1: اضغط عنصرًا من القائمة.'}</p>}
    <div className={styles.buckets} data-count={task.buckets.length}>
      {task.buckets.map((name, b) => <div key={b} className={styles.bucket} data-armed={armed || undefined}>
        <button type="button" className={styles.bucketHead} disabled={!armed} onClick={() => place(b)}
          aria-label={armed ? `ضع «${task.items[selected]}» في ${name}` : name}>
          <span>{name}</span>{armed && <small className={styles.dropHint}><ArrowDown size={12} aria-hidden="true"/> ضعه هنا</small>}</button>
        <div className={styles.bucketBody}>
          {task.items.map((item, i) => places[i] === b && <button type="button" key={i} className={styles.chip} disabled={locked}
            data-wrong={Array.isArray(reveal) && reveal[i] !== b || undefined}
            onClick={() => { const next = [...places]; next[i] = null; onChange(next); setActive(i); }} aria-label={item + '، اضغط لإعادته'}>
            {item}{Array.isArray(reveal) && reveal[i] !== b && <small> ← {task.buckets[reveal[i]]}</small>}
          </button>)}
        </div>
      </div>)}
    </div>
  </div>;
}

// مؤشر: قدّر قيمة بتحريك المؤشر. لا يُعدّ جاهزًا حتى يحرّكه الطالب مرة على الأقل.
export function SliderTask({task, value, onChange, locked, feedback}) {
  const current = typeof value === 'number' ? value : task.initial;
  const reveal = revealOf(feedback);
  return <div className={styles.block} data-noswipe>
    <output className={styles.sliderValue} aria-live="polite">{fmt(current)}{task.unit ? ' ' + task.unit : ''}</output>
    <input type="range" dir="ltr" className={styles.range} min={task.min} max={task.max} step={task.step} value={current} disabled={locked}
      aria-label={task.prompt} aria-valuetext={fmt(current) + (task.unit ? ' ' + task.unit : '')} onChange={e => onChange(Number(e.target.value))}/>
    <div className={styles.rangeEnds} dir="ltr"><span>{fmt(task.min)}</span><span>{fmt(task.max)}</span></div>
    {typeof value !== 'number' && !locked && <p className={styles.helper}>حرّك المؤشر لتختار تقديرك.</p>}
    {typeof reveal === 'number' && <div className={styles.reveal}><strong>القيمة الصحيحة</strong><p>{fmt(reveal)}{task.unit ? ' ' + task.unit : ''}</p></div>}
  </div>;
}

// نقر على صورة: نقاط مرقمة فوق العنصر المرئي؛ يمكن اختيار أكثر من نقطة إن طلب السؤال ذلك.
export function HotspotTask({task, value, onChange, locked, feedback}) {
  const picked = Array.isArray(value) ? value : [];
  const reveal = revealOf(feedback);
  const toggle = id => onChange(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  return <div className={styles.block}>
    <div className={styles.hotspot}>
      <CardVisual visual={task.visual} bare/>
      {task.spots.map((s, i) => {
        const right = Array.isArray(reveal) && reveal.includes(s.id);
        return <button type="button" key={s.id} className={styles.spot} style={{left: s.x + '%', top: s.y + '%'}} disabled={locked}
          aria-pressed={picked.includes(s.id)} data-right={right || (feedback?.correct && picked.includes(s.id)) || undefined}
          aria-label={(s.label && feedback?.done ? s.label : 'الموضع ' + (i + 1))} onClick={() => toggle(s.id)}>{i + 1}</button>;
      })}
    </div>
    {feedback?.done && task.spots.some(s => s.label) && <ul className={styles.spotLegend}>{task.spots.map((s, i) => s.label && <li key={s.id}><b>{i + 1}</b> {s.label}</li>)}</ul>}
  </div>;
}

// تصحيح الخطأ: اضغط الجزء الخاطئ، ثم اختر ما يحل محله.
export function FixTask({task, value, onChange, locked, feedback}) {
  const v = value && typeof value === 'object' ? value : {};
  const reveal = revealOf(feedback);
  return <div className={styles.block}>
    <p className={styles.sentence}>
      {task.tokens.map((t, i) => <button type="button" key={i} className={styles.token} disabled={locked} aria-pressed={v.index === i}
        data-wrong={reveal && reveal.index === i || undefined} onClick={() => onChange({index: i, replacement: v.index === i ? v.replacement : undefined})}>{t}</button>)}
    </p>
    {Number.isInteger(v.index) && <div className={styles.fixChoices} role="radiogroup" aria-label={`تصحيح «${task.tokens[v.index]}»`}>
      <span className={styles.helper}>بدل «{task.tokens[v.index]}» ضع:</span>
      {task.choices.map((c, i) => <button type="button" role="radio" key={i} className={styles.chip} aria-checked={v.replacement === i} disabled={locked}
        onClick={() => onChange({index: v.index, replacement: i})}>{c}</button>)}
    </div>}
    {reveal && <div className={styles.reveal}><strong>التصحيح</strong><p>«{task.tokens[reveal.index]}» ← «{task.choices[reveal.replacement]}»</p></div>}
  </div>;
}

// ملء الفراغ: من بنك كلمات (نقر) أو كتابة مباشرة إن لم يوجد بنك.
export function GapTask({task, value, onChange, locked, feedback}) {
  const parts = task.text.split('___');
  const gaps = parts.length - 1;
  const fills = Array.isArray(value) ? value : Array(gaps).fill('');
  const reveal = revealOf(feedback);
  const set = (i, w) => { const next = [...fills]; next[i] = w; onChange(next); };
  const used = fills.filter(Boolean);
  return <div className={styles.block}>
    <p className={styles.gapSentence}>
      {parts.map((p, i) => <span key={i}>{p}{i < gaps && (task.bank
        ? <button type="button" className={styles.gap} disabled={locked || !fills[i]} data-filled={fills[i] ? true : undefined} onClick={() => set(i, '')}
          aria-label={fills[i] ? `الفراغ ${i + 1}: ${fills[i]}، اضغط لإفراغه` : `الفراغ ${i + 1} فارغ`}>{fills[i] || ' '}</button>
        : <input className={styles.gapInput} dir="auto" maxLength={60} value={fills[i] || ''} disabled={locked} aria-label={'الفراغ ' + (i + 1)} onChange={e => set(i, e.target.value)}/>)}</span>)}
    </p>
    {task.bank && <div className={styles.pool} aria-label="بنك الكلمات">
      {task.bank.map((w, i) => {
        const taken = used.filter(u => u === w).length >= task.bank.filter(b => b === w).length;
        return <button type="button" key={i} className={styles.chip} disabled={locked || taken} data-used={taken || undefined} onClick={() => { const empty = fills.findIndex(f => !f); if (empty >= 0) set(empty, w); }}>{w}</button>;
      })}
    </div>}
    {Array.isArray(reveal) && <div className={styles.reveal}><strong>الكلمات الصحيحة</strong><p>{reveal.join('، ')}</p></div>}
  </div>;
}

// مختبر: المختبرات العملية من الإصدار الأول؛ الدليل الذي تعيده التجربة هو الإجابة ويتحقق منه الخادم.
export function LabTask({task, value, onChange, locked}) {
  const lab = task.lab;
  const done = value && typeof value === 'object';
  const complete = proof => { if (!locked) onChange(proof); };
  return <div className={styles.block} data-noswipe>
    <div className={styles.lab}>
      {lab.kind === 'morse' && <MorseLab sample={lab.sample} onComplete={complete}/>}
      {lab.kind === 'gates' && <LogicGatesLab gate={lab.gate} onComplete={complete}/>}
      {lab.kind === 'science' && <ScienceLab lab={lab} source={lab.source} onComplete={complete}/>}
      {lab.kind === 'civic' && <CivicLab lab={lab} slug="" index={-1} onComplete={complete}/>}
    </div>
    <p className={styles.labStatus} data-done={done || undefined}>{done ? <><Check size={16} aria-hidden="true"/> اكتملت التجربة. اضغط «تحقق».</> : <><FlaskConical size={16} aria-hidden="true"/> أكمل التجربة ليظهر زر «تحقق».</>}</p>
  </div>;
}

// Musnad keys: the 29 letters and the word separator 𐩽.
const MUSNAD_KEYS = Object.fromEntries([...MUSNAD_ALPHABET.map(l => [l.id, l]), ['sep', {id: 'sep', glyph: '𐩽', name: 'فاصل'}]]);
const musnadLine = ids => ids.map(id => MUSNAD_KEYS[id]?.glyph || '').join('');
const COMPOSE_MAX = 80;

// Hands-on composition: tap letters in order to write the requested line in Musnad.
// Musnad is a right-to-left script, so the line grows to the left like Arabic.
export function ComposeTask({task, value, onChange, locked, feedback}) {
  const line = Array.isArray(value) ? value : [];
  const reveal = revealOf(feedback);
  // Without labels the letter names stay hidden (also from screen readers) until the answer is checked.
  const said = task.labels ? line.map(id => MUSNAD_KEYS[id]?.name).join('، ') : line.length + ' رموز';
  return <div className={styles.block} data-noswipe>
    <p className={styles.composeTarget}><span>اكتب بالمسند</span><strong>{task.target}</strong></p>
    <div className={styles.composeLine} dir="rtl" role="status" aria-live="polite" aria-label={line.length ? 'ما كتبته: ' + said : 'لم تكتب شيئًا بعد'}>
      {line.length ? <span lang="und">{musnadLine(line)}</span> : <span className={styles.slotEmpty}>اضغط الحروف أدناه بالترتيب</span>}
    </div>
    <div className={styles.composeTools}>
      <button type="button" className={styles.chip} disabled={locked || !line.length} onClick={() => onChange(line.slice(0, -1))}><Delete size={16} aria-hidden="true"/> احذف آخر حرف</button>
      <button type="button" className={styles.chip} disabled={locked || !line.length} onClick={() => onChange([])}><RotateCcw size={16} aria-hidden="true"/> امسح السطر</button>
      <span className={styles.composeCount}>{line.length} {line.length === 1 ? 'رمز' : 'رموز'}</span>
    </div>
    <div className={styles.composeKeys} role="group" aria-label="لوحة حروف المسند">
      {task.palette.map((id, i) => <button type="button" key={id} className={styles.composeKey} data-sep={id === 'sep' || undefined} disabled={locked || line.length >= COMPOSE_MAX}
        onClick={() => onChange([...line, id])} aria-label={task.labels || id === 'sep' ? 'أضف ' + MUSNAD_KEYS[id].name : 'الرمز ' + (i + 1)}><span lang="und">{MUSNAD_KEYS[id].glyph}</span>{(task.labels || id === 'sep') && <small>{MUSNAD_KEYS[id].name}</small>}</button>)}
    </div>
    {Array.isArray(reveal) && <div className={styles.reveal}><strong>الكتابة الصحيحة</strong><p className={styles.composeReveal} dir="rtl" lang="und">{musnadLine(reveal)}</p><p>{reveal.map(id => MUSNAD_KEYS[id]?.name).join(' ← ')}</p></div>}
  </div>;
}

export const HOW_MORE = {
  order: 'اضغط العناصر بالترتيب: الأول ثم الثاني وهكذا. لإزالة عنصر من ترتيبك اضغط عليه.',
  match: 'اضغط عنصرًا من العمود الأول، ثم اضغط ما يناسبه في العمود الثاني. يظهر الرقم نفسه على الطرفين.',
  buckets: 'اضغط عنصرًا، ثم اضغط اسم المجموعة التي ينتمي إليها. لإعادة عنصر اضغط عليه داخل المجموعة.',
  slider: 'اسحب المؤشر يمينًا أو يسارًا حتى تصل إلى تقديرك، ثم اضغط «تحقق». يكفي أن تقترب من الإجابة.',
  hotspot: 'اضغط الرقم الموجود على الموضع الصحيح في الصورة، ثم اضغط «تحقق».',
  fix: 'اضغط الكلمة أو الجزء الخاطئ في الجملة، ثم اختر التصحيح من الخيارات التي تظهر.',
  gap: 'اضغط كلمة من البنك لتملأ أول فراغ. لإفراغ فراغ اضغط عليه.',
  lab: 'نفّذ التجربة كما هو مطلوب داخل المختبر. حين تكتمل يظهر زر «تحقق».',
  compose: 'اضغط حروف المسند بالترتيب نفسه الذي تُكتب به العربية: الحرف الأول ثم الثاني. بين الكلمات اضغط الفاصل 𐩽. أخطأت؟ اضغط «احذف آخر حرف».',
};

export function interactionReady(task, value) {
  switch (task.kind) {
    case 'order': return Array.isArray(value) && value.length === task.items.length;
    case 'match': return Array.isArray(value) && value.length === task.left.length && value.every(v => Number.isInteger(v));
    case 'buckets': return Array.isArray(value) && value.length === task.items.length && value.every(v => Number.isInteger(v));
    case 'slider': return typeof value === 'number';
    case 'hotspot': return Array.isArray(value) && value.length > 0;
    case 'fix': return Number.isInteger(value?.index) && Number.isInteger(value?.replacement);
    case 'gap': return Array.isArray(value) && value.length === task.text.split('___').length - 1 && value.every(v => typeof v === 'string' && v.trim());
    case 'lab': return Boolean(value && typeof value === 'object');
    case 'compose': return Array.isArray(value) && value.length > 0;
    default: return false;
  }
}

export const INTERACTIONS = {order: OrderTask, match: MatchTask, buckets: BucketsTask, slider: SliderTask, hotspot: HotspotTask, fix: FixTask, gap: GapTask, lab: LabTask, compose: ComposeTask};
