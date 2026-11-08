// مدرسة 967 — نشر مسار بطاقات (الإصدار الثاني) من المستودع إلى قاعدة البيانات.
// الاستخدام: node scripts/publish-school-v2-course.mjs <slug> [--write] [--actor-email=…] [--local]
// بلا --write: يتحقق ويطبع الخطة فقط. مع --write: يحفظ نسخة احتياطية من الصفوف الحالية في
// data/school-v2/archive/ ثم يحفظ كل محطة مسودةً وينشرها بالترتيب (0 ← 11)، ثم المسار نفسه.
// --local: publishes to the local Supabase in Docker (.env.development.local) instead of production,
// to try a course in the real player first. It refuses any address that is not local and keeps no archive.
// يتبع منطق الاستوديو نفسه: المدقق نفسه، وزيادة النسخة مع شرط النسخة السابقة، وسجل التعديلات (trigger) يحفظ ما قبل وما بعد.
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {validateSchoolEditorial} from '../lib/schoolContent.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(root, 'package.json'));
const {createClient} = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const write = args.includes('--write');
const actorEmail = (args.find(a => a.startsWith('--actor-email=')) || '').split('=')[1] || '';
const local = args.includes('--local');
if (!slug || !/^[a-z][a-z0-9-]{2,39}$/.test(slug)) throw Error('اكتب معرّف المسار.');

const dir = path.join(root, 'data/school-v2/pilot', slug);
const config = JSON.parse(readFileSync(path.join(dir, 'course.json'), 'utf8'));
const files = readdirSync(dir).filter(f => /^\d{2}\.json$/.test(f)).sort();
const lessons = files.map(f => validateSchoolEditorial('stage', JSON.parse(readFileSync(path.join(dir, f), 'utf8'))));
if (lessons.length < 1 || lessons.length > 12) throw Error('من درس إلى 12 درسًا.');

const env = Object.fromEntries(readFileSync(path.join(root, local ? '.env.development.local' : '.env.local'), 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
if (local && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.NEXT_PUBLIC_SUPABASE_URL || '')) throw Error('--local: .env.development.local must point to the local Supabase.');
console.log(local ? 'الهدف: Supabase المحلي (Docker).' : 'الهدف: قاعدة الإنتاج.');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const must = (r, what) => { if (r.error) throw Error(what + ': ' + r.error.message); return r.data; };

const course = must(await db.from('school_editor_courses').select('*').eq('slug', slug).maybeSingle(), 'قراءة المسار');
if (!course) throw Error('المسار غير موجود في القاعدة.');
const stages = must(await db.from('school_editor_stages').select('*').eq('course_slug', slug).order('stage_index'), 'قراءة المحطات');
const base = course.published || course.draft;
const courseDoc = validateSchoolEditorial('course', {title: config.title || base.title, category: base.category, description: config.description || base.description,
  format: config.format, units: config.units, capstone: config.capstone});

console.log(`${slug}: ${lessons.length} دروس صالحة؛ المحطات الحالية في القاعدة: ${stages.length}.`);
lessons.forEach((l, i) => { const row = stages.find(s => s.stage_index === i);
  console.log(`  ${i + 1}. ${l.title} — ${row ? `تحديث (النسخة ${row.version}، المنشور الآن: ${row.published?.format === 2 ? 'بطاقات' : row.published ? 'الإصدار الأول' : 'لا شيء'})` : 'إنشاء'}`); });
console.log(`  المسار: format=2، ${courseDoc.units.length} وحدات، المشروع الختامي ${courseDoc.capstone + 1}.`);
if (!write) { console.log('تجربة فقط. أضف --write للكتابة.'); process.exit(0); }

let actor = null;
if (actorEmail) {
  const {data, error} = await db.auth.admin.listUsers({perPage: 1000});
  if (error) throw error;
  actor = data.users.find(u => u.email === actorEmail)?.id || null;
  if (!actor) throw Error('لم أجد حساب الكاتب.');
}

// نسخة احتياطية قبل أي كتابة (للإنتاج فقط؛ النسخة المحلية تُستعاد من النسخ الاحتياطية).
if (!local) {
const archive = path.join(root, 'data/school-v2/archive');
if (!existsSync(archive)) mkdirSync(archive, {recursive: true});
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const backup = path.join(archive, `${stamp}-${slug}.json`);
writeFileSync(backup, JSON.stringify({slug, takenAt: new Date().toISOString(), course, stages}, null, 1));
console.log('النسخة الاحتياطية:', path.relative(root, backup));
}

const now = () => new Date().toISOString();
for (const [i, doc] of lessons.entries()) {
  const row = stages.find(s => s.stage_index === i);
  let version;
  if (row) {
    const saved = must(await db.from('school_editor_stages').update({draft: doc, version: row.version + 1, updated_by: actor, updated_at: now()})
      .eq('course_slug', slug).eq('stage_index', i).eq('version', row.version).select('version').maybeSingle(), `حفظ المحطة ${i + 1}`);
    if (!saved) throw Error(`تغيّرت نسخة المحطة ${i + 1}؛ توقفت.`);
    version = saved.version;
  } else {
    version = must(await db.from('school_editor_stages').insert({course_slug: slug, stage_index: i, draft: doc, updated_by: actor})
      .select('version').single(), `إنشاء المحطة ${i + 1}`).version;
  }
  const pub = must(await db.from('school_editor_stages').update({published: doc, published_version: version, updated_by: actor, updated_at: now()})
    .eq('course_slug', slug).eq('stage_index', i).eq('version', version).select('published_version').maybeSingle(), `نشر المحطة ${i + 1}`);
  if (!pub) throw Error(`تعذر نشر المحطة ${i + 1}؛ توقفت.`);
  console.log(`  ✓ ${i + 1}. ${doc.title} (النسخة ${version})`);
}
const savedCourse = must(await db.from('school_editor_courses').update({draft: courseDoc, version: course.version + 1, updated_by: actor, updated_at: now()})
  .eq('slug', slug).eq('version', course.version).select('version').maybeSingle(), 'حفظ المسار');
if (!savedCourse) throw Error('تغيّرت نسخة المسار؛ توقفت.');
const pubCourse = must(await db.from('school_editor_courses').update({published: courseDoc, published_version: savedCourse.version, updated_by: actor, updated_at: now()})
  .eq('slug', slug).eq('version', savedCourse.version).select('published_version').maybeSingle(), 'نشر المسار');
if (!pubCourse) throw Error('تعذر نشر المسار.');
console.log(`✓ نُشر المسار ${slug} بصيغة البطاقات.`);
