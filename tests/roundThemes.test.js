import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_CONFIG } from '../src/gameLogic.js';
import { ROUND_THEMES, roundSeconds, buildBars, formatSeconds, BASE_THEME, PILL_COLORS, PHONE_THEMES, RESULT_COLORS, barVanishOrder, vanishedBars } from '../src/roundThemes.js';
import { TIPS, tipsText } from '../src/tips.js';

test('les 4 manches ont un habillage complet', () => {
  for (const r of [1, 2, 3, 4]) {
    const t = ROUND_THEMES[r];
    for (const k of ['label', 't1', 't2', 'bg', 'fg', 'a', 'b', 'gridA', 'gridB', 'panel', 'pts', 'tiles']) {
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

test('les tuiles de règles annoncées correspondent aux vrais points et durées', () => {
  const flat = (round) => ROUND_THEMES[round].tiles.map(t => `${t.v} ${t.l}`).join(' | ');
  assert.match(flat(1), /30 S.*1 PT BONNE RÉPONSE.*\+1 LE PLUS RAPIDE/);
  assert.match(flat(2), /30 S.*2 PTS TITRE TROUVÉ.*\+1 LE PLUS RAPIDE/);
  assert.match(flat(3), /45 S.*3 PTS TITRE \+ ARTISTE.*1 PT L’UN DES DEUX.*\+3 \+2 \+1 LES 3 PLUS RAPIDES/);
  assert.match(flat(4), /45 S.*5 PTS TITRE \+ ARTISTE.*2 PTS L’UN DES DEUX.*ÉLIMINÉ/);
  assert.match(ROUND_THEMES[4].tiles[0].s, /30 S/);   // musique coupée à 30 s
  // la durée annoncée est celle du jeu
  for (const r of [1, 2, 3, 4]) assert.equal(ROUND_THEMES[r].tiles[0].v, `${roundSeconds(r)} S`);
});

test('barres : nombre et hauteurs par manche', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => buildBars(r).length), [40, 7, 40, 16]);
  assert.deepEqual(buildBars(2).map(b => b.h), [40, 70, 90, 100, 85, 65, 45]);
});

test('manche 4 : les barres s’éteignent au hasard, une par une, jusqu’à la fin du décompte', () => {
  const order = barVanishOrder(16, 5);
  assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));   // chaque barre une seule fois
  assert.notDeepEqual(order, Array.from({ length: 16 }, (_, i) => i));                             // pas dans l’ordre
  assert.notDeepEqual(barVanishOrder(16, 5), barVanishOrder(16, 6));                               // ordre différent d’une chanson à l’autre
  assert.deepEqual(barVanishOrder(16, 5), order);                                                  // mais identique sur tous les écrans
  assert.equal(vanishedBars(16, 0, 45), 0);
  assert.equal(vanishedBars(16, 22.5, 45), 8);
  assert.equal(vanishedBars(16, 45, 45), 16);
  assert.equal(vanishedBars(16, 99, 45), 16);
  // progression régulière : jamais de retour en arrière
  let prev = 0;
  for (let s = 0; s <= 45; s++) { const v = vanishedBars(16, s, 45); assert.ok(v >= prev); prev = v; }
});

test('bandeau défilant : comment rejoindre + règles « maison », le code est inséré', () => {
  const text = tipsText('OSE-AB3D');
  assert.match(text, /OSE-AB3D/);
  assert.match(text, /RÈGLE N°1 : C'EST TOUJOURS LA FAUTE DU PRÉSENTATEUR/);
  assert.match(text, /RÈGLE N°2/);
  assert.match(text, /SOUDOYER LE PRÉSENTATEUR, IL EST BLINDÉ/);
  assert.ok(TIPS.length >= 8);
  assert.ok(!/\{code\}/.test(text));
});

test('temps affiché à la française', () => {
  assert.equal(formatSeconds(2.4), '2,4 s');
  assert.equal(formatSeconds(null), '');
});

test('accueil : palette et pastilles des maquettes « Transitions »', () => {
  assert.equal(BASE_THEME.bg, '#0E0B1F');
  assert.match(BASE_THEME.sun, /#FFC933.*#FF5A4E.*#FF2E93.*#00E5FF/);
  assert.deepEqual([1, 2, 3, 4].map(r => PILL_COLORS[r]), ['#FFC933', '#F4EBD9', '#00E5FF', '#E10600']);
});

test('annonces de manche : dégradé de soleil et grille propres à chaque manche', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => ROUND_THEMES[r].sun), [
    'linear-gradient(#FFC933,#FF5A4E)', 'linear-gradient(#F4EBD9,#8A8A8F)', 'linear-gradient(#FF2E93,#00E5FF)', 'linear-gradient(#E10600,#5a0200)',
  ]);
  for (const r of [1, 2, 3, 4]) assert.ok(ROUND_THEMES[r].annGrid);
});

test('téléphone : habillage des 4 manches (maquette « Scène synthwave »)', () => {
  assert.deepEqual([1, 2, 3, 4].map(r => PHONE_THEMES[r].bg), ['#1B2A6B', '#0A0A0D', '#140A3C', '#0A0A0A']);
  assert.deepEqual([1, 2, 3, 4].map(r => PHONE_THEMES[r].eqN), [9, 5, 9, 9]);
  for (const r of [1, 2, 3, 4]) for (const k of ['bg', 'fg', 'a', 'b', 'grid', 'sunOp', 'btnFg', 'spd']) assert.ok(PHONE_THEMES[r][k] !== undefined, `manche ${r} : ${k}`);
  assert.deepEqual(RESULT_COLORS, { parfait: '#2FD27A', partiel: '#FF9F1C', rate: '#FF3B3B' });
});
