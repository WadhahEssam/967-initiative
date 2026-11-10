import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeAccountReturn} from '../lib/debates.js';
import {SCHOOL_SCRIPT_OPTIONS,SCHOOL_SCRIPT_IDS,SCHOOL_HISTORICAL_SAMPLES,schoolScriptForStage,validSchoolScript} from '../lib/schoolCalligraphySamples.js';
import {validateSchoolEditorial} from '../lib/schoolContent.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const course=JSON.parse(read('data/school/arabic-calligraphy.json'));

test('all calligraphy hands have specific typeface or sourced genuine historical example',()=>{
 assert.equal(SCHOOL_SCRIPT_OPTIONS.length,7);
 assert.deepEqual(SCHOOL_SCRIPT_IDS,['naskh','ruqah','kufi','thuluth','diwani','nastaliq','maghribi']);
 assert.deepEqual(Object.keys(SCHOOL_HISTORICAL_SAMPLES).sort(),['diwani','maghribi','thuluth']);
 for(const row of Object.values(SCHOOL_HISTORICAL_SAMPLES)){
  assert.ok(row.image.startsWith('https://upload.wikimedia.org/wikipedia/commons/'));
  assert.ok(row.source.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(row.description.includes('نص')||row.description.includes('مخطوطة')||row.description.includes('التمرين'));
  assert.ok(row.credit.length>10);
 }
 for(const [index,stage] of course.stages.entries()){
  assert.ok(validSchoolScript(stage.script));
  assert.equal(schoolScriptForStage(course.slug,index),stage.script);
  assert.equal(stage.practice.script,stage.script);
  assert.equal(validateSchoolEditorial('stage',stage).script,stage.script);
 }
 const styled=read('components/school/CalligraphyExample.jsx');
 assert.ok(styled.includes('SCHOOL_HISTORICAL_SAMPLES'));
 assert.ok(styled.includes('text'));
 assert.ok(styled.includes('عبارة التدريب للقراءة'));
 const fontLink=read('app/school/courses/[slug]/layout.jsx');
 for(const name of ['Amiri','Aref+Ruqaa','Reem+Kufi','Noto+Nastaliq+Urdu'])
  assert.ok(fontLink.includes(name));
 const css=read('app/school/studio/studio.module.css');
 for(const name of ['schoolScriptNaskh','schoolScriptRuqah','schoolScriptKufi','schoolScriptNastaliq'])
  assert.ok(css.includes('.'+name));
 assert.ok(!read('app/layout.jsx').includes('fonts.googleapis.com'),'global site font must not change');
});
test('School Studio rejects unknown scripts and preserves optional script metadata',()=>{
 const stage=course.stages[8];
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,script:'untrusted'}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,practice:{...stage.practice,script:'untrusted'}}));
 assert.throws(()=>validateSchoolEditorial('stage',{...stage,lessons:stage.lessons.map((x,i)=>i===0?{...x,script:'unknown'}:x)}));
 const valid=validateSchoolEditorial('stage',{...stage,lessons:stage.lessons.map((x,i)=>i===0?{...x,script:'diwani'}:x)});
 assert.equal(valid.lessons[0].script,'diwani');
 const studio=read('components/school/SchoolStudio.jsx');
 assert.ok(studio.includes('SCHOOL_SCRIPT_OPTIONS'));
 assert.ok(studio.includes('الخط المستخدم في المثال'));
 assert.ok(studio.includes('الخط المستخدم في نموذج التدريب'));
});
test('guest receives sign-up/login prompt not a misleading progression lock',()=>{
 // SchoolCourseMap was retired in phase 8; the card journey shows the guest prompt.
 const map=read('components/school/v2/CourseJourney.jsx');
 assert.ok(map.includes("if (alive) setProgress({loading: false, guest: true, local"));
 assert.ok(map.includes('أنشئ حسابًا لتحفظ تقدمك ونجومك وتفتح بقية الدروس.'));
 assert.ok(map.includes('<SignupInvite className={styles.guest} showLogin cta="إنشاء حساب" next={back}'));
 const invite=read('components/SignupInvite.jsx');
 assert.ok(invite.includes('تسجيل الدخول'));
 assert.ok(invite.includes("'/login?next=' + target"));
 assert.ok(invite.includes("'/register?next=' + target"));
 assert.ok(map.includes("progress.guest ? 'يحتاج حسابًا' : 'يُفتح بعد إكمال الدرس السابق'"));
});
test('login/register redirect back to School URL, not another origin or privileged dashboard',()=>{
 assert.equal(safeAccountReturn('/school/courses/arabic-calligraphy'),'/school/courses/arabic-calligraphy');
 assert.equal(safeAccountReturn('/school/courses/arabic-calligraphy/1'),'/school/courses/arabic-calligraphy/1');
 assert.equal(safeAccountReturn('//evil.example.com/school'),'/account');
 assert.equal(safeAccountReturn('/admin'),'/account');
 assert.equal(safeAccountReturn('/schooling/fake'),'/account');
 assert.equal(safeAccountReturn('https://evil.example.com/school'),'/account');
});
test('script migration is version guarded and preserves attempts and XP',()=>{
 const sql=read('supabase/migrations/20261030023201_school_calligraphy_script_samples.sql');
 assert.ok(sql.includes('s.version=2 and s.published_version=2'));
 assert.ok(sql.includes('s.draft=s.published'));
 assert.ok(sql.includes('not (s.published ? \'script\')'));
 assert.ok(sql.includes('n<>12'));
 assert.ok(!sql.includes('delete from public.school_stage_attempts'));
 assert.ok(!sql.includes('school_xp_events'));
});
