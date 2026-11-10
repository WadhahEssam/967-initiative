import {guestLessonOpen} from './schoolGuest.js';
// مدرسة 967 — الإصدار الثاني: منطق خريطة الرحلة (بلا واجهة، قابل للاختبار).

// الوحدات كما كتبها المحرر إن كانت صالحة، وإلا تُقسم الدروس تلقائيًا إلى مجموعات من 3.
export function journeyUnits(stages, authored) {
  const indexes = stages.map(s => s.index);
  const valid = Array.isArray(authored) && authored.length >= 1 && authored.length <= 6 && authored.every(u =>
    u && typeof u.title === 'string' && u.title.trim() && Array.isArray(u.stages) && u.stages.length && u.stages.every(Number.isInteger));
  if (valid) {
    const units = authored.map(u => ({title: u.title.trim().slice(0, 60), stages: u.stages.filter(i => indexes.includes(i))})).filter(u => u.stages.length);
    const covered = new Set(units.flatMap(u => u.stages));
    const rest = indexes.filter(i => !covered.has(i));
    if (rest.length) units.push({title: 'دروس أخرى', stages: rest});
    return units;
  }
  const out = [];
  for (let i = 0; i < indexes.length; i += 3) {
    const chunk = indexes.slice(i, i + 3);
    out.push({title: chunk.length > 1 ? `الدروس ${chunk[0] + 1}–${chunk.at(-1) + 1}` : `الدرس ${chunk[0] + 1}`, stages: chunk});
  }
  return out;
}

// حالة كل درس: done | current | open | locked | pending، مع النجوم والإجماليات.
export function journeyState(stages, progress) {
  const byIndex = {};
  if (progress?.loading || progress?.error) {
    for (const s of stages) byIndex[s.index] = {status: 'pending', stars: 0, done: false};
    return {byIndex, done: 0, stars: 0, current: null, finished: false};
  }
  if (progress?.guest) {
    // A visitor: the first lessons are open; the ones finished in this browser show their stars (progress.local).
    const local = progress.local || {};
    let current = null, done = 0, stars = 0;
    for (const s of stages) {
      if (local[s.index]) { const n = Math.max(1, Math.min(3, Number(local[s.index].stars) || 1)); byIndex[s.index] = {status: 'done', stars: n, done: true}; done++; stars += n; }
      else if (guestLessonOpen(s.index)) { byIndex[s.index] = {status: current === null ? 'current' : 'open', stars: 0, done: false}; if (current === null) current = s.index; }
      else byIndex[s.index] = {status: 'locked', stars: 0, done: false};
    }
    return {byIndex, done, stars, current, finished: false};
  }
  const info = new Map((progress?.stages || []).map(s => [s.index, s]));
  let current = null, done = 0, stars = 0;
  for (const s of stages) {
    const p = info.get(s.index);
    if (p?.completed) {
      const n = Math.max(1, Math.min(3, Number(p.stars) || 1));
      byIndex[s.index] = {status: 'done', stars: n, done: true}; done++; stars += n;
    } else if (p && !p.locked) {
      byIndex[s.index] = {status: current === null ? 'current' : 'open', stars: 0, done: false};
      if (current === null) current = s.index;
    } else byIndex[s.index] = {status: 'locked', stars: 0, done: false};
  }
  return {byIndex, done, stars, current, finished: stages.length > 0 && done === stages.length};
}

// محرر الوحدات في الاستوديو: سطر لكل وحدة «العنوان: أرقام المحطات» (من 1 إلى 12).
export const unitsText = units => (units || []).map(u => `${u.title}: ${u.stages.map(n => n + 1).join('، ')}`).join('\n');

// «عنوان الوحدة: 1، 2، 3» ← {title, stages:[0,1,2]}.
export function parseUnits(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return {units: undefined};
  const units = [];
  for (const [i, line] of lines.entries()) {
    const m = line.match(/^(.+?)\s*[:：]\s*([\d\s,،-]+)$/);
    if (!m) return {error: `السطر ${i + 1}: اكتب «عنوان الوحدة: 1، 2، 3».`};
    const stages = m[2].split(/[\s,،]+/).filter(Boolean).map(Number);
    if (stages.some(n => !Number.isInteger(n) || n < 1 || n > 12)) return {error: `السطر ${i + 1}: أرقام المحطات من 1 إلى 12.`};
    units.push({title: m[1].trim(), stages: stages.map(n => n - 1)});
  }
  return {units};
}
