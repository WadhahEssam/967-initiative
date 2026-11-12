// «المُبلّغ المحلي»: when the editors are alerted. Pure functions shared by the server and the tests.
// - fast_move: the price moved more than 10% within two hours.
// - anchor_gap: the price is more than 5% away from the latest editor (anchor) entry.
// - held_surge: more than 10 held reports for one thing within an hour (a push, or a real jump).
// - spread: a currency's sell price fell below its buy price, or is more than 10% above it (one side
//   moved and the other did not).
// - anchor_misses: a verified anchor was very far 3 times in a row (lib/priceReputation.js).
// An alert stays open until an editor marks it handled; the same alert is not raised twice meanwhile.

export const ALERT_RULES = {fastMove: 0.10, fastMoveMs: 2 * 3600e3, anchorGap: 0.05, heldPerHour: 10, maxSpread: 0.10};

export const ALERT_LABELS = {
  fast_move: 'تغيّر السعر أكثر من 10% خلال ساعتين',
  anchor_gap: 'السعر يبتعد أكثر من 5% عن آخر سعر مرساة',
  held_surge: 'أكثر من 10 بلاغات معلّقة خلال ساعة',
  spread: 'سعر البيع والشراء غير متناسبين',
  anchor_misses: 'مرساة موثّقة شذّت 3 مرات متتالية',
};

const key = instrument => [instrument.kind, instrument.region, instrument.item, instrument.side].join(':');
const gap = (a, b) => Math.abs(a - b) / b;

/**
 * Alerts for one instrument after a recomputation.
 * recent: values the price had within the last two hours (before this change).
 * heldLastHour: how many of its reports were held within the last hour.
 */
export function instrumentAlerts({instrument, value, changed, recent = [], official = null, heldLastHour = 0}) {
  const alerts = [], id = key(instrument);
  if (changed && value > 0) {
    const before = recent.find(old => old > 0 && gap(value, old) > ALERT_RULES.fastMove);
    if (before) alerts.push({type: 'fast_move', dedupe: 'fast_move:' + id, details: {from: before, to: value}});
  }
  if (value > 0 && official?.value > 0 && gap(value, official.value) > ALERT_RULES.anchorGap) {
    alerts.push({type: 'anchor_gap', dedupe: 'anchor_gap:' + id, details: {price: value, anchor: official.value}});
  }
  if (heldLastHour > ALERT_RULES.heldPerHour) alerts.push({type: 'held_surge', dedupe: 'held_surge:' + id, details: {held: heldLastHour}});
  return alerts.map(alert => ({...alert, ...instrument}));
}

// Buy and sell of one currency in one city.
export function spreadAlert({kind, region, item, buy, sell}) {
  if (!(buy > 0) || !(sell > 0)) return null;
  if (sell >= buy && (sell - buy) / buy <= ALERT_RULES.maxSpread) return null;
  return {type: 'spread', dedupe: 'spread:' + [kind, region, item].join(':'), kind, region, item, side: null, details: {buy, sell}};
}
