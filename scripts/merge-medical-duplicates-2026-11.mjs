#!/usr/bin/env node
// Merges duplicate medical-centre records approved by the owner (2026-11-09): the official
// Ministry/HeRAMS record is kept and receives the other record's extra facts (empty fields only,
// new specialties/services/hours/sources, social links); the duplicate is unpublished, never deleted.
// Saves go through directory_save_medical_center over a direct connection (scripts/lib/directRpc.mjs).
//   node --env-file=.env.local scripts/merge-medical-duplicates-2026-11.mjs [--write]
import {createClient} from '@supabase/supabase-js';
import {openDirectRpc} from './lib/directRpc.mjs';

const PAIRS = [
  {keep: 'health-2613011', hide: 'osm-n6937218315', note: 'مستشفى كرى العام (مأرب) — same coordinates'},
  {keep: 'health-1518017', hide: 'osm-n1226349676', note: 'المستشفى الجمهوري التعليمي العام (تعز) — 25 m apart'},
];
const write = process.argv.includes('--write');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const keys = ['stable_key', 'official_code', 'slug', 'name_ar', 'name_en', 'institution_type', 'ownership', 'operator_name', 'summary', 'governorate', 'city', 'district', 'address', 'latitude', 'longitude', 'map_url', 'logo_url', 'website', 'phone', 'emergency_phone', 'email', 'social_links', 'booking_url', 'emergency_available', 'operating_status', 'operating_status_as_of', 'verification_status', 'verified_at', 'facility_presence', 'care_level', 'access_status', 'building_status', 'equipment_status', 'is_published'];
const tables = {specialties: 'medical_center_specialties', services: 'medical_center_services', hours: 'medical_center_hours', branches: 'medical_center_branches', sources: 'medical_center_sources'};
const types = {p_id: 'uuid', p_revision: 'bigint', p_record: 'jsonb', p_specialties: 'jsonb', p_services: 'jsonb', p_hours: 'jsonb', p_branches: 'jsonb', p_sources: 'jsonb', p_origin: 'text'};
const empty = value => value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);
const recordOf = row => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
const keyOf = {specialties: x => x.name, services: x => x.name, hours: x => x.label + '|' + x.hours_text, branches: x => x.name, sources: x => x.url};

async function load(slug) {
  const {data: row, error} = await db.from('medical_centers').select('*').eq('slug', slug).is('deleted_at', null).maybeSingle();
  if (error || !row) throw new Error(`${slug}: ${error?.message || 'not found'}`);
  const kids = {};
  for (const [key, table] of Object.entries(tables)) {
    const {data, error: e} = await db.from(table).select('*').eq('medical_center_id', row.id);
    if (key !== 'sources') data?.sort((a, b) => a.display_order - b.display_order);
    if (e) throw new Error(e.message);
    kids[key] = data.map(({id: _id, medical_center_id: _mc, ...rest}) => rest);
  }
  return {row, kids};
}
const args = (row, record, kids) => ({p_id: row.id, p_revision: Number(row.revision), p_record: record, p_specialties: kids.specialties, p_services: kids.services, p_hours: kids.hours, p_branches: kids.branches, p_sources: kids.sources, p_origin: 'editor:merge-duplicates-2026-11'});

const direct = write ? await openDirectRpc() : null;
for (const pair of PAIRS) {
  const keep = await load(pair.keep), hide = await load(pair.hide);
  const record = recordOf(keep.row), moved = [];
  for (const key of ['phone', 'emergency_phone', 'email', 'website', 'booking_url', 'address', 'name_en', 'logo_url', 'map_url'])
    if (empty(record[key]) && !empty(hide.row[key])) { record[key] = hide.row[key]; moved.push(key); }
  const links = [...(record.social_links || [])];
  for (const link of hide.row.social_links || []) if (link?.url && !links.some(l => l.url === link.url)) { links.push(link); moved.push('social:' + link.url); }
  record.social_links = links;
  const kids = keep.kids;
  for (const [key, list] of Object.entries(hide.kids)) {
    const seen = new Set(kids[key].map(keyOf[key]));
    for (const item of list) if (!seen.has(keyOf[key](item))) { seen.add(keyOf[key](item)); kids[key].push(key === 'sources' ? {...item} : {...item, display_order: kids[key].length}); moved.push(key + ':' + keyOf[key](item)); }
  }
  console.log(pair.note, '\n  keep', pair.keep, '| hide', pair.hide, '\n  moved:', moved.length ? moved.join(', ') : 'nothing new');
  if (!write) continue;
  if (moved.length) await direct.call('directory_save_medical_center', args(keep.row, record, kids), types);
  const hidden = {...recordOf(hide.row), is_published: false};
  await direct.call('directory_save_medical_center', args(hide.row, hidden, hide.kids), types);
  console.log('  saved; duplicate unpublished');
}
await direct?.end();
