import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('quiz returns the player to the question and timer on start and every transition',()=>{
 const code=read('components/games/QuizGame.jsx');
 const css=read('components/games/QuizGame.module.css');
 assert.ok(code.includes('playRef=useRef(null)'));
 assert.ok(code.includes("scrollIntoView({block:'start',behavior:'instant'})"));
 assert.ok(code.includes('useLayoutEffect(()=>'));
 assert.ok(code.includes("root.style.scrollBehavior='auto'"));
 assert.ok(css.includes('overflow-anchor:none'));
 assert.ok(css.includes('.progress{margin:12px 0 15px}'));
 assert.ok(code.includes('[runId,step,round.length,result]'));
 assert.ok(code.includes('className={styles.play} ref={playRef}'));
 assert.ok(css.includes('scroll-margin-top:98px'));
 assert.ok(css.includes('scroll-margin-top:83px'));
});

test('map game offers zoom and confirmation without revealing governorate names',()=>{
 const board=read('components/games/ArcadeBoards.jsx');
 const css=read('components/games/ArcadeChallenge.module.css');
 for(const token of ['mapZoomControls','setZoom','تكبير الخريطة','تأكيد الموقع','setCandidate','aria-pressed','onClick={()=>onAnswer(candidate)}'])assert.ok(board.includes(token),token);
 assert.ok(!board.includes('region.nameAr'),'do not expose governorate names in the map');
 assert.ok(!board.slice(board.indexOf('export function MapBoard')).includes('<select'),'no answer dropdown inside map challenge');
 assert.ok(board.includes('onClick={()=>pick(region.id)}'),'click selects a region, not a final answer');
 assert.ok(css.includes('overflow:auto'));
 assert.ok(css.includes('touch-action:pan-x pan-y'));
 assert.ok(css.includes('.mapConfirm{display:flex'));
 assert.ok(css.includes('.region.selectedRegion'));
 assert.ok(css.includes('min-height:48px'));
 assert.ok(board.includes('zoom*100'));
 assert.ok(board.includes('zoom>=3.5'));
});

test('today\'s challenge leads, then the game grid, weekly missions and achievements',()=>{
 const page=read('app/games/page.jsx');
 const css=read('app/games/games.module.css');
 const grid=page.indexOf('className={styles.selectGrid}');
 const player=page.indexOf('<GamesHomeStatus initialDate={date}/>');
 const weekly=page.indexOf('<WeeklyArcade/>');
 const achievements=page.indexOf('<GameAchievementGallery preview/>');
 // Redesign v2: the daily challenge and player summary come first, out of the folds.
 assert.ok(player>0&&player<grid&&grid<weekly&&weekly<achievements);
 assert.equal((page.match(/className=\{styles\.secondarySection\}/g)||[]).length,2);
 assert.ok(page.includes('href={todayGame}'));
 assert.ok(css.includes('.secondarySection>summary'));
 assert.ok(css.includes('.selectTile{display:grid;grid-template-columns:68px'));
 assert.ok(css.includes('min-height:154px'));
});

test('school expedition map and homepage tablet layouts are responsive',()=>{
 const school=read('app/school/page.jsx');
 const world=read('components/school/SchoolWorldMap.jsx');
 const css=read('components/school/SchoolWorldMap.module.css');
 const startCss=read('components/home/HomeSmartStart.module.css');
 assert.ok(school.includes('href="#school-paths"'));
 assert.ok(school.includes('id="school-paths"'));
 assert.ok(school.includes('<SchoolWorldMap/>'));
 assert.ok(!world.includes('الفنون والمهارات'),'no teaser world without lessons');
 assert.ok(css.includes('@media(max-width:700px)'));
 assert.ok(css.includes('@media(max-width:360px)'));
 assert.ok(startCss.includes('.grid>*:last-child:nth-child(odd){grid-column:1/-1}'));
 assert.ok(startCss.includes('.grid>*:last-child:nth-child(odd){grid-column:auto}'));
});

// Editorial Calm redesign: same disclosure behaviour with .ed-* markup.
test('mobile navigation and footer groups are compact disclosures',()=>{
 const header=read('components/Header.jsx');
 const footer=read('components/Footer.jsx');
 const css=read('app/foundation/shell.css');
 assert.ok(header.includes('<details className="ed-nav-group"'));
 assert.ok(header.indexOf('className="ed-nav-search"')<header.indexOf('className="ed-nav-list"'));
 assert.ok(header.includes("querySelectorAll('.ed-nav-group[open]')"));
 assert.ok(footer.includes('className="ed-footer-group ed-footer-fold"'));
 assert.ok(footer.includes('className="ed-footer-group ed-footer-desktop"'));
 assert.ok(css.includes('.ed-footer-fold { display: none; }'));
 assert.ok(css.includes('.ed-footer-desktop { display: none; }'));
 assert.ok(css.includes('.ed-footer-fold { display: block;'));
 assert.ok(css.includes('.ed-footer-fold:not([open]) > ul { display: none; }'));
 assert.ok(css.includes('.ed-nav-group > summary'));
});

test('debate poll copy is specific and card covers do not crop participants',()=>{
 const interaction=read('components/debates/DebateInteraction.jsx');
 const cover=read('components/debates/DebateCover.css');
 const migration=read('supabase/migrations/20261101010057_fix_debate_poll_copy.sql');
 assert.ok(interaction.includes("anchor==='polls'"));
 assert.ok(interaction.includes('سجّل الدخول لاختيار موقفك وحفظ صوتك'));
 assert.ok(cover.includes('.debate-card-art .debate-cover>img{object-fit:contain'));
 assert.ok(migration.includes("debate.slug = 'yemen-digital-services-test'"));
 assert.ok(migration.includes("set label = 'أؤيد التحول الرقمي الكامل خلال خمس سنوات'"));
 assert.ok(migration.includes('and option.position = 0'));
});
