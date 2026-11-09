// Applies the November 2026 medical-centres campaign through directory_save_medical_center (the editor's RPC).
//   --geo           coordinates, map links and district for existing centres from WHO/MoPHP HeRAMS 2020 (by official code)
//   --add-herams    adds public hospitals, health complexes and health centres with beds from HeRAMS 2020
//   --add-osm       adds named private/other hospitals from OpenStreetMap that are not already listed
//   --enrich        applies researched contacts, specialties, services, hours and sources (enrich-output-*.json)
// Inputs: HeRAMS geojson and an OSM Overpass JSON (paths in env HERAMS and OSM). Add --write to save.
import {createClient} from '@supabase/supabase-js';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {openDirectRpc} from './lib/directRpc.mjs';

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
// CAMPAIGN=campaign-2026-11b reads a later round of research from its own folder.
const dir = new URL(`../data/medical-centers/${process.env.CAMPAIGN || 'campaign-2026-11'}/`, import.meta.url);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const today = new Date().toISOString().slice(0, 10);
const keys = ['stable_key', 'official_code', 'slug', 'name_ar', 'name_en', 'institution_type', 'ownership', 'operator_name', 'summary', 'governorate', 'city', 'district', 'address', 'latitude', 'longitude', 'map_url', 'logo_url', 'website', 'phone', 'emergency_phone', 'email', 'social_links', 'booking_url', 'emergency_available', 'operating_status', 'operating_status_as_of', 'verification_status', 'verified_at', 'facility_presence', 'care_level', 'access_status', 'building_status', 'equipment_status', 'is_published'];
const childTables = {specialties: 'medical_center_specialties', services: 'medical_center_services', hours: 'medical_center_hours', branches: 'medical_center_branches', sources: 'medical_center_sources'};
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const url = v => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null;
const empty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
const arabicIndic = /[٠-٩۰-۹]/;
const norm = t => String(t || '').replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[ةه]/g, 'ه').replace(/ى/g, 'ي').replace(/(مستشفي|مستشفى|المركز|مركز|الصحي|العام|ال|\s)/g, '');
const problems = [], done = {geo: 0, herams: 0, osm: 0, enriched: 0, children: 0};
const herams = 'https://data.humdata.org/dataset/yemen-herams-dataset-2020-list-of-health-facilities';

// District lookup from the site's own OCHA boundaries.
const boundaries = JSON.parse(readFileSync(new URL('../public/data/yemen-map/yemen-boundaries.json', import.meta.url), 'utf8'));
const inRing = ([x, y], ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
const govNames = new Map(boundaries.governorates.map(g => [g.id, g.nameAr]));
function locate(lng, lat) {
  for (const d of boundaries.districts) {
    const polys = d.geometry.type === 'Polygon' ? [d.geometry.coordinates] : d.geometry.coordinates;
    if (polys.some(p => inRing([lng, lat], p[0]) && !p.slice(1).some(h => inRing([lng, lat], h)))) return {district: d.nameAr, governorate: govNames.get(d.governorateId) || d.governorateNameAr};
  }
  return null;
}
const mapUrl = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

const {data: rows, error} = await db.from('medical_centers').select('*').is('deleted_at', null);
if (error) throw error;
async function children(id) {
  const out = {};
  for (const [key, table] of Object.entries(childTables)) {
    const {data, error: e} = await db.from(table).select('*').eq('medical_center_id', id);
    if (e) throw new Error(e.message);
    out[key] = data.map(({id: _, medical_center_id, ...rest}) => rest);
  }
  return out;
}
// DIRECT_DB=1 saves over a direct database connection (see scripts/lib/directRpc.mjs).
const direct = write && process.env.DIRECT_DB === '1' ? await openDirectRpc() : null;
async function save(id, revision, record, kids, origin) {
  if (direct) {
    await direct.call('directory_save_medical_center', {p_id: id, p_revision: revision, p_record: record, p_specialties: kids.specialties, p_services: kids.services, p_hours: kids.hours, p_branches: kids.branches, p_sources: kids.sources, p_origin: origin}, {p_id: 'uuid', p_revision: 'bigint', p_record: 'jsonb', p_specialties: 'jsonb', p_services: 'jsonb', p_hours: 'jsonb', p_branches: 'jsonb', p_sources: 'jsonb', p_origin: 'text'});
    return;
  }
  const {error: e} = await db.rpc('directory_save_medical_center', {p_id: id, p_revision: revision, p_record: record, p_specialties: kids.specialties, p_services: kids.services, p_hours: kids.hours, p_branches: kids.branches, p_sources: kids.sources, p_origin: origin});
  if (e) throw new Error(e.message);
}
const recordOf = row => Object.fromEntries(keys.map(k => [k, row[k] ?? null]));
const blank = () => ({specialties: [], services: [], hours: [], branches: [], sources: []});
const heramsFeatures = () => JSON.parse(readFileSync(process.env.HERAMS, 'utf8')).features.filter(f => f.geometry?.coordinates?.length === 2);
const code = f => String(f.properties.MoSD1_MoSD).replace(/_.*$/, '');

if (args.has('--geo')) {
  const byCode = new Map(heramsFeatures().map(f => [code(f), f]));
  for (const row of rows) {
    const f = byCode.get(String(row.official_code || ''));
    if (!f || !empty(row.latitude)) continue;
    const [lng, lat] = f.geometry.coordinates;
    if (!(lat > 12 && lat < 19.5 && lng > 41.5 && lng < 55)) continue;
    try {
      const record = {...recordOf(row), latitude: lat, longitude: lng, map_url: row.map_url || mapUrl(lat, lng)};
      const where = locate(lng, lat); if (where && !row.district) record.district = where.district;
      const kids = await children(row.id);
      if (!kids.sources.some(s => s.url === herams)) kids.sources.push({title: 'منظمة الصحة العالمية ووزارة الصحة — قائمة المرافق الصحية HeRAMS 2020 (الإحداثيات)', url: herams, publisher: 'WHO / MoPHP via HDX', source_type: 'official_directory', checked_at: today, accessed_at: today});
      done.geo++;
      if (write) await save(row.id, Number(row.revision), record, kids, 'import:institution-directory:campaign-2026-11');
    } catch (e) { problems.push(`geo ${row.slug}: ${e.message}`); }
  }
}

const typeMap = {'Authority Hospital': ['referral_hospital', 'Tertiary Health Care', 'مستشفى هيئة'], 'Governorate/General Hospital': ['hospital', 'Secondary Health Care', 'مستشفى محافظة أو مستشفى عام'], 'Specialized Hospital': ['specialized_hospital', 'Tertiary Health Care', 'مستشفى تخصصي'],
  'Inter-district Hospital': ['hospital', 'Secondary Health Care', 'مستشفى يخدم عدة مديريات'], 'District L Rural Hospital': ['hospital', 'Secondary Health Care', 'مستشفى ريفي على مستوى المديرية'], 'Health Complex': ['medical_complex', 'Primary Health Care', 'مجمع صحي'], 'Health Center with beds': ['health_center', 'Primary Health Care', 'مركز صحي بأسرّة']};
const codes = new Set(rows.map(r => String(r.official_code || '')));
const names = new Set(rows.map(r => norm(r.name_ar) + '|' + (r.governorate || '')));
const slugs = new Set(rows.map(r => r.slug));
if (args.has('--add-herams')) {
  for (const f of heramsFeatures()) {
    const p = f.properties, kind = typeMap[p.MoSD3_Type], c = code(f);
    if (!kind || codes.has(c) || !p.MoSD2a_Nam) continue;
    const [lng, lat] = f.geometry.coordinates, where = locate(lng, lat);
    if (!where) { problems.push(`herams ${c}: outside boundaries`); continue; }
    const name = str(p.MoSD2a_Nam.replace(/\s+/g, ' '), 240), slug = 'health-' + c.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (slugs.has(slug) || names.has(norm(name) + '|' + where.governorate)) continue;
    const open = p.HFFUNCT_Fu === 'Open';
    const summary = `${name} منشأة صحية حكومية من فئة «${kind[2]}» في مديرية ${where.district} بمحافظة ${where.governorate}. أدرجتها منظومة رصد توافر الموارد والخدمات الصحية (HeRAMS) التابعة لمنظمة الصحة العالمية ووزارة الصحة العامة والسكان في قائمة المرافق الصحية لعام 2020، وكانت حالتها في ذلك التقييم: ${open ? 'تعمل' : 'مغلقة'}. هذه البيانات تاريخية، ولا تثبت وحدها أن المنشأة تعمل اليوم أو أن خدماتها متاحة؛ يُستحسن التواصل مع مكتب الصحة في المديرية قبل الزيارة.`;
    const record = {...Object.fromEntries(keys.map(k => [k, null])), stable_key: 'herams:' + c, official_code: c, slug, name_ar: name, name_en: str(p.MoSD2_Name, 240) || null,
      institution_type: kind[0], ownership: 'government', operator_name: 'وزارة الصحة العامة والسكان', summary, governorate: where.governorate, city: where.district, district: where.district,
      latitude: lat, longitude: lng, map_url: mapUrl(lat, lng), social_links: [], emergency_available: null, operating_status: open ? 'fully_operational' : 'not_operational', operating_status_as_of: '2020-11-03',
      verification_status: 'needs_review', verified_at: today, care_level: kind[1], facility_presence: 'listed', is_published: true};
    const kids = blank(); kids.sources.push({title: 'منظمة الصحة العالمية ووزارة الصحة — قائمة المرافق الصحية HeRAMS 2020', url: herams, publisher: 'WHO / MoPHP via HDX', source_type: 'official_directory', checked_at: today, accessed_at: today});
    slugs.add(slug); codes.add(c); names.add(norm(name) + '|' + where.governorate); done.herams++;
    if (write) { try { await save(null, null, record, kids, 'import:institution-directory:approved-publish:' + record.stable_key); } catch (e) { problems.push(`herams ${slug}: ${e.message}`); } }
  }
}

if (args.has('--add-osm')) {
  const elements = JSON.parse(readFileSync(process.env.OSM, 'utf8')).elements;
  const known = rows.map(r => ({n: norm(r.name_ar), lat: Number(r.latitude), lng: Number(r.longitude)}));
  if (args.has('--add-herams')) for (const f of heramsFeatures()) known.push({n: norm(f.properties.MoSD2a_Nam), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0]});
  for (const e of elements) {
    const t = e.tags || {}; if (t.amenity !== 'hospital' && t.healthcare !== 'hospital') continue;
    const name = str(t['name:ar'] || (/[؀-ۿ]/.test(t.name || '') ? t.name : ''), 240); if (!name || name.length < 6) continue;
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon; if (!lat || !lng) continue;
    const where = locate(lng, lat); if (!where) continue;
    const n = norm(name);
    if (known.some(k => k.n === n || (k.lat && Math.abs(k.lat - lat) < 0.004 && Math.abs(k.lng - lng) < 0.004 && (k.n.includes(n) || n.includes(k.n))))) continue;
    if (names.has(n + '|' + where.governorate)) continue;
    const slug = `osm-${e.type[0]}${e.id}`; if (slugs.has(slug)) continue;
    const operatorType = t['operator:type'] || '';
    const ownership = /private/.test(operatorType) ? 'private' : /government|public/.test(operatorType) ? 'government' : /ngo|charity|community/.test(operatorType) ? 'civil' : 'other';
    const osmUrl = `https://www.openstreetmap.org/${e.type}/${e.id}`;
    const kind = /مستشف/.test(name) ? ['hospital', 'مستشفى'] : /وحد[ةه] صحي/.test(name) ? ['health_unit', 'وحدة صحية'] : /مركز صحي|المركز الصحي/.test(name) ? ['health_center', 'مركز صحي'] : /عياد|مستوصف|مجمع/.test(name) ? ['medical_center', 'مرفق طبي'] : ['medical_center', 'مرفق طبي'];
    const summary = `${name} ${kind[1]} في مديرية ${where.district} بمحافظة ${where.governorate}${t['addr:street'] ? '، في ' + str(t['addr:street'], 120) : ''}. يظهر موقعه على خريطة OpenStreetMap المفتوحة التي يحررها متطوعون${t.beds ? '، ويُذكر أن سعته نحو ' + str(t.beds, 10) + ' سرير' : ''}${t['healthcare:speciality'] ? '، ومن تخصصاته المسجلة: ' + str(t['healthcare:speciality'], 160) : ''}. لم تُراجَع بياناته بعد من جهة رسمية؛ يُستحسن التأكد من العنوان والخدمات وساعات العمل قبل الزيارة.`;
    const record = {...Object.fromEntries(keys.map(k => [k, null])), stable_key: 'osm:' + e.type + '/' + e.id, slug, name_ar: name, name_en: str(t['name:en'], 240) || null,
      institution_type: kind[0], ownership, operator_name: str(t.operator, 200) || null, summary, governorate: where.governorate, city: str(t['addr:city'], 120) || where.district, district: where.district,
      address: str(t['addr:street'], 300) || null, latitude: lat, longitude: lng, map_url: osmUrl, website: url(t.website), phone: str(t.phone || t['contact:phone'], 80) || null,
      social_links: [], operating_status: 'unknown', verification_status: 'needs_review', verified_at: today, is_published: true};
    const kids = blank(); kids.sources.push({title: 'OpenStreetMap — بيانات المرفق (ODbL، © مساهمو OpenStreetMap)', url: osmUrl, publisher: 'OpenStreetMap contributors', source_type: 'independent_directory', checked_at: today, accessed_at: today});
    slugs.add(slug); names.add(n + '|' + where.governorate); known.push({n, lat, lng}); done.osm++;
    if (write) { try { await save(null, null, record, kids, 'import:institution-directory:approved-publish:' + record.stable_key); } catch (err) { problems.push(`osm ${slug}: ${err.message}`); } }
  }
}

if (args.has('--enrich')) {
  const items = readdirSync(dir).filter(name => /^enrich-output-[\w-]+\.json$/.test(name)).sort().flatMap(name => JSON.parse(readFileSync(new URL(name, dir), 'utf8')));
  const fresh = (await db.from('medical_centers').select('*').is('deleted_at', null)).data;
  const bySlug = new Map(fresh.map(r => [r.slug, r]));
  for (const item of items) {
    const row = bySlug.get(item.slug); if (!row) { problems.push(`${item.slug}: unknown`); continue; }
    if (arabicIndic.test(JSON.stringify(item))) { problems.push(`${item.slug}: Arabic-Indic digits`); continue; }
    try {
      const record = recordOf(row); let changed = false;
      const set = (k, v) => { if (!empty(v) && empty(record[k])) { record[k] = v; changed = true; } };
      set('name_en', str(item.name_en, 240) || null); set('address', str(item.address, 400) || null); set('phone', str(item.phone, 80) || null);
      set('emergency_phone', str(item.emergency_phone, 80) || null); set('website', url(item.website)); set('booking_url', url(item.booking_url));
      if (typeof item.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email.trim())) set('email', item.email.trim());
      set('operator_name', str(item.operator_name, 200) || null);
      set('social_links', (item.social_links || []).map(l => ({label: str(l?.label, 40), url: url(l?.url)})).filter(l => l.url).slice(0, 6));
      if (typeof item.emergency_available === 'boolean' && record.emergency_available === null) { record.emergency_available = item.emergency_available; changed = true; }
      const summary = str(item.summary, 1500);
      if (summary.length > 250 && (/تُدرج وزارة الصحة|منشأة صحية مدرجة في القائمة/.test(row.summary || '') || summary.length > (row.summary || '').length * 1.3)) { record.summary = summary; changed = true; }
      const kids = await children(row.id); const before = Object.values(kids).reduce((n, l) => n + l.length, 0);
      const add = (list, entries, key) => { const seen = new Set(list.map(x => norm(x[key]))); for (const x of entries) if (x[key] && !seen.has(norm(x[key]))) { seen.add(norm(x[key])); list.push({...x, display_order: list.length}); } };
      add(kids.specialties, (item.specialties || []).map(s => ({name: str(s.name, 160), source_url: url(s.source_url)})), 'name');
      add(kids.services, (item.services || []).map(s => ({name: str(s.name, 160), details: str(s.details, 400) || null, source_url: url(s.source_url)})), 'name');
      add(kids.hours, (item.hours || []).map(h => ({label: str(h.label, 80), hours_text: str(h.hours_text, 200), source_url: url(h.source_url)})).filter(h => h.hours_text), 'label');
      const seen = new Set(kids.sources.map(s => s.url));
      for (const s of item.sources || []) { const u = url(s.url); if (u && !seen.has(u)) { seen.add(u); kids.sources.push({title: str(s.title, 300) || 'مصدر', url: u, publisher: str(s.publisher, 200) || null, source_type: ['official_site', 'government', 'official_directory', 'institutional', 'independent', 'independent_directory'].includes(s.source_type) ? s.source_type : 'independent', checked_at: today, accessed_at: today}); } }
      const after = Object.values(kids).reduce((n, l) => n + l.length, 0);
      if (!changed && after === before) continue;
      record.verified_at = today; done.enriched++; done.children += after - before;
      if (write) await save(row.id, Number(row.revision), record, kids, 'import:institution-directory:campaign-2026-11');
    } catch (e) { problems.push(`${item.slug}: ${e.message}`); }
  }
}
writeFileSync(new URL(`apply-report${write ? '' : '-dry-run'}.json`, dir), JSON.stringify({...done, problems}, null, 1));
console.log(JSON.stringify(done), write ? 'written' : 'ready', `problems ${problems.length}`);
for (const p of problems.slice(0, 20)) console.log(' - ' + p);
await direct?.end();
