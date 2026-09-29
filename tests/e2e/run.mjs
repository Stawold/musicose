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
    await p.addInitScript(([pseudo, sid, code]) => {
      localStorage.setItem('musicose_mode', 'player');
      localStorage.setItem('musicose_session', JSON.stringify({ sessionId: sid, pseudo, gameCode: code, avatarColor: 'var(--mo-magenta)' }));
    }, [pseudo, sid, CODE]);
    await p.goto(BASE);
    await p.getByRole('button', { name: /REJOINDRE/ }).click();
    await p.waitForSelector('text=EN ATTENTE');
    return p;
  };
  const alice = await makePlayer('Alice', 'sid-a');
  const bob = await makePlayer('Bob', 'sid-b');
  const cleo = await makePlayer('Cleo', 'sid-c');
  await host.waitForSelector('text=3 JOUEUR');
  check('3 joueurs connectés à la régie', true);

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
  const start = async () => { await clickHost(/LANCER/); await sleep(500); };
  const reveal = async () => { await clickHost(/RÉVÉLER LA RÉPONSE/); await sleep(500); };
  const answer = async (page, title, artist) => {
    await page.getByPlaceholder('Titre de la chanson…').fill(title);
    if (artist !== undefined) await page.getByPlaceholder('Artiste…').fill(artist);
    await page.getByRole('button', { name: /VALIDER MA RÉPONSE/ }).click();
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
  await start();
  await shot(ge, 'ge-manche1'); await shot(alice, 'tel-manche1');
  const micCount = await alice.getByRole('button', { name: /^Proposition / }).count();
  check('téléphone : 4 micros affichés', micCount === 4, String(micCount));
  check('téléphone : aucun champ texte en manche 1', await alice.getByPlaceholder('Titre de la chanson…').count() === 0);
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
  check('grand écran : compteur de réponses', /RÉPONSES REÇUES\s*3\s*\/\s*3/.test((await ge.locator('body').innerText()).replace(/\n/g, ' ')));
  await reveal();
  await shot(ge, 'ge-reveal1');
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
  check('grand écran : classement affiché', /CLASSEMENT/.test(await ge.locator('body').innerText()));
  await alice.getByRole('button', { name: /Continuer/ }).click();
  await next();                 // index 15 → manche 2
  check('la manche 2 démarre à la 16e chanson', await host.locator('text=/MANCHE 2 · CHANSON 1\\/15/').count() > 0);

  // ═══ MANCHE 2 — Le Focus ═══════════════════════════════════
  console.log('\nManche 2 — Le Focus (thème, titre seul)');
  await start();
  await shot(ge, 'ge-manche2'); await shot(alice, 'tel-manche2');
  const aliceText = await alice.locator('body').innerText();
  check('téléphone : thème affiché', aliceText.includes('THÈME') && aliceText.includes('THEME 16'), aliceText.slice(0, 200));
  check('téléphone : pas de champ artiste', await alice.getByPlaceholder('Artiste…').count() === 0);
  check('téléphone : 30 s', /(29|30)s restantes/.test(aliceText));
  check('grand écran : thème affiché', /THÈME/.test(await ge.locator('body').innerText()) && (await ge.locator('body').innerText()).includes('THEME 16'));
  let b2 = await scores();
  await answer(alice, 'titre 16');
  await answer(cleo, 'Titre 16');
  await answer(bob, 'mauvais');
  const d2 = await delta(b2);
  check('manche 2 : 2 pts + 1 bonus au plus rapide, 2 pts au suivant, 0 sinon', same(d2, { a: 3, b: 0, c: 2 }), JSON.stringify(d2));
  await reveal();

  // ═══ MANCHE 3 — Fast & Musicous ════════════════════════════
  console.log('\nManche 3 — Fast & Musicous');
  await next(15);               // index 30
  check('la manche 3 démarre à la 31e chanson', await host.locator('text=/MANCHE 3 · CHANSON 1\\/25/').count() > 0);
  await start();
  check('téléphone : 45 s', /(44|45)s restantes/.test(await alice.locator('body').innerText()));
  b2 = await scores();
  await answer(alice, 'Titre 31', 'Nom31');          // titre + nom de famille → 3 + 3
  await answer(cleo, 'titre 31', 'Prenom31 Nom31');  // titre + artiste complet → 3 + 2
  await answer(bob, 'Titre 31', 'inconnu');          // titre seul → 1
  const d3 = await delta(b2);
  check('manche 3 : 6 / 5 / 1 pts (bonus 3-2-1 par ordre d’arrivée)', same(d3, { a: 6, b: 1, c: 5 }), JSON.stringify(d3));
  await reveal();

  // ═══ MANCHE 4 — Battle Royal ═══════════════════════════════
  console.log('\nManche 4 — Le Battle Royal d’Ose');
  await next(25);               // index 55
  check('la manche 4 démarre à la 56e chanson', await host.locator('text=/MANCHE 4 · CHANSON 1\\/10/').count() > 0);
  await start();
  check('téléphone : 45 s pour répondre', /(44|45)s restantes/.test(await alice.locator('body').innerText()));
  b2 = await scores();
  await answer(alice, 'Titre 56', 'Nom56');   // les deux → 5
  await answer(cleo, 'Titre 56');             // titre seul → 2
  await answer(bob, 'zzz', 'yyy');            // rien → éliminé
  const d4 = await delta(b2);
  check('manche 4 : 5 pts (les deux), 2 pts (un seul), 0 = éliminé', same(d4, { a: 5, b: 0, c: 2 }), JSON.stringify(d4));
  await reveal();
  await next();
  await start();
  check('joueur éliminé bloqué à la chanson suivante', /ÉLIMINÉ/.test(await bob.locator('body').innerText()));
  const audioPlaying = () => host.evaluate(() => { const a = document.querySelector('audio'); return !a.paused; });
  console.log('  … attente de la coupure de la musique à 30 s');
  await sleep(31500);
  await shot(ge, 'ge-manche4-coupee');
  check('manche 4 : musique coupée après 30 s (régie)', /MUSIQUE COUPÉE/.test(await host.locator('body').innerText()) && !(await audioPlaying()));
  check('manche 4 : musique coupée annoncée aux joueurs', /MUSIQUE COUPÉE/.test(await alice.locator('body').innerText()));
  check('manche 4 : musique coupée annoncée au grand écran', /MUSIQUE COUPÉE/.test(await ge.locator('body').innerText()));
  check('manche 4 : réponses toujours ouvertes après la coupure', await alice.getByRole('button', { name: /VALIDER MA RÉPONSE/ }).isEnabled());

  // Podium final
  await next(8);                // index 64
  check('podium proposé à la 65e chanson', await host.getByRole('button', { name: /AFFICHER LE PODIUM FINAL/ }).count() === 1);
  await clickHost(/AFFICHER LE PODIUM FINAL/); await sleep(400);
  check('grand écran : podium', /PODIUM/.test(await ge.locator('body').innerText()));
  check('téléphone : podium', /PODIUM/.test(await alice.locator('body').innerText()));

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
