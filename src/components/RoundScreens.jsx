import React from "react";
import { MIC_CHOICES } from "../gameLogic";
import { ROUND_THEMES, roundSeconds, buildBars, rnd, formatSeconds } from "../roundThemes";
import { MAX_PLAYERS } from "../gameLogic";
import MicIcon from "./MicIcon";
import "../styles/grandEcran.css";

// Maquettes Claude Design v2 : scène de 1280×720 px, affichée à l'échelle 1,5 dans le décor 1920×1080 du grand écran.
const SUN_MASK = 'linear-gradient(#000 0 50%,transparent 50% 56%,#000 56% 66%,transparent 66% 72%,#000 72% 80%,transparent 80% 86%,#000 86%)';
const brand = (code) => (code ? `MUSIC'OSE · ${code}` : "MUSIC'OSE");
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
export function ScreenRound({ code, round, remaining, answers, players, songNumber, totalInRound, options, theme, musicCut, fastestList }) {
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
        <span>{brand(code)}</span>
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
export function ScreenTransition({ round, code }) {
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
        <span>{brand(code)}</span>
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


/* ═══ Écrans hors chanson, dans le même style ═══════════════════════════ */
const BRAND = ROUND_THEMES[3];   // salle d'attente et podium : couleurs de la marque (néon rose / cyan)
const pad2 = (n) => String(n).padStart(2, '0');

const Backdrop = ({ m, sun = 300, sunLeft, sunRight, sunTop = 120 }) => (
  <>
    <Sun m={m} size={sun} left={sunLeft} right={sunRight} top={sunTop} />
    <GridFloor m={m} top={470} height={400} />
  </>
);

const AVATARS = ['#FF2E93', '#00E5FF', '#FFC933', '#B14BFF', '#FF7A59'];

/* Salle d'attente */
export function ScreenLobby({ code, players }) {
  const m = BRAND;
  return (
    <Stage m={m}>
      <Backdrop m={m} sun={380} sunRight={90} sunTop={110} />
      <Bar m={m} top><span>SALLE OUVERTE</span><span>MUSIC'OSE</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 92 }}>
        <div style={{ font: `800 60px/.95 ${TEKTUR}`, fontStyle: 'italic', textShadow: `4px 4px 0 ${m.a}` }}>MUSIC'OSE</div>
        <div style={{ font: `500 16px ${MONO}`, letterSpacing: '.3em', color: m.a, marginTop: 34 }}>CODE DE LA PARTIE</div>
        <div style={{ font: `800 112px/1 ${TEKTUR}`, color: m.b, letterSpacing: '.02em', marginTop: 8 }}>{code || '—'}</div>
        <div style={{ font: `500 24px/1.5 ${MONO}`, background: m.bg, marginTop: 10, maxWidth: 520 }}>
          Entre le code <b style={{ color: m.b }}>{code || '—'}</b> sur ton téléphone pour rejoindre.
        </div>
      </div>

      <Panel m={m} title="JOUEUR·SES" width={460}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <span style={{ font: `800 64px/.9 ${TEKTUR}` }}>{players.length}</span>
          <span style={{ font: `500 18px ${MONO}`, color: m.b }}>/ {MAX_PLAYERS}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 8px', maxHeight: 330, overflow: 'hidden' }}>
          {players.slice(0, 20).map((p, i) => (
            <div key={p.pseudo + i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: `radial-gradient(circle at 30% 25%, ${AVATARS[i % AVATARS.length]}, rgba(0,0,0,.35))`,
                border: `2px solid ${AVATARS[i % AVATARS.length]}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: `800 16px ${TEKTUR}`, color: m.bg,
              }}>{(p.pseudo || '?').slice(0, 2).toUpperCase()}</div>
              <div style={{ font: `400 13px ${MONO}`, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pseudo}</div>
            </div>
          ))}
        </div>
        {players.length > 20 && <div style={{ font: `500 14px ${MONO}`, color: m.b }}>+ {players.length - 20} AUTRES</div>}
      </Panel>

      <Bar m={m}><span>EN ATTENTE DU LANCEMENT PAR L'HÔTE</span><span>4 MANCHES</span></Bar>
    </Stage>
  );
}

/* Révélation de la réponse */
export function ScreenReveal({ round, info, code }) {
  if (!info) return null;
  const m = ROUND_THEMES[round] || BRAND;
  const long = (info.title || '').length > 22;
  const stats = info.stats ? (round === 1
    ? [['JUSTE', info.stats.parfait, m.b], ['FAUX', info.stats.rate, m.a], ['SANS RÉPONSE', info.stats.sans, m.fg]]
    : [['PARFAIT', info.stats.parfait, m.b], ['BIEN', info.stats.bien, m.fg], ['RATÉ', info.stats.rate, m.a], ['SANS RÉPONSE', info.stats.sans, m.fg]]
  ).filter(([, v]) => v !== undefined) : [];

  return (
    <Stage m={m}>
      <Backdrop m={m} sun={300} sunLeft={560} sunTop={100} />
      <Bar m={m} top><span>MANCHE {pad2(round)} · LA RÉPONSE</span><span>{brand(code)}</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 100, width: 860 }}>
        <div style={{ font: `500 18px ${MONO}`, letterSpacing: '.3em', color: m.a }}>LA RÉPONSE ÉTAIT</div>
        <div style={{ font: `800 ${long ? 56 : 84}px/.98 ${TEKTUR}`, fontStyle: 'italic', textShadow: `5px 5px 0 ${m.a}`, marginTop: 18, wordBreak: 'break-word' }}>
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

      <Bar m={m}><span>{m.label}</span><span>{m.pts}</span></Bar>
    </Stage>
  );
}

/* Classement intermédiaire */
export function ScreenStandings({ round, ranking, code }) {
  const m = ROUND_THEMES[round] || BRAND;
  const rows = ranking.slice(0, 8);
  const max = Math.max(1, ...rows.map(r => r.score || 0));
  const rankColor = (i) => (i === 0 ? m.b : i === 1 ? m.a : i === 2 ? m.fg : 'rgba(255,255,255,.55)');
  return (
    <Stage m={m}>
      <Backdrop m={m} sun={300} sunRight={50} sunTop={130} />
      <Bar m={m} top><span>APRÈS LA MANCHE {pad2(round)}</span><span>{brand(code)}</span></Bar>

      <div style={{ position: 'absolute', left: 48, top: 84, font: `800 56px/.95 ${TEKTUR}`, fontStyle: 'italic', textShadow: `4px 4px 0 ${m.a}` }}>CLASSEMENT</div>

      <div style={{ position: 'absolute', left: 48, right: 400, top: 168, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.length === 0 && <div style={{ font: `500 22px ${MONO}` }}>—</div>}
        {rows.map((r, i) => (
          <div key={r.pseudo + i} style={{
            position: 'relative', display: 'grid', gridTemplateColumns: '64px 1fr 150px', alignItems: 'center', height: 52, padding: '0 18px',
            background: m.panel, borderLeft: `5px solid ${rankColor(i)}`, overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${((r.score || 0) / max) * 100}%`, background: rankColor(i), opacity: .8 }} />
            <span style={{ font: `800 32px ${TEKTUR}`, color: rankColor(i) }}>{i + 1}</span>
            <span style={{ font: `500 28px ${TEKTUR}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pseudo}</span>
            <span style={{ font: `500 26px ${MONO}`, textAlign: 'right', color: i < 3 ? m.b : m.fg }}>{(r.score || 0).toLocaleString('fr-FR')} PTS</span>
          </div>
        ))}
      </div>

      <Bar m={m}><span>{m.label}</span><span>{ranking.length} JOUEUR·SES</span></Bar>
    </Stage>
  );
}

/* Podium final */
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
      <Bar m={m} top><span>FIN DE PARTIE</span><span>{brand(code)}</span></Bar>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 80, textAlign: 'center', font: `800 84px/.95 ${TEKTUR}`, fontStyle: 'italic', textShadow: `5px 5px 0 ${m.a}` }}>PODIUM</div>

      <div style={{ position: 'absolute', left: 48, width: 760, bottom: 84, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 16 }}>
        {steps.map(({ p, rank, h, bg, fg }) => (
          <div key={rank} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ font: `800 ${rank === 1 ? 32 : 26}px/1.05 ${TEKTUR}`, wordBreak: 'break-word' }}>{p ? p.pseudo : '—'}</div>
              <div style={{ font: `500 18px ${MONO}`, color: m.b, marginTop: 4 }}>{p ? `${(p.score || 0).toLocaleString('fr-FR')} PTS` : ''}</div>
            </div>
            <div style={{ height: h, background: bg, color: fg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 10, boxShadow: `0 0 24px ${bg}66` }}>
              <span style={{ font: `800 ${rank === 1 ? 110 : 84}px/.9 ${TEKTUR}` }}>{rank}</span>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
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
      )}

      <Bar m={m}><span>MERCI D'AVOIR JOUÉ</span><span>{ranking.length} JOUEUR·SES</span></Bar>
    </Stage>
  );
}
