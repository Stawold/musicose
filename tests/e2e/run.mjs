// Test de bout en bout : régie + grand écran + 3 téléphones, 4 manches.
// Prérequis : playwright (+ Chromium). Lancement : npm run test:e2e
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium } = playwright;

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  ← ${detail}`}`);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS_DIR; // optionnel : dossier où enregistrer des captures d'écran
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

// ── Playlist factice (65 chansons) ───────────────────────────
const songs = Array.from({ length: 65 }, (_, i) => ({
  id: i + 1, title: `Titre ${i + 1}`, artist: `Prenom${i + 1} Nom${i + 1}`, file: `${i + 1}.mp3`,
  ...(i >= 15 && i <= 29 ? { theme: `Theme ${i + 1}` } : {}),
}));
songs[0].choices = [1, 2, 3].map(n => ({ title: `Faux ${n}`, artist: `Faux Artiste ${n}` }));
const playlist = { name: 'Playlist de test', songs };

const server = await createServer({ configFile: 'vite.e2e.config.js', server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const context = await browser.newContext();
await context.route('https://kvdb.io/**', async (route) => {
  const req = route.request();
  return route.abort('connectionreset');   // kvdb.io HORS SERVICE : la partie doit fonctionner quand même
});
await context.route('**/playlists/**', (route) => {
  const url = route.request().url();
  return url.endsWith('data.json')
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(playlist) })
    : route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(16) });
});

const errors = [];
const watch = (page, label) => {
  page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Lecture audio|Failed to load resource|NotSupported/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
};

try {
  // ── Régie ──────────────────────────────────────────────────
  const host = await context.newPage();
  await host.setViewportSize({ width: 1500, height: 900 });
  watch(host, 'host');
  await host.addInitScript(() => localStorage.setItem('musicose_mode', 'host'));
  await host.goto(BASE);
  await host.getByPlaceholder('Mot de passe').fill('melbose');
  await host.getByRole('button', { name: 'Valider' }).click();
  const codeText = await host.locator('text=/CODE · OSE-/').first().textContent();
  const CODE = codeText.match(/OSE-\w+/)[0];
  console.log(`\nPartie ${CODE}  (kvdb.io simulé hors service)`);
  await host.waitForSelector('text=/CHANSON 1\\/15/');

  // ── Grand écran ────────────────────────────────────────────
  const ge = await context.newPage();
  await ge.setViewportSize({ width: 1280, height: 720 });
  watch(ge, 'grand-ecran');
  await ge.goto(`${BASE}/?screen=grand-ecran&code=${CODE}`);
  await ge.waitForSelector(`text=${CODE}`);

  // ── Téléphones ─────────────────────────────────────────────
  const COLORS = { Alice: '#FF2E93', Bob: '#00E5FF', Cleo: '#2FD27A' };
  const makePlayer = async (pseudo, sid) => {
    const p = await context.newPage();
    await p.setViewportSize({ width: 390, height: 850 });
    watch(p, pseudo);
    await p.addInitScript(() => {   // faux Wake Lock : compte les demandes et permet de simuler une libération par le système
      window.__wl = { requests: 0, active: 0, last: null };
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
        const s = { released: false, _l: [], addEventListener(e, f) { this._l.push(f); },
          release: async () => { if (!s.released) { s.released = true; window.__wl.active--; s._l.forEach(f => f()); } } };
        window.__wl.requests++; window.__wl.active++; window.__wl.last = s; return s;
      } } });
    });
    await p.addInitScript(([pseudo, sid, code, color]) => {
      localStorage.setItem('musicose_mode', 'player');
      localStorage.setItem('musicose_session', JSON.stringify({ sessionId: sid, pseudo, gameCode: code, avatarColor: color }));
    }, [pseudo, sid, CODE, COLORS[pseudo]]);
    await p.goto(BASE);
    if (pseudo === 'Alice') {
      await shot(p, 'tel-connexion');
      const fits = () => p.evaluate(() => { const sh = document.querySelector('[data-screen="join"]'); const btn = [...document.querySelectorAll('button')].find(b => /ENTRER EN SCÈNE/.test(b.textContent)); const r = btn.getBoundingClientRect(); return { clipped: sh.scrollHeight - sh.clientHeight, btnBottom: Math.round(r.bottom), h: innerHeight, docScroll: document.documentElement.scrollHeight - innerHeight }; });
      const f1 = await fits();
      check('téléphone : la connexion tient sur une seule page, sans défilement (390×850)', f1.clipped <= 1 && f1.btnBottom <= f1.h && f1.docScroll <= 1, JSON.stringify(f1));
      await p.setViewportSize({ width: 375, height: 667 });
      await sleep(200);
      const f2 = await fits();
      await shot(p, 'tel-connexion-petit');
      check('téléphone : la connexion tient aussi sur un petit écran (375×667)', f2.clipped <= 1 && f2.btnBottom <= f2.h && f2.docScroll <= 1, JSON.stringify(f2));
      await p.setViewportSize({ width: 390, height: 850 });
    }
    check(`téléphone ${pseudo} : couleur choisie pré-sélectionnée parmi 8`, await p.locator('[role="radio"]').count() === 8 && (await p.locator(`[role="radio"][data-color="${COLORS[pseudo]}"]`).getAttribute('aria-checked')) === 'true');
    await p.getByRole('button', { name: /ENTRER EN SCÈNE/ }).click();
    await p.waitForSelector('text=JOUEURS CONNECTÉS');
    return p;
  };
  const alice = await makePlayer('Alice', 'sid-a');
  const bob = await makePlayer('Bob', 'sid-b');
  const cleo = await makePlayer('Cleo', 'sid-c');
  await host.waitForSelector('text=3 JOUEUR');
  await sleep(500);
  await shot(alice, 'tel-attente');
  {
    const waitText = (await alice.locator('body').innerText()).replace(/\s+/g, ' ');
    check('téléphone : l’écran d’attente liste les joueurs connectés', ['Alice', 'Bob', 'Cleo'].every(n => waitText.includes(n)) && /JOUEURS CONNECTÉS 3/.test(waitText) && waitText.includes(CODE), waitText.slice(0, 300));
  }
  check('3 joueurs connectés à la régie', true);
  await sleep(400);
  const lobbyText = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('grand écran : salle d’attente (code, joueurs, pseudos)', lobbyText.includes(CODE) && /SALLE OUVERTE/.test(lobbyText) && /3 \/ 30/.test(lobbyText) && ['Alice', 'Bob', 'Cleo'].every(n => lobbyText.includes(n)), lobbyText.slice(0, 250));
  await shot(ge, 'ge-lobby');
  const qrUrl = await ge.locator('svg[data-url]').first().getAttribute('data-url');
  check('salle d’attente : QR code présent, il contient le lien de la partie', qrUrl && qrUrl.includes(`?join=${CODE}`), String(qrUrl));
  const dancing = await ge.evaluate(() => document.getAnimations().filter(a => a.animationName === 'ge-dance').length);
  check('salle d’attente : logo Music’Ose animé (9 lettres qui dansent)', dancing === 9, String(dancing));
  const codeBox = await ge.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => /^OSE-\w{4}$/.test(d.textContent) && d.children.length === 0); const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('salle d’attente : code en très grand', codeBox.h > 60 && codeBox.w > 300, JSON.stringify(codeBox));
  const geChips = await ge.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-player]')].map(el => [el.dataset.player, el.dataset.color])));
  check('salle d’attente : chaque joueur a la couleur qu’il a choisie (grand écran)', geChips.Alice === COLORS.Alice && geChips.Bob === COLORS.Bob && geChips.Cleo === COLORS.Cleo, JSON.stringify(geChips));
  const phoneChips = await alice.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-player]')].map(el => [el.dataset.player, el.dataset.color])));
  check('salle d’attente : mêmes couleurs sur la liste des téléphones', phoneChips.Alice === COLORS.Alice && phoneChips.Bob === COLORS.Bob && phoneChips.Cleo === COLORS.Cleo, JSON.stringify(phoneChips));
  check('grand écran : « V.3.0 » affiché en bas de la salle d’attente', (await ge.locator('[data-version]').first().innerText()) === 'V.3.0');

  // ── Helpers ────────────────────────────────────────────────
  const hostScore = (name) => host.evaluate((name) => {
    const span = [...document.querySelectorAll('span')].find(s => s.textContent === name && s.parentElement.parentElement.querySelector('button'));
    const row = span.parentElement.parentElement;
    const nums = [...row.querySelectorAll('span.mo-display')];
    return parseInt(nums[nums.length - 1].textContent, 10);
  }, name);
  const scores = async () => ({ a: await hostScore('Alice'), b: await hostScore('Bob'), c: await hostScore('Cleo') });
  const clickHost = (name) => host.getByRole('button', { name }).click();
  const next = async (n = 1) => { for (let i = 0; i < n; i++) { await clickHost('▶▶'); await sleep(40); } };
  const start = async () => { await clickHost(/LANCER/); await sleep(1500); };   // 1,2 s d'effet de manche quand la manche vient d'être annoncée
  const phoneSeconds = async (p) => Number(await p.locator('[data-seconds]').first().getAttribute('data-seconds'));
  const announce = async (n) => { await clickHost(new RegExp(`ANNONCER LA MANCHE ${n}`)); };
  const reveal = async () => { await clickHost(/RÉVÉLER LA RÉPONSE/); await sleep(500); };
  const answer = async (page, title, artist) => {
    await page.getByPlaceholder('Titre…').fill(title);
    if (artist !== undefined) await page.getByPlaceholder('Artiste…').fill(artist);
    await page.getByRole('button', { name: /VALIDER/ }).click();
    await sleep(250);
  };
  const delta = async (before) => { const now = await scores(); return { a: now.a - before.a, b: now.b - before.b, c: now.c - before.c }; };
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

  // ── Écran toujours allumé ──────────────────────────────────
  console.log('\nVerrouillage de l’écran');
  const wl = (p) => p.evaluate(() => ({ requests: window.__wl.requests, active: window.__wl.active }));
  check('téléphone : verrou d’écran demandé dès la connexion', (await wl(alice)).active === 1, JSON.stringify(await wl(alice)));
  await alice.evaluate(() => window.__wl.last.release());               // le système libère le verrou (ex. onglet en arrière-plan)
  check('verrou libéré par le système', (await wl(alice)).active === 0);
  await alice.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(200);
  check('verrou redemandé au retour sur l’onglet', (await wl(alice)).active === 1, JSON.stringify(await wl(alice)));
  await alice.evaluate(() => window.__wl.last.release());
  await alice.locator('body').click({ position: { x: 5, y: 5 } });
  await sleep(200);
  check('verrou redemandé à la première interaction', (await wl(alice)).active === 1, JSON.stringify(await wl(alice)));

  // ═══ MANCHE 1 — 4 micros ═══════════════════════════════════
  console.log('\nManche 1 — Chansons en rafale (4 propositions)');
  await announce(1); await sleep(350);
  check('effet de passage vers la manche 1 (rayons de soleil)', await ge.locator('[data-transition="0"]').count() === 1);
  await shot(ge, 'ge-effet1');
  await sleep(1300);
  check('l’effet se termine tout seul', await ge.locator('[data-transition]').count() === 0);
  const trText = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('annonce : numéro, nom et règles sous forme de tuiles (30 S · 1 PT · +1)',
    /01/.test(trText) && /CHANSONS/.test(trText) && /EN RAFALE/.test(trText) && await ge.locator('[data-tile]').count() === 3 && /30 S POUR RÉPONDRE/.test(trText) && /1 PT BONNE RÉPONSE/.test(trText) && /\+1 LE PLUS RAPIDE/.test(trText) && !/Choisis le bon micro/.test(trText), trText.slice(0, 300));
  check('annonce : en-tête « MANCHE 01 · QUESTION 01/15 » + nom du jeu et code', /MANCHE 01 · QUESTION 01\/15/.test(trText) && trText.includes(`MUSIC'OSE · ${CODE}`), trText.slice(0, 200));
  const ticker = await ge.locator('[data-ticker]').innerText();
  check('annonce : bas d’écran = texte défilant (comment rejoindre, règles drôles)', ticker.includes(CODE) && /RÈGLE N°1/.test(ticker) && /SOUDOYER/.test(ticker), ticker.slice(0, 120));
  const tx1 = await ge.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ge-ticker')).transform).m41);
  await sleep(1200);
  const tx2 = await ge.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.ge-ticker')).transform).m41);
  check('annonce : le texte défile en continu', tx2 < tx1, `${tx1} → ${tx2}`);
  check('annonce : plus de phrase de règle en paragraphe', !/L’un des deux : 2 pts\./.test(trText) && !/Titre \+ artiste : 5 pts\./.test(trText));
  await shot(ge, 'ge-transition1');
  await start();
  await shot(ge, 'ge-manche1'); await shot(alice, 'tel-manche1');
  const boxes = await ge.evaluate(() => [...document.querySelectorAll('[data-option]')].map(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }));
  check('manche 1 : les 4 propositions occupent une grande place (≥ 400×200 px sur un écran 1280×720)', boxes.length === 4 && boxes.every(b => b.w >= 400 && b.h >= 200), JSON.stringify(boxes));
  const geColors = await ge.evaluate(() => [0, 1, 2, 3].map(i => getComputedStyle(document.querySelector(`[data-option="${i}"]`)).borderTopColor));
  const phoneColors = await alice.evaluate(() => ['A', 'B', 'C', 'D'].map(l => getComputedStyle(document.querySelector(`button[aria-label="Proposition ${l}"]`)).backgroundColor));
  check('manche 1 : mêmes couleurs de micros sur le téléphone et sur le grand écran', JSON.stringify(geColors) === JSON.stringify(phoneColors) && new Set(geColors).size === 4, `${JSON.stringify(geColors)} / ${JSON.stringify(phoneColors)}`);
  const barH = await ge.evaluate(() => Math.max(...[...document.querySelectorAll('.ge-bar')].map(b => b.getBoundingClientRect().height)));
  check('manche 1 : barre de son réduite (≤ 70 px)', barH <= 70, String(barH));
  const geR1 = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('manche 1 : numéro de question et total toujours visibles (1/15 · 1/65)', /QUESTION 01\/15 · TOTAL 01\/65/.test(geR1), geR1.slice(0, 200));
  check('manche 1 : plus de doublon « question » au centre (une seule mention, dans l’en-tête)', (geR1.match(/QUESTION/g) || []).length === 1 && !/AU TOTAL/.test(geR1), geR1.slice(0, 300));
  check('manche 1 : « V.3.0 » affiché en bas', (await ge.locator('[data-version]').first().innerText()) === 'V.3.0');
  {
    const small = await cleo.viewportSize();
    await cleo.setViewportSize({ width: 375, height: 667 }); await sleep(250);
    const sc = await cleo.evaluate(() => ({ doc: document.documentElement.scrollHeight - innerHeight, sh: (() => { const s = document.querySelector('[data-screen="game"]'); return s.scrollHeight - s.clientHeight; })() }));
    check('téléphone : l’écran de jeu (4 micros) tient sans défilement sur un petit écran (375×667)', sc.doc <= 1 && sc.sh <= 1, JSON.stringify(sc));
    await shot(cleo, 'tel-manche1-petit');
    await cleo.setViewportSize(small);
  }
  check('en cours de partie : QR code et code de partie restent affichés', await ge.locator('svg[data-url]').count() === 1 && geR1.includes(CODE) && /REJOINS/.test(geR1));
  const micCount = await alice.getByRole('button', { name: /^Proposition / }).count();
  check('téléphone : 4 micros affichés', micCount === 4, String(micCount));
  check('téléphone : aucun champ texte en manche 1', await alice.getByPlaceholder('Titre…').count() === 0);
  check('téléphone : aucun titre de proposition révélé', !/Faux \d|Titre 1\b/.test(await alice.locator('body').innerText()));
  const geText = await ge.locator('body').innerText();
  check('grand écran : 4 propositions avec titres et artistes', ['Faux 1', 'Faux 2', 'Faux 3', 'Titre 1'].every(t => geText.includes(t)) && geText.includes('Faux Artiste 2') && geText.includes('Prenom1 Nom1'));
  const good = await host.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(s => s.textContent.includes('✓ BONNE'));
    return el.parentElement.querySelector('span.mo-display').textContent;
  });
  const letters = ['A', 'B', 'C', 'D'];
  const wrong = letters.find(l => l !== good);
  await alice.getByRole('button', { name: `Proposition ${wrong}` }).click();
  await sleep(300);
  await alice.getByRole('button', { name: `Proposition ${good}` }).click();   // Alice change d'avis
  await sleep(600);
  await cleo.getByRole('button', { name: `Proposition ${good}` }).click();    // Cleo juste mais plus lente
  await bob.getByRole('button', { name: `Proposition ${wrong}` }).click();
  await sleep(300);
  check('grand écran : compteur de réponses', /3\/3 RÉPONSES/.test((await ge.locator('body').innerText()).replace(/\s+/g, ' ')));
  await reveal();
  await shot(ge, 'ge-reveal1'); await shot(alice, 'tel-revelation'); await shot(bob, 'tel-revelation-rate');
  const revText = (await alice.locator('body').innerText()).replace(/\s+/g, ' ');
  check('téléphone : la révélation montre le résultat, les points gagnés et la bonne réponse (une seule fois)', /BONNE RÉPONSE/.test(revText) && /\+2/.test(revText) && /C'ÉTAIT/.test(revText) && (revText.match(/TITRE 1/g) || []).length === 1, revText.slice(0, 350));
  check('téléphone : pas de classement ni de bouton « continuer » sur la révélation', !/CLASSEMENT/.test(revText) && await alice.getByRole('button', { name: /CONTINUER/i }).count() === 0);
  check('téléphone : la révélation reste dans la DA de la manche 1 (fond marine)', (await alice.evaluate(() => getComputedStyle(document.querySelector('[data-screen="reveal"]')).backgroundColor)) === 'rgb(27, 42, 107)');
  check('téléphone Bob : résultat « raté » sans classement', /RATÉ/.test(await bob.locator('body').innerText()) && !/CLASSEMENT/.test(await bob.locator('body').innerText()));
  check('révélation : numéro de question toujours visible', /QUESTION 01\/15 · TOTAL 01\/65/.test((await ge.locator('body').innerText()).replace(/\s+/g, ' ')));
  let s = await scores();
  check('Alice : 1 pt + 1 bonus (dernier choix juste, plus rapide)', s.a === 2, JSON.stringify(s));
  check('Cleo : 1 pt, pas de bonus', s.c === 1, JSON.stringify(s));
  check('Bob : 0 pt', s.b === 0, JSON.stringify(s));
  check('téléphone Alice : bonne réponse + bonus rapidité', /BONNE RÉPONSE/.test(await alice.locator('body').innerText()) && /PLUS RAPIDE/.test(await alice.locator('body').innerText()));
  check('téléphone Bob : raté', /RATÉ/.test(await bob.locator('body').innerText()));
  check('grand écran : révélation', /TITRE 1\b/i.test(await ge.locator('body').innerText()));

  // Ajustement manuel
  const adj = (name, sign) => host.evaluate(([name, sign]) => {
    const span = [...document.querySelectorAll('span')].find(s => s.textContent === name && s.parentElement.parentElement.querySelector('button'));
    [...span.parentElement.parentElement.querySelectorAll('button')].find(b => b.textContent === sign).click();
  }, [name, sign]);
  await adj('Bob', '+1'); await sleep(300);
  check('ajustement manuel +1', (await hostScore('Bob')) === 1);
  await adj('Bob', '−1'); await adj('Bob', '−1'); await sleep(300);
  check('ajustement manuel −1, jamais sous 0', (await hostScore('Bob')) === 0);
  await adj('Cleo', '+1'); await sleep(300);
  check('ajustement manuel : Cleo 2 pts', (await hostScore('Cleo')) === 2);

  // Fin du temps sans révéler : notation automatique
  await next();
  await start();
  const good2 = await host.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(s => s.textContent.includes('✓ BONNE'));
    return el.parentElement.querySelector('span.mo-display').textContent;
  });
  const before = await scores();
  await cleo.getByRole('button', { name: `Proposition ${good2}` }).click();
  await alice.getByRole('button', { name: `Proposition ${letters.find(l => l !== good2)}` }).click();
  console.log('  … attente de la fin des 30 s');
  await sleep(33000);
  check('fin de temps : Cleo +2 (bon + seul bon donc plus rapide)', (await delta(before)).c === 2, JSON.stringify(await delta(before)));
  check('fin de temps : Alice (faux) 0', (await delta(before)).a === 0);

  // Classement intermédiaire uniquement en fin de manche
  await next(12);               // index 13 (14e chanson)
  check('pas de classement à la chanson 14/15', await host.getByRole('button', { name: /MONTRER LE CLASSEMENT/ }).count() === 0);
  await next();                 // index 14 (15/15)
  check('classement proposé à la fin de la manche 1 (15e chanson)', await host.getByRole('button', { name: /MONTRER LE CLASSEMENT/ }).count() === 1);
  await clickHost(/MONTRER LE CLASSEMENT/); await sleep(400);
  const stText = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('grand écran : classement affiché (après la manche 01, joueurs classés avec points)', /CLASSEMENT/.test(stText) && /APRÈS LA MANCHE 01/.test(stText) && /Cleo/.test(stText) && /PTS/.test(stText), stText.slice(0, 250));
  await shot(ge, 'ge-classement');
  await sleep(2600);
  const posOf = () => ge.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-standing]')].map(el => [el.dataset.standing, Number(el.dataset.pos)])));
  const pos1 = await posOf();
  check('classement : QR code toujours visible', await ge.locator('svg[data-url]').count() === 1);
  check('téléphone : classement de fin de manche sans bouton « continuer »', /CLASSEMENT/.test(await alice.locator('body').innerText()) && await alice.getByRole('button', { name: /CONTINUER/i }).count() === 0);
  await next();                 // index 15 → manche 2
  check('la manche 2 démarre à la 16e chanson', await host.locator('text=/MANCHE 2 · CHANSON 1\\/15/').count() > 0);

  // ═══ MANCHE 2 — Le Focus ═══════════════════════════════════
  console.log('\nManche 2 — Le Focus (thème, titre seul)');
  const homeText = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('entre les manches : retour à l’accueil, la manche 2 est mise en avant', /ACCUEIL/.test(homeText) && /PRÊTS \?/.test(homeText) && await ge.locator('[data-pill="2"][data-next="true"]').count() === 1 && await ge.locator('[data-pill][data-next="true"]').count() === 1, homeText.slice(0, 200));
  await shot(ge, 'ge-accueil');
  await announce(2); await sleep(500);
  await shot(ge, 'ge-effet2');
  await sleep(1000);
  await shot(ge, 'ge-transition2');
  check('annonce : manche 2 (tuiles)', /LE\s+FOCUS/.test(await ge.locator('body').innerText()) && /TITRE TROUVÉ/.test(await ge.locator('body').innerText()) && await ge.locator('[data-tile]').count() === 3);
  await start();
  await shot(ge, 'ge-manche2'); await shot(alice, 'tel-manche2');
  const aliceText = await alice.locator('body').innerText();
  check('téléphone : thème affiché', aliceText.includes('THÈME') && aliceText.includes('THEME 16'), aliceText.slice(0, 200));
  check('téléphone : pas de champ artiste', await alice.getByPlaceholder('Artiste…').count() === 0);
  const s2 = await phoneSeconds(alice);
  check('téléphone : compte à rebours de 30 s', s2 >= 28 && s2 <= 30, String(s2));
  // Le « S » du décompte et le compteur de réponses ne bougent jamais, quel que soit le chiffre affiché
  {
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await ge.evaluate(() => {
        const n = document.querySelector('[data-countdown]').getBoundingClientRect();
        const l = document.querySelector('[data-countdown-label]').getBoundingClientRect();
        return { digits: document.querySelector('[data-countdown]').textContent, nx: Math.round(n.left), ny: Math.round(n.top), lx: Math.round(l.left), ly: Math.round(l.top) };
      }));
      await sleep(1100);
    }
    const distinct = new Set(samples.map(x => x.digits)).size;
    const stable = samples.every(x => x.lx === samples[0].lx && x.ly === samples[0].ly && x.nx === samples[0].nx && x.ny === samples[0].ny);
    check(`décompte : le « S » et le texte ne bougent pas (${distinct} chiffres différents testés)`, distinct >= 4 && stable, JSON.stringify(samples));
  }
  const geR2 = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('manche 2 : plus de doublon « question » au centre', (geR2.match(/QUESTION/g) || []).length === 1 && !/AU TOTAL/.test(geR2));
  check('manche 2 : le top 3 reste affiché au centre', /EN TÊTE/.test(geR2));
  check('grand écran : thème affiché', /THÈME/.test(await ge.locator('body').innerText()) && (await ge.locator('body').innerText()).includes('THEME 16'));
  let b2 = await scores();
  await answer(alice, 'titre 16');
  await shot(alice, 'tel-envoyee');
  await answer(cleo, 'Titre 16');
  await answer(bob, 'mauvais');
  const d2 = await delta(b2);
  check('manche 2 : 2 pts + 1 bonus au plus rapide, 2 pts au suivant, 0 sinon', same(d2, { a: 3, b: 0, c: 2 }), JSON.stringify(d2));
  await reveal();

  // Classement de fin de manche 2 : le dernier passe en tête grâce à l'ajustement manuel → les lignes glissent
  await next(14);               // index 29 (30e chanson)
  const sc2 = await scores();
  const byName = { Alice: sc2.a, Bob: sc2.b, Cleo: sc2.c };
  const leaderScore = Math.max(...Object.values(byName));
  const lastName = Object.entries(byName).sort((x, y) => x[1] - y[1])[0][0];
  for (let i = 0; i < leaderScore - byName[lastName] + 1; i++) { await adj(lastName, '+1'); await sleep(60); }
  await sleep(300);
  await clickHost(/MONTRER LE CLASSEMENT/); await sleep(450);
  const startPos = await posOf();
  await shot(ge, 'ge-classement-avant');
  await sleep(3200);
  const endPos = await posOf();
  await shot(ge, 'ge-classement-apres');
  check('classement : il repart de l’ancien classement', same(Object.entries(startPos).sort(), Object.entries(pos1).sort()), `${JSON.stringify(startPos)} vs ${JSON.stringify(pos1)}`);
  check(`classement : ${lastName} (dernier) glisse jusqu’à la 1re place`, startPos[lastName] === 2 && endPos[lastName] === 0, `${JSON.stringify(startPos)} → ${JSON.stringify(endPos)}`);
  check('classement : indicateur de progression (▲2)', /▲2/.test(await ge.locator('body').innerText()));

  // ═══ MANCHE 3 — Fast & Musicous ════════════════════════════
  console.log('\nManche 3 — Fast & Musicous');
  await next();                 // index 30
  check('la manche 3 démarre à la 31e chanson', await host.locator('text=/MANCHE 3 · CHANSON 1\\/25/').count() > 0);
  check('accueil entre les manches : la manche 3 est mise en avant', await ge.locator('[data-pill="3"][data-next="true"]').count() === 1);
  await announce(3); await sleep(500);
  await shot(ge, 'ge-effet3');
  check('effet de passage vers la manche 3 (bandes de vitesse)', await ge.locator('[data-transition="2"]').count() === 1);
  await sleep(1000);
  await shot(ge, 'ge-transition3');
  await start();
  await shot(alice, 'tel-manche3');
  const s3 = await phoneSeconds(alice);
  check('téléphone : compte à rebours de 45 s', s3 >= 43 && s3 <= 45, String(s3));
  const geR3start = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('manche 3 : numéro de question et total (1/25 · 31/65)', /QUESTION 01\/25 · TOTAL 31\/65/.test(geR3start), geR3start.slice(0, 200));
  const barH3 = await ge.evaluate(() => Math.max(...[...document.querySelectorAll('.ge-bar')].map(b => b.getBoundingClientRect().height)));
  check('manche 3 : égaliseur pleine hauteur (> 100 px)', barH3 > 100, String(barH3));
  b2 = await scores();
  await answer(alice, 'Titre 31', 'Nom31');          // titre + nom de famille → 3 + 3
  await answer(cleo, 'titre 31', 'Prenom31 Nom31');  // titre + artiste complet → 3 + 2
  await sleep(300);
  check('téléphone manche 3 : « 2 ont déjà répondu » en direct', /PODIUM · 2 ONT DÉJÀ RÉPONDU/.test((await bob.locator('body').innerText()).replace(/\s+/g, ' ')), (await bob.locator('body').innerText()).slice(0, 300));
  await answer(bob, 'Titre 31', 'inconnu');          // titre seul → 1
  const d3 = await delta(b2);
  check('manche 3 : 6 / 5 / 1 pts (bonus 3-2-1 par ordre d’arrivée)', same(d3, { a: 6, b: 1, c: 5 }), JSON.stringify(d3));
  await sleep(300);
  const geR3 = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('grand écran manche 3 : podium des plus rapides (Alice +3, Cleo +2)', /LES \+ RAPIDES/.test(geR3) && /\+3 Alice/.test(geR3) && /\+2 Cleo/.test(geR3), geR3.slice(0, 300));
  await shot(ge, 'ge-manche3');
  await reveal();

  // ═══ MANCHE 4 — Battle Royal ═══════════════════════════════
  console.log('\nManche 4 — Le Battle Royal d’Ose');
  await next(25);               // index 55
  check('la manche 4 démarre à la 56e chanson', await host.locator('text=/MANCHE 4 · CHANSON 1\\/10/').count() > 0);
  check('accueil entre les manches : la manche 4 est mise en avant', await ge.locator('[data-pill="4"][data-next="true"]').count() === 1);
  await announce(4); await sleep(500);
  await shot(ge, 'ge-effet4');
  check('effet de passage vers la manche 4 (zone rouge)', await ge.locator('[data-transition="3"]').count() === 1);
  await sleep(1000);
  await shot(ge, 'ge-transition4');
  await start();
  await shot(alice, 'tel-manche4');
  const s4 = await phoneSeconds(alice);
  check('téléphone : 45 s pour répondre', s4 >= 43 && s4 <= 45, String(s4));
  b2 = await scores();
  await answer(alice, 'Titre 56', 'Nom56');   // les deux → 5
  await answer(cleo, 'Titre 56');             // titre seul → 2
  await answer(bob, 'zzz', 'yyy');            // rien → éliminé
  const d4 = await delta(b2);
  check('manche 4 : 5 pts (les deux), 2 pts (un seul), 0 = éliminé', same(d4, { a: 5, b: 0, c: 2 }), JSON.stringify(d4));
  await sleep(300);
  check('grand écran manche 4 : 2 joueurs en lice sur 3', /2 \/ 3 EN LICE/.test((await ge.locator('body').innerText()).replace(/\s+/g, ' ')), (await ge.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await shot(ge, 'ge-manche4');
  await reveal();
  await next();
  await start();
  check('joueur éliminé bloqué à la chanson suivante', /ÉLIMINÉ/.test(await bob.locator('body').innerText()));
  check('téléphone manche 4 : « en lice 2 / 3 » en direct', /EN LICE · 2 \/ 3/.test((await alice.locator('body').innerText()).replace(/\s+/g, ' ')), (await alice.locator('body').innerText()).slice(0, 300));
  const audioPlaying = () => host.evaluate(() => { const a = document.querySelector('audio'); return !a.paused; });
  console.log('  … attente de la coupure de la musique à 30 s');
  const barsOff = () => ge.evaluate(() => [...document.querySelectorAll('[data-bar]')].map((b, i) => b.dataset.bar === 'off' ? i : -1).filter(i => i >= 0));
  const off0 = await barsOff();
  await sleep(6000);
  const off1 = await barsOff();
  await sleep(25500);
  const off2 = await barsOff();
  await shot(ge, 'ge-manche4-coupee');
  const lastK = (k) => Array.from({ length: k }, (_, i) => 16 - k + i);
  check('manche 4 : les barres de son s’éteignent au hasard, petit à petit (0 → ' + off1.length + ' → ' + off2.length + ' sur 16)',
    off0.length === 0 && off1.length >= 1 && off2.length > off1.length && off2.length <= 14 && off1.every(i => off2.includes(i)) && JSON.stringify(off2) !== JSON.stringify(lastK(off2.length)), JSON.stringify({ off0, off1, off2 }));
  const geR4 = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('manche 4 : aucun classement affiché au centre (suspens)', !/CLASSEMENT|EN TÊTE/.test(geR4) && /EN LICE/.test(geR4), geR4.slice(0, 250));
  check('manche 4 : musique coupée après 30 s (régie)', /MUSIQUE COUPÉE/.test(await host.locator('body').innerText()) && !(await audioPlaying()));
  check('manche 4 : musique coupée annoncée aux joueurs', /MUSIQUE COUPÉE/.test(await alice.locator('body').innerText()));
  check('manche 4 : musique coupée annoncée au grand écran', /MUSIQUE COUPÉE/.test(await ge.locator('body').innerText()));
  check('manche 4 : réponses toujours ouvertes après la coupure', await alice.getByRole('button', { name: /VALIDER/ }).isEnabled());

  // ── Arrivée par QR code : seul le pseudo est à taper ───────
  console.log('\nRejoindre par QR code');
  const dana = await context.newPage();
  await dana.setViewportSize({ width: 390, height: 850 });
  watch(dana, 'Dana');
  await dana.addInitScript(() => localStorage.clear());   // téléphone tout neuf
  await dana.goto(qrUrl);
  check('QR code : le code de la partie est déjà rempli', (await dana.getByPlaceholder('OSE-XXXX').inputValue()) === CODE);
  await dana.getByPlaceholder('Ton pseudo').fill('Dana');
  await dana.getByRole('button', { name: /ENTRER EN SCÈNE/ }).click();
  await host.waitForSelector('text=4 JOUEUR', { timeout: 15000 }).then(() => check('QR code : le joueur rejoint la partie sans taper le code', true), () => check('QR code : le joueur rejoint la partie sans taper le code', false, 'pas de 4e joueur'));
  // Elle arrive en pleine chanson : elle est mise directement dans la partie, avec le temps restant
  await dana.waitForSelector('[data-seconds]');
  const danaSec = await phoneSeconds(dana);
  check('QR code : arrivée en cours de chanson, le téléphone reçoit le décompte restant', danaSec > 0 && danaSec <= 45 && await dana.locator('[data-screen="game"]').count() === 1, String(danaSec));

  // Podium final
  await next(8);                // index 64
  check('podium proposé à la 65e chanson', await host.getByRole('button', { name: /AFFICHER LE PODIUM FINAL/ }).count() === 1);
  await clickHost(/AFFICHER LE PODIUM FINAL/);
  const tPodium = Date.now();
  const opacities = () => ge.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-podium-rank]')].map(el => [el.dataset.podiumRank, Number(getComputedStyle(el).opacity)])));
  const delays = await ge.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-podium-rank]')].map(el => [el.dataset.podiumRank, parseFloat(getComputedStyle(el).animationDelay)])));
  check('podium : 3e, puis 2e, puis 1er (délais croissants)', delays[3] < delays[2] && delays[2] < delays[1], JSON.stringify(delays));
  await sleep(1000 - (Date.now() - tPodium));
  const o1 = await opacities();
  await shot(ge, 'ge-podium-1');
  check('podium à 1 s : seule la 3e place est apparue', o1[3] > 0 && o1[2] === 0 && o1[1] === 0, JSON.stringify(o1));
  await sleep(2600 - (Date.now() - tPodium));
  const o2 = await opacities();
  await shot(ge, 'ge-podium-2');
  check('podium à 2,6 s : 3e et 2e places apparues, pas encore la 1re', o2[3] === 1 && o2[2] > 0 && o2[1] === 0, JSON.stringify(o2));
  await sleep(5300 - (Date.now() - tPodium));
  const o3 = await opacities();
  check('podium à 5,3 s : les trois places sont là', o3[3] === 1 && o3[2] === 1 && o3[1] === 1, JSON.stringify(o3));
  const poText = (await ge.locator('body').innerText()).replace(/\s+/g, ' ');
  check('grand écran : podium (3 premiers)', /PODIUM/.test(poText) && ['Alice', 'Bob', 'Cleo'].every(n => poText.includes(n)), poText.slice(0, 250));
  await shot(ge, 'ge-podium');
  await sleep(500);
  const alicePod = (await alice.locator('body').innerText()).replace(/\s+/g, ' ');
  const danaPod = (await dana.locator('body').innerText()).replace(/\s+/g, ' ');
  await shot(alice, 'tel-podium'); await shot(dana, 'tel-podium-hors');
  check('téléphone : podium à la nouvelle DA, un joueur du podium voit « BRAVO »', /PODIUM/.test(alicePod) && /BRAVO/.test(alicePod) && /N°1/.test(alicePod) && await alice.locator('[data-podium-rank]').count() === 3, alicePod.slice(0, 250));
  check('téléphone : un joueur hors podium voit son propre classement (N°4)', /TON CLASSEMENT/.test(danaPod) && /N°4/.test(danaPod) && (await dana.locator('[data-me="true"]').count()) === 1, danaPod.slice(0, 300));
  check('téléphone : le podium est le seul écran qui peut défiler', (await dana.evaluate(() => getComputedStyle(document.querySelector('[data-screen="podium"]')).overflowY)) === 'auto' && (await alice.evaluate(() => getComputedStyle(document.querySelector('[data-screen="podium"]')).overflowY)) === 'auto');
  check('grand écran : « V.3.0 » toujours affiché sur le podium', (await ge.locator('[data-version]').first().innerText()) === 'V.3.0');

  check('aucune erreur JavaScript dans les pages', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error('\nERREUR DU TEST :', e);
  results.push(false);
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} vérifications OK`);
process.exit(failed ? 1 : 0);
