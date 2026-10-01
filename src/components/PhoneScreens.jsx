import React from "react";
import { PHONE_THEMES, BASE_THEME, PILL_COLORS, RESULT_COLORS, rnd } from "../roundThemes";
import { ROUND_NAMES, ROUND_CONFIG, MIC_CHOICES, PLAYER_COLORS } from "../gameLogic";
import "../styles/grandEcran.css";

// Écrans téléphone — maquettes « Scène synthwave » (Claude Design).
// Composants purement visuels : toute la logique du jeu reste dans player.jsx.
const TEKTUR = "'Tektur', 'Impact', sans-serif";
const MONO = "'DM Mono', ui-monospace, monospace";
const SUN_MASK = 'linear-gradient(#000 0 50%,transparent 50% 56%,#000 56% 66%,transparent 66% 72%,#000 72% 80%,transparent 80% 86%,#000 86%)';
const GRID_H = (c, s1, s2) => `repeating-linear-gradient(90deg,${c} 0 2px,transparent 2px ${s1}px),repeating-linear-gradient(0deg,${c} 0 2px,transparent 2px ${s2}px)`;
const BASE = { ...BASE_THEME, a: '#FF2E93', b: '#FFC933' };
const pad2 = (n) => String(n).padStart(2, '0');
const skew = { transform: 'skewX(-8deg)' };

export const phoneTheme = (round) => PHONE_THEMES[round] || PHONE_THEMES[3];

function Shell({ t, children, scroll, name }) {
  // Tous les écrans tiennent dans la fenêtre, sans défilement. Seul le podium final peut défiler.
  return (
    <div data-screen={name} style={{
      ...(scroll ? { minHeight: '100vh' } : { height: '100dvh', maxHeight: '100vh' }),
      display: 'flex', flexDirection: 'column', background: t.bg, color: t.fg,
      fontFamily: MONO, position: 'relative', overflow: scroll ? 'hidden auto' : 'hidden',
    }}>{children}</div>
  );
}

function Header({ t, right }) {
  return (
    <div style={{ padding: '22px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.b}` }}>
      <span style={{ font: `italic 800 20px ${TEKTUR}`, color: t.a }}>MUSIC'OSE</span>
      <span style={{ font: `500 12px ${MONO}`, letterSpacing: '.15em' }}>{right}</span>
    </div>
  );
}

function Footer({ t, left, right, rightColor }) {
  return (
    <div style={{ padding: '12px 20px 20px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.b}`, font: `500 12px ${MONO}`, letterSpacing: '.15em' }}>
      <span>{left}</span><span style={rightColor ? { color: rightColor } : undefined}>{right}</span>
    </div>
  );
}

const who = (t, pseudo, score) => (
  <>{(pseudo || '').toUpperCase()} · <b style={{ color: t.b }}>{score} PTS</b></>
);

/* Égaliseur */
function Eq({ n, colors, color, base = 1.2, seed = 0, height = 22 }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="ge-bar" style={{ flex: 1, height: '100%', transformOrigin: 'bottom', '--dur': `${(base + rnd(i + seed) * base * 0.6).toFixed(2)}s`, '--delay': `${(-rnd(i + seed + 5) * 2).toFixed(2)}s` }}>
          <div style={{ width: '100%', height: '100%', background: colors ? colors[i % colors.length] : color, transformOrigin: 'bottom' }} />
        </div>
      ))}
    </div>
  );
}

/* Mini-scène : soleil rayé + grille */
function Scene({ t, height, sunSize, sunTop, sunGradient, sunOp = 1, gridTop, gridColor, children }) {
  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', flex: '0 1 auto', minHeight: 0 }}>
      <div style={{
        position: 'absolute', left: '50%', top: sunTop, width: sunSize, height: sunSize, marginLeft: -sunSize / 2, borderRadius: '50%',
        background: sunGradient || `linear-gradient(${t.a},${t.b})`, opacity: sunOp, WebkitMask: SUN_MASK, mask: SUN_MASK,
      }} />
      <div style={{
        position: 'absolute', left: -150, right: -150, top: gridTop, height: 260, transform: 'perspective(260px) rotateX(60deg)', transformOrigin: 'top',
        background: GRID_H(gridColor || t.grid, 50, 36),
      }} />
      {children}
    </div>
  );
}

const Title = ({ t, children, bottom = 50, size = 54 }) => (
  <div style={{ position: 'absolute', left: 20, right: 20, bottom, font: `italic 800 ${size}px/.9 ${TEKTUR}`, color: BASE.fg, textShadow: `4px 4px 0 ${t.a}` }}>{children}</div>
);

const MicSvg = () => (
  <svg width="26" height="36" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
    <rect x="7" y="2" width="10" height="17" rx="5" /><path d="M3 14a9 9 0 0 0 18 0M12 23v5M7 29h10" />
  </svg>
);

const SkewBtn = ({ bg, color, children, ...p }) => (
  <button {...p} style={{
    height: 62, border: 0, background: bg, color, font: `italic 800 22px ${TEKTUR}`, ...skew, cursor: 'pointer',
    opacity: p.disabled ? 0.45 : 1, ...(p.style || {}),
  }}>{children}</button>
);

const fieldLabel = (color) => ({ display: 'flex', flexDirection: 'column', gap: 6, font: `500 12px ${MONO}`, letterSpacing: '.2em', color });
const fieldInput = (color, fg) => ({
  height: 58, border: 0, borderBottom: `3px solid ${color}`, background: 'rgba(255,255,255,.05)', color: fg,
  padding: '0 14px', font: `700 22px ${TEKTUR}`, boxSizing: 'border-box', outline: 'none', width: '100%',
});

/* Liste de joueurs connectés (2 colonnes) */
function PlayerGrid({ players }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {players.slice(0, 30).map((pl, i) => {
        const name = typeof pl === 'string' ? pl : pl.pseudo;
        const col = (typeof pl === 'object' && pl.color) || BASE_THEME.bars[i % 4];
        return (
          <div key={name + i} data-player={name} data-color={col} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.05)', minWidth: 0 }}>
            <span style={{ width: 28, height: 28, flex: '0 0 auto', background: col, color: BASE.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 12px ${TEKTUR}` }}>{(name || '?').slice(0, 2).toUpperCase()}</span>
            <span style={{ font: `700 15px ${TEKTUR}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

const RoundPillsRow = ({ current }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    {[1, 2, 3, 4].map(r => (
      <div key={r} style={{
        flex: 1, height: 40, border: `2px solid ${PILL_COLORS[r]}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `italic 800 16px ${TEKTUR}`, color: current === r ? PHONE_THEMES[r].bg : PILL_COLORS[r], background: current === r ? PILL_COLORS[r] : 'transparent', ...skew,
      }}>{pad2(r)}</div>
    ))}
  </div>
);

/* ── Connexion : tient sur une seule page (code, pseudo, couleur) ───────── */
export function ScreenJoin({ code, onCode, pseudo, onPseudo, color, onColor, onSubmit, connecting, error, hasSession, onReset, onResetMode }) {
  const t = BASE;
  const input = (c) => ({ ...fieldInput(c, t.fg), height: 50, font: `700 20px ${TEKTUR}` });
  return (
    <Shell t={t} name="join">
      <Header t={t} right="BLIND TEST LIVE" />
      <div style={{ position: 'relative', height: 'clamp(92px, 19dvh, 170px)', overflow: 'hidden', flex: '0 1 auto' }}>
        <div style={{
          position: 'absolute', left: '50%', top: 8, width: 'clamp(70px, 15dvh, 130px)', height: 'clamp(70px, 15dvh, 130px)', transform: 'translateX(-50%)',
          borderRadius: '50%', background: BASE_THEME.sun, WebkitMask: SUN_MASK, mask: SUN_MASK,
        }} />
        <div style={{ position: 'absolute', left: -150, right: -150, top: '48%', height: 200, transform: 'perspective(260px) rotateX(60deg)', transformOrigin: 'top', background: GRID_H('rgba(244,235,217,.25)', 50, 36) }} />
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 8, font: `italic 800 clamp(22px, 4.2dvh, 36px)/.9 ${TEKTUR}`, whiteSpace: 'nowrap', color: t.fg, textShadow: `3px 3px 0 ${t.a}` }}>REJOINS LA PARTIE</div>
      </div>
      <div style={{ padding: '10px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 auto', minHeight: 0 }}>
        {hasSession && (
          <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.12em', color: '#00E5FF' }}>SESSION SAUVEGARDÉE — TU RETROUVERAS TES POINTS</div>
        )}
        <label style={fieldLabel('#FFC933')}>CODE DE LA PARTIE
          <input value={code} onChange={e => onCode(e.target.value)} onKeyPress={e => e.key === 'Enter' && onSubmit()}
            placeholder="OSE-XXXX" autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck="false"
            style={{ ...input('#FFC933'), letterSpacing: '.1em' }} />
        </label>
        <label style={fieldLabel('#00E5FF')}>TON PSEUDO
          <input value={pseudo} onChange={e => onPseudo(e.target.value)} onKeyPress={e => e.key === 'Enter' && onSubmit()}
            placeholder="Ton pseudo" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
            style={input('#00E5FF')} />
        </label>
        <div>
          <div style={{ font: `500 12px ${MONO}`, letterSpacing: '.2em', color: color, marginBottom: 6 }}>TA COULEUR</div>
          <div role="radiogroup" aria-label="Ta couleur" style={{ display: 'flex', gap: 8 }}>
            {PLAYER_COLORS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Couleur ${c}`} data-color={c} onClick={() => onColor(c)}
                style={{
                  flex: 1, height: 34, border: 0, background: c, cursor: 'pointer', ...skew,
                  boxShadow: color === c ? `0 0 0 3px ${t.bg}, 0 0 0 5px ${t.fg}` : 'none', opacity: color === c ? 1 : 0.75,
                }} />
            ))}
          </div>
        </div>
        {error && (
          <div style={{ padding: '8px 12px', border: '1px solid rgba(255,45,149,.5)', background: 'rgba(255,45,149,.08)', color: t.a, font: `500 12px/1.4 ${MONO}` }}>{error}</div>
        )}
        <SkewBtn bg={t.a} color="#fff" onClick={onSubmit} disabled={connecting} style={{ marginTop: 'auto', height: 56 }}>
          {connecting ? 'CONNEXION…' : 'ENTRER EN SCÈNE ›››'}
        </SkewBtn>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          {hasSession && (
            <button onClick={onReset} style={{ background: 'none', border: 0, color: t.fg, opacity: 0.6, font: `400 12px ${MONO}`, textDecoration: 'underline', cursor: 'pointer' }}>Changer de joueur</button>
          )}
          {onResetMode && (
            <button onClick={onResetMode} style={{ background: 'none', border: 0, color: t.fg, opacity: 0.6, font: `400 12px ${MONO}`, textDecoration: 'underline', cursor: 'pointer' }}>Changer de mode</button>
          )}
        </div>
      </div>
      <Footer t={t} left="4 MANCHES" right="PRÊTS ?" />
    </Shell>
  );
}

/* ── Attente (avant la partie et entre les chansons) ───────── */
export function ScreenWaiting({ pseudo, score, players, code, round, title = ['EN', 'ATTENTE'], message, restored }) {
  const t = BASE;
  return (
    <Shell t={t} name="waiting">
      <Header t={t} right={who(t, pseudo, score)} />
      <Scene t={t} height="clamp(200px, 32dvh, 300px)" sunSize={210} sunTop={40} sunGradient={BASE_THEME.sun} gridTop={200} gridColor="rgba(244,235,217,.25)">
        <Title t={t}>{title[0]}<br />{title[1]}</Title>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16 }}><Eq n={16} colors={BASE_THEME.bars} base={1.2} seed={77} height={24} /></div>
      </Scene>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ font: `500 13px/1.5 ${MONO}`, letterSpacing: '.1em' }}>{message || "L'animateur va lancer la partie. Garde les yeux sur le Grand Écran."}</div>
        {restored !== null && restored !== undefined && (
          <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.15em', color: '#00E5FF' }}>{restored} PTS RESTAURÉS</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid rgba(244,235,217,.2)', paddingBottom: 8 }}>
          <span style={{ font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>JOUEURS CONNECTÉS</span>
          <span style={{ font: `italic 800 28px ${TEKTUR}`, color: '#00E5FF' }}>{players.length}</span>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
          <PlayerGrid players={players.slice(0, 10)} />
          {players.length > 10 && <div style={{ font: `500 12px ${MONO}`, letterSpacing: '.15em', color: '#00E5FF', marginTop: 8 }}>+ {players.length - 10} AUTRES JOUEURS</div>}
        </div>
        <RoundPillsRow current={round} />
      </div>
      <Footer t={t} left={`CODE · ${(code || '').toUpperCase()}`} right="● LIVE" rightColor="#00E5FF" />
    </Shell>
  );
}

/* ── Manche en cours ───────────────────────────────────────── */
export function ScreenGame({
  round, pseudo, score, seconds, total, active, theme, status, statusLabel, musicCut,
  optionCount, choice, onChoose, title, onTitle, artist, onArtist, onSubmit, eliminated, hint,
}) {
  const t = phoneTheme(round);
  const pct = total > 0 ? Math.round((100 * seconds) / total) : 0;
  const isQuiz = round === 1;
  const dur = `${ROUND_CONFIG[round].seconds} S`;
  const pts = { 1: '1 PT + BONUS', 2: 'TITRE SEUL · 2 PTS', 3: '3 PTS + BONUS', 4: '5 / 2 PTS · ÉLIMINATION' }[round];
  const locked = !active || eliminated;
  return (
    <Shell t={t} name="game">
      <Header t={t} right={who(t, pseudo, score)} />
      <Scene t={t} height="clamp(190px, 31dvh, 270px)" sunSize={190} sunTop={26} sunOp={t.sunOp} gridTop={170}>
        <div style={{ position: 'absolute', left: 20, top: 18, font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>MANCHE {pad2(round)}</div>
        <div data-seconds={active ? seconds : ''} style={{ position: 'absolute', right: 20, top: 10, font: `italic 800 56px/1 ${TEKTUR}`, color: t.b, textShadow: `3px 3px 0 ${t.a}` }}>{active ? seconds : '—'}</div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 44, font: `italic 800 30px/.95 ${TEKTUR}`, textShadow: `3px 3px 0 ${t.a}` }}>{ROUND_NAMES[round - 1].toUpperCase()}</div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14 }}><Eq n={t.eqN} color={t.b} base={t.spd} seed={round * 20} /></div>
      </Scene>
      <div style={{ height: 6, background: 'rgba(255,255,255,.14)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${t.a},${t.b})`, transition: 'width 1s linear' }} />
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {theme && <div style={{ font: `500 13px ${MONO}`, letterSpacing: '.15em' }}>THÈME · <b style={{ font: `800 18px ${TEKTUR}`, color: t.b }}>{String(theme).toUpperCase()}</b></div>}
        {status && <div style={{ font: `500 13px ${MONO}`, letterSpacing: '.15em' }}>{statusLabel} · <b style={{ font: `800 18px ${TEKTUR}`, color: t.a }}>{status}</b></div>}
        {musicCut && <div style={{ font: `500 13px ${MONO}`, letterSpacing: '.15em', color: t.a }}>MUSIQUE COUPÉE</div>}

        {isQuiz ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: 'clamp(96px, 16dvh, 140px)', gap: 12 }}>
            {MIC_CHOICES.slice(0, optionCount).map((m, i) => {
              const selected = choice === i;
              return (
                <button key={i} onClick={() => onChoose(i)} disabled={!active} aria-label={`Proposition ${m.letter}`} aria-pressed={selected}
                  style={{
                    border: 0, background: m.color, color: t.bg, ...skew, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    padding: 14, cursor: active ? 'pointer' : 'default',
                    boxShadow: selected ? `0 0 0 4px ${t.fg}, 0 0 22px ${m.color}` : 'none',
                    opacity: !active ? 0.45 : choice !== null && !selected ? 0.55 : 1, transition: 'all .12s ease',
                  }}>
                  <span style={{ font: `italic 800 64px/.8 ${TEKTUR}` }}>{m.letter}</span>
                  <MicSvg />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <input value={title} onChange={e => onTitle(e.target.value)} disabled={locked} placeholder="Titre…"
              autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
              style={{ ...fieldInput(t.b, t.fg), font: `700 20px ${TEKTUR}`, opacity: locked ? 0.5 : 1 }} />
            {round !== 2 && (
              <input value={artist} onChange={e => onArtist(e.target.value)} disabled={locked} placeholder="Artiste…"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
                style={{ ...fieldInput(t.b, t.fg), font: `700 20px ${TEKTUR}`, opacity: locked ? 0.5 : 1 }} />
            )}
            {eliminated && <div style={{ font: `500 13px ${MONO}`, letterSpacing: '.1em', color: t.a, textAlign: 'center' }}>❌ ÉLIMINÉ·E DE CETTE MANCHE</div>}
            <SkewBtn bg={t.a} color={t.btnFg} onClick={onSubmit} disabled={locked} style={{ marginTop: 6 }}>VALIDER ›››</SkewBtn>
            <span style={{ font: `400 12px ${MONO}`, letterSpacing: '.15em', opacity: 0.7 }}>{hint}</span>
          </>
        )}
        {isQuiz && (
          <span style={{ font: `400 12px ${MONO}`, letterSpacing: '.15em', opacity: 0.7, textAlign: 'center' }}>
            {choice === null ? 'REGARDE LE GRAND ÉCRAN · CHOISIS TON MICRO' : "TU PEUX CHANGER D'AVIS JUSQU'À LA FIN"}
          </span>
        )}
      </div>
      <Footer t={t} left={dur} right={pts} />
    </Shell>
  );
}

/* ── Réponse envoyée, en attente de la révélation ──────────── */
export function ScreenSent({ round, pseudo, score, answer, choiceIndex }) {
  const t = phoneTheme(round);
  const mic = choiceIndex !== null && choiceIndex !== undefined ? MIC_CHOICES[choiceIndex] : null;
  return (
    <Shell t={t} name="sent">
      <Header t={t} right={who(t, pseudo, score)} />
      <Scene t={t} height="clamp(190px, 31dvh, 270px)" sunSize={190} sunTop={26} sunOp={t.sunOp} gridTop={170}>
        <div style={{ position: 'absolute', left: 20, top: 18, font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>MANCHE {pad2(round)}</div>
        <Title t={t} bottom={44} size={38}>RÉPONSE<br />ENVOYÉE</Title>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14 }}><Eq n={t.eqN} color={t.b} base={t.spd} seed={round * 20} /></div>
      </Scene>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div style={{ font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>EN ATTENTE DE LA RÉVÉLATION…</div>
        {round === 1 && (
          <div style={{ padding: 16, border: `1px solid ${t.b}` }}>
            <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.2em', opacity: 0.7, marginBottom: 8 }}>TON CHOIX</div>
            {mic ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: mic.color }}>
                <MicSvg /><span style={{ font: `italic 800 34px ${TEKTUR}` }}>{mic.letter}</span>
              </div>
            ) : <div style={{ font: `700 16px ${TEKTUR}`, opacity: 0.7 }}>Aucun choix</div>}
          </div>
        )}
        {round !== 1 && answer && (answer.title || answer.artist) && (
          <div style={{ padding: 16, border: `1px solid ${t.b}` }}>
            <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.2em', opacity: 0.7, marginBottom: 8 }}>TA RÉPONSE</div>
            {answer.title && <div style={{ font: `800 20px ${TEKTUR}` }}>{answer.title}</div>}
            {answer.artist && round !== 2 && <div style={{ font: `500 14px ${MONO}`, opacity: 0.8, marginTop: 4 }}>{answer.artist}</div>}
          </div>
        )}
        <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.15em', opacity: 0.6, marginTop: 'auto' }}>L'ANIMATEUR VA RÉVÉLER LA RÉPONSE</div>
      </div>
      <Footer t={t} left={`${ROUND_CONFIG[round].seconds} S`} right="● LIVE" rightColor={t.b} />
    </Shell>
  );
}

/* ── Révélation : reste dans la DA de la manche, ni classement ni bouton ──────── */
export function ScreenReveal({ round, pseudo, score, outcome, points, label, sub, correct, mine, bonuses }) {
  const t = phoneTheme(round);
  const color = RESULT_COLORS[outcome];
  const mark = outcome === 'parfait' ? '✓' : outcome === 'partiel' ? '≈' : '✕';
  return (
    <Shell t={t} name="reveal">
      <Header t={t} right={who(t, pseudo, score)} />
      <Scene t={t} height="clamp(190px, 31dvh, 270px)" sunSize={190} sunTop={26} sunOp={t.sunOp} gridTop={170}>
        <div style={{ position: 'absolute', left: 20, top: 18, font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>MANCHE {pad2(round)}</div>
        <div data-points style={{ position: 'absolute', right: 20, top: 10, font: `italic 800 56px/1 ${TEKTUR}`, color: t.b, textShadow: `3px 3px 0 ${t.a}` }}>{points > 0 ? `+${points}` : '0'}</div>
        <div data-outcome={outcome} style={{ position: 'absolute', left: 20, right: 20, bottom: 44, font: `italic 800 30px/.95 ${TEKTUR}`, textShadow: `3px 3px 0 ${t.a}` }}>{label}</div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14 }}><Eq n={t.eqN} color={t.b} base={t.spd} seed={round * 20} /></div>
      </Scene>
      <div style={{ height: 6, background: color }} />

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div style={{ font: `500 13px ${MONO}`, letterSpacing: '.15em', color }}><b style={{ font: `800 18px ${TEKTUR}` }}>{mark}</b> {sub.toUpperCase()}</div>
        <div style={{ padding: 16, border: `1px solid ${t.b}`, background: 'rgba(255,255,255,.04)' }}>
          <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.25em', opacity: 0.7 }}>C'ÉTAIT</div>
          <div style={{ font: `italic 800 24px/1.1 ${TEKTUR}`, marginTop: 8, textShadow: `2px 2px 0 ${t.a}` }}>{(correct.title || '').toUpperCase()}</div>
          <div style={{ font: `500 14px ${MONO}`, color: t.b, marginTop: 6 }}>{(correct.artist || '').toUpperCase()}</div>
        </div>
        {mine && (
          <div style={{ font: `400 12px ${MONO}`, letterSpacing: '.1em', opacity: 0.75 }}>
            TA RÉPONSE · <span style={{ textDecoration: outcome === 'rate' ? 'line-through' : 'none' }}>{mine}</span>
          </div>
        )}
        {bonuses.map(b => (
          <div key={b} style={{ padding: '8px 14px', border: `1px solid ${t.b}`, color: t.b, font: `500 12px ${MONO}`, letterSpacing: '.15em', ...skew }}>{b}</div>
        ))}
      </div>
      <Footer t={t} left={`${ROUND_CONFIG[round].seconds} S`} right="EN ATTENTE DE LA SUITE…" />
    </Shell>
  );
}

const Swatch = ({ color, size = 28, text, bg = '#0E0B1F' }) => (
  <span style={{ width: size, height: size, flex: '0 0 auto', background: color || '#888', color: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `800 ${Math.round(size * 0.42)}px ${TEKTUR}` }}>{text}</span>
);

/* ── Classement de fin de manche (dans la DA de la manche, sans bouton) ─────── */
export function ScreenRanking({ round, pseudo, score, ranking }) {
  const t = phoneTheme(round);
  const rows = (ranking || []).map((r, i) => ({ ...r, rank: i + 1 }));
  const top = rows.slice(0, 6);
  const me = rows.find(r => r.pseudo === pseudo);
  const shown = me && me.rank > 6 ? [...top, me] : top;
  return (
    <Shell t={t} name="ranking">
      <Header t={t} right={who(t, pseudo, score)} />
      <Scene t={t} height="clamp(120px, 20dvh, 200px)" sunSize={150} sunTop={14} sunOp={t.sunOp} gridTop={120}>
        <div style={{ position: 'absolute', left: 20, top: 14, font: `500 12px ${MONO}`, letterSpacing: '.2em' }}>APRÈS LA MANCHE {pad2(round)}</div>
        <Title t={t} bottom={14} size={40}>CLASSEMENT</Title>
      </Scene>
      <div style={{ height: 6, background: `linear-gradient(90deg,${t.a},${t.b})` }} />
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {shown.map(r => (
          <div key={r.pseudo + r.rank} data-me={r.pseudo === pseudo ? 'true' : 'false'} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center', gap: 8, padding: '9px 8px', borderBottom: `1px solid ${t.b}44`,
            font: `700 17px ${TEKTUR}`, background: r.pseudo === pseudo ? `${t.b}26` : 'transparent',
          }}>
            <span style={{ font: `italic 800 24px ${TEKTUR}`, color: r.rank <= 3 ? t.b : t.fg }}>{r.rank}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Swatch color={r.color} size={18} bg={t.bg} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pseudo}</span>
            </span>
            <span>{r.score || 0}</span>
          </div>
        ))}
      </div>
      <Footer t={t} left={`MANCHE ${pad2(round)}`} right="EN ATTENTE DE LA SUITE…" />
    </Shell>
  );
}

/* ── Podium final : le défilement n'existe que sur cet écran ─────────────── */
export function ScreenPodium({ pseudo, ranking, onReplay }) {
  const t = BASE;
  const rows = (ranking || []).map((r, i) => ({ ...r, rank: i + 1 }));
  const me = rows.find(r => r.pseudo === pseudo);
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const meRef = React.useRef(null);
  React.useEffect(() => { if (me && me.rank > 3 && meRef.current) meRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [me && me.rank]);
  const steps = [
    { p: top3[1], rank: 2, h: 100, bg: t.b, fg: t.bg },
    { p: top3[0], rank: 1, h: 142, bg: t.a, fg: '#fff' },
    { p: top3[2], rank: 3, h: 74, bg: t.fg, fg: t.bg },
  ];
  return (
    <Shell t={t} scroll name="podium">
      <Header t={t} right="FIN DE PARTIE" />
      <Scene t={t} height={190} sunSize={140} sunTop={12} sunGradient={BASE_THEME.sun} gridTop={110} gridColor="rgba(244,235,217,.25)">
        <Title t={t} bottom={14} size={46}>PODIUM</Title>
      </Scene>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '18px 16px 0' }}>
        {steps.map(({ p, rank, h, bg, fg }) => (
          <div key={rank} data-podium-rank={rank} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              {p && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><Swatch color={p.color} size={rank === 1 ? 32 : 26} /></div>}
              <div style={{ font: `800 ${rank === 1 ? 16 : 13}px/1.1 ${TEKTUR}`, wordBreak: 'break-word' }}>{p ? p.pseudo : '—'}</div>
              <div style={{ font: `500 11px ${MONO}`, color: t.b, marginTop: 2 }}>{p ? `${p.score || 0} PTS` : ''}</div>
            </div>
            <div style={{
              height: h, background: bg, color: fg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 6,
              boxShadow: p && p.pseudo === pseudo ? `0 0 0 3px ${t.bg}, 0 0 0 5px ${t.fg}` : 'none',
            }}>
              <span style={{ font: `italic 800 ${rank === 1 ? 54 : 40}px/.9 ${TEKTUR}` }}>{rank}</span>
            </div>
          </div>
        ))}
      </div>

      <div data-me-card style={{ margin: '16px 20px 0', padding: '12px 16px', border: `2px solid ${t.b}`, ...skew, background: 'rgba(255,255,255,.05)' }}>
        <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.2em', color: t.b }}>{me && me.rank <= 3 ? 'BRAVO !' : 'TON CLASSEMENT'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
          <span style={{ font: `italic 800 34px ${TEKTUR}` }}>{me ? `N°${me.rank}` : '—'} <span style={{ font: `500 12px ${MONO}`, opacity: 0.7 }}>/ {rows.length}</span></span>
          <span style={{ font: `800 22px ${TEKTUR}`, color: t.b }}>{me ? me.score || 0 : 0} PTS</span>
        </div>
      </div>

      {rest.length > 0 && (
        <div style={{ padding: '14px 20px 6px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.25em', opacity: 0.7, marginBottom: 6 }}>LES AUTRES JOUEURS</div>
          {rest.map(r => (
            <div key={r.pseudo + r.rank} ref={r.pseudo === pseudo ? meRef : undefined} data-me={r.pseudo === pseudo ? 'true' : 'false'} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr auto', alignItems: 'center', gap: 8, padding: '9px 8px', borderBottom: `1px solid ${t.b}33`,
              font: `700 16px ${TEKTUR}`, background: r.pseudo === pseudo ? `${t.b}2a` : 'transparent',
            }}>
              <span style={{ font: `italic 800 22px ${TEKTUR}`, color: t.b }}>{r.rank}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Swatch color={r.color} size={18} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pseudo}</span>
              </span>
              <span>{r.score || 0}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '16px 20px 22px', marginTop: 'auto' }}>
        <SkewBtn bg={t.b} color={t.bg} onClick={onReplay} style={{ width: '100%', height: 58 }}>REJOUER ›››</SkewBtn>
      </div>
      <Footer t={t} left="MERCI D'AVOIR JOUÉ" right={`${rows.length} JOUEURS`} />
    </Shell>
  );
}
