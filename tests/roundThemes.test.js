import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_CONFIG } from '../src/gameLogic.js';
import { ROUND_THEMES, roundSeconds, buildBars, formatSeconds } from '../src/roundThemes.js';

test('les 4 manches ont un habillage complet', () => {
  for (const r of [1, 2, 3, 4]) {
    const t = ROUND_THEMES[r];
    for (const k of ['label', 't1', 't2', 'bg', 'fg', 'a', 'b', 'gridA', 'gridB', 'panel', 'pts', 'rule']) {
      assert.ok(t[k], `manche ${r} : ${k} manquant`);
    }
    assert.ok(t.bars.count > 0 && t.bars.fill);
  }
});

test('couleurs de fond des maquettes v2', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => ROUND_THEMES[r].bg), ['#1B2A6B', '#0A0A0D', '#140A3C', '#0A0A0A']);
});

test('les durées affichées viennent de la configuration du jeu (30 / 30 / 45 / 45)', () => {
  assert.deepEqual([1, 2, 3, 4].map(roundSeconds), [30, 30, 45, 45]);
  for (const r of [1, 2, 3, 4]) assert.equal(roundSeconds(r), ROUND_CONFIG[r].seconds);
});

test('les règles annoncées correspondent aux vrais points', () => {
  assert.match(ROUND_THEMES[1].rule, /1 pt/);
  assert.match(ROUND_THEMES[2].rule, /2 pts/);
  assert.match(ROUND_THEMES[3].rule, /3 pts.*1 pt.*\+3 · \+2 · \+1/);
  assert.match(ROUND_THEMES[4].rule, /5 pts.*2 pts.*éliminé.*30 s/);
});

test('barres manche 4 : toujours 16, la part tombée suit la part de joueurs éliminés', () => {
  assert.equal(buildBars(4, [true, false, true]).filter(b => b.dead).length, 5);   // 1 éliminé sur 3 → 5 barres sur 16
  assert.equal(buildBars(4, [true, true]).filter(b => b.dead).length, 0);
  assert.equal(buildBars(4, [false, false]).filter(b => b.dead).length, 16);
  assert.equal(buildBars(4, []).length, 16);
  assert.equal(buildBars(4, [true, false, true]).length, 16);
  // les barres tombées sont les dernières (comme dans la maquette)
  assert.deepEqual(buildBars(4, [true, false]).map(b => b.dead).slice(7, 9), [false, true]);
  assert.equal(buildBars(2, null).length, 7);
  assert.deepEqual(buildBars(2, null).map(b => b.h), [40, 70, 90, 100, 85, 65, 45]);
});

test('temps affiché à la française', () => {
  assert.equal(formatSeconds(2.4), '2,4 s');
  assert.equal(formatSeconds(null), '');
});
