// Applies the November 2026 universities campaign through directory_save_university (the editor's own RPC).
//  enrich-output-*.json — fills empty fields of existing institutions (never overwrites a filled one, except a
//                         hedging/short summary) and appends programmes, branches and sources to the existing lists.
//  add-output-*.json    — new institutions, published with their programmes, branches and sources.
// The RPC replaces child lists atomically, so every call sends existing + new children. Add --write to save.
import {createClient} from '@supabase/supabase-js';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {openDirectRpc} from './lib/directRpc.mjs';

const write = process.argv.includes('--write');
// CAMPAIGN=campaign-2026-11b reads a later round of research from its own folder.
const dir = new URL(`../data/universities/${process.env.CAMPAIGN || 'campaign-2026-11'}/`, import.meta.url);
const read = name => existsSync(new URL(name, dir)) ? JSON.parse(readFileSync(new URL(name, dir), 'utf8')) : [];
const outputs = prefix => existsSync(dir) ? readdirSync(dir).filter(name => name.startsWith(prefix) && name.endsWith('.json')).sort().flatMap(read) : [];
const enriched = outputs('enrich-output-');
const added = outputs('add-output-');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const today = new Date().toISOString().slice(0, 10);
const arabicIndic = /[٠-٩۰-۹]/;
const url = v => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : null;
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const email = v => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ? v.trim() : null;
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const list = (v, max = 8) => Array.isArray(v) ? [...new Set(v.map(x => str(x, 60)).filter(Boolean))].slice(0, max) : [];
const types = ['official_site', 'government', 'official_directory', 'institutional', 'independent', 'independent_directory'];
const statuses = ['operating', 'temporarily_closed', 'closed', 'listed_for_admission', 'unknown'];
const keys = ['stable_key', 'slug', 'name_ar', 'name_en', 'institution_type', 'ownership', 'founded_year', 'summary', 'governorate', 'city', 'district', 'address', 'latitude', 'longitude', 'map_url', 'logo_url', 'website', 'phone', 'email', 'social_links', 'admission_info', 'tuition_info', 'tuition_as_of', 'registration_url', 'languages', 'study_modes', 'education_levels', 'accreditation_status', 'accrediting_body', 'operating_status', 'verification_status', 'verified_at', 'is_published'];
const norm = t => String(t || '').replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/[ةه]/g, 'ه').replace(/ى/g, 'ي').replace(/(جامعه|كليه|معهد|المجتمع|ال|و)/g, '').replace(/\s+/g, '');
const problems = [], done = {updated: 0, inserted: 0, programs: 0, branches: 0, sources: 0};
const hedging = /دون الجزم|ترد .{0,40} ضمن قائمة|لا يعني بالضرورة|تعرض أدلة/;
const empty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

function fields(item, row = {}) {
  const out = {};
  const set = (key, value) => { if (!empty(value) && empty(row[key])) out[key] = value; };
  set('name_en', str(item.name_en, 240) || null);
  set('founded_year', num(item.founded_year, 1800, 2026));
  set('website', url(item.website)); set('phone', str(item.phone, 80) || null); set('email', email(item.email));
  set('address', str(item.address, 400) || null); set('city', str(item.city, 120) || null); set('governorate', str(item.governorate, 120) || null);
  const lat = num(item.latitude, 12, 19.5), lng = num(item.longitude, 41.5, 55);
  if (lat !== null && lng !== null && empty(row.latitude)) { out.latitude = lat; out.longitude = lng; }
  set('map_url', url(item.map_url)); set('logo_url', url(item.logo_url));
  set('social_links', Array.isArray(item.social_links) ? item.social_links.map(l => ({label: str(l?.label, 40), url: url(l?.url)})).filter(l => l.url).slice(0, 8) : []);
  set('admission_info', str(item.admission_info, 2000)); set('tuition_info', str(item.tuition_info, 2000));
  if (item.tuition_info && /^\d{4}-\d{2}-\d{2}$/.test(item.tuition_as_of || '')) set('tuition_as_of', item.tuition_as_of);
  set('languages', list(item.languages)); set('study_modes', list(item.study_modes)); set('education_levels', list(item.education_levels));
  if (statuses.includes(item.operating_status) && item.operating_status !== 'unknown' && (!row.operating_status || row.operating_status === 'unknown')) out.operating_status = item.operating_status;
  const summary = str(item.summary, 1500);
  if (summary && (!row.summary || (hedging.test(row.summary) && summary.length > 200) || summary.length > (row.summary || '').length * 1.3)) out.summary = summary;
  return out;
}
const programOf = (p, i) => ({faculty: str(p.faculty, 200), department: str(p.department, 200), name: str(p.name, 240), field: str(p.field, 120), qualification: str(p.qualification, 60), language: str(p.language, 40), study_mode: str(p.study_mode, 40), source_url: url(p.source_url), display_order: i});
const branchOf = (b, i) => ({name: str(b.name, 240), governorate: str(b.governorate, 120) || null, city: str(b.city, 120) || null, district: null, address: str(b.address, 400) || null, latitude: null, longitude: null, map_url: url(b.map_url), phone: str(b.phone, 80) || null, source_url: url(b.source_url), display_order: i});
const sourceOf = s => ({title: str(s.title, 300) || 'مصدر', url: url(s.url), publisher: str(s.publisher, 200) || null, source_type: types.includes(s.source_type) ? s.source_type : 'independent', checked_at: today, accessed_at: today});
const strip = row => { const {id, university_id, ...rest} = row; return rest; };

function mergeChildren(existing, item) {
  const programs = existing.programs.map(strip), branches = existing.branches.map(strip), sources = existing.sources.map(strip);
  const pKey = p => [p.name, p.qualification || '', p.study_mode || ''].join('|');
  const pSeen = new Set(programs.map(pKey));
  for (const p of (item.programs || []).map(programOf)) if (p.name && !pSeen.has(pKey(p))) { pSeen.add(pKey(p)); programs.push({...p, display_order: 1000 + programs.length}); }
  const bSeen = new Set(branches.map(b => norm(b.name)));
  for (const b of (item.branches || []).map(branchOf)) if (b.name && !bSeen.has(norm(b.name))) { bSeen.add(norm(b.name)); branches.push({...b, display_order: 100 + branches.length}); }
  const sSeen = new Set(sources.map(s => s.url));
  for (const s of (item.sources || []).map(sourceOf)) if (s.url && !sSeen.has(s.url)) { sSeen.add(s.url); sources.push(s); }
  return {programs, branches, sources, added: {programs: programs.length - existing.programs.length, branches: branches.length - existing.branches.length, sources: sources.length - existing.sources.length}};
}
// Reads use the public API (published rows and their public children).
const pub = await db.from('universities').select('*').is('deleted_at', null);
if (pub.error) throw pub.error;
const all = pub.data;
const bySlug = new Map(all.map(r => [r.slug, r]));
const names = new Set(all.map(r => norm(r.name_ar)));
async function readChildren(id) {
  const [p, b, s] = await Promise.all([
    db.from('university_programs').select('*').eq('university_id', id).order('display_order'),
    db.from('university_branches').select('*').eq('university_id', id).order('display_order'),
    db.from('university_sources').select('*').eq('university_id', id),
  ]);
  if (p.error || b.error || s.error) throw new Error((p.error || b.error || s.error).message);
  return {programs: p.data, branches: b.data, sources: s.data};
}
// DIRECT_DB=1 saves over a direct database connection (see scripts/lib/directRpc.mjs).
const direct = write && process.env.DIRECT_DB === '1' ? await openDirectRpc() : null;
async function save(id, revision, record, children, origin) {
  if (direct) return direct.call('directory_save_university', {p_id: id, p_revision: revision, p_record: record, p_programs: children.programs, p_branches: children.branches, p_sources: children.sources, p_origin: origin}, {p_id: 'uuid', p_revision: 'bigint', p_record: 'jsonb', p_programs: 'jsonb', p_branches: 'jsonb', p_sources: 'jsonb', p_origin: 'text'});
  const {data, error: e} = await db.rpc('directory_save_university', {p_id: id, p_revision: revision, p_record: record, p_programs: children.programs, p_branches: children.branches, p_sources: children.sources, p_origin: origin});
  if (e) throw new Error(e.message);
  return data;
}

for (const item of enriched) {
  const row = bySlug.get(item.slug);
  if (!row) { problems.push(`${item.slug}: unknown`); continue; }
  if (arabicIndic.test(JSON.stringify(item))) { problems.push(`${item.slug}: Arabic-Indic digits`); continue; }
  try {
    const patch = fields(item, row);
    const existing = await readChildren(row.id);
    const children = mergeChildren(existing, item);
    if (!Object.keys(patch).length && !children.added.programs && !children.added.branches && !children.added.sources) continue;
    const record = Object.fromEntries(keys.map(k => [k, row[k]]));
    Object.assign(record, patch, {verified_at: today});
    done.updated++; done.programs += children.added.programs; done.branches += children.added.branches; done.sources += children.added.sources;
    if (write) await save(row.id, Number(row.revision), record, children, 'import:institution-directory:campaign-2026-11');
  } catch (e) { problems.push(`${item.slug}: ${e.message}`); }
}
const slugs = new Set(all.map(r => r.slug));
const kinds = ['university', 'community_college', 'independent_college', 'higher_institute', 'technical_institute', 'vocational_institute', 'specialized_institution'];
for (const item of added) {
  const slug = str(item.slug, 100), name = str(item.name_ar, 240);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) { problems.push(`${slug}: bad or existing slug`); continue; }
  if (!name || names.has(norm(name))) { problems.push(`${slug}: name exists (${name})`); continue; }
  if (!kinds.includes(item.institution_type) || !(item.sources || []).some(s => url(s.url))) { problems.push(`${slug}: type or sources`); continue; }
  if (arabicIndic.test(JSON.stringify(item))) { problems.push(`${slug}: Arabic-Indic digits`); continue; }
  const stable = 'campaign-2026-11:' + slug;
  const record = Object.fromEntries(keys.map(k => [k, null]));
  Object.assign(record, {social_links: [], languages: [], study_modes: [], education_levels: [], admission_info: '', tuition_info: '', accrediting_body: ''}, fields(item), {
    slug, stable_key: stable, name_ar: name, institution_type: item.institution_type,
    ownership: ['government', 'private', 'community', 'civil', 'other'].includes(item.ownership) ? item.ownership : 'other',
    summary: str(item.summary, 1500) || name, accreditation_status: 'not_asserted',
    operating_status: statuses.includes(item.operating_status) ? item.operating_status : 'unknown',
    verification_status: 'needs_review', verified_at: today, is_published: true});
  const children = mergeChildren({programs: [], branches: [], sources: []}, item);
  slugs.add(slug); names.add(norm(name)); done.inserted++;
  done.programs += children.added.programs; done.branches += children.added.branches; done.sources += children.added.sources;
  if (write) { try { await save(null, null, record, children, 'import:institution-directory:approved-publish:' + stable); } catch (e) { problems.push(`${slug}: ${e.message}`); } }
}
writeFileSync(new URL(`apply-report${write ? '' : '-dry-run'}.json`, dir), JSON.stringify({...done, problems}, null, 1));
console.log(JSON.stringify(done), write ? 'written' : 'ready', `problems ${problems.length}`);
for (const p of problems.slice(0, 25)) console.log(' - ' + p);
await direct?.end();
