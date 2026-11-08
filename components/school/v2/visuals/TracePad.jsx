'use client';
// Tracing board for one Musnad letter inside a lesson card: the student traces over
// a faint model of the letter, then hides it and writes from memory. Not graded or saved.
import {useEffect, useRef, useState} from 'react';
import {Eye, EyeOff, RotateCcw} from 'lucide-react';
import {MUSNAD_ALPHABET} from '@/lib/schoolMusnad';
import styles from './Visuals.module.css';

export default function TracePad({letter}) {
  const glyph = MUSNAD_ALPHABET.find(l => l.id === letter);
  const [guide, setGuide] = useState(true);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef(null), drawing = useRef(false);

  const clear = () => {
    const node = canvas.current;
    node?.getContext('2d')?.clearRect(0, 0, node.width, node.height);
    setDrawn(false);
  };
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const fit = () => {
      const box = node.getBoundingClientRect(), scale = Math.min(3, window.devicePixelRatio || 1);
      node.width = Math.round(Math.max(1, box.width) * scale);
      node.height = Math.round(Math.max(1, box.height) * scale);
      const ctx = node.getContext('2d');
      if (ctx) {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = getComputedStyle(node).color || '#176456';
      }
      setDrawn(false);
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  useEffect(clear, [letter]);

  const at = e => { const b = e.currentTarget.getBoundingClientRect(); return {x: e.clientX - b.left, y: e.clientY - b.top}; };
  const down = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const {x, y} = at(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .01, y + .01); ctx.stroke();
    setDrawn(true);
  };
  const move = e => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const {x, y} = at(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const up = e => { drawing.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} };

  if (!glyph) return null;
  return <div className={styles.trace} data-noswipe>
    <div className={styles.traceHead}><strong lang="und">{glyph.glyph}</strong><span>حرف {glyph.name} <small dir="ltr">{glyph.latin}</small></span></div>
    <div className={styles.traceBoard}>
      {guide && <span className={styles.traceGhost} aria-hidden="true" lang="und">{glyph.glyph}</span>}
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label={'لوحة لتتبّع حرف ' + glyph.name + ' بالإصبع أو الفأرة'}/>
      {!drawn && <span className={styles.traceHint}>ارسم فوق الحرف بإصبعك أو الفأرة</span>}
    </div>
    <div className={styles.traceTools}>
      <button type="button" onClick={clear}><RotateCcw size={15} aria-hidden="true"/> امسح</button>
      <button type="button" onClick={() => setGuide(v => !v)} aria-pressed={!guide}>{guide ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>} {guide ? 'أخفِ الحرف' : 'أظهر الحرف'}</button>
    </div>
  </div>;
}
