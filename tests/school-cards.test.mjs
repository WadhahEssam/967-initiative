import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCardLesson, gradeCard, lessonResult, TASK_KINDS, TASK_INSTRUCTIONS} from '../lib/schoolCards.js';

const scene = {kind: 'scene', scene: 'shop', alt: 'دكان صغير في سوق الملح بصنعاء'};
const lesson = () => ({
  format: 2, title: 'الندرة والاختيار', subtitle: 'لماذا لا نستطيع امتلاك كل شيء؟', template: 'decision', minutes: 4,
  summary: ['الموارد محدودة والرغبات كثيرة', 'كل اختيار يعني التخلي عن بديل'],
  cards: [
    {id: 'hook', role: 'hook', title: 'دكانك في سوق الملح', text: 'معك 10,000 ريال فقط لهذا الأسبوع. ماذا تشتري؟', visual: scene,
      task: {kind: 'choice', prompt: 'أي قرار تتخذه أولًا؟', options: ['دقيق للبيع', 'ثلاجة جديدة', 'كل شيء معًا'], answer: 0, explain: 'المال لا يكفي للكل؛ هذا هو جوهر الندرة.', hint: 'هل يكفي المبلغ لكل الخيارات؟'}},
    {id: 'idea', role: 'explain', text: 'الندرة: الموارد أقل من الرغبات، فلا بد من الاختيار.', visual: {kind: 'layers', alt: 'مقارنة بين الموارد والرغبات', layers: [{label: 'الموارد'}, {label: 'الرغبات'}]}},
    {id: 'sort', role: 'practice', visual: scene, task: {kind: 'buckets', prompt: 'صنّف: حاجة أم رغبة؟', buckets: ['حاجة', 'رغبة'], items: ['خبز', 'هاتف جديد', 'ماء'], answer: [0, 1, 0], explain: 'الحاجات أساسية للحياة.'}},
    {id: 'guess', role: 'practice', visual: {kind: 'stat', indicator: 'consumer-price-inflation', alt: 'التضخم في اليمن عبر السنين'}, task: {kind: 'slider', prompt: 'كم تتوقع نسبة التضخم في 2017؟', min: 0, max: 50, step: 1, unit: '%', answer: 24, tolerance: 5, explain: 'ارتفعت الأسعار بقوة بعد 2015.'}},
    {id: 'tf', role: 'practice', visual: scene, task: {kind: 'truefalse', prompt: 'صح أم خطأ؟', statements: ['كل اختيار له تكلفة', 'الأغنياء لا يواجهون الندرة'], answer: [true, false], explain: 'الوقت نفسه نادر للجميع.'}},
    {id: 'gap', role: 'practice', visual: scene, task: {kind: 'gap', prompt: 'أكمل الجملة', text: 'قيمة أفضل بديل تخليت عنه هي ___ البديلة', answer: ['التكلفة'], bank: ['التكلفة', 'الربح'], explain: 'هذه هي تكلفة الفرصة البديلة.'}},
    {id: 'recap', role: 'recap', text: 'كل قرار اقتصادي يبدأ من الندرة.', visual: scene},
  ],
});

test('a well-formed card lesson validates and keys never reach the public lesson', () => {
  const {lesson: pub, keys} = validateCardLesson(lesson());
  assert.equal(pub.cards.length, 7);
  assert.deepEqual(Object.keys(keys).sort(), ['gap', 'guess', 'hook', 'sort', 'tf']);
  const raw = JSON.stringify(pub);
  assert.ok(!raw.includes('"answer"'), 'no answer keys in the public lesson');
  assert.ok(pub.cards.every(c => !c.task || !('explain' in c.task)), 'explanations are revealed only after answering');
  assert.ok(!raw.includes('tolerance'));
});

test('lesson rules: hook first, no long explanation runs, 4–8 graded cards, 70% visuals, Western digits', () => {
  const bad = (mutate, re) => { const l = lesson(); mutate(l); assert.throws(() => validateCardLesson(l), re); };
  bad(l => { l.cards[0].role = 'explain'; }, /تحديًا/);
  bad(l => { l.cards.splice(2, 0, {id: 'x1', role: 'explain', text: 'شرح إضافي طويل', visual: scene}, {id: 'x2', role: 'explain', text: 'شرح آخر متتابع', visual: scene}); }, /متتاليتان/);
  bad(l => { for (const c of l.cards.slice(2, 6)) delete c.task; }, /4 إلى 8|متتاليتان/);
  bad(l => { for (const c of l.cards) if (!c.task) delete c.visual; l.cards[1].visual = undefined; l.cards[6].visual = undefined; l.cards[2].visual = undefined; }, /70%/);
  bad(l => { l.cards[0].text = 'معك ١٠٠٠٠ ريال'; }, /الغربية/);
  bad(l => { l.cards[1].id = 'hook'; }, /مكرر/);
  bad(l => { l.cards[0].task.answer = 7; }, /answer/);
});

test('questions are understandable: one short question, the scenario apart, and a clear instruction for every kind', () => {
  const {lesson: pub} = validateCardLesson(lesson());
  for (const c of pub.cards.filter(c => c.task)) assert.match(c.task.instruction, /^المطلوب: /);
  assert.equal(TASK_KINDS.filter(k => !TASK_INSTRUCTIONS[k]).length, 0);
  const l = lesson(); l.cards[0].task.prompt = 'ماذا تشتري؟ ولماذا؟'; assert.throws(() => validateCardLesson(l), /سؤال واحد/);
  const long = lesson(); long.cards[0].task.prompt = 'س'.repeat(150); assert.throws(() => validateCardLesson(long), /prompt/);
  const ctx = lesson(); ctx.cards[0].task.context = 'معك 10,000 ريال فقط لهذا الأسبوع.'; assert.equal(validateCardLesson(ctx).lesson.cards[0].task.context, 'معك 10,000 ريال فقط لهذا الأسبوع.');
});

test('every interaction kind grades correctly', () => {
  const g = (key, ok, wrong) => { assert.equal(gradeCard(key, ok), true, key.kind + ' ok'); assert.equal(gradeCard(key, wrong), false, key.kind + ' wrong'); };
  g({kind: 'choice', answer: 2}, 2, 1);
  g({kind: 'predict', answer: 0}, 0, 1);
  g({kind: 'truefalse', answer: [true, false]}, [true, false], [true, true]);
  g({kind: 'order', answer: [2, 0, 1]}, [2, 0, 1], [0, 1, 2]);
  g({kind: 'match', answer: [1, 0]}, [1, 0], [0, 1]);
  g({kind: 'buckets', answer: [0, 1, 0]}, [0, 1, 0], [1, 1, 0]);
  g({kind: 'slider', answer: 24, tolerance: 5}, 27, 30);
  g({kind: 'hotspot', answer: ['a', 'c']}, ['c', 'a'], ['a']);
  g({kind: 'fix', answer: {index: 2, replacement: 1}}, {index: 2, replacement: 1}, {index: 1, replacement: 1});
  g({kind: 'gap', answer: ['التكلفه']}, ['التَّكلفة'], ['الربح']);
  g({kind: 'type', answer: ['صنعاء']}, ' صَنعاء ', 'عدن');
  g({kind: 'lab', lab: {kind: 'gates', gate: 'AND'}}, {kind: 'gates', visited: ['0:0', '0:1', '1:0', '1:1']}, true);
  assert.equal(gradeCard({kind: 'lab'}, true), false, 'lab without a known lab never passes');
  g({kind: 'compose', answer: ['m', 'l', 'sep', 'w']}, ['m', 'l', 'sep', 'w'], ['m', 'l', 'w']);
  assert.equal(TASK_KINDS.length, 13);
});

test('stars and the score stay compatible with attempts (0..6) and the first-pass XP trigger (5–6)', () => {
  assert.deepEqual(lessonResult(5, 5), {stars: 3, ratio: 1, score: 6, passed: true});
  assert.equal(lessonResult(4, 5).stars, 2);
  assert.equal(lessonResult(1, 5).stars, 1);
  for (const n of [0, 1, 2, 3, 4, 5]) { const r = lessonResult(n, 5); assert.ok(r.score >= 5 && r.score <= 6 && r.passed); }
});

test('musnad compose: palette and answer are checked, "all" expands to the full keyboard, keys stay on the server', () => {
  const card = task => ({id: 'hook', role: 'hook', visual: {kind: 'glyphs', letters: ['m', 'l'], alt: 'حرفا الميم واللام في المسند'}, task});
  const withTask = task => { const l = lesson(); l.cards[0] = card(task); return l; };
  const base = {kind: 'compose', prompt: 'اكتب هذا التسلسل بحروف المسند:', target: 'ميم ← لام', explain: 'الميم أولًا ثم اللام من اليمين.'};
  const {lesson: pub, keys} = validateCardLesson(withTask({...base, palette: ['m', 'l', 'w'], answer: ['m', 'l']}));
  assert.deepEqual(pub.cards[0].task.palette, ['m', 'l', 'w']);
  assert.equal(pub.cards[0].task.labels, false, 'letter names are hidden unless the lesson asks for them');
  assert.equal(validateCardLesson(withTask({...base, labels: true, palette: ['m', 'l'], answer: ['m', 'l']})).lesson.cards[0].task.labels, true);
  assert.equal(pub.cards[0].task.answer, undefined, 'the answer never reaches the browser');
  assert.deepEqual(keys.hook.answer, ['m', 'l']);
  const all = validateCardLesson(withTask({...base, palette: 'all', answer: ['m', 'sep', 'zz']})).lesson.cards[0].task.palette;
  assert.equal(all.length, 30); assert.equal(all.at(-1), 'sep');
  assert.throws(() => validateCardLesson(withTask({...base, palette: ['m', 'x9'], answer: ['m']})), /palette/);
  assert.throws(() => validateCardLesson(withTask({...base, palette: ['m', 'l'], answer: ['w']})), /answer/);
  assert.throws(() => validateCardLesson(withTask({...base, palette: ['m', 'm'], answer: ['m']})), /palette/);
});
