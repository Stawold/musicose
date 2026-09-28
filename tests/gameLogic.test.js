import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND_CONFIG, TOTAL_SONGS, roundForIndex, isEndOfRound,
  isCorrect, isArtistCorrect, scoreTextAnswer, round3BonusForPosition,
  scoreChoiceRound, buildOptions, themeFor, adjustedScores,
} from '../src/gameLogic.js';

// Playlist factice de 65 chansons
const songs = Array.from({ length: TOTAL_SONGS }, (_, i) => ({
  title: `Titre ${i + 1}`, artist: `Prenom${i + 1} Nom${i + 1}`,
}));
// Seed déterministe
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('structure : 15 + 15 + 25 + 10 = 65 chansons', () => {
  const size = r => ROUND_CONFIG[r].end - ROUND_CONFIG[r].start + 1;
  assert.deepEqual([1, 2, 3, 4].map(size), [15, 15, 25, 10]);
  assert.equal(TOTAL_SONGS, 65);
  assert.equal(ROUND_CONFIG[2].start, ROUND_CONFIG[1].end + 1);
  assert.equal(ROUND_CONFIG[3].start, ROUND_CONFIG[2].end + 1);
  assert.equal(ROUND_CONFIG[4].start, ROUND_CONFIG[3].end + 1);
});

test('durées : 30 / 30 / 45 / 45 (musique coupée à 30 s en manche 4)', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => ROUND_CONFIG[r].seconds), [30, 30, 45, 45]);
  assert.equal(ROUND_CONFIG[4].audio, 30);
});

test('roundForIndex aux frontières', () => {
  const expected = { 0: 1, 14: 1, 15: 2, 29: 2, 30: 3, 54: 3, 55: 4, 64: 4 };
  for (const [idx, r] of Object.entries(expected)) assert.equal(roundForIndex(+idx), r, `index ${idx}`);
});

test('classement intermédiaire uniquement à la fin des manches 1, 2, 3', () => {
  const ends = songs.map((_, i) => i).filter(isEndOfRound);
  assert.deepEqual(ends, [14, 29, 54]);
  assert.equal(isEndOfRound(64), false); // dernière chanson : podium final
});

test('réponses : tolérance, accents, articles, apostrophes typographiques', () => {
  assert.ok(isCorrect('alors on danse', 'Alors on danse'));
  assert.ok(isCorrect('Laventurier', "L'aventurier"));
  assert.ok(isCorrect('l’aventurier', "L'aventurier"));
  assert.ok(isCorrect('Cote Ouest', 'Côte Ouest'));
  assert.ok(!isCorrect('Autre chose', 'Alors on danse'));
  assert.ok(!isCorrect('', 'Alors on danse'));
});

test('artiste : nom complet OU nom de famille', () => {
  assert.ok(isArtistCorrect('Celine Dion', 'Celine Dion'));
  assert.ok(isArtistCorrect('Dion', 'Celine Dion'));
  assert.ok(isArtistCorrect('beatles', 'The Beatles'));
  assert.ok(!isArtistCorrect('Celine', 'Celine Dion'));
  assert.ok(!isArtistCorrect('Shakira', 'Celine Dion'));
});

test('manche 1 : 1 pt si bon, +1 pour le plus rapide parmi les bons seulement', () => {
  const res = scoreChoiceRound({
    a: { index: 2, time: 8.5 },
    b: { index: 1, time: 1.0 },   // plus rapide mais faux → pas de bonus
    c: { index: 2, time: 3.2 },   // bon et le plus rapide des bons
  }, 2);
  assert.deepEqual(res.a, { correct: true, points: 1, fastest: false });
  assert.deepEqual(res.b, { correct: false, points: 0, fastest: false });
  assert.deepEqual(res.c, { correct: true, points: 2, fastest: true });
});

test('manche 1 : personne de juste → aucun point ni bonus', () => {
  const res = scoreChoiceRound({ a: { index: 0, time: 1 }, b: { index: 3, time: 2 } }, 1);
  assert.equal(res.a.points + res.b.points, 0);
  assert.ok(!res.a.fastest && !res.b.fastest);
});

test('manche 1 : un seul bonus même en cas d’égalité de temps', () => {
  const res = scoreChoiceRound({ a: { index: 0, time: 2 }, b: { index: 0, time: 2 } }, 0);
  assert.equal(Object.values(res).filter(r => r.fastest).length, 1);
});

test('manche 2 : titre seul = 2 pts, l’artiste ne compte pas', () => {
  const s = { title: 'Flowers', artist: 'Miley Cyrus' };
  assert.equal(scoreTextAnswer(2, { title: 'flowers', artist: '' }, s).points, 2);
  assert.equal(scoreTextAnswer(2, { title: '', artist: 'Miley Cyrus' }, s).points, 0);
  assert.equal(scoreTextAnswer(2, { title: 'flowers', artist: 'Miley Cyrus' }, s).points, 2);
});

test('manche 3 : 1 pt titre OU artiste, 3 pts les deux, bonus 3/2/1 puis 0', () => {
  const s = { title: 'Flowers', artist: 'Miley Cyrus' };
  assert.equal(scoreTextAnswer(3, { title: 'flowers', artist: '' }, s).points, 1);
  assert.equal(scoreTextAnswer(3, { title: '', artist: 'cyrus' }, s).points, 1);
  assert.equal(scoreTextAnswer(3, { title: 'flowers', artist: 'cyrus' }, s).points, 3);
  assert.equal(scoreTextAnswer(3, { title: 'x', artist: 'y' }, s).points, 0);
  assert.deepEqual([0, 1, 2, 3, 4].map(round3BonusForPosition), [3, 2, 1, 0, 0]);
});

test('manche 4 : 5 pts les deux, 2 pts un seul, 0 = éliminé', () => {
  const s = { title: 'Flowers', artist: 'Miley Cyrus' };
  assert.equal(scoreTextAnswer(4, { title: 'flowers', artist: 'miley cyrus' }, s).points, 5);
  assert.equal(scoreTextAnswer(4, { title: 'flowers', artist: '' }, s).points, 2);
  assert.equal(scoreTextAnswer(4, { title: '', artist: 'cyrus' }, s).points, 2);
  assert.equal(scoreTextAnswer(4, { title: '', artist: '' }, s).points, 0);
});

test('propositions : 4 uniques, la bonne y est une seule fois, correctIndex juste', () => {
  for (let idx = 0; idx <= 14; idx++) {
    const { options, correctIndex } = buildOptions(songs, idx, seeded(idx + 7));
    assert.equal(options.length, 4);
    assert.equal(new Set(options.map(o => o.title)).size, 4);
    assert.equal(options[correctIndex].title, songs[idx].title);
    assert.equal(options.filter(o => o.title === songs[idx].title).length, 1);
  }
});

test('propositions : utilise song.choices quand fournies, complète sinon', () => {
  const custom = songs.map(s => ({ ...s }));
  custom[3].choices = [
    { title: 'Faux 1', artist: 'Artiste X' },
    { title: 'Faux 2', artist: 'Artiste Y' },
    { title: 'Faux 3', artist: 'Artiste Z' },
  ];
  const full = buildOptions(custom, 3, seeded(3)).options.map(o => o.title).sort();
  assert.deepEqual(full, ['Faux 1', 'Faux 2', 'Faux 3', 'Titre 4']);

  custom[4].choices = [{ title: 'Faux A', artist: 'Artiste A' }];
  const partial = buildOptions(custom, 4, seeded(4)).options;
  assert.equal(partial.length, 4);
  assert.ok(partial.some(o => o.title === 'Faux A'));
});

test('propositions : pas de mauvaise proposition du même artiste que la bonne', () => {
  const custom = songs.map(s => ({ ...s }));
  custom[0].choices = [
    { title: 'Autre titre', artist: custom[0].artist },
    { title: 'Faux 2', artist: 'Y' }, { title: 'Faux 3', artist: 'Z' }, { title: 'Faux 4', artist: 'W' },
  ];
  const { options } = buildOptions(custom, 0, seeded(9));
  assert.equal(options.filter(o => o.artist === custom[0].artist).length, 1);
});

test('thème : utilise song.theme, sinon repli sur l’artiste', () => {
  assert.equal(themeFor({ title: 'x', artist: 'Queen', theme: 'Rock' }), 'Rock');
  assert.equal(themeFor({ title: 'x', artist: 'Queen' }), 'Queen');
});

test('ajustement manuel des scores : +1 / -1, jamais sous 0', () => {
  const p = { totalScore: 10, scorePerRound: [4, 6, 0, 0] };
  assert.deepEqual(adjustedScores(p, 2, 1), { totalScore: 11, scorePerRound: [4, 7, 0, 0], applied: 1 });
  assert.deepEqual(adjustedScores(p, 1, -1), { totalScore: 9, scorePerRound: [3, 6, 0, 0], applied: -1 });
  assert.equal(adjustedScores({ totalScore: 0, scorePerRound: [0, 0, 0, 0] }, 1, -1), null);
});
