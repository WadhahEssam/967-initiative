import {pageIsVisible} from './pageVisibility.js';

// One navigation vocabulary for the header, the mobile menu, the footer and the
// home page "doors". Section names are nouns; actions elsewhere are verbs.
// Every link still passes through the editorial visibility settings.
export const navSections = [
  {
    id: 'media', label: 'الإعلام', lead: 'شاهد واقرأ',
    description: 'أعمال مصوّرة وحوارات، ومجلة 967 بأعدادها، ومناظرات منظّمة تتسع للرأي الآخر.',
    // Each phrase belongs to a link; hidden sections drop out of the description too.
    parts: {'/works': 'أعمال مصوّرة وحوارات', '/magazine': 'مجلة 967 بأعدادها', '/debates': 'مناظرات منظّمة تتسع للرأي الآخر'},
    links: [['/works', 'الأعمال الإعلامية'], ['/magazine', 'مجلة 967'], ['/debates', 'مناظرات 967']],
  },
  {
    id: 'knowledge', label: 'المعرفة', lead: 'افهم اليمن',
    description: 'مؤشرات وطنية بمصادرها، وموقع اليمن في العالم، وخريطة المحافظات، وشخصيات وتاريخ.',
    links: [['/yemen-in-numbers', 'اليمن بالأرقام'], ['/yemen-ranking', 'ترتيب اليمن'], ['/yemen-map', 'خريطة اليمن'], ['/yemeni-figures', 'شخصيات يمنية'], ['/yemen-history', 'تاريخ اليمن']],
  },
  {
    id: 'school', label: 'مدرسة 967', lead: 'تعلّم بالتجربة', standalone: true,
    description: 'مسارات تفاعلية في الكتابة والعلوم والتفكير والسياسة والاقتصاد. التصفح مفتوح، وحفظ التقدم بحساب.',
    links: [['/school', 'جميع المسارات'], ['/school/writing', 'الكتابة والأدب'], ['/school/nature', 'الفلك والطبيعة'], ['/school/logic', 'المنطق والتفكير'], ['/school/civic', 'السياسة والاقتصاد'], ['/school/dashboard', 'رحلتي التعليمية']],
  },
  {
    id: 'games', label: 'ألعاب 967', lead: 'العب وتحدَّ', standalone: true,
    description: 'تسع ألعاب قصيرة عن اليمن، مع تحدٍّ يومي واحد للجميع ولوحة متصدرين أسبوعية.',
    links: [['/games', 'جميع الألعاب'], ['/games/leaderboard', 'لوحة المتصدرين'], ['/games/achievements', 'الشارات والإنجازات']],
  },
  {
    id: 'market', label: 'سوق 967', lead: 'بِع واشترِ', standalone: true,
    description: 'سوق مجاني للبيع والشراء بين الناس داخل اليمن: انشر إعلانك بصوره، وراسل البائع، وقدّم عرض سعر.',
    links: [['/market', 'تصفح السوق'], ['/market/new', 'أضف إعلانًا'], ['/market/mine', 'إعلاناتي']],
  },
  {
    id: 'directories', label: 'الأدلة', lead: 'اعثر على',
    description: 'أدلة معلوماتية بمصادر وتواريخ تحقق: شركات ومنتجات، ومهنيون، وجامعات، ومراكز طبية.',
    parts: {'/yemeni-products': 'شركات ومنتجات', '/professionals': 'مهنيون', '/universities': 'جامعات', '/medical-centers': 'مراكز طبية'}, partsLead: 'أدلة معلوماتية بمصادر وتواريخ تحقق: ',
    links: [['/yemeni-products', 'منتجات يمنية'], ['/professionals', 'المهنيون'], ['/universities', 'الجامعات والمعاهد'], ['/medical-centers', 'المراكز الطبية']],
  },
  {
    id: 'services', label: 'الخدمات', lead: 'استفد يوميًا',
    description: 'معلومات عملية تتجدد كل يوم: أسعار الصرف في صنعاء وعدن، مع حاسبة للصرف والحوالات.',
    links: [['/services/exchange-rates', 'أسعار الصرف'], ['/services', 'كل الخدمات']],
  },
  {
    id: 'initiative', label: 'المبادرة', lead: 'شارك معنا',
    description: 'من نحن وما نعمل عليه، وكيف ترسل تصحيحًا أو فكرة أو طلب إدراج.',
    links: [['/#about', 'من نحن'], ['/#projects', 'مشاريعنا'], ['/contribute', 'ساهم معنا']],
  },
];

// Managed initiative pages (about/help/privacy-requests) replace the static
// "من نحن" anchor when editors publish them, exactly as before.
// «أ، وب، وج» from the phrases of the links that are shown.
export function describeVisible(section, visible) {
  if (!section.parts) return section.description;
  const phrases = visible.map(([href]) => section.parts[href]).filter(Boolean);
  if (!phrases.length) return section.description;
  const text = phrases.map((phrase, index) => index ? 'و' + phrase : phrase).join('، ');
  return (section.partsLead || '') + text + '.';
}

export function resolveNavSections({contentLinks = [], visibility = {}, pages = []} = {}) {
  return navSections.map(section => {
    let links = section.links;
    if (section.id === 'initiative') {
      const managed = contentLinks.filter(item => ['about', 'help', 'privacy-requests'].includes(item.slug)).map(item => [item.href, item.title]);
      links = [...(managed.length ? managed : [['/#about', 'من نحن']]), ['/#projects', 'مشاريعنا'], ['/contribute', 'ساهم معنا']];
    }
    const visible = links.filter(([href]) => pageIsVisible(href, visibility, pages));
    return {...section, links: visible, description: describeVisible(section, visible)};
  }).filter(section => section.links.length);
}

export const utilityLinks = {
  search: ['/search', 'البحث'],
  saved: ['/read-later', 'للقراءة لاحقاً'],
  login: ['/login', 'الدخول'],
  account: ['/account', 'حسابي'],
  editor: ['/admin', 'لوحة التحرير'],
};
