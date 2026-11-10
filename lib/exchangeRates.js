// «أسعار الصرف»: rates entered by hand every day for Sanaa and Aden, and the converter maths.
// Pure functions (no database), shared by the server, the entry form and the public page.
import {RequestValidationError} from './requestSecurity.js';
import {toLatinDigits} from './format.js';

// The two cities differ because different notes circulate in each; the page says so plainly.
export const RATE_REGIONS = [
  {id: 'sanaa', name: 'صنعاء', hint: 'يُعتمد غالبًا في صنعاء والمحافظات المتعاملة بالعملة القديمة.'},
  {id: 'aden', name: 'عدن', hint: 'يُعتمد غالبًا في عدن والمحافظات المتعاملة بالعملة الجديدة.'},
];
export const RATE_CURRENCIES = [
  {id: 'USD', name: 'الدولار الأمريكي', short: 'دولار'},
  {id: 'SAR', name: 'الريال السعودي', short: 'ريال سعودي'},
];
export const YER = {id: 'YER', name: 'الريال اليمني', short: 'ريال يمني'};
export const regionName = id => RATE_REGIONS.find(region => region.id === id)?.name || '';
export const currencyName = id => (id === 'YER' ? YER : RATE_CURRENCIES.find(currency => currency.id === id))?.short || '';

const HOUR = 3600e3;
// A rate older than a day carries a warning; older than two days it is not shown or used.
export const STALE_AFTER_MS = 24 * HOUR;
export const EXPIRED_AFTER_MS = 48 * HOUR;
// The entry form asks before saving a rate that moved more than this since the last one.
export const LARGE_CHANGE = 0.1;
// Buy/sell spread above this is almost certainly a typing mistake.
const MAX_SPREAD = 0.1;

export function rateFreshness(recordedAt, now = Date.now()) {
  const at = Date.parse(recordedAt);
  if (!Number.isFinite(at)) return 'expired';
  const age = now - at;
  return age > EXPIRED_AFTER_MS ? 'expired' : age > STALE_AFTER_MS ? 'stale' : 'fresh';
}

export function parseRateNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const text = toLatinDigits(value).replace(/[٫]/g, '.').replace(/[,،\s]/g, '').trim();
  return /^\d{1,6}(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
}

const key = (region, currency) => region + ':' + currency;

// The latest visible rate for each city and currency: {'aden:USD': row, ...}.
export function latestRates(rows = []) {
  const latest = {};
  for (const row of rows) {
    if (!row || row.hidden) continue;
    const k = key(row.region, row.currency), seen = latest[k];
    if (!seen || Date.parse(row.recorded_at) > Date.parse(seen.recorded_at)) latest[k] = row;
  }
  return latest;
}

// Checks one submission. input: {rates:[{region,currency,buy,sell}], note, confirmLargeChange}.
// previous: latestRates() before this entry. Returns {rates, note}; a large move without
// confirmation throws with status 409 and the list of moves, so the form can ask.
export function validateRateEntry(input, previous = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.rates)) throw new RequestValidationError('بيانات الأسعار غير صالحة.');
  const rates = [], seen = new Set();
  for (const item of input.rates) {
    const region = RATE_REGIONS.find(r => r.id === item?.region), currency = RATE_CURRENCIES.find(c => c.id === item?.currency);
    if (!region || !currency) throw new RequestValidationError('مدينة أو عملة غير معروفة.');
    const buyText = String(item.buy ?? '').trim(), sellText = String(item.sell ?? '').trim();
    if (!buyText && !sellText) continue; // A pair left empty is simply not updated.
    const label = currency.short + ' في ' + region.name;
    const buy = parseRateNumber(item.buy), sell = parseRateNumber(item.sell);
    if (!(buy > 0) || !(sell > 0)) throw new RequestValidationError('أدخل سعري الشراء والبيع لـ' + label + ' بأرقام صحيحة.');
    if (sell < buy) throw new RequestValidationError('سعر البيع لـ' + label + ' أقل من سعر الشراء. تحقق من الترتيب.');
    if ((sell - buy) / buy > MAX_SPREAD) throw new RequestValidationError('الفرق بين الشراء والبيع لـ' + label + ' كبير جدًا. تحقق من الرقمين.');
    const k = key(region.id, currency.id);
    if (seen.has(k)) throw new RequestValidationError('تكرر سعر ' + label + '.');
    seen.add(k);
    rates.push({region: region.id, currency: currency.id, buy, sell});
  }
  if (!rates.length) throw new RequestValidationError('أدخل سعرًا واحدًا على الأقل.');
  // The riyal follows the dollar (about 3.75 riyals to the dollar): a ratio far from that is a typo.
  for (const region of RATE_REGIONS) {
    const pick = c => rates.find(r => r.region === region.id && r.currency === c) || previous[key(region.id, c)];
    const usd = pick('USD'), sar = pick('SAR');
    if (usd && sar && rates.some(r => r.region === region.id)) {
      const ratio = Number(usd.sell) / Number(sar.sell);
      if (ratio < 3.3 || ratio > 4.3) throw new RequestValidationError('سعر الدولار والريال السعودي في ' + region.name + ' غير متناسبين. تحقق من الأرقام.');
    }
  }
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : '';
  const moves = rates.map(rate => {
    const before = previous[key(rate.region, rate.currency)];
    if (!before) return null;
    const change = (rate.sell - Number(before.sell)) / Number(before.sell);
    return Math.abs(change) > LARGE_CHANGE ? {region: rate.region, currency: rate.currency, from: Number(before.sell), to: rate.sell, change} : null;
  }).filter(Boolean);
  if (moves.length && input.confirmLargeChange !== true) {
    const error = new RequestValidationError('تغيّر ' + moves.map(m => 'سعر ' + currencyName(m.currency) + ' في ' + regionName(m.region) + ' بنسبة ' + Math.round(Math.abs(m.change) * 100) + '%').join('، و') + '. أكّد أن الأرقام صحيحة.', 409);
    error.moves = moves;
    throw error;
  }
  return {rates, note};
}

// Converts with the rates of one city. Selling foreign currency to a changer uses its «buy»
// price; buying foreign currency uses its «sell» price. feePercent is the changer's commission.
export function convertAmount({amount, from, to, region, rates, feePercent = 0}) {
  const value = parseRateNumber(String(amount ?? '')), fee = Number(feePercent) || 0;
  if (!(value > 0) || from === to || fee < 0 || fee >= 100) return null;
  const rate = currency => rates[key(region, currency)];
  let yer;
  if (from === 'YER') yer = value;
  else { const r = rate(from); if (!r) return null; yer = value * Number(r.buy); }
  let result;
  if (to === 'YER') result = yer;
  else { const r = rate(to); if (!r) return null; result = yer / Number(r.sell); }
  const net = result * (1 - fee / 100);
  return {result: net, fee: result - net};
}

// An estimate of a transfer in rials between the two cities: the rials buy dollars in the
// sending city (its «sell» price) and the dollars become rials in the receiving city («buy»).
export function transferEstimate({amount, fromRegion, toRegion, rates, feePercent = 0}) {
  const value = parseRateNumber(String(amount ?? '')), fee = Number(feePercent) || 0;
  if (!(value > 0) || fromRegion === toRegion || fee < 0 || fee >= 100) return null;
  const sending = rates[key(fromRegion, 'USD')], receiving = rates[key(toRegion, 'USD')];
  if (!sending || !receiving) return null;
  const gross = value / Number(sending.sell) * Number(receiving.buy), net = gross * (1 - fee / 100);
  return {result: net, fee: gross - net, dollars: value / Number(sending.sell)};
}

// The calendar day in Yemen (UTC+3) of a timestamp, as YYYY-MM-DD.
export const adenDay = at => new Date(Date.parse(at) + 3 * HOUR).toISOString().slice(0, 10);

// The last sell price of each day for one city and currency, oldest first, over `days` days.
export function dailySeries(rows = [], region, currency, days = 30, now = Date.now()) {
  const since = adenDay(new Date(now - (days - 1) * 24 * HOUR).toISOString());
  const byDay = new Map();
  for (const row of rows) {
    if (row.hidden || row.region !== region || row.currency !== currency) continue;
    const day = adenDay(row.recorded_at);
    if (day < since) continue;
    const seen = byDay.get(day);
    if (!seen || Date.parse(row.recorded_at) > Date.parse(seen.recorded_at)) byDay.set(day, row);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, row]) => ({day, sell: Number(row.sell), buy: Number(row.buy)}));
}

// «الثلاثاء 10 نوفمبر، 9:30 ص» in Yemen time, whatever the reader's or server's time zone.
export function formatRateTime(at, options = {weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'}) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-YE-u-nu-latn', {...options, timeZone: 'Asia/Aden', numberingSystem: 'latn'}).format(date);
}
export const formatRateDay = day => formatRateTime(day + 'T12:00:00+03:00', {day: 'numeric', month: 'long'});
// Rates that may still be shown (fresh or a day old); expired ones are left out entirely.
export function usableRates(latest = {}, now = Date.now()) {
  return Object.fromEntries(Object.entries(latest).filter(([, row]) => rateFreshness(row.recorded_at, now) !== 'expired'));
}
