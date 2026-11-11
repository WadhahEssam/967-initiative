'use client';
// العنصر المرئي للبطاقة (المرحلة 3): مكتبة SVG/CSS بألوان الموقع. الوصف النصي (alt) لقارئ الشاشة، والتعليق المرئي اختياري.
import {ArrowLeft} from 'lucide-react';
import {MUSNAD_ALPHABET} from '@/lib/schoolMusnad';
import {servedImageUrl} from '@/lib/media';
import {LineChart, BarChart, SupplyDemand, Legend} from './visuals/Charts';
import {bindShift} from '@/lib/schoolCardVisuals';
import YemenMapVisual from './visuals/YemenMapVisual';
import Scene from './visuals/Scenes';
import CalligraphyExample from '../CalligraphyExample';
import CalligraphyPracticePad from '../CalligraphyPracticePad';
import TracePad from './visuals/TracePad';
import studio from '@/app/school/studio/studio.module.css';
import styles from './visuals/Visuals.module.css';

const GRAPHIC = new Set(['chart', 'stat', 'map', 'scene', 'image']);
const OPS = {plus: '+', minus: '−', times: '×', divide: '÷', equals: '=', arrow: '←'};
const musnad = Object.fromEntries(MUSNAD_ALPHABET.map(l => [l.id, l]));

function Body({visual, task, value}) {
  switch (visual.kind) {
    case 'chart': {
      if (visual.type === 'bar') return <BarChart bars={visual.bars} unit={visual.unit} highlight={visual.highlight}/>;
      if (visual.type === 'supply-demand') {
        const live = bindShift(visual, task, value);
        return <div className={styles.canvas}><SupplyDemand demandShift={(visual.demandShift || 0) + (visual.bind === 'demand' ? live : 0)} supplyShift={(visual.supplyShift || 0) + (visual.bind === 'supply' ? live : 0)}/></div>;
      }
      return <><div className={styles.canvas}><LineChart series={visual.series} highlight={visual.highlight}/></div><Legend series={visual.series}/></>;
    }
    case 'stat': {
      const data = visual.data;
      if (!data?.points?.length) return <p className={styles.caption}>تعذر تحميل بيانات المؤشر الآن.</p>;
      return <div className={styles.canvas}><LineChart series={[{label: data.name, points: data.points}]} highlight={visual.highlight}/></div>;
    }
    case 'map': return <YemenMapVisual visual={visual}/>;
    case 'scene': return <div className={styles.canvas}><Scene scene={visual.scene}/>
      {visual.labels?.map((l, i) => <span key={i} className={styles.sceneLabel} style={{left: l.x + '%', top: l.y + '%'}}>{l.text}</span>)}
    </div>;
    case 'timeline': return <ol className={styles.timeline}>
      {visual.events.map((e, i) => <li key={i} className={styles.event} data-hi={visual.highlight === i || undefined}><span className={styles.year}>{e.year}</span><span className={styles.eventLabel}>{e.label}</span></li>)}
    </ol>;
    case 'layers': return <div className={styles.layers}>
      {visual.layers.map((l, i) => <div key={i} className={styles.layer}><strong>{l.label}</strong>{l.detail && <span>{l.detail}</span>}</div>)}
    </div>;
    case 'compare': return <div className={styles.compare}>
      <div className={styles.side} data-side="before"><small>{visual.beforeLabel || 'قبل'}</small><strong>{visual.before}</strong></div>
      <ArrowLeft className={styles.arrow} size={22} aria-hidden="true"/>
      <div className={styles.side} data-side="after"><small>{visual.afterLabel || 'بعد'}</small><strong>{visual.after}</strong></div>
    </div>;
    case 'formula': return <div className={styles.formula}>
      {visual.parts.map((p, i) => <span key={i} style={{display: 'contents'}}>
        {i > 0 && <span className={styles.op} aria-hidden="true">{OPS[visual.ops?.[i - 1]] || (i === visual.parts.length - 1 ? '=' : '+')}</span>}
        <span className={styles.term}>{p}</span>
      </span>)}
    </div>;
    case 'verse': return <div className={styles.verse}>
      {visual.meter && <span className={styles.meter}>بحر {visual.meter}</span>}
      <div className={styles.hemistichs}><span>{visual.sadr}</span><span>{visual.ajuz}</span></div>
      {visual.feet && <div className={styles.feet}>{visual.feet.map((f, i) => <span key={i} className={styles.foot}><b>{f.text}</b>{f.pattern && <code>{f.pattern}</code>}{f.name && <small>{f.name}</small>}</span>)}</div>}
    </div>;
    case 'glyphs': return <div className={styles.glyphs}>
      {visual.letters.map((id, i) => <span key={i} className={styles.glyph}><span lang="und">{musnad[id]?.glyph}</span><small>{musnad[id]?.name}</small></span>)}
    </div>;
    case 'script': return <div className={styles.scriptBox + ' ' + studio.cardScript}><CalligraphyExample text={visual.text} script={visual.script} label="نموذج الخط" hideName={visual.blind === true}/></div>;
    // لوح التدريب للكتابة الحرة: لا يُصحَّح ولا يُحفظ، ولا يقلب البطاقة عند السحب عليه.
    case 'pad': return <div className={styles.scriptBox + ' ' + studio.cardScript} data-noswipe><CalligraphyPracticePad practice={{model: visual.model, focus: visual.focus, instructions: visual.instructions, script: visual.script}} script={visual.script} stageKey={'card-' + visual.script}/></div>;
    case 'trace': return <TracePad letter={visual.letter}/>;
    // eslint-disable-next-line @next/next/no-img-element -- صور كومنز تمر عبر خادمنا (ويكيميديا محجوبة في اليمن).
    case 'image': return <img className={styles.image} src={servedImageUrl(visual.src,828)} alt="" loading="lazy" decoding="async" width={visual.width} height={visual.height}/>;
    default: return null;
  }
}

function caption(visual) {
  if (visual.kind === 'stat' && visual.data) {
    const s = visual.data.source;
    return <>{visual.data.name}{visual.data.unit ? ` (${visual.data.unit})` : ''}. المصدر: {s?.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s?.name || 'اليمن بالأرقام'}</>;
  }
  if (visual.kind === 'image') return <>{visual.credit} — {visual.license}</>;
  return visual.caption || null;
}

export default function CardVisual({visual, task, value, bare = false}) {
  if (!visual) return null;
  const note = bare ? null : caption(visual);
  // الرسوم تُقرأ بوصفها النصي؛ العناصر النصية (خط زمني، طبقات، بيت…) تُقرأ كما هي.
  const graphic = GRAPHIC.has(visual.kind);
  return <figure className={styles.visual + (bare ? ' ' + styles.bare : '')} data-kind={visual.kind}>
    <div role={graphic ? 'img' : undefined} aria-label={graphic ? visual.alt : undefined}><Body visual={visual} task={task} value={value}/></div>
    {note && <figcaption className={styles.caption}>{note}</figcaption>}
  </figure>;
}
