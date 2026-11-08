// مدرسة 967 — الإصدار الثاني: صيغة دروس البطاقات (format: 2).
// التحقق من الدرس، وفصل الصيغة العامة (بلا مفاتيح) عن مفاتيح الخادم، والتصحيح، وحساب النجوم.
// راجع docs/school-v2/DESIGN.md.
import {RequestValidationError} from './requestSecurity.js';
import {verifySchoolLabEvidence} from './schoolLabEvidence.js';
import {validSchoolScript, SCHOOL_SCRIPT_IDS} from './schoolCalligraphySamples.js';
import {GATE_TYPES} from './schoolThinkingLabs.js';
import {SCIENCE_LABS} from './schoolScienceModels.js';
import {CIVIC_LABS} from './schoolCivicModels.js';
import {MUSNAD_ALPHABET} from './schoolMusnad.js';
const MUSNAD_IDS = new Set(MUSNAD_ALPHABET.map(l => l.id));

export const CARD_FORMAT = 2;
export const LESSON_TEMPLATES = ['story', 'lab', 'build', 'decision', 'spot', 'mixed'];
export const CARD_ROLES = ['hook', 'explain', 'practice', 'reveal', 'recap'];
export const TASK_KINDS = ['choice', 'truefalse', 'order', 'match', 'buckets', 'slider', 'hotspot', 'fix', 'gap', 'predict', 'type', 'lab', 'compose'];
export const VISUAL_KINDS = ['chart', 'stat', 'map', 'timeline', 'layers', 'image', 'compare', 'scene', 'formula', 'verse', 'glyphs', 'script', 'pad', 'trace'];
// Musnad word separator 𐩽: it counts as a key on the compose keyboard.
export const MUSNAD_SEPARATOR = 'sep';
const COMPOSE_KEYS = new Set([...MUSNAD_IDS, MUSNAD_SEPARATOR]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// سطر «المطلوب» الثابت فوق كل تفاعل: يقول للطالب بفعل واضح ماذا يفعل، فلا يُترك ليخمّن طريقة الإجابة.
export const TASK_INSTRUCTIONS = {
  choice: 'المطلوب: اختر إجابة واحدة.',
  predict: 'المطلوب: توقّع الإجابة، ثم اكتشف ما يحدث.',
  truefalse: 'المطلوب: حدّد لكل عبارة: صح أم خطأ.',
  order: 'المطلوب: رتّب العناصر من الأول إلى الأخير.',
  match: 'المطلوب: صِل كل عنصر في اليمين بما يناسبه في اليسار.',
  buckets: 'المطلوب: ضع كل عنصر في المجموعة المناسبة.',
  slider: 'المطلوب: حرّك المؤشر إلى القيمة التي تتوقعها.',
  hotspot: 'المطلوب: اضغط على الموضع الصحيح في الصورة.',
  fix: 'المطلوب: اضغط على الجزء الخاطئ، ثم اختر التصحيح.',
  gap: 'المطلوب: املأ الفراغ بالكلمة المناسبة.',
  type: 'المطلوب: اكتب إجابتك في المربع.',
  lab: 'المطلوب: جرّب في المختبر حتى تكتمل التجربة.',
  compose: 'المطلوب: اضغط الحروف بالترتيب لتكتب المطلوب بخط المسند.',
};
const questionMarks = s => (s.match(/[؟?]/g) || []).length;
const arabicIndic = /[٠-٩۰-۹]/;

const fail = message => { throw new RequestValidationError(message); };
const text = (value, min, max, label) => {
  if (typeof value !== 'string') fail(`${label}: نص مطلوب.`);
  const v = value.trim();
  if (v.length < min || v.length > max) fail(`${label}: الطول بين ${min} و${max} حرفًا.`);
  if (arabicIndic.test(v)) fail(`${label}: استخدم الأرقام الغربية.`);
  return v;
};
const optional = (value, max, label) => value === undefined || value === null || value === '' ? undefined : text(value, 1, max, label);
const list = (value, min, max, label) => { if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label}: من ${min} إلى ${max} عناصر.`); return value; };
const int = (value, min, max, label) => { if (!Number.isInteger(value) || value < min || value > max) fail(`${label}: رقم صحيح بين ${min} و${max}.`); return value; };
const num = (value, label) => { if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label}: رقم مطلوب.`); return value; };
const permutation = (value, n, label) => { const a = list(value, n, n, label); if (new Set(a).size !== n || a.some(i => !Number.isInteger(i) || i < 0 || i >= n)) fail(`${label}: ترتيب غير صالح.`); return a; };

export function normalizeArabicAnswer(value) {
  return String(value ?? '').normalize('NFKC').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0)).replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة(?=\s|$)/g, 'ه').replace(/\s+/g, ' ').trim().toUpperCase();
}

export const VISUAL_SCENES = ['city', 'street', 'home', 'well', 'shop', 'market', 'space', 'volcano', 'bank', 'telegraph', 'circuit', 'desk', 'court', 'school', 'parliament', 'farm', 'port', 'weather-station', 'lab', 'mountains', 'desert'];
export const FORMULA_OPS = ['plus', 'minus', 'times', 'divide', 'equals', 'arrow'];
const PCODE = /^YE(1[1-9]|2\d|3[0-2])$/;
const pct = (n, label) => { const v = num(n, label); if (v < 0 || v > 100) fail(`${label}: نسبة بين 0 و100.`); return v; };

// تحقق خاص بكل نوع: الحقول التي يحتاجها الرسم موجودة وبحدود معقولة.
function checkVisualKind(v, label) {
  switch (v.kind) {
    case 'chart':
      if (!['line', 'bar', 'supply-demand'].includes(v.type)) fail(`${label}.type: line أو bar أو supply-demand.`);
      if (v.type === 'line') list(v.series, 1, 3, `${label}.series`).forEach((s, i) => { text(s?.label, 1, 40, `${label}.series[${i}].label`); list(s.points, 2, 80, `${label}.series[${i}].points`).forEach((p, j) => { if (!Array.isArray(p) || p.length !== 2) fail(`${label}.series[${i}].points[${j}]`); num(p[0], 'x'); num(p[1], 'y'); }); });
      if (v.type === 'bar') list(v.bars, 2, 8, `${label}.bars`).forEach((b, i) => { text(b?.label, 1, 40, `${label}.bars[${i}].label`); num(b.value, `${label}.bars[${i}].value`); });
      if (v.type === 'supply-demand') { for (const k of ['demandShift', 'supplyShift']) if (v[k] !== undefined && (num(v[k], k) < -25 || v[k] > 25)) fail(`${label}.${k}: بين -25 و25.`); if (v.bind !== undefined && !['demand', 'supply'].includes(v.bind)) fail(`${label}.bind: demand أو supply.`); }
      break;
    case 'stat':
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.indicator || '')) fail(`${label}.indicator: معرّف مؤشر من «اليمن بالأرقام».`);
      if (v.years !== undefined) { const [a, b] = list(v.years, 2, 2, `${label}.years`); int(a, 1900, 2100, 'from'); int(b, a, 2100, 'to'); }
      break;
    case 'map':
      if (v.highlight !== undefined && list(v.highlight, 0, 22, `${label}.highlight`).some(c => !PCODE.test(c))) fail(`${label}.highlight: رموز محافظات مثل YE13.`);
      if (v.values !== undefined) { if (!v.values || typeof v.values !== 'object' || Array.isArray(v.values)) fail(`${label}.values`); for (const [k, n] of Object.entries(v.values)) { if (!PCODE.test(k)) fail(`${label}.values: ${k}`); num(n, `${label}.values.${k}`); } }
      if (!v.highlight?.length && !v.values) fail(`${label}: حدّد محافظات (highlight) أو قيمًا (values).`);
      break;
    case 'timeline':
      list(v.events, 2, 8, `${label}.events`).forEach((e, i) => { if (!(Number.isInteger(e?.year) || (typeof e?.year === 'string' && e.year.length <= 14))) fail(`${label}.events[${i}].year`); text(e.label, 2, 90, `${label}.events[${i}].label`); });
      break;
    case 'layers':
      list(v.layers, 2, 6, `${label}.layers`).forEach((l, i) => { text(l?.label, 1, 40, `${label}.layers[${i}].label`); optional(l.detail, 140, `${label}.layers[${i}].detail`); });
      break;
    case 'compare':
      text(v.before, 1, 60, `${label}.before`); text(v.after, 1, 60, `${label}.after`);
      optional(v.beforeLabel, 24, `${label}.beforeLabel`); optional(v.afterLabel, 24, `${label}.afterLabel`);
      break;
    case 'scene':
      if (!VISUAL_SCENES.includes(v.scene)) fail(`${label}.scene: ${VISUAL_SCENES.join('، ')}.`);
      if (v.labels !== undefined) list(v.labels, 0, 4, `${label}.labels`).forEach((l, i) => { text(l?.text, 1, 24, `${label}.labels[${i}]`); pct(l.x, 'x'); pct(l.y, 'y'); });
      break;
    case 'formula': {
      const parts = list(v.parts, 2, 5, `${label}.parts`); parts.forEach((p, i) => text(p, 1, 40, `${label}.parts[${i}]`));
      if (v.ops !== undefined && (list(v.ops, parts.length - 1, parts.length - 1, `${label}.ops`).some(o => !FORMULA_OPS.includes(o)))) fail(`${label}.ops: ${FORMULA_OPS.join('، ')}.`);
      break;
    }
    case 'verse':
      text(v.sadr, 4, 90, `${label}.sadr`); text(v.ajuz, 4, 90, `${label}.ajuz`); optional(v.meter, 20, `${label}.meter`);
      if (v.feet !== undefined) list(v.feet, 1, 8, `${label}.feet`).forEach((f, i) => { text(f?.text, 1, 24, `${label}.feet[${i}].text`); if (f.pattern !== undefined && !/^[/0 ]{1,14}$/.test(f.pattern)) fail(`${label}.feet[${i}].pattern: من / و0 فقط.`); optional(f.name, 16, `${label}.feet[${i}].name`); });
      break;
    case 'glyphs':
      if (list(v.letters, 1, 12, `${label}.letters`).some(id => !MUSNAD_IDS.has(id))) fail(`${label}.letters: معرّفات حروف المسند.`);
      break;
    case 'image':
      if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^\s"'<>]+$/.test(v.src || '')) fail(`${label}.src: صورة من ويكيميديا كومنز فقط.`);
      text(v.credit, 2, 120, `${label}.credit`); text(v.license, 2, 40, `${label}.license`);
      break;
    // نموذج خط حقيقي (خط ويب متخصص أو عمل تاريخي موثق)، ولوح تدريب حر غير مصحَّح، من مسار الخطوط العربية.
    case 'script':
      text(v.text, 1, 60, `${label}.text`);
      if (v.blind !== undefined && typeof v.blind !== 'boolean') fail(`${label}.blind: true أو false.`);
      if (!validSchoolScript(v.script)) fail(`${label}.script: ${SCHOOL_SCRIPT_IDS.join('، ')}.`);
      break;
    case 'pad':
      text(v.model, 1, 60, `${label}.model`); text(v.focus, 3, 60, `${label}.focus`); text(v.instructions, 6, 220, `${label}.instructions`);
      if (!validSchoolScript(v.script)) fail(`${label}.script: ${SCHOOL_SCRIPT_IDS.join('، ')}.`);
      break;
    // Free tracing board for one Musnad letter: not graded or saved.
    case 'trace':
      if (!MUSNAD_IDS.has(v.letter)) fail(`${label}.letter: معرّف حرف من حروف المسند.`);
      break;
  }
  if (v.caption !== undefined) optional(v.caption, 160, `${label}.caption`);
}

function validateVisual(v, label) {
  if (v === undefined || v === null) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v) || !VISUAL_KINDS.includes(v.kind)) fail(`${label}: نوع العنصر المرئي غير معروف.`);
  const alt = text(v.alt, 8, 240, `${label}.alt`);
  const raw = JSON.stringify(v);
  if (raw.length > 8000) fail(`${label}: العنصر المرئي أكبر من المسموح.`);
  if (arabicIndic.test(raw)) fail(`${label}: استخدم الأرقام الغربية.`);
  if (v.data !== undefined) fail(`${label}.data: تُملأ بيانات المؤشر تلقائيًا من الخادم.`);
  checkVisualKind(v, label);
  return {...v, alt};
}

// يعيد {public, key}: public يُرسل للمتصفح، key يبقى على الخادم.
function validateTask(t, label) {
  if (!t || typeof t !== 'object' || !TASK_KINDS.includes(t.kind)) fail(`${label}: نوع التفاعل غير معروف.`);
  // السؤال قصير وسؤال واحد فقط؛ الموقف أو المعطيات تذهب إلى context منفصل فوقه.
  const prompt = text(t.prompt, 6, 140, `${label}.prompt`);
  if (questionMarks(prompt) > 1) fail(`${label}.prompt: سؤال واحد فقط في كل تفاعل.`);
  const base = {kind: t.kind, context: optional(t.context, 220, `${label}.context`), prompt, instruction: TASK_INSTRUCTIONS[t.kind], hint: optional(t.hint, 240, `${label}.hint`)};
  const explain = text(t.explain, 10, 600, `${label}.explain`);
  const strings = (arr, min, max, l, len = 120) => list(arr, min, max, l).map((s, i) => text(s, 1, len, `${l}[${i}]`));
  switch (t.kind) {
    case 'choice': case 'predict': {
      const options = strings(t.options, 2, 4, `${label}.options`);
      if (new Set(options).size !== options.length) fail(`${label}: خيارات مكررة.`);
      const answer = int(t.answer, 0, options.length - 1, `${label}.answer`);
      const pub = {...base, options};
      if (t.kind === 'predict') pub.reveal = {text: text(t.reveal?.text, 10, 400, `${label}.reveal.text`), visual: validateVisual(t.reveal?.visual, `${label}.reveal.visual`)};
      return {public: pub, key: {kind: t.kind, answer, explain}};
    }
    case 'truefalse': {
      const statements = strings(t.statements, 1, 5, `${label}.statements`, 200);
      const answer = list(t.answer, statements.length, statements.length, `${label}.answer`);
      if (answer.some(b => typeof b !== 'boolean')) fail(`${label}.answer: قيم صح/خطأ فقط.`);
      return {public: {...base, statements}, key: {kind: 'truefalse', answer, explain}};
    }
    case 'order': {
      const items = strings(t.items, 3, 7, `${label}.items`);
      const answer = permutation(t.answer, items.length, `${label}.answer`);
      // العناصر تُعرض كما خُزنت؛ إن كانت مرتبة أصلًا فلا تحدّي.
      if (answer.every((v, i) => v === i)) fail(`${label}: اكتب العناصر بترتيب مختلط؛ الترتيب الصحيح في answer.`);
      return {public: {...base, items}, key: {kind: 'order', answer, explain}};
    }
    case 'match': {
      const left = strings(t.left, 2, 6, `${label}.left`), right = strings(t.right, left.length, 6, `${label}.right`);
      const answer = list(t.answer, left.length, left.length, `${label}.answer`).map((r, i) => int(r, 0, right.length - 1, `${label}.answer[${i}]`));
      if (new Set(answer).size !== answer.length) fail(`${label}.answer: كل عنصر في اليسار يُستخدم مرة واحدة.`);
      return {public: {...base, left, right}, key: {kind: 'match', answer, explain}};
    }
    case 'buckets': {
      const buckets = strings(t.buckets, 2, 4, `${label}.buckets`, 60), items = strings(t.items, 3, 10, `${label}.items`);
      return {public: {...base, buckets, items}, key: {kind: 'buckets', answer: list(t.answer, items.length, items.length, `${label}.answer`).map((b, i) => int(b, 0, buckets.length - 1, `${label}.answer[${i}]`)), explain}};
    }
    case 'slider': {
      const min = num(t.min, `${label}.min`), max = num(t.max, `${label}.max`), step = num(t.step, `${label}.step`);
      if (!(min < max) || step <= 0) fail(`${label}: مدى المؤشر غير صالح.`);
      const answer = num(t.answer, `${label}.answer`), tolerance = num(t.tolerance ?? 0, `${label}.tolerance`);
      if (answer < min || answer > max || tolerance < 0) fail(`${label}: الإجابة خارج المدى.`);
      return {public: {...base, min, max, step, unit: optional(t.unit, 40, `${label}.unit`), initial: typeof t.initial === 'number' ? t.initial : min}, key: {kind: 'slider', answer, tolerance, explain}};
    }
    case 'hotspot': {
      const visual = validateVisual(t.visual, `${label}.visual`);
      if (!visual) fail(`${label}: الصورة مطلوبة.`);
      const spots = list(t.spots, 2, 8, `${label}.spots`).map((s, i) => {
        if (!ID.test(s?.id || '')) fail(`${label}.spots[${i}].id غير صالح.`);
        return {id: s.id, x: num(s.x, 'x'), y: num(s.y, 'y'), r: num(s.r ?? 6, 'r'), label: optional(s.label, 60, `${label}.spots[${i}].label`)};
      });
      const ids = new Set(spots.map(s => s.id));
      const answer = list(t.answer, 1, spots.length, `${label}.answer`);
      if (answer.some(id => !ids.has(id))) fail(`${label}.answer: نقطة غير موجودة.`);
      return {public: {...base, visual, spots}, key: {kind: 'hotspot', answer: [...new Set(answer)].sort(), explain}};
    }
    case 'fix': {
      const tokens = strings(t.tokens, 2, 12, `${label}.tokens`);
      const index = int(t.answer?.index, 0, tokens.length - 1, `${label}.answer.index`);
      const choices = strings(t.choices, 2, 4, `${label}.choices`);
      const replacement = int(t.answer?.replacement, 0, choices.length - 1, `${label}.answer.replacement`);
      return {public: {...base, tokens, choices}, key: {kind: 'fix', answer: {index, replacement}, explain}};
    }
    case 'gap': {
      const sentence = text(t.text, 6, 300, `${label}.text`);
      const gaps = (sentence.match(/___/g) || []).length;
      if (gaps < 1 || gaps > 4) fail(`${label}.text: من فراغ إلى 4 فراغات (___).`);
      const answer = strings(t.answer, gaps, gaps, `${label}.answer`, 60);
      const bank = t.bank === undefined ? undefined : strings(t.bank, gaps, 10, `${label}.bank`, 60);
      if (bank && answer.some(a => !bank.includes(a))) fail(`${label}: كل إجابة يجب أن تكون في بنك الكلمات.`);
      return {public: {...base, text: sentence, bank}, key: {kind: 'gap', answer: answer.map(normalizeArabicAnswer), display: answer, explain}};
    }
    case 'type': {
      const answers = (Array.isArray(t.answer) ? t.answer : [t.answer]).map((a, i) => text(a, 1, 80, `${label}.answer[${i}]`));
      return {public: base, key: {kind: 'type', answer: answers.map(normalizeArabicAnswer), display: answers, explain}};
    }
    case 'lab': {
      const lab = t.lab;
      if (!lab || typeof lab !== 'object' || !['morse', 'gates', 'science', 'civic'].includes(lab.kind)) fail(`${label}: مختبر غير معروف.`);
      if (lab.kind === 'morse' && !/^[A-Z0-9 ]{1,12}$/.test(lab.sample || '')) fail(`${label}: نص مورس من حروف إنجليزية كبيرة وأرقام.`);
      if (lab.kind === 'gates' && !GATE_TYPES.includes(lab.gate)) fail(`${label}: بوابة منطقية غير معروفة.`);
      if (lab.kind === 'science' && !SCIENCE_LABS[lab.model]) fail(`${label}: نموذج علمي غير معروف.`);
      if (lab.kind === 'civic' && !lab.activity && !CIVIC_LABS[lab.model]) fail(`${label}: نموذج مدني غير معروف.`);
      if (JSON.stringify(lab).length > 6000) fail(`${label}: المختبر أكبر من المسموح.`);
      return {public: {...base, lab}, key: {kind: 'lab', lab, explain}};
    }
    // Hands-on composition: the student builds a line from a Musnad keyboard, graded by exact sequence.
    // palette is a list of letter ids (plus 'sep'), or 'all' for the full alphabet and the separator.
    // Keys show glyphs only, so the student must recognise each letter; labels: true also shows the
    // letter names (for lessons that are still introducing the letters).
    case 'compose': {
      const target = text(t.target, 1, 120, `${label}.target`);
      const palette = t.palette === 'all' ? [...COMPOSE_KEYS] : list(t.palette, 2, 30, `${label}.palette`);
      if (palette.some(id => !COMPOSE_KEYS.has(id)) || new Set(palette).size !== palette.length) fail(`${label}.palette: معرّفات حروف مسند غير مكررة (أو sep).`);
      const answer = list(t.answer, 1, 80, `${label}.answer`);
      if (answer.some(id => !palette.includes(id))) fail(`${label}.answer: كل حرف في الإجابة يجب أن يكون على لوحة الحروف.`);
      if (t.labels !== undefined && typeof t.labels !== 'boolean') fail(`${label}.labels: true أو false.`);
      return {public: {...base, target, palette, labels: t.labels === true}, key: {kind: 'compose', answer, explain}};
    }
  }
  return fail(`${label}: نوع غير مدعوم.`);
}

// يتحقق من درس كامل ويعيد {lesson: الصيغة العامة, keys: {cardId: key}}.
export function validateCardLesson(input) {
  if (!input || typeof input !== 'object' || input.format !== CARD_FORMAT) fail('الدرس ليس بصيغة البطاقات.');
  const lesson = {
    format: CARD_FORMAT,
    title: text(input.title, 3, 90, 'عنوان الدرس'),
    subtitle: optional(input.subtitle, 180, 'العنوان الفرعي') || '',
    template: LESSON_TEMPLATES.includes(input.template) ? input.template : fail('قالب الدرس غير معروف.'),
    minutes: int(input.minutes, 2, 12, 'مدة الدرس'),
    summary: list(input.summary, 2, 4, 'الملخص').map((s, i) => text(s, 6, 160, `الملخص[${i}]`)),
    source: input.source ? {title: text(input.source.title, 3, 160, 'المصدر'), url: /^https:\/\//.test(input.source.url || '') ? input.source.url : fail('رابط المصدر غير صالح.')} : undefined,
    cards: [],
  };
  const keys = {};
  const cards = list(input.cards, 6, 12, 'البطاقات');
  const seen = new Set();
  let streak = 0, visuals = 0;
  cards.forEach((c, i) => {
    const label = `البطاقة ${i + 1}`;
    if (!c || typeof c !== 'object' || !ID.test(c.id || '') || seen.has(c.id)) fail(`${label}: معرّف غير صالح أو مكرر.`);
    seen.add(c.id);
    if (!CARD_ROLES.includes(c.role)) fail(`${label}: دور البطاقة غير معروف.`);
    if (i === 0 && c.role !== 'hook') fail('البطاقة الأولى يجب أن تكون تحديًا (hook).');
    const card = {id: c.id, role: c.role, title: optional(c.title, 70, `${label}.title`), text: optional(c.text, 260, `${label}.text`), visual: validateVisual(c.visual, `${label}.visual`)};
    if (!card.text && !card.visual && !c.task) fail(`${label}: فارغة.`);
    if (card.visual || c.task?.kind === 'hotspot') visuals++;
    if (c.task) { const {public: pub, key} = validateTask(c.task, `${label}.task`); card.task = pub; keys[c.id] = key; streak = 0; }
    else if (++streak > 2) fail(`${label}: لا تتجاوز بطاقتا شرح متتاليتان بلا تفاعل.`);
    lesson.cards.push(card);
  });
  const graded = Object.keys(keys).length;
  if (graded < 4 || graded > 8) fail('يحتاج الدرس من 4 إلى 8 بطاقات تفاعلية.');
  if (visuals / cards.length < 0.7) fail('يحتاج 70% من البطاقات على الأقل إلى عنصر مرئي.');
  return {lesson, keys};
}

// تصحيح إجابة بطاقة واحدة مقابل مفتاحها.
export function gradeCard(key, answer) {
  if (!key) return false;
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  switch (key.kind) {
    case 'choice': case 'predict': return answer === key.answer;
    case 'truefalse': case 'order': case 'match': case 'buckets': case 'compose': return same(answer, key.answer);
    case 'slider': return typeof answer === 'number' && Math.abs(answer - key.answer) <= key.tolerance;
    case 'hotspot': return Array.isArray(answer) && same([...new Set(answer)].sort(), key.answer);
    case 'fix': return answer?.index === key.answer.index && answer?.replacement === key.answer.replacement;
    case 'gap': return Array.isArray(answer) && same(answer.map(normalizeArabicAnswer), key.answer);
    case 'type': return key.answer.includes(normalizeArabicAnswer(answer));
    // المختبر يُثبت بدليل التجربة نفسه (كما في الإصدار الأول)، لا بمجرد «تم».
    case 'lab': return ['morse', 'gates', 'science', 'civic'].includes(key.lab?.kind) && verifySchoolLabEvidence(key.lab, '', -1, answer);
    default: return false;
  }
}

// النجوم من نسبة الصحيح في المحاولة الأولى، والدرجة المتوافقة مع جدول المحاولات (0..6) ومشغّل نقاط الخبرة (5–6 = نجاح).
export function lessonResult(firstTry, total) {
  const ratio = total ? firstTry / total : 0;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1;
  return {stars, ratio, score: stars === 3 ? 6 : 5, passed: true};
}
