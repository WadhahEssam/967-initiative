// «المُبلّغ المحلي»: what members send and what readers see about it. Pure functions shared by the
// server, the report form and the pages. Nothing here may reveal a report's status, a member's
// weight or a ban: readers only see the price, how many people it rests on, and how fresh it is.
import {RequestValidationError} from './requestSecurity.js';
import {RATE_CURRENCIES,RATE_REGIONS,parseRateNumber} from './exchangeRates.js';
import {FOOD_ITEMS,FOOD_REGIONS,parsePrice} from './foodPrices.js';

export const REPORT_REGIONS = RATE_REGIONS;
// One report per member for the same thing in the same city every 6 hours, 20 a day.
export const REPORT_EVERY_HOURS = 6;
export const REPORTS_PER_DAY = 20;
// Reporting is open to accounts at least this old.
export const MIN_ACCOUNT_AGE_DAYS = 3;
export const REPORT_THANKS = 'شكراً، سيظهر بلاغك بعد تأكيده من آخرين.';
export const CONFIRM_THANKS = 'شكراً لتأكيدك، يساعد هذا الناس في مدينتك.';
export const SIGNUP_PROMPT = 'سجّل لتساعد الناس في مدينتك على معرفة السعر الحقيقي';

export const CONFIDENCE = {
  trusted: {label: 'موثوق', hint: 'يستند إلى خمسة بلاغات متقاربة أو أكثر، أو إلى مصدر موثّق.'},
  estimated: {label: 'تقديري', hint: 'يستند إلى بلاغات قليلة متقاربة. تأكد منه قبل التعامل.'},
  stale: {label: 'قديم', hint: 'لم يؤكده أحد منذ مدة. قد يكون السعر تغيّر.'},
};

const key = (...parts) => parts.join(':');

// Checks what the form sends: {kind, region, item, side, value, source}. Returns a clean entry.
// Only the shape is checked here: an unlikely price is accepted and simply not counted, and the
// member is never told so.
export function validateReportInput(input) {
  if (!input || typeof input !== 'object') throw new RequestValidationError('بيانات البلاغ غير صالحة.');
  const region = REPORT_REGIONS.find(item => item.id === input.region);
  if (!region) throw new RequestValidationError('اختر المدينة.');
  const source = typeof input.source === 'string' ? input.source.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
  if (input.kind === 'rate') {
    const currency = RATE_CURRENCIES.find(item => item.id === input.item);
    if (!currency) throw new RequestValidationError('اختر العملة.');
    if (!['buy', 'sell'].includes(input.side)) throw new RequestValidationError('اختر الشراء أو البيع.');
    const value = parseRateNumber(input.value);
    if (!(value > 0) || value >= 100000) throw new RequestValidationError('اكتب السعر بالأرقام، مثل 535.');
    return {kind: 'rate', region: region.id, item: currency.id, side: input.side, value, source: source || null};
  }
  if (input.kind === 'food') {
    const item = FOOD_ITEMS.find(entry => entry.id === input.item);
    if (!item) throw new RequestValidationError('اختر المادة.');
    const value = parsePrice(input.value);
    if (!(value > 0) || value >= 10000000) throw new RequestValidationError('اكتب السعر بالأرقام، مثل 9500.');
    return {kind: 'food', region: region.id, item: item.id, side: 'price', value, source: source || null};
  }
  throw new RequestValidationError('نوع البلاغ غير معروف.');
}

// «السعر صحيح»: which prices a tap confirms. Currencies: the buy and sell price of the dollar in
// that city (the two prices on the card); food: the item's price. The server confirms the price it
// shows at that moment, never a number sent by the browser.
export function confirmTargets(input) {
  const region = REPORT_REGIONS.find(item => item.id === input?.region);
  if (!region) throw new RequestValidationError('اختر المدينة.');
  if (input.kind === 'rate') {
    const currency = RATE_CURRENCIES.find(item => item.id === (input.item || 'USD'));
    if (!currency) throw new RequestValidationError('اختر العملة.');
    return ['buy', 'sell'].map(side => ({kind: 'rate', region: region.id, item: currency.id, side}));
  }
  if (input.kind === 'food' && FOOD_ITEMS.some(item => item.id === input.item)) return [{kind: 'food', region: region.id, item: input.item, side: 'price'}];
  throw new RequestValidationError('اختر المادة.');
}

// «بلاغ واحد»، «بلاغين»، «3 بلاغات»، «12 بلاغًا».
export function reportsText(count) {
  if (count === 1) return 'بلاغ واحد';
  if (count === 2) return 'بلاغين';
  if (count >= 3 && count <= 10) return count + ' بلاغات';
  return count + ' بلاغًا';
}

// «قبل دقيقة»، «قبل 40 دقيقة»، «قبل ساعتين»، «قبل 3 أيام».
export function agoText(at, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - at) / 60e3));
  const say = (count, one, two, few, many) => count === 1 ? one : count === 2 ? two : count <= 10 ? count + ' ' + few : count + ' ' + many;
  if (minutes < 1) return 'قبل لحظات';
  if (minutes < 60) return 'قبل ' + say(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return 'قبل ' + say(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const days = Math.round(hours / 24);
  return 'قبل ' + say(days, 'يوم', 'يومين', 'أيام', 'يومًا');
}

// The line under a price: «بناءً على 12 بلاغًا · آخر تحديث قبل 40 دقيقة», or «من فريق 967» when no
// member has reported since the team's entry.
export function basisText(entry, now = Date.now()) {
  if (!entry) return '';
  const basis = entry.count > 0 ? 'بناءً على ' + reportsText(entry.count) : 'من فريق 967';
  return entry.lastActivityAt ? basis + ' · آخر تحديث ' + agoText(entry.lastActivityAt, now) : basis;
}

// «يتراوح بين 530 و536», only when reports differ.
export function rangeText(entry, format = String) {
  if (!entry || !(entry.low > 0) || !(entry.high > entry.low)) return '';
  return 'يتراوح بين ' + format(entry.low) + ' و' + format(entry.high);
}

// The rates the page shows: the computed buy and sell price where both exist, the editor's entry
// otherwise. Each row keeps the editor shape ({buy, sell, recorded_at}) so the converter and the
// rest of the page work unchanged, plus `community` for the card.
export function mergeRates(editorLatest = {}, board = null) {
  const merged = {...editorLatest};
  if (!board) return merged;
  for (const region of RATE_REGIONS) for (const currency of RATE_CURRENCIES) {
    const buy = board[key('rate', region.id, currency.id, 'buy')], sell = board[key('rate', region.id, currency.id, 'sell')];
    if (!(buy?.value > 0) || !(sell?.value > 0) || buy.confidence === 'expired' || sell.confidence === 'expired') continue;
    const last = Math.max(buy.lastActivityAt || 0, sell.lastActivityAt || 0);
    merged[key(region.id, currency.id)] = {
      ...(editorLatest[key(region.id, currency.id)] || {}),
      region: region.id, currency: currency.id, buy: buy.value, sell: sell.value,
      recorded_at: new Date(last).toISOString(),
      community: {count: Math.max(buy.count, sell.count), confidence: sell.confidence === 'stale' || buy.confidence === 'stale' ? 'stale' : sell.confidence === 'trusted' && buy.confidence === 'trusted' ? 'trusted' : 'estimated', low: sell.low, high: sell.high, lastActivityAt: last},
    };
  }
  return merged;
}

// The food prices the page shows, in the shape of latestFoodPrices(): {latest, previous} per city
// and item. The computed price replaces the latest one; the editor's entry before it stays the
// «previous» used for the change arrow.
export function mergeFood(editorPairs = {}, board = null) {
  const merged = {...editorPairs};
  if (!board) return merged;
  for (const region of FOOD_REGIONS) for (const item of FOOD_ITEMS) {
    const entry = board[key('food', region.id, item.id, 'price')];
    if (!(entry?.value > 0) || entry.confidence === 'expired') continue;
    const pair = editorPairs[key(region.id, item.id)];
    const sameAsEditor = Boolean(pair?.latest) && Number(pair.latest.price) === entry.value;
    merged[key(region.id, item.id)] = {
      latest: {...(pair?.latest || {}), price: entry.value, recorded_at: new Date(entry.lastActivityAt).toISOString(), note: sameAsEditor ? pair.latest.note || '' : ''},
      previous: sameAsEditor ? pair?.previous || null : pair?.latest || null,
      community: {count: entry.count, confidence: entry.confidence, low: entry.low, high: entry.high, lastActivityAt: entry.lastActivityAt},
    };
  }
  return merged;
}

// «الدولار · بيع · صنعاء», «الأرز · صنعاء»: how editors read an instrument in alerts and lists.
export function describeInstrument({kind, region, item, side}) {
  const city = REPORT_REGIONS.find(entry => entry.id === region)?.name || region || '';
  if (kind === 'rate') {
    const currency = RATE_CURRENCIES.find(entry => entry.id === item)?.short || item;
    return [currency, side === 'buy' ? 'شراء' : side === 'sell' ? 'بيع' : '', city].filter(Boolean).join(' · ');
  }
  const food = FOOD_ITEMS.find(entry => entry.id === item);
  return [food ? food.name + ' (' + food.unit + ')' : item, city].filter(Boolean).join(' · ');
}
