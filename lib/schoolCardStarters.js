// مدرسة 967 — الإصدار الثاني: نماذج جاهزة لمحرر دروس البطاقات (كل نموذج صالح للمدقق كما هو).
// المحرر يبدأ منها ثم يعدّل النصوص؛ لا تُنشر كما هي.

export const TEMPLATE_LABELS = {story: 'قصة', lab: 'مختبر', build: 'ابنِ بنفسك', decision: 'مسار قرارات', spot: 'اكتشف الخطأ', mixed: 'متنوع'};
export const ROLE_LABELS = {hook: 'تحدٍّ افتتاحي', explain: 'شرح', practice: 'تمرين', reveal: 'كشف', recap: 'خلاصة'};
export const TASK_LABELS = {choice: 'اختيار', truefalse: 'صح أو خطأ', order: 'ترتيب', match: 'توصيل', buckets: 'تصنيف', slider: 'مؤشر تقدير', hotspot: 'نقر على صورة', fix: 'تصحيح خطأ', gap: 'ملء فراغ', predict: 'توقّع ثم اكشف', type: 'كتابة', lab: 'مختبر', compose: 'تركيب بخط المسند'};
export const VISUAL_LABELS = {chart: 'منحنى', stat: 'مؤشر من «اليمن بالأرقام»', map: 'خريطة اليمن', timeline: 'خط زمني', layers: 'طبقات', image: 'صورة كومنز', compare: 'مقارنة', scene: 'مشهد', formula: 'علاقة', verse: 'بيت شعري', glyphs: 'حروف المسند', script: 'نموذج خط', pad: 'لوح تدريب على الخط', trace: 'لوح تتبّع حرف مسند'};

const common = {hint: 'تلميح يقرّب من الإجابة ولا يكشفها.', explain: 'اشرح لماذا هذه هي الإجابة الصحيحة.'};

// حقول التفاعل الخاصة بكل نوع (بعد الحقول المشتركة: السياق والسؤال والتلميح والشرح).
export const TASK_STARTERS = {
  choice: {prompt: 'اكتب سؤالك هنا؟', options: ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث'], answer: 0},
  truefalse: {prompt: 'حدّد الصواب في كل عبارة:', statements: ['العبارة الأولى', 'العبارة الثانية'], answer: [true, false]},
  order: {prompt: 'رتّب الخطوات من الأولى إلى الأخيرة:', items: ['الخطوة الثانية', 'الخطوة الأولى', 'الخطوة الثالثة'], answer: [1, 0, 2]},
  match: {prompt: 'صِل كل مصطلح بمعناه:', left: ['المصطلح أ', 'المصطلح ب'], right: ['معنى ب', 'معنى أ', 'معنى زائد'], answer: [1, 0]},
  buckets: {prompt: 'ضع كل عنصر في مجموعته:', buckets: ['المجموعة الأولى', 'المجموعة الثانية'], items: ['عنصر 1', 'عنصر 2', 'عنصر 3'], answer: [0, 1, 0]},
  slider: {prompt: 'كم تتوقع أن تكون القيمة؟', min: 0, max: 100, step: 5, initial: 50, unit: '%', answer: 70, tolerance: 10},
  hotspot: {prompt: 'أين الموضع الصحيح في الرسم؟', visual: {kind: 'chart', type: 'supply-demand', alt: 'رسم العرض والطلب وعليه نقاط مرقمة'},
    spots: [{id: 'a', x: 30, y: 20, label: 'الموضع الأول'}, {id: 'b', x: 50, y: 49, label: 'نقطة التوازن'}], answer: ['b']},
  fix: {prompt: 'في الجملة خطأ واحد. أين هو؟', tokens: ['الجزء الأول', 'الجزء الخاطئ', 'الجزء الأخير'], choices: ['التصحيح', 'بديل آخر'], answer: {index: 1, replacement: 0}},
  gap: {prompt: 'املأ الفراغ:', text: 'الجملة فيها ___ واحد.', bank: ['فراغ', 'خطأ'], answer: ['فراغ']},
  predict: {prompt: 'ماذا تتوقع أن يحدث؟', options: ['التوقع الأول', 'التوقع الثاني'], answer: 0, reveal: {text: 'اكتب هنا ما يحدث فعلًا ولماذا.'}},
  type: {prompt: 'اكتب الكلمة المناسبة:', answer: ['الإجابة', 'صيغة أخرى مقبولة']},
  lab: {prompt: 'جرّب في المختبر وراقب النتيجة.', lab: {kind: 'civic', model: 'market'}},
  compose: {prompt: 'اكتب هذا التسلسل بحروف المسند:', target: 'ميم ← لام', palette: ['m', 'l', 'w', 'h'], answer: ['m', 'l']},
};

export const VISUAL_STARTERS = {
  chart: {type: 'supply-demand', alt: 'منحنى طلب نازل ومنحنى عرض صاعد'},
  stat: {indicator: 'population-total', years: [2000, 2025], alt: 'منحنى عدد سكان اليمن'},
  map: {highlight: ['YE13'], alt: 'خريطة اليمن مع تمييز أمانة العاصمة'},
  timeline: {events: [{year: 1990, label: 'الحدث الأول'}, {year: 2000, label: 'الحدث الثاني'}], alt: 'خط زمني لحدثين'},
  layers: {layers: [{label: 'الطبقة الأولى'}, {label: 'الطبقة الثانية'}], alt: 'طبقتان متتاليتان'},
  image: {src: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Arabic_calligraphy_thuluth.svg', credit: 'اسم المصوّر · ويكيميديا كومنز', license: 'CC0', alt: 'وصف الصورة لقارئ الشاشة'},
  compare: {before: 'قبل', after: 'بعد', beforeLabel: 'الحال الأول', afterLabel: 'الحال الثاني', alt: 'مقارنة بين حالين'},
  scene: {scene: 'market', alt: 'سوق شعبي في صنعاء'},
  formula: {parts: ['الجزء الأول', 'الجزء الثاني', 'النتيجة'], alt: 'علاقة بين جزأين ونتيجة'},
  verse: {sadr: 'صدر البيت هنا', ajuz: 'عجز البيت هنا', alt: 'بيت شعري'},
  glyphs: {letters: ['m', 'l', 'w'], alt: 'ثلاثة حروف من خط المسند'},
  script: {text: 'العلم نور', script: 'naskh', alt: 'عبارة «العلم نور» مكتوبة بخط النسخ'},
  pad: {model: 'العلم نور', script: 'naskh', focus: 'اكتب العبارة بخط النسخ', instructions: 'انظر إلى النموذج، ثم اكتب العبارة على الأسطر بإصبعك أو بالقلم.', alt: 'لوح للكتابة الحرة بجانب نموذج بخط النسخ'},
  trace: {letter: 'm', alt: 'لوح لتتبّع حرف الميم في خط المسند'},
};

export const taskStarter = kind => ({kind, ...structuredClone(TASK_STARTERS[kind]), ...common});
export const visualStarter = kind => ({kind, ...structuredClone(VISUAL_STARTERS[kind])});

// درس بداية صالح: تحدٍّ ثم شرح ثم تمارين ثم خلاصة. 6 بطاقات، 4 تفاعلات، وعنصر مرئي في كل بطاقة.
export function starterLesson(title = 'عنوان الدرس') {
  return {
    format: 2, title, subtitle: 'سطر يشرح ما سيتعلمه الطالب', template: 'mixed', minutes: 4,
    summary: ['الفكرة الأولى التي تعلمها الطالب.', 'الفكرة الثانية التي تعلمها الطالب.'],
    cards: [
      {id: 'hook', role: 'hook', title: 'التحدي', visual: visualStarter('scene'), task: taskStarter('choice')},
      {id: 'idea', role: 'explain', title: 'الفكرة', text: 'اشرح الفكرة في سطرين أو ثلاثة.', visual: visualStarter('layers')},
      {id: 'practice-1', role: 'practice', visual: visualStarter('compare'), task: taskStarter('truefalse')},
      {id: 'practice-2', role: 'practice', visual: visualStarter('chart'), task: taskStarter('order')},
      {id: 'practice-3', role: 'practice', visual: visualStarter('formula'), task: taskStarter('gap')},
      {id: 'recap', role: 'recap', title: 'تذكّر', text: 'خلاصة الدرس في جملة.', visual: visualStarter('scene'), task: taskStarter('type')},
    ],
  };
}

// معرّف بطاقة جديد غير مكرر.
export function nextCardId(cards, base = 'card') {
  const ids = new Set(cards.map(c => c.id));
  for (let i = cards.length + 1; ; i++) if (!ids.has(`${base}-${i}`)) return `${base}-${i}`;
}
