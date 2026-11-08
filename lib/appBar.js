import {navSections} from './navigation.js';

// App-style top bar on phones: the current place in the platform and, on
// detail pages, a one-tap way back to the list it belongs to.
const EXTRA = [
  ['/school', 'مدرسة 967'], ['/games', 'ألعاب 967'],
  ['/explore', 'استكشف'], ['/search', 'البحث'],
  ['/account', 'حسابي'], ['/messages', 'الرسائل'], ['/notifications', 'الإشعارات'], ['/read-later', 'للقراءة لاحقًا'],
  ['/members', 'الأعضاء'], ['/login', 'الدخول'], ['/register', 'حساب جديد'], ['/forgot-password', 'استعادة كلمة المرور'], ['/update-password', 'كلمة مرور جديدة'],
  ['/admin', 'لوحة التحرير'], ['/contribute', 'ساهم معنا'], ['/about', 'من نحن'], ['/help', 'المساعدة'], ['/privacy', 'الخصوصية'], ['/terms', 'الشروط'],
  ['/yemen-in-numbers/timeline', 'المؤشرات عبر الزمن'], ['/games/leaderboard', 'لوحة المتصدرين'], ['/games/achievements', 'الشارات'],
  ['/school/dashboard', 'رحلتي التعليمية'], ['/school/courses/musnad', 'خط المسند'], ['/school/courses/arud', 'علم العروض'],
];
// EXTRA comes first so its labels win over generic menu labels for the same path.
const ROUTES = [...EXTRA, ...navSections.flatMap(section => section.links.filter(([href]) => href.startsWith('/') && !href.includes('#')))]
  .sort((a, b) => b[0].length - a[0].length);

/** {label, href, isRoot} for the bar, or null on the home page / unknown paths. */
export function appBarPlace(pathname = '/') {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/') return null;
  // A custom course stage returns to its own course map.
  const stage = path.match(/^\/school\/courses\/([^/]+)\/[^/]+$/);
  if (stage) return {label: 'خريطة المسار', href: '/school/courses/' + stage[1], isRoot: false};
  const match = ROUTES.find(([href]) => path === href || path.startsWith(href + '/'));
  if (!match) return null;
  const [href, label] = match;
  return {label, href, isRoot: path === href};
}
