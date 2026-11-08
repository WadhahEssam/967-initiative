import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules={
 school:read('app/school/school.module.css'),
 studio:read('app/school/studio/studio.module.css'),
 civic:read('app/school/civic/civic.module.css'),
 dashboard:read('app/school/dashboard/dashboard.module.css'),
 worlds:read('components/school/SchoolWorldMap.module.css'),
 tracks:read('components/school/SchoolTrackTrail.module.css'),
 journey:read('components/school/v2/CourseJourney.module.css'),
};
const dark=':global(:root[data-ed-theme="dark"])';

test('all 7 school stylesheet modules include scoped dark-mode rules',()=>{
 for(const [name,css] of Object.entries(modules)){
  assert.ok(css.includes(dark),name+' has no dark theme');
  assert.equal(css.split('{').length,css.split('}').length,name+' has mismatched CSS braces');
 }
});

test('Musnad stage cards use dedicated backgrounds and readable labels in dark mode',()=>{
 const css=modules.school;
 for(const cls of ['.stationTop .done','.stationTop .open','.stationTop .locked','.stationTop .staffOpen']){
  assert.ok(css.includes(cls),cls+' missing');
 }
 for(const bg of ['#173d2c','#153d35','#31393e','#173a52'])assert.ok(css.includes('background:'+bg),bg);
 for(const fg of ['#d5f9dc','#d4fff0','#f0f5f4','#e4f6ff'])assert.ok(css.includes('color:'+fg),fg);
 assert.ok(css.includes('.staffPreviewNotice'));
 assert.ok(css.includes('.reviewCorrect,.reviewWrong,.lessonError'));
});

test('generic lessons cover answer states and feedback surfaces',()=>{
 const studio=modules.studio;
 for(const cls of ['.guidedTips','.learningIllustration','.guidedReady','.guidedCaution',
  '.calligraphyPractice','.courseAuthBox','.practiceCanvas','.scienceObservation','.scienceCaveat']){
  assert.ok(studio.includes(cls),cls);
 }
 assert.ok(studio.includes('background:var(--c-surface)'));
 assert.ok(studio.includes('background-color:#f5faf4'));
});

test('Civic, science and dashboard elements remain readable when dark',()=>{
 const civic=modules.civic,studio=modules.studio,dashboard=modules.dashboard;
 for(const sel of ['.challenge','.activityStory','.exerciseExplanation','.pathGrid button','.choiceIndex','.warning']){
  assert.ok(civic.includes(sel),sel);
 }
 for(const sel of ['.thinkingLab','.scienceLab','.sciencePredictionResult','.scienceActivityPrompt','.sciencePredictionChoices button']){
  assert.ok(studio.includes(sel),sel);
 }
 for(const sel of ['.xpPanel','.leaderboardEntry','.goalChoice','.goalSelected','.reviewItem .reviewContext',
  '.achievementLocked','.leaderboardMine','.periodTabs','.resume>div>span']){
  assert.ok(dashboard.includes(sel),sel);
 }
 assert.ok(dashboard.includes('opacity:1'));
 assert.ok(dashboard.includes('var(--c-accent-soft)'));
});

test('adventure map, trail and real-progress map include readable dark badges',()=>{
 assert.ok(modules.worlds.includes('.worldKicker .open'));
 assert.ok(modules.worlds.includes('.futureTag'));
 assert.ok(modules.tracks.includes('.questMeta .isOpen'));
 assert.ok(modules.tracks.includes('.trailCount strong'));
 assert.ok(modules.journey.includes(':global(:root[data-ed-theme="dark"]) .item[data-status="done"] .node'));
 assert.ok(modules.journey.includes(':global(:root[data-ed-theme="dark"]) .error'));
});

test('dark-mode paper preserves stroke visibility in both writing workshops',()=>{
 const school=modules.school,studio=modules.studio;
 const musnad=read('components/school/MusnadWritingStudio.jsx');
 const practice=read('components/school/CalligraphyPracticePad.jsx');
 assert.ok(musnad.includes("ctx.strokeStyle='#176456'"));
 assert.ok(practice.includes("ctx.strokeStyle='#204d3c'"));
 assert.ok(school.includes('.writingBoard')&&school.includes('background-color:#f5faf4'));
 assert.ok(studio.includes('.practiceCanvas')&&studio.includes('background-color:#f5faf4'));
 assert.ok(studio.includes('background-image:linear-gradient'));
});

function luminance(hex){
 const full=hex.replace('#','');
 const rgb=[0,2,4].map(index=>parseInt(full.slice(index,index+2),16)/255);
 const linear=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function contrast(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
test('all representative dark status palettes meet WCAG 4.5:1 for normal text',()=>{
 const pairs=[
  ['Musnad complete','#d5f9dc','#173d2c'],
  ['Musnad available','#d4fff0','#153d35'],
  ['Musnad locked','#f0f5f4','#31393e'],
  ['Musnad staff preview','#e4f6ff','#173a52'],
  ['muted text on dark surface','#b7c2bf','#131a1c'],
  ['muted text on raised surface','#b7c2bf','#1a2225'],
  ['paper ink (Musnad)','#176456','#f5faf4'],
  ['paper ink (calligraphy)','#204d3c','#f5faf4'],
  ['error text','#eef2f0','#3a1714'],
  ['green alert text','#eef2f0','#13301a'],
  ['selected button text','#ffffff','#176e55'],
 ];
 for(const [name,fg,bg] of pairs)assert.ok(contrast(fg,bg)>=4.5,name+': '+contrast(fg,bg).toFixed(2));
});
