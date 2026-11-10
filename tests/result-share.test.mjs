import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RESULT_GAMES, parseResultShare, resultShareImagePath, resultSharePath} from '../lib/resultShare.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('result links carry only numbers and known ids', () => {
  assert.equal(resultSharePath({kind: 'game', game: 'quiz', score: 8, total: 10, daily: true}), '/share/result?k=game&g=quiz&s=8&t=10&m=daily');
  assert.equal(resultSharePath({kind: 'lesson', course: 'arud', lesson: 2, stars: 3}), '/share/result?k=lesson&c=arud&l=2&st=3');
  assert.equal(resultShareImagePath({kind: 'game', game: 'map', score: 3, total: 10}), '/share/result/image?k=game&g=map&s=3&t=10');
  assert.deepEqual(parseResultShare(new URLSearchParams('k=game&g=who&s=7&t=10')), {kind: 'game', game: 'who', score: 7, total: 10, daily: false});
  assert.deepEqual(parseResultShare({k: 'lesson', c: 'economics-basics', l: '12', st: '1'}), {kind: 'lesson', course: 'economics-basics', lesson: 12, stars: 1});
  for (const query of ['k=game&g=hack&s=1&t=2', 'k=game&g=quiz&s=11&t=10', 'k=game&g=quiz&s=-1&t=10', 'k=game&g=quiz&s=1.5&t=10', 'k=game&g=quiz&s=1&t=0',
    'k=lesson&c=Arud&l=1&st=3', 'k=lesson&c=arud&l=13&st=3', 'k=lesson&c=arud&l=1&st=4', 'k=lesson&c=<b>&l=1&st=1', 'k=other'])
    assert.equal(parseResultShare(new URLSearchParams(query)), null, query);
  assert.equal(resultSharePath({kind: 'game', game: 'quiz', score: 12, total: 10}), null, 'an invalid result falls back to the plain link');
  for (const game of ['place', 'timeline', 'map', 'who', 'bigger', 'connect', 'yemenword', 'object', 'quiz']) assert.ok(RESULT_GAMES.includes(game), game);
});

test('the result page and image take names from the site, are not indexed, and count arrivals', () => {
  const page = read('app/share/result/page.jsx');
  assert.ok(page.includes('noindex:true'));
  assert.ok(page.includes("sectionGate(result.kind==='game'?'games':'school',settings)"));
  assert.ok(page.includes('<ShareArrival'));
  assert.ok(read('app/share/result/ShareArrival.jsx').includes("trackFunnel('share_arrival', kind)"));
  const server = read('lib/resultShareServer.js');
  assert.ok(server.includes('gameNames[result.game]') && server.includes('publishedSchoolCatalog'));
  assert.ok(read('app/share/result/image/route.js').includes('parseResultShare(new URL(request.url).searchParams)'));
});

test('games and lessons share result links and count the click', () => {
  for (const file of ['components/games/QuizGame.jsx', 'components/games/ArcadeChallenge.jsx', 'components/games/ExtraArcadeChallenge.jsx', 'components/school/v2/CardLessonPlayer.jsx']) {
    const source = read(file);
    assert.ok(source.includes('resultSharePath({kind:') || source.includes('resultSharePath({kind: '), file);
    assert.ok(source.includes("trackFunnel('share_click'"), file);
  }
});
