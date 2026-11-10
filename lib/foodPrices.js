// «أسعار المواد الأساسية»: prices entered by hand every week for Sanaa and Aden.
// Pure functions (no database), shared by the server, the entry form and the public page.
import {RequestValidationError} from './requestSecurity.js';
import {toLatinDigits} from './format.js';
import {RATE_REGIONS} from './exchangeRates.js';

export const FOOD_REGIONS = RATE_REGIONS;

export const FOOD_GROUPS = [
  {id: 'grains', name: 'الحبوب والخبز'},
  {id: 'legumes', name: 'البقوليات'},
  {id: 'pantry', name: 'السكر والزيت والملح'},
  {id: 'produce', name: 'الخضار'},
  {id: 'protein', name: 'اللحوم والبيض والحليب'},
  {id: 'energy', name: 'الغاز والوقود والماء'},
];

// Each item is priced in the unit people buy it in. `per` gives the price per kilo or litre
// for bulk units, so a 50 kg bag and a 10 kg bag can be compared.
// Items are defined here, not in the database: adding one needs no migration.
export const FOOD_ITEMS = [
  {id: 'wheat_flour', group: 'grains', name: 'دقيق القمح', unit: 'كيس 50 كيلو', per: {size: 50, unit: 'الكيلو'}},
  {id: 'rice', group: 'grains', name: 'الأرز', unit: 'كيس 10 كيلو', per: {size: 10, unit: 'الكيلو'}},
  {id: 'bread', group: 'grains', name: 'الروتي', unit: 'حبة'},
  {id: 'lentils', group: 'legumes', name: 'العدس', unit: 'كيلو'},
  {id: 'red_beans', group: 'legumes', name: 'الفاصوليا الحمراء', unit: 'علبة'},
  {id: 'fava_beans', group: 'legumes', name: 'الفول', unit: 'علبة'},
  {id: 'sugar', group: 'pantry', name: 'السكر', unit: 'كيس 50 كيلو', per: {size: 50, unit: 'الكيلو'}},
  {id: 'cooking_oil', group: 'pantry', name: 'زيت الطبخ', unit: 'دبة 20 لتر', per: {size: 20, unit: 'اللتر'}},
  {id: 'salt', group: 'pantry', name: 'الملح', unit: 'كيلو'},
  {id: 'tomatoes', group: 'produce', name: 'الطماطم', unit: 'كيلو'},
  {id: 'potatoes', group: 'produce', name: 'البطاطس', unit: 'كيلو'},
  {id: 'onions', group: 'produce', name: 'البصل', unit: 'كيلو'},
  {id: 'chicken', group: 'protein', name: 'الدجاج', unit: 'كيلو'},
  {id: 'beef', group: 'protein', name: 'اللحم البقري', unit: 'كيلو'},
  {id: 'lamb', group: 'protein', name: 'اللحم الغنمي', unit: 'كيلو'},
  {id: 'eggs', group: 'protein', name: 'البيض', unit: 'طبق 30 بيضة'},
  {id: 'milk_powder', group: 'protein', name: 'الحليب المجفف', unit: 'علبة 2.5 كيلو', per: {size: 2.5, unit: 'الكيلو'}},
  {id: 'infant_formula', group: 'protein', name: 'حليب الأطفال', unit: 'علبة 400 غرام'},
  {id: 'cooking_gas', group: 'energy', name: 'غاز الطبخ', unit: 'أسطوانة'},
  {id: 'petrol', group: 'energy', name: 'البترول', unit: 'دبة 20 لتر', per: {size: 20, unit: 'اللتر'}},
  {id: 'diesel', group: 'energy', name: 'الديزل', unit: 'دبة 20 لتر', per: {size: 20, unit: 'اللتر'}},
  {id: 'water_truck', group: 'energy', name: 'وايت الماء', unit: 'وايت'},
];
export const foodItem = id => FOOD_ITEMS.find(item => item.id === id);
export const foodRegionName = id => FOOD_REGIONS.find(region => region.id === id)?.name || '';

const DAY = 864e5;
// Food prices are entered weekly: a price older than 8 days carries a warning; older than
// 21 days it is no longer shown.
export const FOOD_STALE_AFTER_MS = 8 * DAY;
export const FOOD_EXPIRED_AFTER_MS = 21 * DAY;
// The entry form asks before saving a price that moved more than this since the last one.
export const FOOD_LARGE_CHANGE = 0.25;

export function foodFreshness(recordedAt, now = Date.now()) {
  const at = Date.parse(recordedAt);
  if (!Number.isFinite(at)) return 'expired';
  const age = now - at;
  return age > FOOD_EXPIRED_AFTER_MS ? 'expired' : age > FOOD_STALE_AFTER_MS ? 'stale' : 'fresh';
}
export const daysOld = (recordedAt, now = Date.now()) => Math.floor((now - Date.parse(recordedAt)) / DAY);

export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const text = toLatinDigits(value).replace(/[٫]/g, '.').replace(/[,،\s]/g, '').trim();
  return /^\d{1,7}(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
}

export const foodKey = (region, item) => region + ':' + item;

// The latest visible price of each city and item, and the one before it (from another entry),
// for the change shown next to it: {'aden:rice': {latest, previous}}.
export function latestFoodPrices(rows = []) {
  const sorted = rows.filter(row => row && !row.hidden).sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));
  const result = {};
  for (const row of sorted) {
    const k = foodKey(row.region, row.item), seen = result[k];
    if (!seen) result[k] = {latest: row, previous: null};
    else if (!seen.previous && row.batch_id !== seen.latest.batch_id) seen.previous = row;
  }
  return result;
}

// Checks one submission. input: {prices:[{region,item,price}], note, confirmLargeChange}.
// previous: the latest price of each city and item ({'aden:rice': row}). Returns {prices, note};
// a large move without confirmation throws with status 409 and the list of moves.
export function validateFoodEntry(input, previous = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.prices) || input.prices.length > FOOD_ITEMS.length * FOOD_REGIONS.length) throw new RequestValidationError('بيانات الأسعار غير صالحة.');
  const prices = [], seen = new Set();
  for (const entry of input.prices) {
    const region = FOOD_REGIONS.find(r => r.id === entry?.region), item = foodItem(entry?.item);
    if (!region || !item) throw new RequestValidationError('مدينة أو مادة غير معروفة.');
    if (!String(entry.price ?? '').trim()) continue; // A field left empty is simply not updated.
    const price = parsePrice(entry.price);
    if (!(price > 0)) throw new RequestValidationError('أدخل سعر ' + item.name + ' في ' + region.name + ' برقم صحيح.');
    const k = foodKey(region.id, item.id);
    if (seen.has(k)) throw new RequestValidationError('تكرر سعر ' + item.name + ' في ' + region.name + '.');
    seen.add(k);
    prices.push({region: region.id, item: item.id, price});
  }
  if (!prices.length) throw new RequestValidationError('أدخل سعرًا واحدًا على الأقل.');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : '';
  const moves = prices.map(entry => {
    const before = previous[foodKey(entry.region, entry.item)];
    if (!before) return null;
    const change = (entry.price - Number(before.price)) / Number(before.price);
    return Math.abs(change) > FOOD_LARGE_CHANGE ? {region: entry.region, item: entry.item, from: Number(before.price), to: entry.price, change} : null;
  }).filter(Boolean);
  if (moves.length && input.confirmLargeChange !== true) {
    const list = moves.slice(0, 4).map(m => foodItem(m.item).name + ' في ' + foodRegionName(m.region) + ' (' + (m.change > 0 ? '+' : '−') + Math.round(Math.abs(m.change) * 100) + '%)').join('، ');
    const error = new RequestValidationError('تغيّر سعر ' + list + (moves.length > 4 ? ' و' + (moves.length - 4) + ' غيرها' : '') + ' بأكثر من 25%. أكّد أن الأرقام صحيحة.', 409);
    error.moves = moves;
    throw error;
  }
  return {prices, note};
}

// Price per kilo or litre for bulk units, or null.
export function unitPrice(itemId, price) {
  const item = foodItem(itemId);
  return item?.per && price > 0 ? {value: price / item.per.size, unit: item.per.unit} : null;
}
// The price in dollars at the city's dollar sell rate (rates: usable exchange rates).
export function inDollars(region, price, rates = {}) {
  const usd = rates[region + ':USD'];
  return usd && price > 0 ? price / Number(usd.sell) : null;
}
// Change from the previous entry, as a fraction, or null.
export function priceChange(pair) {
  if (!pair?.previous) return null;
  const before = Number(pair.previous.price), after = Number(pair.latest.price);
  return before > 0 ? (after - before) / before : null;
}
