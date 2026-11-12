// «المُبلّغ المحلي», phase 4: editor alerts, review of held reports, reporter management, and the
// log of every editor action.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {instrumentAlerts, spreadAlert, ALERT_LABELS} from '../lib/priceAlerts.js';
import {describeInstrument} from '../lib/priceReports.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const usd = {kind: 'rate', region: 'sanaa', item: 'USD', side: 'sell'};

test('alerts: over 10% within two hours, over 5% from the anchor, over 10 held reports an hour', () => {
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 600, changed: true, recent: [535]}).map(alert => alert.type), ['fast_move']);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 580, changed: true, recent: [535]}).map(alert => alert.type), []);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 600, changed: false, recent: [535]}).map(alert => alert.type), []);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 565, official: {value: 535}}).map(alert => alert.type), ['anchor_gap']);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 560, official: {value: 535}}).map(alert => alert.type), []);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 535, heldLastHour: 11}).map(alert => alert.type), ['held_surge']);
  assert.deepEqual(instrumentAlerts({instrument: usd, value: 535, heldLastHour: 10}).map(alert => alert.type), []);
  const [alert] = instrumentAlerts({instrument: usd, value: 600, changed: true, recent: [535]});
  assert.equal(alert.dedupe, 'fast_move:rate:sanaa:USD:sell');
});

test('a spread alert when sell falls below buy or is more than 10% above it', () => {
  assert.equal(spreadAlert({kind: 'rate', region: 'sanaa', item: 'USD', buy: 530, sell: 535}), null);
  assert.equal(spreadAlert({kind: 'rate', region: 'sanaa', item: 'USD', buy: 530, sell: 600}).type, 'spread');
  assert.equal(spreadAlert({kind: 'rate', region: 'sanaa', item: 'USD', buy: 540, sell: 535}).type, 'spread');
  assert.equal(spreadAlert({kind: 'rate', region: 'sanaa', item: 'USD', buy: null, sell: 535}), null);
});

test('editors read instruments in Arabic; every alert type has a label', () => {
  assert.equal(describeInstrument(usd), 'دولار · بيع · صنعاء');
  assert.equal(describeInstrument({kind: 'food', region: 'aden', item: 'rice', side: 'price'}), 'الأرز (كيس 10 كيلو) · عدن');
  for (const type of ['fast_move', 'anchor_gap', 'held_surge', 'spread', 'anchor_misses']) assert.ok(ALERT_LABELS[type]);
});

test('the editors’ API is for editors only, and every action is logged', () => {
  const route = read('app/api/admin/prices/route.js');
  assert.equal(route.match(/await authorizePriceEditor\(request,db\)/g)?.length, 2);
  const server = read('lib/priceModerationServer.js');
  assert.ok(server.includes('export const authorizePriceEditor=(request,db)=>authorizeEditorRequest(request,db);'));
  for (const fn of ['reviewReport', 'updateReporter', 'resolveAlert', 'recomputeByEditor']) {
    const body = server.split('export async function ' + fn)[1].split('\nexport ')[0];
    assert.ok(body.includes('await logPriceAction(db,{actorId,action'), fn + ' logs its action');
  }
  for (const file of ['lib/exchangeRatesServer.js', 'lib/foodPricesServer.js']) {
    const source = read(file);
    assert.ok(source.includes("action:'anchor_price'"), file);
    assert.ok(source.includes("action:hidden?'hide_anchor':'show_anchor'"), file);
  }
});

test('the log can only be added to; alerts and the log are closed to browsers', () => {
  const sql = read('supabase/migrations/20261112150000_price_moderation.sql');
  assert.match(sql, /grant select,insert on public\.price_moderation_log to service_role;/);
  assert.doesNotMatch(sql, /grant (all|update|delete)[^;]*price_moderation_log/);
  for (const table of ['price_alerts', 'price_moderation_log']) assert.match(sql, new RegExp('revoke all on public\\.' + table + ' from public,anon,authenticated;'));
  assert.match(sql, /create unique index if not exists price_alerts_open_idx on public\.price_alerts\(dedupe\) where resolved_at is null;/);
});

test('alerts reach editors as notifications, quietly after an editor handled them, and never block the price', () => {
  const server = read('lib/priceConsensusServer.js');
  assert.ok(server.includes("try{await raiseAlerts(db,kind,checks,prices,alerts,history.length>0,now);}catch{"));
  assert.ok(server.includes(".gte('resolved_at',new Date(now-12*3600e3).toISOString())"));
  assert.ok(server.includes("kind:'moderation',title:('تنبيه أسعار: '+ALERT_LABELS[alert.type])"));
  assert.ok(server.includes(".in('role',['admin','management'])"));
});

test('lifting a ban brings the score to the ban line, so the next report does not ban again at once', () => {
  assert.ok(read('lib/priceModerationServer.js').includes(":action==='unban'?{silent_ban:false,ban_reason:null,banned_at:null,score:Math.max(score,BAN_BELOW)}"));
});
