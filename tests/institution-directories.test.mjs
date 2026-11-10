import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {directoryFallbackAllowed,institutionCompleteness,institutionSearchFields,latestEvidenceDate,relatedInstitutions} from '../lib/institutionDirectories.js';
import {fallbackMedicalCenters,fallbackUniversities} from '../lib/institutionFallbacks.js';
import {matchesSearch} from '../lib/search.js';
import {listStateSearch,readListState,collectionDefaults} from '../lib/listState.js';
import {pageIsVisible} from '../lib/pageVisibility.js';
import {publicReadingHref,readingContentItem} from '../lib/readingList.js';
import {buildSitemap} from '../lib/seo.js';
import {institutionSchema} from '../lib/seo-schema.js';
import {contextualHref,safeNavigationSource} from '../lib/navigationContext.js';
import {directoryRecordPayload,parseInstitutionSources,serializeInstitutionSocialLinks,serializeInstitutionSources} from '../lib/institutionAdminPayload.js';
import {directoryBundleDiff,normalizeDirectorySource} from '../lib/directoryImportMerge.js';

test('admin directory edits preserve coordinates and institutional social links',()=>{
 const record={stable_key:'edu:test',slug:'test-university',name_ar:'جامعة اختبار',name_en:'Test University',institution_type:'university',ownership:'government',summary:'نبذة محدثة',governorate:'تعز',city:'تعز',district:'القاهرة',address:'عنوان موثق',latitude:13.5789,longitude:44.0219,map_url:'https://maps.google.com/?q=13.5789,44.0219',logo_url:null,website:'https://example.edu.ye',phone:'04-000000',email:'info@example.edu.ye',social_links:serializeInstitutionSocialLinks([{label:'فيسبوك',url:'https://facebook.com/example'}]),verification_status:'verified',verified_at:'2026-10-26',founded_year:'2000',admission_info:'',tuition_info:'',tuition_as_of:'',registration_url:'',languages:'العربية',study_modes:'انتظام',education_levels:'بكالوريوس',accreditation_status:'not_asserted',accrediting_body:'',operating_status:'unknown'};
 const payload=directoryRecordPayload('university',record,true,null);
 assert.equal(payload.latitude,13.5789);assert.equal(payload.longitude,44.0219);
 assert.deepEqual(payload.social_links,[{label:'فيسبوك',url:'https://facebook.com/example'}]);
 assert.equal(payload.summary,'نبذة محدثة');
});

test('internal completeness score rewards documented depth without rating the institution',()=>{
 const sparse=institutionCompleteness(fallbackUniversities[0],'university',new Date('2026-10-26T12:00:00Z'));
 const enriched=institutionCompleteness({...fallbackUniversities[0],website:'https://example.edu.ye',phone:'01-000000',address:'عنوان',mapUrl:'https://maps.google.com/example',programs:[{name:'علوم الحاسوب',source_url:'https://example.edu.ye/program'}],sources:[{url:'https://example.edu.ye',checked_at:'2026-10-26'}]},'university',new Date('2026-10-26T12:00:00Z'));
 assert.ok(enriched.score>sparse.score);assert.ok(enriched.score<=100);
 assert.ok(sparse.warnings.includes('دون برامج موثقة'));
 assert.deepEqual(Object.keys(enriched.dimensions),['identity','contact','location','offerings','evidence','freshness','review','consistency']);
});

test('source access dates never make old or unknown evidence look current',()=>{
 const old={sources:[{source_published_at:'2023',status_as_of:'2023',accessed_at:'2026-10-26'}],verificationStatus:'verified',programs:[]};
 const unknown={sources:[{accessed_at:'2026-10-26'}],verificationStatus:'verified',programs:[]};
 assert.deepEqual(latestEvidenceDate(old),{label:'2023',precision:'year',sort:2023*12+11,year:2023,month:null});
 assert.equal(latestEvidenceDate(unknown),null);
 assert.equal(institutionCompleteness(old,'university',new Date('2026-10-26T12:00:00Z')).dimensions.freshness.score,0);
 assert.equal(institutionCompleteness(unknown,'university',new Date('2026-10-26T12:00:00Z')).evidenceDate,null);
 assert.equal(latestEvidenceDate({sources:[{status_as_of:'2026-2027'}]}).label,'2026-2027');
});

test('source metadata round-trips once without duplicating note dates',()=>{
 const legacy={title:'دليل رسمي',url:'https://EXAMPLE.test/source/?utm_source=test',publisher:'جهة',source_type:'government',checked_at:'2026-10-26',note:'ملاحظة — Published: 2023 — Accessed: 2026-10-26 — Status as of: 2023'};
 const canonical=normalizeDirectorySource(legacy);
 assert.equal(canonical.note,'ملاحظة');assert.equal(canonical.source_published_at,'2023');assert.equal(canonical.status_as_of,'2023');
 const text=serializeInstitutionSources([canonical]),parsed=parseInstitutionSources(text);
 assert.equal(parsed[0].url,canonical.url);assert.equal(parsed[0].note,canonical.note);assert.equal(parsed[0].source_published_at,canonical.source_published_at);assert.equal(parsed[0].status_as_of,canonical.status_as_of);
 const first=directoryBundleDiff({id:'db',stable_key:'x',slug:'x',sources:[legacy]},{stable_key:'x',slug:'x',sources:[canonical]},['sources']);
 assert.equal(first.changed,false);assert.equal(first.relations.sources.length,1);
});

test('directory editor round-trips advanced source metadata safely',()=>{
 const sample={title:'وثيقة رسمية',url:'https://example.org/source',publisher:'جهة رسمية',source_type:'government',checked_at:'2026-10-26',source_published_at:'2023-09',accessed_at:'2026-10-26',status_as_of:'2023-09',information_verified_at:'2026-10-20',document_url:'https://example.org/document',supports:['identity','services'],conflict_note:'تعارض | مرجع قديم',note:'النص | هنا\nسطر ثان'};
 const text=serializeInstitutionSources([sample]);
 assert.deepEqual(parseInstitutionSources(text),[sample]);
 assert.deepEqual(parseInstitutionSources(serializeInstitutionSources([{...sample,note:'وصف معدّل'}]))[0],{...sample,note:'وصف معدّل'});
 assert.equal(parseInstitutionSources('دليل | https://example.org | حكومة | government | 2026-10-26 | ملاحظة')[0].note,'ملاحظة');
 assert.throws(()=>parseInstitutionSources(text.replace('https://example.org/document','javascript:alert(1)')),/رابط الوثيقة/);
 assert.throws(()=>parseInstitutionSources(text.replace('["identity","services"]','{"not":"an array"}')),/نطاق المصدر/);
});

test('directory fallback is impossible in production and allowed only outside it',()=>{
 assert.equal(directoryFallbackAllowed({NODE_ENV:'production',LOCAL_CONTENT_FALLBACK:'1'}),false);
 assert.equal(directoryFallbackAllowed({NODE_ENV:'development'}),true);
 assert.equal(directoryFallbackAllowed({NODE_ENV:'test'}),true);
});

test('directory import preview is additive, idempotent and preserves manual values',()=>{
 const current={id:'db-id',stable_key:'edu:test',summary:'تحرير يدوي',website:null,is_published:true,programs:[{name:'القانون',qualification:'بكالوريوس',study_mode:'',source_url:'https://manual.example'}],sources:[]};
 const incoming={stable_key:'edu:test',summary:'نص الاستيراد',website:'https://example.edu.ye',is_published:false,programs:[{name:'القانون',qualification:'بكالوريوس',study_mode:'',source_url:'https://import.example'},{name:'علوم الحاسوب',qualification:'بكالوريوس',study_mode:'',source_url:'https://example.edu.ye/cs'}],sources:[{title:'الموقع الرسمي',url:'https://example.edu.ye'}]};
 const first=directoryBundleDiff(current,incoming,['programs','sources']);
 assert.equal(first.record.summary,'تحرير يدوي');assert.equal(first.record.website,'https://example.edu.ye');assert.equal(first.record.is_published,true);
 assert.equal(first.relations.programs.length,2);assert.equal(first.relations.programs[0].source_url,'https://manual.example');
 assert.ok(first.conflicts.some(item=>item.field==='summary'));assert.equal(first.changed,true);
 const next={...first.record,...first.relations};
 const second=directoryBundleDiff(next,incoming,['programs','sources']);
 assert.equal(second.changed,false);assert.equal(second.relations.programs.length,2);
 const unpublished=directoryBundleDiff({...current,is_published:false},{...incoming,is_published:true},['programs','sources']);
 assert.equal(unpublished.record.is_published,false,'existing drafts remain drafts');
 const deleted=directoryBundleDiff({...current,deleted_at:'2026-10-26T00:00:00Z'},incoming,['programs','sources']);
 assert.equal(deleted.record.deleted_at,'2026-10-26T00:00:00Z','logical deletion is preserved');
 const identity=directoryBundleDiff(current,{...incoming,stable_key:'changed',slug:'changed'},['programs','sources'],{overwrite:true});
 assert.equal(identity.record.stable_key,'edu:test');assert.ok(identity.conflicts.some(item=>item.resolution==='kept_stable_identity'));
});

test('real institution datasets meet targets, retain sources, stable identities and broad coverage',()=>{
 assert.ok(fallbackUniversities.length>=100);assert.ok(fallbackMedicalCenters.length>=150);
 for(const [label,rows] of [['universities',fallbackUniversities],['medical',fallbackMedicalCenters]]){
  assert.equal(new Set(rows.map(row=>row.stableKey)).size,rows.length,`${label} stable keys`);
  assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,`${label} slugs`);
  assert.ok(rows.every(row=>row.name&&row.sources.length&&row.sources.every(source=>/^https?:\/\//.test(source.url||source.document_url))));
  assert.ok(rows.every(row=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id)));
 }
 assert.ok(new Set(fallbackUniversities.map(row=>row.governorate).filter(Boolean)).size>=10);
 assert.equal(new Set(fallbackMedicalCenters.map(row=>row.governorate).filter(Boolean)).size,22);
 const historicallyDated=fallbackMedicalCenters.filter(row=>row.operatingStatusAsOf);
 assert.ok(historicallyDated.length>=160&&historicallyDated.every(row=>row.verificationStatus==='needs_review'));
 assert.ok(fallbackMedicalCenters.filter(row=>!row.phone).every(row=>row.emergencyAvailable===null),'missing contact facts do not imply emergency availability');
 const universityData=JSON.parse(fs.readFileSync(new URL('../data/directories/universities.json',import.meta.url),'utf8'));
 const medicalData=JSON.parse(fs.readFileSync(new URL('../data/directories/medical-centers.json',import.meta.url),'utf8'));
 assert.equal(universityData.records.reduce((sum,row)=>sum+row.programs.length,0),74);
 assert.equal(medicalData.records.length,161);assert.equal(medicalData.records.filter(row=>row.is_published===false).length,0);
 assert.equal(medicalData.records.reduce((sum,row)=>sum+row.specialties.length,0),14);
 assert.equal(medicalData.records.reduce((sum,row)=>sum+row.services.length,0),21);
 const datedSource=universityData.records.flatMap(row=>row.sources).find(source=>source.source_published_at&&source.accessed_at&&source.status_as_of);
 assert.ok(datedSource,'source publication, access and status dates remain separate');
});

test('directory search, compound URL filters and related records use only stored facts',()=>{
 const university=fallbackUniversities.find(row=>row.governorate==='تعز');
 assert.ok(university);assert.equal(matchesSearch('تعز',institutionSearchFields(university,'university')),true);
 const center=fallbackMedicalCenters.find(row=>row.governorate==='سقطرى');
 assert.ok(center);assert.equal(matchesSearch('سقطرى',institutionSearchFields(center,'medical')),true);
 const state={...collectionDefaults.medicalCenters,q:'مستشفى',governorate:'تعز',type:'hospital',page:2};
 const search=listStateSearch('',state,collectionDefaults.medicalCenters);
 assert.deepEqual(readListState(search,collectionDefaults.medicalCenters),state);
 const related=relatedInstitutions(center,fallbackMedicalCenters,'medical');
 assert.ok(related.every(row=>row.id!==center.id&&(row.governorate===center.governorate||row.type===center.type)));
 const source=safeNavigationSource('/universities?q=جامعة&governorate=تعز&ownership=government#universities-directory');
 assert.ok(source.includes('governorate='));assert.ok(source.includes('#universities-directory'));
 assert.equal(new URL(contextualHref('/universities/example',source),'https://local.test').searchParams.get('from'),source);
 assert.equal(safeNavigationSource('/medical-centers?specialty=باطنية&service=مختبر#medical-directory').startsWith('/medical-centers?'),true);
 const enriched=fallbackUniversities.find(row=>row.id==='edu-317b3333511e');
 assert.equal(matchesSearch('دوام كامل',institutionSearchFields(enriched,'university')),true);
});

test('visibility, reading later, sitemap and schema include only public directory records',()=>{
 assert.equal(pageIsVisible('/universities/example',{universities:false}),false);
 assert.equal(pageIsVisible('/medical-centers/example',{medicalCenters:false}),false);
 assert.deepEqual(readingContentItem({kind:'university',href:'/universities/edu-a',title:'جامعة'}),{kind:'university',href:'/universities/edu-a',title:'جامعة'});
 assert.equal(publicReadingHref('/medical-centers/health-1','?from=%2Fadmin'),'/medical-centers/health-1');
 const env={NODE_ENV:'production',NEXT_PUBLIC_SITE_URL:'https://example.test'};
 const items=buildSitemap({universities:[{...fallbackUniversities[0],is_published:true}],medicalCenters:[{...fallbackMedicalCenters[0],is_published:true},{...fallbackMedicalCenters[1],is_published:false}]},env);
 assert.ok(items.some(item=>item.url.includes('/universities/')));assert.equal(items.filter(item=>item.url.includes('/medical-centers/health-')).length,1);
 const medicalSchema=institutionSchema(fallbackMedicalCenters[0],'medical');
 assert.ok(['Hospital','MedicalOrganization'].includes(medicalSchema['@type']));
 assert.equal(medicalSchema.availableService,undefined,'unknown emergency availability does not become a claim');
 assert.equal(institutionSchema({...fallbackUniversities[0],is_published:false},'university'),null);
});

test('migration and importer keep protected writes, revisions, source gating and explicit apply confirmation',()=>{
 const sql=fs.readFileSync(new URL('../supabase/archive/legacy-migrations/202610250007_institution_directories.sql',import.meta.url),'utf8');
 const safetySql=fs.readFileSync(new URL('../supabase/archive/legacy-migrations/202610260001_institution_directory_data_safety.sql',import.meta.url),'utf8');
 const importer=fs.readFileSync(new URL('../scripts/import-institution-directories.mjs',import.meta.url),'utf8');
 for(const table of ['universities','university_programs','university_branches','university_sources','medical_centers','medical_center_specialties','medical_center_services','medical_center_hours','medical_center_branches','medical_center_sources'])assert.ok(sql.includes(`'${table}'`),`${table} is included in the protected table loop`);
 assert.match(sql,/alter table public\.%I enable row level security/);
 assert.match(sql,/Stale university revision/);assert.match(sql,/Stale medical-center revision/);
 assert.match(sql,/Published university requires a source/);assert.match(sql,/Published medical center requires a source/);
 assert.match(sql,/Management role required/);assert.match(sql,/directory_batch/);
 assert.match(importer,/if\(!apply\)/);assert.match(importer,/DIRECTORY_IMPORT_CONFIRM/);assert.match(importer,/DIRECTORY_NEW_PUBLICATION_CONFIRM/);assert.match(importer,/--publish-new/);
 assert.match(importer,/previewDiff/);assert.match(importer,/enrichedOnly/);assert.match(importer,/directoryBundleDiff/);assert.match(importer,/if\(lookup\.data&&!updateExisting\)/);assert.doesNotMatch(importer,/\.delete\(/);
 assert.match(safetySql,/source_published_at text/);assert.match(safetySql,/information_verified_at text/);assert.match(safetySql,/directory_jsonb_array_equal/);assert.match(safetySql,/approved-publish/);
});
