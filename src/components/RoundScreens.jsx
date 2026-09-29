import React from "react";
import { MIC_CHOICES, MAX_PLAYERS, joinUrl, progressForIndex, ROUND_CONFIG, TOTAL_SONGS } from "../gameLogic";
import { ROUND_THEMES, roundSeconds, buildBars, rnd, formatSeconds } from "../roundThemes";
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

function Stage({ m, children }) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, width: 1280, height: 720, overflow: 'hidden',
      transform: 'scale(1.5)', transformOrigin: '0 0',
      background: m.bg, color: m.fg, fontFamily: MONO,
    }}>
      {children}
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

const Sun = ({ m, size, left, right, top }) => (
  <div style={{
    position: 'absolute', left, right, top, width: size, height: size, borderRadius: '50%',
    background: `linear-gradient(${m.a},${m.b})`, WebkitMask: SUN_MASK, mask: SUN_MASK, opacity: m.sunOp,
  }} />
);

const GridFloor = ({ m, top, height }) => (
  <div style={{
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
export function ScreenRound({ code, round, remaining, answers, players, progress, options, theme, musicCut, fastestList }) {
  const m = ROUND_THEMES[round];
  const p = progress || progressForIndex(ROUND_CONFIG[round].start);
  const cd = String(Math.max(0, Math.ceil(remaining))).padStart(2, '0');
  const aliveList = players.map(pl => pl.alive !== false);
  const bars = buildBars(round, aliveList);
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

      <div style={{ position: 'absolute', left: quiz ? 36 : 48, top: quiz ? 186 : 285, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', width: quiz ? 290 : 'auto' }}>
        <span style={{ font: `800 ${quiz ? 104 : 120}px/.8 ${TEKTUR}`, color: m.b }}>{cd}</span>
        <span style={{ font: `500 ${quiz ? 16 : 18}px ${MONO}`, paddingBottom: 6 }}>S · {answers.count}/{answers.total} RÉPONSES</span>
      </div>

      {/* Numéro de question toujours bien visible */}
      <div style={{ position: 'absolute', left: quiz ? 36 : 'auto', right: quiz ? 'auto' : 380, top: quiz ? 330 : 300, textAlign: quiz ? 'left' : 'right' }}>
        <div style={{ font: `500 14px ${MONO}`, letterSpacing: '.3em', color: m.a }}>QUESTION</div>
        <div style={{ font: `800 ${quiz ? 54 : 46}px/1 ${TEKTUR}`, color: m.fg }}>
          {pad2(p.number)}<span style={{ color: m.b }}>/{p.size}</span>
        </div>
        <div style={{ font: `500 14px ${MONO}`, opacity: .8, marginTop: 2 }}>{pad2(p.global)} / {p.total} AU TOTAL</div>
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
        {bars.map((b, i) => (
          <div key={i} className={b.dead ? 'ge-bar ge-bar--dead' : 'ge-bar'} style={{
            flex: 1, height: `${b.h}%`, opacity: b.dead ? 0.35 : 1, transformOrigin: 'bottom left', transition: 'transform .8s, opacity .8s',
            transform: b.dead ? 'translateY(70px) rotate(8deg) scaleY(.2)' : 'none',
            '--dur': `${b.dur}s`, '--delay': `${b.delay}s`,
          }}>
            <div style={{ width: '100%', height: '100%', transformOrigin: 'bottom', background: b.dead ? '#3a3a3a' : m.bars.fill, boxShadow: `0 0 12px ${b.dead ? 'transparent' : m.bars.glow}` }} />
          </div>
        ))}
      </div>

      <Bar m={m}>
        <span>{roundSeconds(round)} S</span>
        <span>{m.pts}</span>
      </Bar>
    </Stage>
  );
}

/* ── Transition : annonce de la manche ────────────────────── */
export function ScreenTransition({ round, code }) {
  const m = ROUND_THEMES[round];
  const size = ROUND_CONFIG[round].end - ROUND_CONFIG[round].start + 1;
  return (
    <Stage m={m}>
      <Sun m={m} size={420} right={80} top={110} />
      <GridFloor m={m} top={470} height={400} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(180deg,transparent 0 30px,${m.gridB} 30px 32px)`,
        WebkitMask: 'linear-gradient(90deg,#000,transparent 60%)', mask: 'linear-gradient(90deg,#000,transparent 60%)',
      }} />
      <Bar m={m} top>
        <span>MANCHE {pad2(round)} · {size} QUESTIONS · {pad2(ROUND_CONFIG[round].start + 1)} → {pad2(ROUND_CONFIG[round].end + 1)} / {TOTAL_SONGS}</span>
        <span>{brand(code)}</span>
      </Bar>
      <div style={{ position: 'absolute', left: 70, top: 100, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ font: `italic 800 180px/.8 ${TEKTUR}`, color: m.b }}>{pad2(round)}</div>
        <div style={{ font: `italic 800 110px/.9 ${TEKTUR}`, textShadow: `6px 6px 0 ${m.a}`, whiteSpace: 'nowrap' }}>{m.t1}<br />{m.t2}</div>
        <div style={{ font: `500 28px/1.5 ${MONO}`, background: m.bg, padding: '4px 0', maxWidth: 760 }}>{m.rule}</div>
      </div>
      <JoinTile m={m} code={code} side="right" />
      <Bar m={m}>
        <span>{roundSeconds(round)} S</span>
        <span>{m.pts}</span>
      </Bar>
    </Stage>
  );
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
          '--i': i, color: ch === "'" ? m.b : i % 2 ? m.fg : m.b,
          textShadow: `3px 3px 0 ${m.a}, 0 0 18px ${m.a}88`,
        }}>{ch}</span>
      ))}
      {['♪', '♫', '♪'].map((n, i) => (
        <span key={i} className="ge-note" style={{ left: `${20 + i * 34}%`, top: -8, font: `800 ${size * 0.5}px ${TEKTUR}`, color: i === 1 ? m.b : m.a, '--d': `${i * 1.05}s` }}>{n}</span>
      ))}
    </div>
  );
}

/* Salle d'attente : code très grand + QR code + logo dansant */
export function ScreenLobby({ code, players }) {
  const m = BRAND;
  const url = code ? joinUrl(window.location.origin, window.location.pathname, code) : null;
  const shown = players.slice(0, MAX_PLAYERS);
  return (
    <Stage m={m}>
      <GridFloor m={m} top={470} height={400} />
      <Bar m={m} top><span>SALLE OUVERTE</span><span>MUSIC'OSE</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 92 }}><DancingLogo m={m} size={62} /></div>

      <div style={{ position: 'absolute', left: 48, top: 190 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.35em', color: m.a }}>CODE DE LA PARTIE</div>
        <div style={{ font: `800 150px/1 ${TEKTUR}`, color: m.b, letterSpacing: '.01em', marginTop: 6, textShadow: `0 0 30px ${m.b}66` }}>{code || '—'}</div>
        <div style={{ font: `500 22px/1.4 ${MONO}`, marginTop: 8 }}>Scanne le QR code, ou entre ce code sur ton téléphone.</div>
      </div>

      <div style={{ position: 'absolute', right: 48, top: 96, textAlign: 'center' }}>
        <div style={{ background: '#fff', padding: 10, boxShadow: `0 0 40px ${m.b}66`, border: `3px solid ${m.b}` }}>
          {url && <QrCode text={url} size={300} />}
        </div>
        <div style={{ font: `500 16px ${MONO}`, letterSpacing: '.3em', color: m.b, marginTop: 12 }}>SCANNE POUR REJOINDRE</div>
      </div>

      <div style={{ position: 'absolute', left: 48, right: 48, top: 452, bottom: 78 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.25em', color: m.a, marginBottom: 12 }}>{players.length} / {MAX_PLAYERS} JOUEUR·SES</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignContent: 'flex-start', overflow: 'hidden', maxHeight: 118 }}>
          {shown.map((pl, i) => (
            <div key={pl.pseudo + i} className="ge-pop" style={{ display: 'flex', alignItems: 'center', gap: 8, background: m.panel, padding: '4px 12px 4px 4px', border: `1px solid ${AVATARS[i % AVATARS.length]}` }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', background: AVATARS[i % AVATARS.length], color: m.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', font: `800 13px ${TEKTUR}`,
              }}>{(pl.pseudo || '?').slice(0, 2).toUpperCase()}</div>
              <span style={{ font: `500 16px ${MONO}`, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.pseudo}</span>
            </div>
          ))}
        </div>
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
function StandingRow({ m, pseudo, from, to, prevScore, score, go, max }) {
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
      <span style={{ font: `500 28px ${TEKTUR}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pseudo}</span>
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
          return <StandingRow key={r.pseudo} m={m} pseudo={r.pseudo} from={pi} to={i} prevScore={pr ? (pr.score || 0) : 0} score={r.score || 0} go={go} max={max} />;
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
