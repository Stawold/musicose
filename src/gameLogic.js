// Logique pure du jeu (sans React) — partagée par la régie, les joueurs et les tests.

// ── Manches ────────────────────────────────────────────────────
// start / end : indices (0-based, inclus) des chansons dans data.json
// seconds     : temps pour répondre
// audio       : durée pendant laquelle la musique est audible
export const ROUND_NAMES = ["Chansons en rafale", "Le Focus", "Fast and Musicous", "Le battle Royal d'Ose"];

export const ROUND_CONFIG = {
  1: { start: 0,  end: 14, seconds: 30, audio: 30 },
  2: { start: 15, end: 29, seconds: 30, audio: 30 },
  3: { start: 30, end: 54, seconds: 45, audio: 45 },
  4: { start: 55, end: 64, seconds: 45, audio: 30 },
};

export const TOTAL_SONGS = ROUND_CONFIG[4].end + 1; // 65

export const CHOICE_COUNT = 4;

// Manche 1 : 4 micros de couleurs différentes (+ lettre pour les daltoniens)
export const MIC_CHOICES = [
  { letter: 'A', label: 'ROSE',  color: 'var(--mo-magenta)' },
  { letter: 'B', label: 'CYAN',  color: 'var(--mo-cyan)' },
  { letter: 'C', label: 'OR',    color: 'var(--mo-gold)' },
  { letter: 'D', label: 'VERT',  color: '#7CFF6B' },
];

export const roundForIndex = (songIndex) => {
  for (const r of [1, 2, 3, 4]) {
    if (songIndex <= ROUND_CONFIG[r].end) return r;
  }
  return 4;
};

// Fin de manche 1, 2 ou 3 → classement intermédiaire (la manche 4 se termine par le podium)
export const isEndOfRound = (songIndex) => [1, 2, 3].some(r => ROUND_CONFIG[r].end === songIndex);

// ── Comparaison de réponses ────────────────────────────────────
export const levenshtein = (a, b) => {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1].toLowerCase() === a[j - 1].toLowerCase())
        matrix[i][j] = matrix[i - 1][j - 1];
      else
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
    }
  }
  return matrix[b.length][a.length];
};

export const normalize = (s) => {
  if (!s) return '';
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[(\[{][^)\]{}]*[)\]{}]/g, ' ')
    .replace(/[-'’‘.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|les|le|la|l|un|une|a|an|des)\s+/i, '')
    .trim();
};

export const isCorrect = (answer, correct) => {
  if (!answer || !correct) return false;
  const a = normalize(answer);
  const c = normalize(correct);
  const dist = levenshtein(a, c);
  const maxDist = Math.max(1, Math.floor(c.length * 0.15));
  return dist <= maxDist;
};

// Artiste : nom complet OU nom de famille (dernier mot)
export const isArtistCorrect = (answer, correct) => {
  if (isCorrect(answer, correct)) return true;
  const words = normalize(correct).split(' ');
  return words.length > 1 && isCorrect(answer, words[words.length - 1]);
};

// ── Points ─────────────────────────────────────────────────────
export const POINTS = {
  round1Correct: 1,
  round1FastestBonus: 1,
  round2Title: 2,
  round2FastestBonus: 1,
  round3Both: 3,
  round3One: 1,
  round3Bonus: [3, 2, 1], // 1er, 2e, 3e joueur à trouver titre + artiste
  round4Both: 5,
  round4One: 2,
};

// Manches 2, 3 et 4 (réponse saisie). Renvoie les points de base (sans bonus de rapidité).
export const scoreTextAnswer = (round, answer, song) => {
  const titleOk = isCorrect(answer.title, song.title);
  const artistOk = round === 2 ? false : isArtistCorrect(answer.artist, song.artist);
  let points = 0;
  if (round === 2) {
    if (titleOk) points = POINTS.round2Title;
  } else if (round === 3) {
    if (titleOk && artistOk) points = POINTS.round3Both;
    else if (titleOk || artistOk) points = POINTS.round3One;
  } else if (round === 4) {
    if (titleOk && artistOk) points = POINTS.round4Both;
    else if (titleOk || artistOk) points = POINTS.round4One;
  }
  return { points, titleOk, artistOk, both: titleOk && artistOk };
};

export const round3BonusForPosition = (position) => POINTS.round3Bonus[position] || 0;

// Manche 1 (QCM) : choices = { [sessionId]: { index, time } } — dernier choix de chaque joueur.
// 1 point si bon + 1 bonus pour le plus rapide UNIQUEMENT parmi les bonnes réponses.
// Renvoie { [sessionId]: { correct, points, fastest } }.
export const scoreChoiceRound = (choices, correctIndex) => {
  const results = {};
  let fastestSid = null;
  let fastestTime = Infinity;
  for (const [sid, c] of Object.entries(choices)) {
    const correct = c.index === correctIndex;
    results[sid] = { correct, points: correct ? POINTS.round1Correct : 0, fastest: false };
    if (correct) {
      const t = typeof c.time === 'number' && !Number.isNaN(c.time) ? c.time : Infinity;
      if (fastestSid === null || t < fastestTime) { fastestSid = sid; fastestTime = t; }
    }
  }
  if (fastestSid !== null) {
    results[fastestSid].fastest = true;
    results[fastestSid].points += POINTS.round1FastestBonus;
  }
  return results;
};

// ── Propositions (manche 1) ────────────────────────────────────
const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// song.choices (optionnel) : 3 mauvaises propositions [{title, artist}, ...].
// Si absent ou incomplet, on complète avec des chansons de la playlist (autre artiste).
// Renvoie { options: [{title, artist} x4 mélangées], correctIndex }.
export const buildOptions = (songs, songIndex, rng = Math.random) => {
  const song = songs[songIndex];
  const good = { title: song.title, artist: song.artist };
  const sameKey = (a, b) => normalize(a.title) === normalize(b.title) || normalize(a.artist) === normalize(b.artist);

  const wrong = [];
  const addWrong = (c) => {
    if (!c || !c.title || !c.artist) return;
    if (sameKey(c, good)) return;
    if (wrong.some(w => normalize(w.title) === normalize(c.title))) return;
    wrong.push({ title: c.title, artist: c.artist });
  };

  (Array.isArray(song.choices) ? song.choices : []).forEach(addWrong);

  if (wrong.length < CHOICE_COUNT - 1) {
    const { start, end } = ROUND_CONFIG[1];
    const inRound = songs.slice(start, end + 1).filter((_, i) => start + i !== songIndex);
    const others = songs.filter((_, i) => i !== songIndex);
    shuffle(inRound, rng).forEach(s => wrong.length < CHOICE_COUNT - 1 && addWrong(s));
    shuffle(others, rng).forEach(s => wrong.length < CHOICE_COUNT - 1 && addWrong(s));
  }

  const all = shuffle([good, ...wrong.slice(0, CHOICE_COUNT - 1)], rng);
  return { options: all, correctIndex: all.findIndex(o => o.title === good.title && o.artist === good.artist) };
};

// Thème affiché en manche 2 (repli : l'artiste)
export const themeFor = (song) => (song && (song.theme || song.artist)) || '';

// Ajuste un score sans jamais passer sous 0. Renvoie null si rien ne change.
export const adjustedScores = (player, round, delta) => {
  const total = player.totalScore || 0;
  const newTotal = Math.max(0, total + delta);
  const applied = newTotal - total;
  if (applied === 0) return null;
  const perRound = [...(player.scorePerRound || [0, 0, 0, 0])];
  perRound[round - 1] = Math.max(0, (perRound[round - 1] || 0) + applied);
  return { totalScore: newTotal, scorePerRound: perRound, applied };
};

// ── Code de partie ─────────────────────────────────────────────
// Le code affiché (OSE-XXXX) sert directement d'identifiant PeerJS de la régie :
// les joueurs se connectent avec, sans passer par un service tiers pour retrouver la régie.
// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L).
export const GAME_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const generateGameCode = (rng = Math.random) =>
  'OSE-' + Array.from({ length: 4 }, () => GAME_CODE_ALPHABET[Math.floor(rng() * GAME_CODE_ALPHABET.length)]).join('');

export const peerIdFromCode = (code) => 'musicose-' + String(code).trim().toUpperCase();

export const isGameCode = (code) => /^OSE-[A-Z0-9]{4}$/i.test(String(code).trim());
