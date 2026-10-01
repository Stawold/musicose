// Habillage visuel des 4 manches du grand écran (d'après les maquettes Claude Design v2)
// et textes des écrans de transition. Les durées viennent de ROUND_CONFIG : une seule source de vérité.
import { ROUND_CONFIG } from "./gameLogic.js";

export const ROUND_THEMES = {
  1: {
    label: 'CHANSONS EN RAFALE', t1: 'CHANSONS', t2: 'EN RAFALE',
    bg: '#1B2A6B', fg: '#FFF3D6', a: '#FF5A4E', b: '#FFC933',
    gridA: 'rgba(255,201,51,.45)', gridB: 'rgba(255,90,78,.45)', sunOp: 0.9, panel: 'rgba(27,42,107,.88)',
    bars: { count: 40, min: 0.7, rng: 0.5, gap: 6, seed: 10, fill: 'linear-gradient(0deg,#FF5A4E,#FFC933)', glow: 'rgba(255,201,51,.5)' },
    sun: 'linear-gradient(#FFC933,#FF5A4E)', annGrid: 'rgba(255,201,51,.4)',
    pts: '1 PT + BONUS +1',
    tiles: [{ v: '30 S', l: 'POUR RÉPONDRE' }, { v: '1 PT', l: 'BONNE RÉPONSE' }, { v: '+1', l: 'LE PLUS RAPIDE' }],
  },
  2: {
    label: 'LE FOCUS', t1: 'LE', t2: 'FOCUS',
    bg: '#0A0A0D', fg: '#F4EBD9', a: '#8A8A8F', b: '#F4EBD9',
    gridA: 'rgba(244,235,217,.18)', gridB: 'rgba(138,138,143,.22)', sunOp: 0.35, panel: 'rgba(10,10,13,.9)',
    bars: { count: 7, min: 2.4, rng: 1.6, gap: 22, seed: 20, fill: '#F4EBD9', glow: 'rgba(244,235,217,.35)', heights: [40, 70, 90, 100, 85, 65, 45] },
    sun: 'linear-gradient(#F4EBD9,#8A8A8F)', annGrid: 'rgba(244,235,217,.14)',
    pts: 'TITRE SEUL · 2 PTS + BONUS +1',
    tiles: [{ v: '30 S', l: 'POUR RÉPONDRE' }, { v: '2 PTS', l: 'TITRE TROUVÉ' }, { v: '+1', l: 'LE PLUS RAPIDE' }],
  },
  3: {
    label: 'FAST AND MUSICOUS', t1: 'FAST AND', t2: 'MUSICOUS',
    bg: '#140A3C', fg: '#EAF4FF', a: '#FF2E93', b: '#00E5FF',
    gridA: 'rgba(0,229,255,.45)', gridB: 'rgba(255,46,147,.45)', sunOp: 0.85, panel: 'rgba(20,10,60,.85)',
    bars: { count: 40, min: 0.7, rng: 0.4, gap: 6, seed: 50, fill: 'linear-gradient(0deg,#00E5FF,#FF2E93)', glow: 'rgba(0,229,255,.6)' },
    sun: 'linear-gradient(#FF2E93,#00E5FF)', annGrid: 'rgba(0,229,255,.4)',
    pts: '3 PTS / 1 PT + BONUS +3/+2/+1',
    tiles: [{ v: '45 S', l: 'POUR RÉPONDRE' }, { v: '3 PTS', l: 'TITRE + ARTISTE' }, { v: '1 PT', l: 'L’UN DES DEUX' }, { v: '+3 +2 +1', l: 'LES 3 PLUS RAPIDES' }],
  },
  4: {
    label: "LE BATTLE ROYAL D'OSE", t1: 'BATTLE ROYAL', t2: "D'OSE",
    bg: '#0A0A0A', fg: '#F4EBD9', a: '#E10600', b: '#F4EBD9',
    gridA: 'rgba(225,6,0,.5)', gridB: 'rgba(244,235,217,.18)', sunOp: 0.8, panel: 'rgba(10,10,10,.9)',
    bars: { count: 16, min: 1.0, rng: 0.5, gap: 10, seed: 90, fill: '#E10600', glow: 'rgba(225,6,0,.5)' },
    sun: 'linear-gradient(#E10600,#5a0200)', annGrid: 'rgba(225,6,0,.45)',
    pts: '5 PTS / 2 PTS · ÉLIMINATION',
    tiles: [{ v: '45 S', l: 'POUR RÉPONDRE', s: 'MUSIQUE COUPÉE À 30 S' }, { v: '5 PTS', l: 'TITRE + ARTISTE' }, { v: '2 PTS', l: 'L’UN DES DEUX' }, { v: 'ÉLIMINÉ', l: 'SI TOUT EST FAUX' }],
  },
};

export const roundSeconds = (round) => ROUND_CONFIG[round].seconds;

// Générateur pseudo-aléatoire déterministe des maquettes (durées d'animation des barres)
export const rnd = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

// Barres d'égaliseur : nombre, hauteur, durée et décalage d'animation.
export const buildBars = (round) => {
  const t = ROUND_THEMES[round].bars;
  return Array.from({ length: t.count }, (_, i) => ({
    h: t.heights ? t.heights[i % t.heights.length] : 100,
    dur: (t.min + rnd(i + t.seed) * t.rng).toFixed(2),
    delay: (-rnd(i + t.seed + 7) * 2).toFixed(2),
  }));
};

// Manche 4 : les barres de son s'éteignent une à une, dans un ordre aléatoire, pendant le décompte.
// Ordre d'extinction (mélange déterministe : le même pour toutes les machines, différent à chaque chanson).
export const barVanishOrder = (n, seed = 0) =>
  Array.from({ length: n }, (_, i) => i).sort((a, b) => rnd(a * 7.31 + seed * 3.17 + 1) - rnd(b * 7.31 + seed * 3.17 + 1));

// Nombre de barres éteintes après `elapsed` secondes sur `total` (toutes éteintes à la fin du décompte).
export const vanishedBars = (n, elapsed, total) =>
  total > 0 ? Math.max(0, Math.min(n, Math.floor((elapsed / total) * n))) : 0;

export const formatSeconds = (s) => (typeof s === 'number' && !Number.isNaN(s) ? `${s.toFixed(1).replace('.', ',')} s` : '');

// ── Écran d'accueil (salle d'attente et entre les manches) ─────────────
export const BASE_THEME = {
  bg: '#0E0B1F', fg: '#F4EBD9', a: '#FF2E93', b: '#FFC933',
  grid: 'rgba(244,235,217,.22)', sun: 'linear-gradient(#FFC933,#FF5A4E 45%,#FF2E93 70%,#00E5FF)',
  bars: ['#FFC933', '#FF5A4E', '#FF2E93', '#00E5FF'],
};

// Couleur des pastilles 01-04 de l'accueil
export const PILL_COLORS = { 1: '#FFC933', 2: '#F4EBD9', 3: '#00E5FF', 4: '#E10600' };

// ── Habillage des écrans téléphone (maquettes « Scène synthwave ») ─────
export const PHONE_THEMES = {
  1: { bg: '#1B2A6B', fg: '#FFF3D6', a: '#FF5A4E', b: '#FFC933', grid: 'rgba(255,201,51,.45)', sunOp: 0.9, btnFg: '#FFF3D6', eqN: 9, spd: 1.2 },
  2: { bg: '#0A0A0D', fg: '#F4EBD9', a: '#F4EBD9', b: '#8A8A8F', grid: 'rgba(244,235,217,.14)', sunOp: 0.3, btnFg: '#0A0A0D', eqN: 5, spd: 2.6 },
  3: { bg: '#140A3C', fg: '#EAF4FF', a: '#FF2E93', b: '#00E5FF', grid: 'rgba(0,229,255,.45)', sunOp: 0.85, btnFg: '#FFFFFF', eqN: 9, spd: 0.9 },
  4: { bg: '#0A0A0A', fg: '#F4EBD9', a: '#E10600', b: '#F4EBD9', grid: 'rgba(225,6,0,.5)', sunOp: 0.8, btnFg: '#F4EBD9', eqN: 9, spd: 1.4 },
};

// Résultat d'une chanson côté téléphone
export const RESULT_COLORS = { parfait: '#2FD27A', partiel: '#FF9F1C', rate: '#FF3B3B' };
