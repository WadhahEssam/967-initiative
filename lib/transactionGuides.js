// «دليل المعاملات»: step-by-step guides to government transactions, one variant per city.
// Pure functions (no database), shared by the server, the editor and the public pages.
import {RequestValidationError} from './requestSecurity.js';

export const GUIDE_REGIONS = [
  {id: 'sanaa', name: 'صنعاء'},
  {id: 'aden', name: 'عدن'},
];
export const guideRegionName = id => GUIDE_REGIONS.find(region => region.id === id)?.name || '';

export const GUIDE_CATEGORIES = [
  {id: 'identity', name: 'الهوية والأحوال المدنية', icon: 'IdCard'},
  {id: 'travel', name: 'السفر', icon: 'Plane'},
  {id: 'vehicles', name: 'المركبات والقيادة', icon: 'Car'},
  {id: 'education', name: 'التعليم', icon: 'GraduationCap'},
  {id: 'legal', name: 'الأمن والقضاء', icon: 'Scale'},
  {id: 'business', name: 'العمل والتجارة', icon: 'Briefcase'},
  {id: 'other', name: 'معاملات أخرى', icon: 'Landmark'},
];
export const guideCategory = id => GUIDE_CATEGORIES.find(category => category.id === id) || GUIDE_CATEGORIES.at(-1);

// Each step has a kind, drawn as its own illustration. Photos can replace them later.
export const STEP_KINDS = [
  {id: 'visit', name: 'التوجه إلى الجهة', icon: 'MapPin'},
  {id: 'documents', name: 'تجهيز الأوراق', icon: 'FileStack'},
  {id: 'photo', name: 'الصور الشخصية', icon: 'Camera'},
  {id: 'form', name: 'تعبئة النموذج', icon: 'ClipboardPen'},
  {id: 'counter', name: 'مراجعة الموظف', icon: 'UserRound'},
  {id: 'payment', name: 'دفع الرسوم', icon: 'Receipt'},
  {id: 'fingerprint', name: 'البصمة', icon: 'Fingerprint'},
  {id: 'medical', name: 'الفحص الطبي', icon: 'Stethoscope'},
  {id: 'exam', name: 'الاختبار', icon: 'ClipboardCheck'},
  {id: 'stamp', name: 'التوقيع والختم', icon: 'Stamp'},
  {id: 'wait', name: 'الانتظار', icon: 'Hourglass'},
  {id: 'online', name: 'خطوة إلكترونية', icon: 'Smartphone'},
  {id: 'receive', name: 'الاستلام', icon: 'BadgeCheck'},
];
export const stepKind = id => STEP_KINDS.find(kind => kind.id === id) || STEP_KINDS[0];

export const GUIDE_STATUSES = [
  {id: 'draft', name: 'مسودة'},
  {id: 'review', name: 'بانتظار التحقق'},
  {id: 'published', name: 'منشور'},
];

// A guide checked more than six months ago carries a notice asking readers to confirm.
export const GUIDE_STALE_AFTER_MS = 183 * 864e5;
export const guideIsStale = (verifiedAt, now = Date.now()) => !verifiedAt || now - Date.parse(verifiedAt) > GUIDE_STALE_AFTER_MS;

const LIMITS = {title: 120, summary: 400, audience: 400, text: 600, line: 300, short: 160, lines: 30, steps: 25};

function text(value, max, label, {required = false} = {}) {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new RequestValidationError(label + ' غير صالح.');
  const clean = (value || '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (required && !clean) throw new RequestValidationError('أدخل ' + label + '.');
  if (clean.length > max) throw new RequestValidationError(label + ' أطول من المسموح (' + max + ' حرفًا).');
  return clean;
}
// Lists are typed one item per line in the editor, or sent as arrays.
function lines(value, label) {
  const items = (Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : value == null ? [] : null);
  if (!items) throw new RequestValidationError(label + ' غير صالحة.');
  const clean = items.map(item => text(typeof item === 'string' ? item.replace(/^[-•*\d.)\s]+/, '') : item, LIMITS.line, label)).filter(Boolean);
  if (clean.length > LIMITS.lines) throw new RequestValidationError(label + ': الحد ' + LIMITS.lines + ' سطرًا.');
  return clean;
}
function link(value) {
  const clean = text(value, 500, 'رابط الموقع');
  if (!clean) return '';
  let url;
  try { url = new URL(clean); } catch { throw new RequestValidationError('رابط الموقع على الخريطة غير صالح.'); }
  if (url.protocol !== 'https:') throw new RequestValidationError('رابط الموقع يجب أن يبدأ بـ https.');
  return url.toString();
}

// Questions readers ask, answered once for both cities.
function faqs(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new RequestValidationError('الأسئلة الشائعة: الحد 20 سؤالًا.');
  return value.map((item, index) => ({q: text(item?.q, 200, 'السؤال ' + (index + 1)), a: text(item?.a, 800, 'جواب السؤال ' + (index + 1))})).filter(item => item.q || item.a).map((item, index) => {
    if (!item.q || !item.a) throw new RequestValidationError('أكمل السؤال والجواب رقم ' + (index + 1) + '.');
    return item;
  });
}
// Other guides worth reading next, by their short link.
function related(value, self) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new RequestValidationError('المعاملات المرتبطة غير صالحة.');
  const clean = [...new Set(value.filter(item => typeof item === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(item) && item !== self))];
  if (clean.length > 6) throw new RequestValidationError('المعاملات المرتبطة: الحد 6.');
  return clean;
}

export const emptyVariant = () => ({authority: '', place: '', mapUrl: '', hours: '', fees: '', duration: '', delegate: '', online: '', documents: [], steps: [], tips: [], mistakes: []});

export function normalizeVariant(input = {}, regionName = '') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestValidationError('بيانات ' + regionName + ' غير صالحة.');
  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (steps.length > LIMITS.steps) throw new RequestValidationError('الحد ' + LIMITS.steps + ' خطوة لكل مدينة.');
  return {
    authority: text(input.authority, LIMITS.short, 'الجهة'),
    place: text(input.place, LIMITS.line, 'المكان'),
    mapUrl: link(input.mapUrl),
    hours: text(input.hours, LIMITS.short, 'أوقات الدوام'),
    fees: text(input.fees, LIMITS.line, 'الرسوم'),
    duration: text(input.duration, LIMITS.short, 'المدة'),
    delegate: text(input.delegate, LIMITS.line, 'من ينوب عنك'),
    online: text(input.online, LIMITS.line, 'الخدمة الإلكترونية'),
    documents: lines(input.documents, 'الأوراق المطلوبة'),
    steps: steps.map((step, index) => {
      if (!step || typeof step !== 'object') throw new RequestValidationError('الخطوة ' + (index + 1) + ' غير صالحة.');
      if (step.kind && !STEP_KINDS.some(kind => kind.id === step.kind)) throw new RequestValidationError('نوع الخطوة ' + (index + 1) + ' غير معروف.');
      return {kind: step.kind || 'visit', title: text(step.title, LIMITS.short, 'عنوان الخطوة ' + (index + 1), {required: true}), text: text(step.text, LIMITS.text, 'شرح الخطوة ' + (index + 1))};
    }),
    tips: lines(input.tips, 'النصائح'),
    mistakes: lines(input.mistakes, 'الأخطاء الشائعة'),
  };
}

// Checks a guide from the editor. Publishing needs a verification date and steps for at least
// one city, so nothing unchecked reaches visitors.
export function validateGuide(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestValidationError('بيانات الدليل غير صالحة.');
  const slug = text(input.slug, 60, 'الرابط المختصر', {required: true}).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new RequestValidationError('الرابط المختصر بحروف إنجليزية صغيرة وأرقام وشرطات فقط، مثل passport.');
  if (!GUIDE_CATEGORIES.some(category => category.id === input.category)) throw new RequestValidationError('اختر تصنيف المعاملة.');
  if (!GUIDE_STATUSES.some(status => status.id === input.status)) throw new RequestValidationError('حالة الدليل غير معروفة.');
  const variants = {};
  for (const region of GUIDE_REGIONS) variants[region.id] = normalizeVariant(input.variants?.[region.id] || emptyVariant(), region.name);
  let verifiedAt = null;
  if (input.verifiedAt) {
    const day = text(input.verifiedAt, 10, 'تاريخ التحقق');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day + 'T00:00:00Z'))) throw new RequestValidationError('تاريخ التحقق غير صالح.');
    if (Date.parse(day + 'T00:00:00Z') > Date.now() + 864e5) throw new RequestValidationError('تاريخ التحقق في المستقبل.');
    verifiedAt = day;
  }
  const guide = {
    slug,
    title: text(input.title, LIMITS.title, 'عنوان المعاملة', {required: true}),
    summary: text(input.summary, LIMITS.summary, 'الوصف المختصر'),
    audience: text(input.audience, LIMITS.audience, 'لمن هذه المعاملة'),
    category: input.category,
    status: input.status,
    variants,
    sources: lines(input.sources, 'المصادر'),
    verifiedAt,
    verifiedBy: text(input.verifiedBy, 80, 'اسم من تحقق'),
    editorNote: text(input.editorNote, LIMITS.text, 'ملاحظة للمحررين'),
    faqs: faqs(input.faqs),
    related: related(input.related, slug),
    featured: input.featured === true,
  };
  if (guide.status === 'published') {
    if (!guide.verifiedAt) throw new RequestValidationError('لا يُنشر الدليل قبل التحقق منه. أدخل تاريخ التحقق أولًا.');
    if (!GUIDE_REGIONS.some(region => variants[region.id].steps.length)) throw new RequestValidationError('أضف خطوات لمدينة واحدة على الأقل قبل النشر.');
  }
  return guide;
}

// The cities that have content, in order; the public page offers a switch only between these.
export const guideRegions = guide => GUIDE_REGIONS.filter(region => {
  const variant = guide?.variants?.[region.id];
  return variant && (variant.steps?.length || variant.documents?.length);
});

// The checklist as a message to send on WhatsApp.
export function checklistMessage(guide, regionId, url = '') {
  const variant = guide.variants?.[regionId];
  if (!variant) return '';
  return [
    'الأوراق المطلوبة لـ«' + guide.title + '» في ' + guideRegionName(regionId) + ':',
    ...variant.documents.map(item => '- ' + item),
    variant.fees ? 'الرسوم: ' + variant.fees : '',
    url ? 'التفاصيل والخطوات: ' + url : '',
  ].filter(Boolean).join('\n');
}

// Counts for a card or the «باختصار» strip: steps and documents in the first city with content.
export function guideStats(guide, regionId) {
  const region = regionId || guideRegions(guide)[0]?.id;
  const variant = guide?.variants?.[region] || {};
  return {steps: variant.steps?.length || 0, documents: variant.documents?.length || 0, cities: guideRegions(guide).map(item => item.name)};
}
