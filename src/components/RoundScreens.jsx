import React from "react";
import { MIC_CHOICES } from "../gameLogic";
import { ROUND_THEMES, roundSeconds, buildBars, rnd, formatSeconds } from "../roundThemes";
import MicIcon from "./MicIcon";
import "../styles/grandEcran.css";

// Maquettes Claude Design v2 : scène de 1280×720 px, affichée à l'échelle 1,5 dans le décor 1920×1080 du grand écran.
const SUN_MASK = 'linear-gradient(#000 0 50%,transparent 50% 56%,#000 56% 66%,transparent 66% 72%,#000 72% 80%,transparent 80% 86%,#000 86%)';
const TEKTUR = "'Tektur', 'Impact', sans-serif";
const MONO = "'DM Mono', ui-monospace, monospace";

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

function OptionsPanel({ m, options }) {
  return (
    <Panel m={m} title="CHOISIS TON MICRO" width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {options.map((o, i) => {
          const mic = MIC_CHOICES[i];
          return (
            <div key={i} style={{
              height: 150, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px',
              border: `2px solid ${mic.color}`, background: 'rgba(0,0,0,.28)', boxShadow: `0 0 14px ${mic.color}55`,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                <MicIcon color={mic.color} size={56} />
                <span style={{ font: `800 26px ${TEKTUR}`, color: mic.color }}>{mic.letter}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `500 22px/1.1 ${TEKTUR}`, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.title}</div>
                <div style={{ font: `400 15px ${MONO}`, color: mic.color, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.artist}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ── Manche en cours ──────────────────────────────────────── */
export function ScreenRound({ round, remaining, answers, players, songNumber, totalInRound, options, theme, musicCut, fastestList }) {
  const m = ROUND_THEMES[round];
  const cd = String(Math.max(0, Math.ceil(remaining))).padStart(2, '0');
  const aliveList = players.map(p => p.alive !== false);
  const bars = buildBars(round, aliveList);

  return (
    <Stage m={m}>
      <Sun m={m} size={300} left={560} top={120} />
      <GridFloor m={m} top={390} height={500} />
      <div style={{
        position: 'absolute', left: 0, top: 120, width: 520, height: 240,
        background: `repeating-linear-gradient(180deg,transparent 0 22px,${m.gridA} 22px 24px)`,
        WebkitMask: 'linear-gradient(90deg,transparent,#000)', mask: 'linear-gradient(90deg,transparent,#000)',
      }} />

      <Bar m={m} top>
        <span>MANCHE {String(round).padStart(2, '0')} · CHANSON {songNumber}/{totalInRound}</span>
        <span>MUSIC'OSE</span>
      </Bar>

      <div style={{ position: 'absolute', left: 48, top: 90, font: `800 64px/.95 ${TEKTUR}`, fontStyle: 'italic', textShadow: `4px 4px 0 ${m.a}`, whiteSpace: 'nowrap' }}>
        {m.t1}<br />{m.t2}
      </div>

      <div style={{ position: 'absolute', left: 48, top: 285, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <span style={{ font: `800 120px/.8 ${TEKTUR}`, color: m.b }}>{cd}</span>
        <span style={{ font: `500 18px ${MONO}`, paddingBottom: 6 }}>S · {answers.count}/{answers.total} RÉPONSES</span>
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

      {round === 1 && options
        ? <OptionsPanel m={m} options={options} />
        : round === 3 ? <FastestPanel m={m} list={fastestList} />
        : round === 4 ? <ArenaPanel m={m} aliveList={aliveList.length ? aliveList : [true]} />
        : <RankPanel m={m} title={round === 2 ? 'EN TÊTE' : 'CLASSEMENT'} players={players} />}

      <div style={{
        position: 'absolute', left: 36, right: 36, bottom: 72, height: 150, display: 'flex', justifyContent: 'center',
        gap: m.bars.gap, alignItems: 'flex-end', WebkitBoxReflect: 'below 4px linear-gradient(transparent 40%,rgba(255,255,255,.3))',
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
export function ScreenTransition({ round }) {
  const m = ROUND_THEMES[round];
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
        <span>MANCHE</span>
        <span>MUSIC'OSE</span>
      </Bar>
      <div style={{ position: 'absolute', left: 70, top: 100, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ font: `800 180px/.8 ${TEKTUR}`, color: m.b, fontStyle: 'italic' }}>{String(round).padStart(2, '0')}</div>
        <div style={{ font: `800 110px/.9 ${TEKTUR}`, fontStyle: 'italic', textShadow: `6px 6px 0 ${m.a}`, whiteSpace: 'nowrap' }}>{m.t1}<br />{m.t2}</div>
        <div style={{ font: `500 28px/1.5 ${MONO}`, background: m.bg, padding: '4px 0', maxWidth: 760 }}>{m.rule}</div>
      </div>
      <Bar m={m}>
        <span>{roundSeconds(round)} S</span>
        <span>{m.pts}</span>
      </Bar>
    </Stage>
  );
}
