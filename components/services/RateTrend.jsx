'use client';
import {useEffect,useRef,useState} from 'react';
import {formatNumber} from '@/lib/format';
import {formatRateDay} from '@/lib/exchangeRates';
import styles from './Services.module.css';

const H = 150, PAD = {top: 12, right: 12, bottom: 22, left: 44};

// One city's dollar sell price over the last 30 days: a single 2px line, the last value marked
// and labelled, min/max on the axis, a crosshair readout on hover or touch, and a table view.
export default function RateTrend({title, points}) {
  const [active, setActive] = useState(null);
  // Drawn at its real width, so text and line keep their size on every screen.
  const box = useRef(null), [W, setW] = useState(320);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (points.length < 2) return <section className={styles.trend} aria-label={title} ref={box}>
    <h3>{title}</h3><p className={styles.trendValue}>يظهر الرسم بعد تسجيل أسعار يومين على الأقل.</p>
  </section>;
  const values = points.map(p => p.sell), min = Math.min(...values), max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.01), low = min - span * 0.1, high = max + span * 0.1;
  const x = i => PAD.left + i * (W - PAD.left - PAD.right) / (points.length - 1);
  const y = v => PAD.top + (high - v) * (H - PAD.top - PAD.bottom) / (high - low);
  const path = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.sell).toFixed(1)).join(' ');
  const last = points.length - 1, shown = active ?? last;
  const pick = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * W;
    const i = Math.round((px - PAD.left) / ((W - PAD.left - PAD.right) / last));
    setActive(Math.max(0, Math.min(last, i)));
  };
  return <section className={styles.trend} aria-label={title} ref={box}>
    <h3>{title}</h3>
    <p className={styles.trendValue}>{formatRateDay(points[shown].day)}: <strong>{formatNumber(points[shown].sell)}</strong> ريال</p>
    <svg className={styles.chart} width={W} height={H} viewBox={`0 0 ${W} ${H}`} dir="ltr" role="img" aria-label={`${title}: من ${formatNumber(points[0].sell)} إلى ${formatNumber(points[last].sell)} ريال خلال ${points.length} يومًا مسجلًا`}
      onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)}>
      {[max, min].map(v => <g key={v}>
        <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}/>
        <text className={styles.axis} x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{formatNumber(v)}</text>
      </g>)}
      <text className={styles.axis} x={PAD.left} y={H - 4} textAnchor="start">{formatRateDay(points[0].day)}</text>
      <text className={styles.axis} x={W - PAD.right} y={H - 4} textAnchor="end">{formatRateDay(points[last].day)}</text>
      <path className={styles.line} d={path}/>
      {active !== null && <line className={styles.cross} x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom}/>}
      <circle className={styles.dot} cx={x(shown)} cy={y(points[shown].sell)} r="4.5"/>
      {/* Wide invisible target so the whole plot responds to the pointer. */}
      <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} fill="transparent"/>
    </svg>
    <details>
      <summary>عرض الأرقام في جدول</summary>
      <div className={styles.tableWrap}><table className={styles.dataTable}>
        <thead><tr><th scope="col">اليوم</th><th scope="col">شراء</th><th scope="col">بيع</th></tr></thead>
        <tbody>{points.slice().reverse().map(p => <tr key={p.day}><th scope="row">{formatRateDay(p.day)}</th><td>{formatNumber(p.buy)}</td><td>{formatNumber(p.sell)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}
