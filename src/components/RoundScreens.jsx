import React from "react";
import { MIC_CHOICES, MAX_PLAYERS, joinUrl, progressForIndex, ROUND_CONFIG, TOTAL_SONGS } from "../gameLogic";
import { ROUND_THEMES, BASE_THEME, PILL_COLORS, roundSeconds, buildBars, barVanishOrder, vanishedBars, rnd, formatSeconds } from "../roundThemes";
import { APP_VERSION } from "../gameLogic";
import { tipsText } from "../tips";
import MicIcon from "./MicIcon";
import QrCode from "./QrCode";
import "../styles/grandEcran.css";

// Maquettes Claude Design v2 : scène de 1280×720 px, affichée à l'échelle 1,5 dans le décor 1920×1080 du grand écran.
const SUN_MASK = 'linear-gradient(#000 0 50%,transparent 50% 56%,#000 56% 66%,transparent 66% 72%,#000 72% 80%,transparent 80% 86%,#000 86%)';
const brand = (code) => (code ? `MUSIC'OSE · ${code}` : "MUSIC'OSE");
const TEKTUR = "'Tektur', 'Impact', sans-serif";
const MONO = "'DM Mono', ui-monospace, monospace";

const pad2 = (n) => String(n).padStart(2, '0');

// Numéro de la question dans la manche et dans toute la partie — toujours visible dans le bandeau du haut
const progressText = (p) => `MANCHE ${pad2(p.round)} · QUESTION ${pad2(p.number)}/${p.size} · TOTAL ${pad2(p.global)}/${p.total}`;

// QR code + code de la partie, gardés à l'écran pour que n'importe qui puisse rejoindre en cours de partie
export function JoinTile({ m, code, side = 'left', bottom = 78 }) {
  if (!code) return null;
  const url = joinUrl(window.location.origin, window.location.pathname, code);
  return (
    <div style={{
      position: 'absolute', [side]: 36, bottom, width: 128, boxSizing: 'border-box', padding: 8, zIndex: 3,
      background: m.bg, border: `1px solid ${m.b}`, textAlign: 'center',
    }}>
      <QrCode text={url} size={110} />
      <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.25em', color: m.a, marginTop: 6 }}>REJOINS</div>
      <div style={{ font: `800 17px/1.1 ${TEKTUR}`, color: m.b }}>{code}</div>
    </div>
  );
}

function Stage({ m, children, hideVersion }) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, width: 1280, height: 720, overflow: 'hidden',
      transform: 'scale(1.5)', transformOrigin: '0 0',
      background: m.bg, color: m.fg, fontFamily: MONO,
    }}>
      {children}
      {!hideVersion && (
        <div data-version style={{ position: 'absolute', left: 0, right: 0, bottom: 20, textAlign: 'center', font: `500 14px ${MONO}`, letterSpacing: '.3em', opacity: 0.75, zIndex: 4, pointerEvents: 'none' }}>{APP_VERSION}</div>
      )}
    </div>
  );
}

function Bar({ children, m, top }) {
  const base = {
    position: 'absolute', left: 0, right: 0, padding: '18px 36px', display: 'flex', justifyContent: 'space-between',
    font: `500 18px ${MONO}`, letterSpacing: '.25em', background: m.bg,
  };
  return <div style={{ ...base, ...(top ? { top: 0, borderBottom: `1px solid ${m.b}`, zIndex: 2, padding: '20px 36px' } : { bottom: 0, borderTop: `1px solid ${m.b}` }) }}>{children}</div>;
}

const Sun = ({ m, size, left, right, top, gradient, opacity }) => (
  <div style={{
    position: 'absolute', left, right, top, width: size, height: size, borderRadius: '50%',
    background: gradient || `linear-gradient(${m.a},${m.b})`, WebkitMask: SUN_MASK, mask: SUN_MASK, opacity: opacity ?? m.sunOp,
  }} />
);

const GridFloor = ({ m, top, height, scroll }) => (
  <div className={scroll ? 'ge-grid-scroll' : undefined} style={{
    position: 'absolute', left: -200, right: -200, top, height,
    transform: 'perspective(400px) rotateX(62deg)', transformOrigin: 'top',
    background: `repeating-linear-gradient(90deg,${m.gridA} 0 2px,transparent 2px 80px),repeating-linear-gradient(0deg,${m.gridB} 0 2px,transparent 2px 60px)`,
  }} />
);

/* ── Panneaux de droite ───────────────────────────────────── */
function RankPanel({ m, title, players }) {
  const top = [...players].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).slice(0, 3);
  return (
    <Panel m={m} title={title}>
      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '8px 12px', font: `500 22px ${MONO}` }}>
        {top.length === 0 && <span style={{ gridColumn: '1 / -1', color: m.b }}>—</span>}
        {top.map((p, i) => (
          <React.Fragment key={p.pseudo + i}>
            <span style={{ color: m.b }}>{i + 1}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</span>
            <span>{p.totalScore || 0}</span>
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ m, title, children, width = 300 }) {
  return (
    <div style={{
      position: 'absolute', right: 40, top: 90, width, display: 'flex', flexDirection: 'column', gap: 10,
      background: m.panel, padding: 18, border: `1px solid ${m.a}`, boxSizing: 'border-box',
    }}>
      <div style={{ font: `500 16px ${MONO}`, letterSpacing: '.2em', color: m.a }}>{title}</div>
      {children}
    </div>
  );
}

function FastestPanel({ m, list }) {
  const slot = (i, height, bg, color, expected, big) => {
    const f = list[i];
    return (
      <div style={{ flex: 1, height: `${height}%`, background: bg, color, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 8, opacity: f ? 1 : 0.35 }}>
        <b style={{ font: `800 ${big}px ${TEKTUR}` }}>+{f ? f.bonus : expected}</b>
        <span style={{ font: `500 15px ${MONO}`, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f ? <>{f.pseudo}<br />{formatSeconds(f.time)}</> : '—'}</span>
      </div>
    );
  };
  return (
    <Panel m={m} title="LES + RAPIDES">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 190 }}>
        {slot(1, 70, m.b, m.bg, 2, 34)}
        {slot(0, 100, m.a, '#fff', 3, 40)}
        {slot(2, 48, m.fg, m.bg, 1, 30)}
      </div>
    </Panel>
  );
}

function ArenaPanel({ m, aliveList }) {
  const total = aliveList.length;
  const alive = aliveList.filter(Boolean).length;
  return (
    <Panel m={m} title="ZONE DE JEU">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ font: `800 64px/.9 ${TEKTUR}` }}>{alive}</span>
        <span style={{ font: `500 18px ${MONO}`, color: m.b }}>/ {total} EN LICE</span>
      </div>
      <div style={{ position: 'relative', width: 200, height: 200, alignSelf: 'center' }}>
        <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: `2px dashed ${m.fg}` }} />
        <div style={{ position: 'absolute', inset: 50, borderRadius: '50%', border: `1px dotted ${m.a}` }} />
        {aliveList.map((isAlive, i) => {
          const ang = i * 2.39 + 0.3;
          const r = isAlive ? 12 + rnd(i) * 55 : 96;
          return (
            <div key={i} style={{
              position: 'absolute', left: Math.round(100 + Math.cos(ang) * r), top: Math.round(100 + Math.sin(ang) * r),
              width: 14, height: 14, margin: '-7px 0 0 -7px', transition: 'left .8s, top .8s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 16px/1 ${MONO}`, color: m.a,
            }}>
              {isAlive ? <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.fg }} /> : '✕'}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* R1 : les 4 propositions occupent l'essentiel de l'écran */
function OptionsGrid({ options }) {
  return (
    <div style={{
      position: 'absolute', left: 350, right: 36, top: 84, height: 486, display: 'grid',
      gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 16,
    }}>
      {options.map((o, i) => {
        const mic = MIC_CHOICES[i];
        const long = (o.title || '').length > 26;
        return (
          <div key={i} data-option={i} style={{
            display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px', boxSizing: 'border-box', minWidth: 0,
            border: `3px solid ${mic.color}`, background: 'rgba(0,0,0,.32)', boxShadow: `0 0 26px ${mic.color}55, inset 0 0 26px ${mic.color}18`,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <MicIcon color={mic.color} size={96} />
              <span style={{ font: `800 44px/1 ${TEKTUR}`, color: mic.color }}>{mic.letter}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `500 ${long ? 28 : 34}px/1.1 ${TEKTUR}`, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.title}</div>
              <div style={{ font: `500 22px/1.2 ${MONO}`, color: mic.color, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.artist}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Manche en cours ──────────────────────────────────────── */
export function ScreenRound({ code, round, remaining, total, answers, players, progress, options, theme, musicCut, fastestList, songIndex = 0 }) {
  const m = ROUND_THEMES[round];
  const p = progress || progressForIndex(ROUND_CONFIG[round].start);
  const cd = String(Math.max(0, Math.ceil(remaining))).padStart(2, '0');
  const aliveList = players.map(pl => pl.alive !== false);
  const bars = buildBars(round);
  // Manche 4 : les barres de son s'éteignent au hasard pendant le décompte
  const gone = round === 4 ? new Set(barVanishOrder(bars.length, songIndex).slice(0, vanishedBars(bars.length, (total || 0) - remaining, total || 0))) : new Set();
  const quiz = round === 1 && options;   // manche 1 : propositions en grand, égaliseur réduit

  return (
    <Stage m={m}>
      {!quiz && <Sun m={m} size={300} left={560} top={120} />}
      <GridFloor m={m} top={quiz ? 560 : 390} height={500} />
      {!quiz && (
        <div style={{
          position: 'absolute', left: 0, top: 120, width: 520, height: 240,
          background: `repeating-linear-gradient(180deg,transparent 0 22px,${m.gridA} 22px 24px)`,
          WebkitMask: 'linear-gradient(90deg,transparent,#000)', mask: 'linear-gradient(90deg,transparent,#000)',
        }} />
      )}

      <Bar m={m} top>
        <span>{progressText(p)}</span>
        <span>{brand(code)}</span>
      </Bar>

      <div style={{ position: 'absolute', left: quiz ? 36 : 48, top: quiz ? 84 : 90, font: `italic 800 ${quiz ? 40 : 64}px/.95 ${TEKTUR}`, textShadow: `${quiz ? 3 : 4}px ${quiz ? 3 : 4}px 0 ${m.a}`, whiteSpace: 'nowrap' }}>
        {m.t1}<br />{m.t2}
      </div>

      {/* Décompte : positions fixes, le « S » et les réponses ne bougent jamais d'un chiffre à l'autre */}
      <div style={{ position: 'absolute', left: quiz ? 36 : 48, top: quiz ? 186 : 285, width: quiz ? 290 : 420, height: quiz ? 128 : 112 }}>
        <div data-countdown style={{ position: 'absolute', left: 0, top: 0, width: quiz ? 180 : 200, height: quiz ? 104 : 112, font: `800 ${quiz ? 104 : 120}px/${quiz ? 104 : 112}px ${TEKTUR}`, color: m.b, whiteSpace: 'nowrap' }}>{cd}</div>
        <div data-countdown-label style={{ position: 'absolute', left: quiz ? 0 : 176, top: quiz ? 110 : 82, font: `500 ${quiz ? 16 : 18}px/20px ${MONO}`, whiteSpace: 'nowrap' }}>S · {answers.count}/{answers.total} RÉPONSES</div>
      </div>

      {round === 2 && theme && (
        <div style={{ position: 'absolute', left: 48, top: 405, right: 380 }}>
          <div style={{ font: `500 16px ${MONO}`, letterSpacing: '.3em', color: m.a }}>THÈME</div>
          <div style={{ font: `800 40px/1 ${TEKTUR}`, color: m.b, marginTop: 4 }}>{theme.toUpperCase()}</div>
        </div>
      )}
      {round === 4 && musicCut && (
        <div style={{ position: 'absolute', left: 48, top: 415, font: `800 30px ${TEKTUR}`, color: m.a }}>
          MUSIQUE COUPÉE · À VOUS !
        </div>
      )}

      {quiz
        ? <OptionsGrid options={options} />
        : round === 3 ? <FastestPanel m={m} list={fastestList} />
        : round === 4 ? <ArenaPanel m={m} aliveList={aliveList.length ? aliveList : [true]} />
        : <RankPanel m={m} title={round === 2 ? 'EN TÊTE' : 'CLASSEMENT'} players={players} />}

      <JoinTile m={m} code={code} side="left" />

      <div style={{
        position: 'absolute', left: 200, right: 36, bottom: 72, height: quiz ? 60 : 150, display: 'flex', justifyContent: 'center',
        gap: m.bars.gap, alignItems: 'flex-end', WebkitBoxReflect: quiz ? 'none' : 'below 4px linear-gradient(transparent 40%,rgba(255,255,255,.3))',
      }}>
        {bars.map((b, i) => {
          const off = gone.has(i);
          return (
            <div key={i} data-bar={off ? 'off' : 'on'} className={off ? 'ge-bar ge-bar--dead' : 'ge-bar'} style={{
              flex: 1, height: `${b.h}%`, opacity: off ? 0 : 1, transformOrigin: 'bottom left', transition: 'transform .6s, opacity .6s',
              transform: off ? 'translateY(40px) scaleY(.1)' : 'none',
              '--dur': `${b.dur}s`, '--delay': `${b.delay}s`,
            }}>
              <div style={{ width: '100%', height: '100%', transformOrigin: 'bottom', background: m.bars.fill, boxShadow: `0 0 12px ${m.bars.glow}` }} />
            </div>
          );
        })}
      </div>

      <Bar m={m}>
        <span>{roundSeconds(round)} S</span>
        <span>{m.pts}</span>
      </Bar>
    </Stage>
  );
}

/* ── Annonce de la manche (maquette « Transitions ») ───────── */
function RuleTile({ m, t, i, n }) {
  const wide = n <= 3;
  return (
    <div className="ge-lift" data-tile style={{
      width: wide ? 200 : 158, boxSizing: 'border-box', padding: '12px 14px 10px', transform: 'skewX(-8deg)',
      border: `2px solid ${i === n - 1 && n === 4 ? m.a : m.b}`, background: m.panel, animationDelay: `${0.5 + i * 0.12}s`,
      boxShadow: `0 0 18px ${m.bars.glow}`,
    }}>
      <div style={{ font: `italic 800 ${t.v.length > 6 ? 30 : 44}px/1 ${TEKTUR}`, color: i === 0 ? m.fg : m.b, whiteSpace: 'nowrap' }}>{t.v}</div>
      <div style={{ font: `500 12px/1.3 ${MONO}`, letterSpacing: '.15em', marginTop: 8 }}>{t.l}</div>
      {t.s && <div style={{ font: `500 11px/1.3 ${MONO}`, letterSpacing: '.1em', color: m.a, marginTop: 4 }}>{t.s}</div>}
    </div>
  );
}

// Bandeau défilant du bas : comment rejoindre, règles « maison »…
function Ticker({ m, code }) {
  const text = tipsText(code);
  return (
    <div data-ticker style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, boxSizing: 'border-box', background: m.bg, borderTop: `1px solid ${m.b}`,
      overflow: 'hidden', display: 'flex', alignItems: 'center', zIndex: 3,
    }}>
      <div className="ge-ticker" style={{ font: `500 20px ${MONO}`, letterSpacing: '.12em', whiteSpace: 'nowrap', color: m.fg }}>
        <span>{text}   ✦   </span><span>{text}   ✦   </span>
      </div>
      <div data-version style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', padding: '0 24px', background: m.bg, borderLeft: `1px solid ${m.b}`, font: `500 16px ${MONO}`, letterSpacing: '.25em', color: m.b }}>{APP_VERSION}</div>
    </div>
  );
}

export function ScreenTransition({ round, code }) {
  const m = ROUND_THEMES[round];
  const p = progressForIndex(ROUND_CONFIG[round].start);
  const bars = buildBars(round);
  return (
    <Stage m={m} hideVersion>
      <Sun m={m} size={380} right={110} top={100} gradient={m.sun} opacity={round === 2 ? 0.35 : 0.9} />
      <GridFloor m={{ ...m, gridA: m.annGrid, gridB: m.annGrid }} top={440} height={500} scroll />
      <Bar m={m} top>
        <span>{progressText(p)}</span>
        <span>{brand(code)}</span>
      </Bar>
      <div style={{ position: 'absolute', left: 70, top: 84, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="ge-pop" style={{ font: `italic 800 150px/.8 ${TEKTUR}`, color: round === 4 ? m.a : m.b, transformOrigin: 'left bottom' }}>{pad2(round)}</div>
        <div className="ge-lift" style={{ font: `italic 800 96px/.9 ${TEKTUR}`, textShadow: `6px 6px 0 ${m.a}`, whiteSpace: 'nowrap' }}>{m.t1}<br />{m.t2}</div>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 408, display: 'flex', gap: 14 }}>
        {m.tiles.map((t, i) => <RuleTile key={t.l} m={m} t={t} i={i} n={m.tiles.length} />)}
      </div>
      <BarsRow bars={bars} fill={m.bars.fill} glow={m.bars.glow} gap={m.bars.gap} height={70} left={36} right={190} />
      <JoinTile m={m} code={code} side="right" bottom={72} />
      <Ticker m={m} code={code} />
    </Stage>
  );
}

/* Égaliseur du bas d'écran (barres animées en CSS) */
function BarsRow({ bars, fill, glow, gap, height = 150, colors, left = 200, right = 36 }) {
  return (
    <div style={{
      position: 'absolute', left, right, bottom: 72, height, display: 'flex', justifyContent: 'center',
      gap, alignItems: 'flex-end', WebkitBoxReflect: 'below 4px linear-gradient(transparent 40%,rgba(255,255,255,.3))',
    }}>
      {bars.map((b, i) => (
        <div key={i} className="ge-bar" style={{ flex: 1, height: `${b.h}%`, transformOrigin: 'bottom left', '--dur': `${b.dur}s`, '--delay': `${b.delay}s` }}>
          <div style={{ width: '100%', height: '100%', transformOrigin: 'bottom', background: colors ? colors[i % colors.length] : fill, boxShadow: `0 0 12px ${colors ? colors[i % colors.length] : glow}` }} />
        </div>
      ))}
    </div>
  );
}

/* ── Effets de passage d'une manche à l'autre (maquette « Transitions ») ── */
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cl01 = (v) => Math.max(0, Math.min(1, v));

// p : progression 0 → 1 ; l'écran change au milieu (p = 0,5). k : 0 rayons, 1 iris, 2 bandes de vitesse, 3 zone rouge.
export function TransitionOverlay({ k, p, reduced }) {
  if (p <= 0 || p >= 1) return null;
  const c = p < 0.5 ? easeInOutCubic(p * 2) : 1 - easeInOutCubic((p - 0.5) * 2);
  const full = { position: 'absolute', inset: 0, pointerEvents: 'none' };
  const wrap = (children) => (
    <div data-transition={k} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: 'scale(1.5)', transformOrigin: '0 0', overflow: 'hidden', pointerEvents: 'none', zIndex: 20 }}>{children}</div>
  );
  if (reduced) return wrap(<div style={{ ...full, background: ROUND_THEMES[k + 1].bg, opacity: c }} />);
  if (k === 0) return wrap(
    <div style={full}>
      <div style={{
        position: 'absolute', left: 640 - 800, top: 360 - 800, width: 1600, height: 1600, borderRadius: '50%',
        background: 'radial-gradient(circle,#FFC933 0 46%,transparent 46.2%),repeating-conic-gradient(#FFC933 0 5deg,#FF5A4E 5deg 7deg,transparent 7deg 15deg)',
        transform: `scale(${c * 1.25}) rotate(${p * 120}deg)`,
      }} />
    </div>);
  if (k === 1) {
    const R = (1 - c) * 760;
    return wrap(
      <div style={full}>
        <div style={{ ...full, background: `radial-gradient(circle at 50% 50%,transparent ${R}px,#0A0A0D ${R + 1}px)` }} />
        {[0, 14, 30].map(d => <div key={d} style={{ position: 'absolute', left: 640 - R - d, top: 360 - R - d, width: 2 * (R + d), height: 2 * (R + d), borderRadius: '50%', border: '1px solid rgba(244,235,217,.5)' }} />)}
      </div>);
  }
  if (k === 2) return wrap(
    <div style={{ ...full, overflow: 'hidden' }}>
      {Array.from({ length: 9 }, (_, i) => {
        const st = i * 0.05;
        const x = p < 0.5 ? -1 + easeInOutCubic(cl01((p * 2 - st) / 0.6)) : easeInOutCubic(cl01(((p - 0.5) * 2 - st) / 0.6));
        return <div key={i} style={{ position: 'absolute', left: 0, top: i * 80, width: '100%', height: 81, background: ['#00E5FF', '#FF2E93', '#140A3C'][i % 3], transform: `translateX(${x * 115}%) skewX(-18deg)` }} />;
      })}
    </div>);
  const R = (1 - c) * 760;
  return wrap(
    <div style={full}>
      <div style={{ ...full, background: `radial-gradient(circle at 50% 50%,transparent ${R}px,#E10600 ${R + 1}px)` }} />
      {[0, 40].map(d => <div key={d} style={{ position: 'absolute', left: 640 - R - d, top: 360 - R - d, width: 2 * (R + d), height: 2 * (R + d), borderRadius: '50%', border: '3px dashed #F4EBD9', transform: `rotate(${p * 60}deg)` }} />)}
    </div>);
}

/* ═══ Écrans hors chanson, dans le même style ═══════════════════════════ */
const BRAND = ROUND_THEMES[3];   // salle d'attente et podium : couleurs de la marque (néon rose / cyan)

const Backdrop = ({ m, sun = 300, sunLeft, sunRight, sunTop = 120 }) => (
  <>
    <Sun m={m} size={sun} left={sunLeft} right={sunRight} top={sunTop} />
    <GridFloor m={m} top={470} height={400} />
  </>
);

const AVATARS = ['#FF2E93', '#00E5FF', '#FFC933', '#B14BFF', '#FF7A59'];

/* Logo « Music'Ose » dansant */
function DancingLogo({ m, size = 64 }) {
  const letters = "MUSIC'OSE".split('');
  return (
    <div aria-label="Music'Ose" style={{ font: `italic 800 ${size}px/1 ${TEKTUR}`, whiteSpace: 'nowrap', position: 'relative' }}>
      {letters.map((ch, i) => (
        <span key={i} className="ge-dance" style={{
          '--i': i, color: ch === "'" ? m.b : m.fg,
          textShadow: `${Math.max(3, Math.round(size / 25))}px ${Math.max(3, Math.round(size / 25))}px 0 ${m.a}, 0 0 18px ${m.a}88`,
        }}>{ch}</span>
      ))}
      {['♪', '♫', '♪'].map((n, i) => (
        <span key={i} className="ge-note" style={{ left: `${20 + i * 34}%`, top: -8, font: `800 ${size * 0.5}px ${TEKTUR}`, color: i === 1 ? m.b : m.a, '--d': `${i * 1.05}s` }}>{n}</span>
      ))}
    </div>
  );
}

/* ── Accueil (maquette « Transitions ») : salle d'attente et écran entre les manches ── */
const HOME = { ...BASE_THEME, gridA: BASE_THEME.grid, gridB: BASE_THEME.grid, panel: 'rgba(14,11,31,.88)', sunOp: 0.9 };
const homeBars = (n) => Array.from({ length: n }, (_, i) => ({ h: 100, dur: (1 + rnd(i + 3) * 0.8).toFixed(2), delay: (-rnd(i + 11) * 2).toFixed(2) }));

// Pastilles 01-04 : la prochaine manche est pleine et clignote
function RoundPills({ next, size = 'lg' }) {
  const lg = size === 'lg';
  return (
    <div style={{ display: 'flex', gap: lg ? 12 : 8 }}>
      {[1, 2, 3, 4].map(r => {
        const col = PILL_COLORS[r];
        const isNext = r === next;
        return (
          <div key={r} className={isNext ? 'ge-blink' : undefined} data-pill={r} data-next={isNext ? 'true' : 'false'} style={{
            padding: lg ? '10px 16px' : '4px 10px', border: `2px solid ${col}`, background: isNext ? col : 'transparent',
            color: isNext ? ROUND_THEMES[r].bg : HOME.fg, font: `500 ${lg ? 18 : 14}px ${MONO}`, letterSpacing: '.1em',
          }}>{pad2(r)}</div>
        );
      })}
    </div>
  );
}

/* Entre deux manches : retour à l'accueil, la prochaine manche clignote */
export function ScreenHome({ code, next }) {
  const m = HOME;
  return (
    <Stage m={m}>
      <Sun m={m} size={380} right={110} top={100} gradient={BASE_THEME.sun} />
      <GridFloor m={m} top={440} height={500} scroll />
      <Bar m={m} top><span>ACCUEIL</span><span>{brand(code)}</span></Bar>
      <div style={{ position: 'absolute', left: 70, top: 110, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="ge-lift" style={{ font: `500 22px ${MONO}`, letterSpacing: '.3em' }}>BLIND TEST LIVE</div>
        <DancingLogo m={m} size={150} />
        <div className="ge-lift" style={{ marginTop: 10, animationDelay: '.15s' }}><RoundPills next={next} /></div>
        {next && (
          <div className="ge-fade" style={{ font: `500 20px ${MONO}`, letterSpacing: '.2em', color: PILL_COLORS[next], animationDelay: '.5s' }}>
            PROCHAINE MANCHE · {ROUND_THEMES[next].label}
          </div>
        )}
      </div>
      <BarsRow bars={homeBars(28)} gap={6} colors={BASE_THEME.bars} />
      <JoinTile m={m} code={code} side="left" />
      <Bar m={m}><span>4 MANCHES</span><span>PRÊTS ?</span></Bar>
    </Stage>
  );
}

/* Salle d'attente : accueil + code très grand + QR code + joueurs connectés */
export function ScreenLobby({ code, players }) {
  const m = HOME;
  const url = code ? joinUrl(window.location.origin, window.location.pathname, code) : null;
  const shown = players.slice(0, MAX_PLAYERS);
  return (
    <Stage m={m}>
      <GridFloor m={m} top={470} height={400} scroll />
      <Bar m={m} top><span>SALLE OUVERTE</span><span>MUSIC'OSE</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 84 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.3em', marginBottom: 8 }}>BLIND TEST LIVE</div>
        <DancingLogo m={m} size={70} />
      </div>

      <div style={{ position: 'absolute', left: 48, top: 206 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.35em', color: m.a }}>CODE DE LA PARTIE</div>
        <div style={{ font: `800 150px/1 ${TEKTUR}`, color: m.b, letterSpacing: '.01em', marginTop: 6, textShadow: `0 0 30px ${m.b}66` }}>{code || '—'}</div>
        <div style={{ font: `500 22px/1.4 ${MONO}`, marginTop: 6 }}>Scanne le QR code, ou entre ce code sur ton téléphone.</div>
      </div>

      <div style={{ position: 'absolute', right: 48, top: 96, textAlign: 'center' }}>
        <div style={{ background: '#fff', padding: 10, boxShadow: `0 0 40px ${m.b}66`, border: `3px solid ${m.b}` }}>
          {url && <QrCode text={url} size={300} />}
        </div>
        <div style={{ font: `500 16px ${MONO}`, letterSpacing: '.3em', color: m.b, marginTop: 12 }}>SCANNE POUR REJOINDRE</div>
      </div>

      <div style={{ position: 'absolute', left: 48, right: 48, top: 474 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.25em', color: m.a }}>{players.length} / {MAX_PLAYERS} JOUEUR·SES</div>
          <RoundPills next={1} size="sm" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignContent: 'flex-start', overflow: 'hidden', maxHeight: 96 }}>
          {shown.map((pl, i) => (
            <div key={pl.pseudo + i} data-player={pl.pseudo} data-color={pl.color || ''} className="ge-pop" style={{ display: 'flex', alignItems: 'center', gap: 8, background: m.panel, padding: '3px 12px 3px 3px', border: `1px solid ${pl.color || BASE_THEME.bars[i % 4]}` }}>
              <div style={{
                width: 30, height: 30, background: pl.color || BASE_THEME.bars[i % 4], color: m.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 12px ${TEKTUR}`,
              }}>{(pl.pseudo || '?').slice(0, 2).toUpperCase()}</div>
              <span style={{ font: `500 15px ${MONO}`, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.pseudo}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 36, right: 36, bottom: 72, height: 44, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {homeBars(28).map((b, i) => (
          <div key={i} className="ge-bar" style={{ flex: 1, height: '100%', transformOrigin: 'bottom left', '--dur': `${b.dur}s`, '--delay': `${b.delay}s` }}>
            <div style={{ width: '100%', height: '100%', transformOrigin: 'bottom', background: BASE_THEME.bars[i % 4] }} />
          </div>
        ))}
      </div>

      <Bar m={m}><span>EN ATTENTE DU LANCEMENT PAR L'HÔTE</span><span>4 MANCHES · {TOTAL_SONGS} QUESTIONS</span></Bar>
    </Stage>
  );
}

/* Révélation de la réponse */
export function ScreenReveal({ round, info, code, progress }) {
  if (!info) return null;
  const m = ROUND_THEMES[round] || BRAND;
  const p = progress || progressForIndex(ROUND_CONFIG[round].start);
  const long = (info.title || '').length > 22;
  const stats = info.stats ? (round === 1
    ? [['JUSTE', info.stats.parfait, m.b], ['FAUX', info.stats.rate, m.a], ['SANS RÉPONSE', info.stats.sans, m.fg]]
    : [['PARFAIT', info.stats.parfait, m.b], ['BIEN', info.stats.bien, m.fg], ['RATÉ', info.stats.rate, m.a], ['SANS RÉPONSE', info.stats.sans, m.fg]]
  ).filter(([, v]) => v !== undefined) : [];

  return (
    <Stage m={m}>
      <Backdrop m={m} sun={300} sunLeft={560} sunTop={100} />
      <Bar m={m} top><span>{progressText(p)}</span><span>{brand(code)}</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 100, width: 860 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.3em', color: m.a }}>LA RÉPONSE ÉTAIT</div>
        <div style={{ font: `italic 800 ${long ? 56 : 84}px/.98 ${TEKTUR}`, textShadow: `5px 5px 0 ${m.a}`, marginTop: 18, wordBreak: 'break-word' }}>
          {(info.title || '').toUpperCase()}
        </div>
        <div style={{ font: `500 40px/1.1 ${TEKTUR}`, color: m.b, marginTop: 26 }}>{(info.artist || '').toUpperCase()}</div>
      </div>

      {info.options && (
        <div style={{ position: 'absolute', left: 48, top: 470, width: 860, display: 'flex', gap: 12 }}>
          {info.options.map((o, i) => {
            const mic = MIC_CHOICES[i];
            const right = i === info.correctIndex;
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', boxSizing: 'border-box',
                border: `2px solid ${right ? mic.color : 'rgba(255,255,255,.15)'}`, background: right ? 'rgba(255,255,255,.08)' : m.panel,
                boxShadow: right ? `0 0 18px ${mic.color}` : 'none', opacity: right ? 1 : 0.45,
              }}>
                <MicIcon color={mic.color} size={34} />
                <span style={{ font: `800 24px ${TEKTUR}`, color: mic.color }}>{mic.letter}</span>
                <span style={{ font: `500 22px ${MONO}` }}>{info.votes ? info.votes[i] : ''}</span>
                {right && <span style={{ marginLeft: 'auto', font: `800 22px ${TEKTUR}`, color: m.b }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {stats.length > 0 && (
        <Panel m={m} title="SUR CETTE CHANSON">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px 12px', alignItems: 'baseline' }}>
            {stats.map(([label, v, color]) => (
              <React.Fragment key={label}>
                <span style={{ font: `500 16px ${MONO}`, letterSpacing: '.1em' }}>{label}</span>
                <span style={{ font: `800 40px/1 ${TEKTUR}`, color }}>{v}</span>
              </React.Fragment>
            ))}
          </div>
        </Panel>
      )}

      <JoinTile m={m} code={code} side="right" />
      <Bar m={m}><span>{m.label}</span><span>{m.pts}</span></Bar>
    </Stage>
  );
}

/* Ligne de classement : glisse jusqu'à sa nouvelle place et compte ses points */
const ROW_STEP = 60;
function StandingRow({ m, pseudo, color: playerColor, from, to, prevScore, score, go, max }) {
  const [shown, setShown] = React.useState(prevScore);
  React.useEffect(() => {
    if (!go) { setShown(prevScore); return undefined; }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || prevScore === score) { setShown(score); return undefined; }
    let raf; const t0 = performance.now(); const dur = 1300;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      setShown(Math.round(prevScore + (score - prevScore) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, prevScore, score]);

  const pos = go ? to : from;
  const color = pos === 0 ? m.b : pos === 1 ? m.a : pos === 2 ? m.fg : 'rgba(255,255,255,.55)';
  const moved = from - to;   // > 0 : monte
  return (
    <div data-standing={pseudo} data-pos={pos} style={{
      position: 'absolute', left: 0, right: 0, top: pos * ROW_STEP, height: 52, boxSizing: 'border-box',
      display: 'grid', gridTemplateColumns: '64px 1fr 70px 150px', alignItems: 'center', padding: '0 18px',
      background: m.panel, borderLeft: `5px solid ${color}`, overflow: 'hidden',
      transition: 'top 1.3s cubic-bezier(.3,.8,.2,1)', opacity: from >= 8 && !go ? 0 : 1,
    }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${(shown / max) * 100}%`, background: color, opacity: .8 }} />
      <span style={{ font: `800 32px ${TEKTUR}`, color }}>{pos + 1}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {playerColor && <span style={{ width: 18, height: 18, flex: '0 0 auto', background: playerColor }} />}
        <span style={{ font: `500 28px ${TEKTUR}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pseudo}</span>
      </span>
      <span style={{ font: `800 20px ${TEKTUR}`, color: moved > 0 ? m.b : m.a, opacity: go && moved !== 0 ? 1 : 0, transition: 'opacity .4s ease .9s' }}>
        {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : ''}
      </span>
      <span style={{ font: `500 26px ${MONO}`, textAlign: 'right', color: pos < 3 ? m.b : m.fg }}>{shown.toLocaleString('fr-FR')} PTS</span>
    </div>
  );
}

/* Classement intermédiaire : les joueurs glissent de leur ancienne à leur nouvelle place */
export function ScreenStandings({ round, ranking, prevRanking, code }) {
  const m = ROUND_THEMES[round] || BRAND;
  const rows = ranking.slice(0, 8);
  const prev = prevRanking || [];
  const max = Math.max(1, ...ranking.map(r => r.score || 0));
  const [go, setGo] = React.useState(false);
  React.useEffect(() => {
    setGo(false);
    const t = setTimeout(() => setGo(true), 1100);   // le temps de lire l'ancien classement
    return () => clearTimeout(t);
  }, [ranking]);

  const prevIndexOf = (pseudo, fallback) => {
    const i = prev.findIndex(r => r.pseudo === pseudo);
    return i === -1 ? fallback : i;
  };
  const done = ROUND_CONFIG[round].end + 1;

  return (
    <Stage m={m}>
      <Backdrop m={m} sun={300} sunRight={50} sunTop={130} />
      <Bar m={m} top><span>APRÈS LA MANCHE {pad2(round)} · {pad2(done)}/{TOTAL_SONGS} QUESTIONS JOUÉES</span><span>{brand(code)}</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 84, font: `italic 800 56px/.95 ${TEKTUR}`, textShadow: `4px 4px 0 ${m.a}` }}>CLASSEMENT</div>

      <div style={{ position: 'absolute', left: 48, right: 400, top: 168, height: 8 * ROW_STEP }}>
        {rows.length === 0 && <div style={{ font: `500 22px ${MONO}` }}>—</div>}
        {rows.map((r, i) => {
          const pi = prevIndexOf(r.pseudo, ranking.length + i);
          const pr = prev.find(x => x.pseudo === r.pseudo);
          return <StandingRow key={r.pseudo} m={m} pseudo={r.pseudo} color={r.color} from={pi} to={i} prevScore={pr ? (pr.score || 0) : 0} score={r.score || 0} go={go} max={max} />;
        })}
      </div>

      <JoinTile m={m} code={code} side="right" />
      <Bar m={m}><span>{m.label}</span><span>{ranking.length} JOUEUR·SES</span></Bar>
    </Stage>
  );
}

/* Podium final : les marches apparaissent dans l'ordre 3e, 2e puis 1er */
export const PODIUM_DELAYS = { 3: 0.5, 2: 1.9, 1: 3.4 };   // secondes

export function ScreenPodium({ ranking, code }) {
  const m = BRAND;
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3, 8);
  const steps = [
    { p: top3[1], rank: 2, h: 200, bg: m.b, fg: m.bg },
    { p: top3[0], rank: 1, h: 280, bg: m.a, fg: '#fff' },
    { p: top3[2], rank: 3, h: 140, bg: m.fg, fg: m.bg },
  ];
  return (
    <Stage m={m}>
      <Backdrop m={m} sun={380} sunLeft={450} sunTop={70} />
      <Bar m={m} top><span>FIN DE PARTIE · {TOTAL_SONGS}/{TOTAL_SONGS} QUESTIONS</span><span>{brand(code)}</span></Bar>

      <div className="ge-fade" style={{ position: 'absolute', left: 0, right: 0, top: 80, textAlign: 'center', font: `italic 800 84px/.95 ${TEKTUR}`, textShadow: `5px 5px 0 ${m.a}` }}>PODIUM</div>

      <div style={{ position: 'absolute', left: 48, width: 760, bottom: 84, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
        {steps.map(({ p, rank, h, bg, fg }) => (
          <div key={rank} className="ge-rise" data-podium-rank={rank} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0,
            animationDelay: `${PODIUM_DELAYS[rank]}s`, animationDuration: rank === 1 ? '1.2s' : '.9s',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              {p && p.color && <div style={{ width: rank === 1 ? 34 : 28, height: rank === 1 ? 34 : 28, background: p.color, margin: '0 auto 6px', boxShadow: `0 0 14px ${p.color}` }} />}
              <div style={{ font: `800 ${rank === 1 ? 32 : 26}px/1.05 ${TEKTUR}`, wordBreak: 'break-word' }}>{p ? p.pseudo : '—'}</div>
              <div style={{ font: `500 18px ${MONO}`, color: m.b, marginTop: 4 }}>{p ? `${(p.score || 0).toLocaleString('fr-FR')} PTS` : ''}</div>
            </div>
            <div style={{ height: h, background: bg, color: fg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 10, boxShadow: `0 0 ${rank === 1 ? 40 : 24}px ${bg}88` }}>
              <span style={{ font: `800 ${rank === 1 ? 110 : 84}px/.9 ${TEKTUR}` }}>{rank}</span>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="ge-fade" style={{ animationDelay: '4.6s' }}>
          <Panel m={m} title="SUIVANTS">
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: '8px 10px', font: `500 20px ${MONO}` }}>
              {rest.map((r, i) => (
                <React.Fragment key={r.pseudo + i}>
                  <span style={{ color: m.b }}>{i + 4}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pseudo}</span>
                  <span>{r.score || 0}</span>
                </React.Fragment>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <JoinTile m={m} code={code} side="right" />
      <Bar m={m}><span>MERCI D'AVOIR JOUÉ</span><span>{ranking.length} JOUEUR·SES</span></Bar>
    </Stage>
  );
}
