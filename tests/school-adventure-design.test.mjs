import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('the school home is a four-world adventure map, not a grid of duplicate course cards',()=>{
 const home=read('app/school/page.jsx');
 const map=read('components/school/SchoolWorldMap.jsx');
 const css=read('components/school/SchoolWorldMap.module.css');
 assert.ok(home.includes('id="school-paths"'));
 assert.ok(home.includes('<SchoolWorldMap/>'));
 assert.ok(home.includes('href="/school/dashboard"'));
 assert.ok(home.includes('15 مسارًا و180 محطة'));
 for(const href of ['/school/writing','/school/nature','/school/logic','/school/civic'])assert.ok(map.includes("href:'"+href+"'"),href);
 assert.ok(map.includes("id:'writing'")&&map.includes("id:'nature'")&&map.includes("id:'logic'")&&map.includes("id:'civic'"));
 assert.ok(map.includes('const worlds=['));
 assert.ok(map.includes('قيد الإعداد'));
 assert.ok(!map.includes('href="/school/art"'));
 for(const cls of ['.worldList','.worldItem','.roadNode','.scene','.worldAction','.worldPending','.mapEnd'])assert.ok(css.includes(cls),cls);
 assert.ok(css.includes(':global(:root[data-ed-theme="dark"])'));
 assert.ok(css.includes('@media(max-width:700px)'));
 assert.ok(css.includes('@media(max-width:360px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.equal(css.split('{').length,css.split('}').length);
});

test('every department uses a connected expedition trail and preserves its public content source',()=>{
 const trail=read('components/school/SchoolTrackTrail.jsx');
 const css=read('components/school/SchoolTrackTrail.module.css');
 const pages=[
 ['app/school/writing/page.jsx','writing'],
 ['app/school/nature/page.jsx','nature'],
 ['app/school/logic/page.jsx','logic'],
 ['app/school/civic/page.jsx','civic']
 ];
 for(const [p,theme] of pages){
  const src=read(p);
  assert.ok(src.includes('<SchoolTrackTrail theme="'+theme+'"'),p);
  assert.ok(src.includes('publishedSchoolCatalog'),p);
  assert.ok(src.includes('href="/school/dashboard"')||src.includes("href='/school/dashboard'"),p);
 }
 assert.ok(read('app/school/nature/page.jsx').includes('publishedSchoolStages'));
 assert.ok(read('app/school/logic/page.jsx').includes('publishedSchoolStages'));
 assert.ok(read('app/school/civic/page.jsx').includes('publishedSchoolStages'));
 assert.ok(read('app/school/writing/page.jsx').includes("href:'/school/courses/musnad'"));
 assert.ok(read('app/school/writing/page.jsx').includes("href:'/school/courses/arud'"));
 assert.ok(trail.includes('tracks.map((track,index)'));
 assert.ok(trail.includes('track.href||'));
 assert.ok(trail.includes('اختر أي مسار')||trail.includes('يمكنك اختيار أي مسار منشور'));
 assert.ok(css.includes('.steps:before'));
 assert.ok(css.includes('.pathPin'));
 assert.ok(css.includes('.step:nth-child(even)'));
 assert.ok(css.includes('@media(max-width:680px)'));
 assert.ok(css.includes(':global(:root[data-ed-theme="dark"])'));
 assert.equal(css.split('{').length,css.split('}').length);
});

test('course journey map uses true API progress and never unlocks a station cosmetically',()=>{
 // SchoolCourseMap was retired in phase 8; every course uses the card journey.
 const map=read('components/school/v2/CourseJourney.jsx');
 const css=read('components/school/v2/CourseJourney.module.css');
 assert.ok(map.includes("fetch('/api/school/custom?slug=' + encodeURIComponent(slug), {cache: 'no-store', headers: {Authorization: 'Bearer ' + token}})"));
 assert.ok(map.includes('staff: Boolean(json.staffPreview)'));
 assert.ok(map.includes('const state = useMemo(() => journeyState(stages, progress), [stages, progress]);'));
 assert.ok(map.includes("{st.status === 'locked' || st.status === 'pending'"));
 assert.ok(map.includes('<div className={styles.link} aria-disabled="true">{inner}</div>'));
 assert.ok(map.includes("const st = state.byIndex[s.index] || {status: 'locked', stars: 0};"));
 assert.ok(map.includes('aria-valuenow={state.done}'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.equal(css.split('{').length,css.split('}').length);
});
