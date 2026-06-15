import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Chip, Eq, Stars, GridFloor, Panel, Vinyl, Avatar } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import "./styles/tokens.css";

const AVATAR_COLORS = [
  'var(--mo-magenta)',
  'var(--mo-cyan)',
  'var(--mo-gold)',
  'var(--mo-violet)',
  '#ff7a59',
];

const KVDB_BASE = "https://kvdb.io/GVkYCf2Kfn44jq3EYGweRj/";

const resolveShortCode = async (shortCode) => {
  try {
    const res = await fetch(`${KVDB_BASE}${encodeURIComponent(shortCode)}`);
    if (!res.ok) throw new Error("Code introuvable");
    return res.text().then(text => text.trim());
  } catch (e) {
    return null;
  }
};

export default function GrandEcran() {
  const [status, setStatus] = useState("connecting"); // connecting | connected | error
  const [phase, setPhase] = useState("lobby");
  const [shortCode, setShortCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundName, setRoundName] = useState("");
  const [songNumber, setSongNumber] = useState(1);
  const [totalInRound, setTotalInRound] = useState(1);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answers, setAnswers] = useState({ count: 0, total: 0 });
  const [revealInfo, setRevealInfo] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [rankingRound, setRankingRound] = useState(1);
  const [scale, setScale] = useState(1);

  const stageRef = useRef(null);

  // --- Scale 1920×1080 stage to fit viewport ---
  useEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const s = Math.min(el.clientWidth / 1920, el.clientHeight / 1080);
      setScale(s);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // --- Connect to host as a spectator ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setStatus("error");
      return;
    }
    setShortCode(code.toUpperCase());

    const peer = new Peer(undefined, peerConfig);

    peer.on("open", async () => {
      let realHostId = code;
      if (code.toUpperCase().startsWith("OSE-")) {
        const resolved = await resolveShortCode(code.toUpperCase());
        if (!resolved) {
          setStatus("error");
          return;
        }
        realHostId = resolved;
      }

      const connection = peer.connect(realHostId);

      connection.on("open", () => {
        connection.send({ type: "newGrandEcran" });
        setStatus("connected");
      });

      connection.on("data", (data) => {
        switch (data.type) {
          case "lobbyState":
            if (data.shortCode) setShortCode(data.shortCode);
            setPlayers(data.players || []);
            break;
          case "startTimer":
            setPhase("playing");
            setRevealInfo(null);
            if (typeof data.round === "number") setCurrentRound(data.round);
            if (data.roundName) setRoundName(data.roundName);
            if (typeof data.songNumber === "number") setSongNumber(data.songNumber);
            if (typeof data.totalInRound === "number") setTotalInRound(data.totalInRound);
            setTotalSeconds(data.seconds);
            setSecondsLeft(data.seconds);
            setAnswers({ count: 0, total: data.totalPlayers || 0 });
            break;
          case "answersUpdate":
            setAnswers({ count: data.count, total: data.total });
            break;
          case "revealAnswer":
            setPhase("reveal");
            setRevealInfo({ title: data.title || "", artist: data.artist || "", stats: data.stats || null });
            break;
          case "showRanking":
            setPhase("standings");
            setRanking(data.ranking || []);
            if (typeof data.round === "number") setRankingRound(data.round);
            break;
          case "showFinalRanking":
            setPhase("podium");
            setRanking(data.ranking || []);
            break;
          default:
            break;
        }
      });

      connection.on("error", () => setStatus("error"));
    });

    peer.on("error", () => setStatus("error"));

    return () => { peer.destroy(); };
  }, []);

  // --- Local countdown during "playing" ---
  useEffect(() => {
    if (phase !== "playing" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  if (status === "error") {
    return (
      <div className="mo-app" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <Stars />
        <div className="mo-display mo-neon" style={{ fontSize: 40, color: 'var(--mo-magenta)', position: 'relative', zIndex: 1 }}>
          CONNEXION IMPOSSIBLE
        </div>
        <p style={{ color: 'var(--mo-ink-dim)', fontFamily: 'var(--mo-font-mono)', fontSize: 13, position: 'relative', zIndex: 1 }}>
          Ouvre cet écran depuis le bouton "GRAND ÉCRAN" côté régie.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', display: 'flex' }}>
      <div ref={stageRef} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div className="mo-app" style={{
          width: 1920, height: 1080, flex: '0 0 auto',
          transform: `scale(${scale})`, transformOrigin: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <Stars />
          {(phase === 'lobby' || phase === 'standings' || phase === 'podium') && <GridFloor />}

          {/* Top status bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 18, letterSpacing: '0.3em', color: 'var(--mo-ink-dim)' }}>GRAND ÉCRAN</span>
            </div>
            {shortCode && (
              <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 18, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
                {shortCode} · {players.length} JOUEUR·SES
              </span>
            )}
          </div>

          <div style={{ position: 'absolute', inset: 0 }}>
            {phase === 'lobby' && <ScreenLobby shortCode={shortCode} players={players} />}
            {phase === 'playing' && (
              <ScreenPlaying
                remaining={secondsLeft}
                total={totalSeconds}
                roundName={roundName}
                currentRound={currentRound}
                songNumber={songNumber}
                totalInRound={totalInRound}
                answers={answers}
              />
            )}
            {phase === 'reveal' && <ScreenReveal info={revealInfo} />}
            {phase === 'standings' && <ScreenStandings ranking={ranking} round={rankingRound} />}
            {phase === 'podium' && <ScreenPodium ranking={ranking} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   ÉTAT 1 — SALLE D'ATTENTE
   ===================================================================== */
function ScreenLobby({ shortCode, players }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '90px 100px', boxSizing: 'border-box' }}>
      {/* LEFT — join info */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span className="mo-display mo-neon" style={{ fontSize: 52, color: 'var(--mo-magenta)' }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </span>
          <Chip live style={{ fontSize: 18, padding: '10px 18px' }}>SALLE OUVERTE</Chip>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 24, letterSpacing: '0.4em', color: 'var(--mo-cyan)' }}>CODE DE LA PARTIE</div>
          <div className="mo-display mo-neon" style={{ fontSize: 180, color: 'var(--mo-gold)', lineHeight: 1, marginTop: 10, letterSpacing: '0.04em' }}>
            {shortCode || '—'}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 22, color: 'var(--mo-ink-dim)', letterSpacing: '0.15em' }}>REJOINS SUR</div>
          <div style={{ fontSize: 24, color: 'var(--mo-ink-dim)', marginTop: 12 }}>
            Entre le code {shortCode || '—'} pour rejoindre ✦
          </div>
        </div>
      </div>

      {/* RIGHT — players joining */}
      <div className="mo-panel" style={{ padding: 44, display: 'flex', flexDirection: 'column', margin: '10px 0 10px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 22, letterSpacing: '0.3em', color: 'var(--mo-ink-dim)' }}>JOUEUR·SES</div>
            <div className="mo-display mo-neon" style={{ fontSize: 88, color: 'var(--mo-magenta)', lineHeight: 1, marginTop: 4 }}>
              {players.length} <span style={{ fontSize: 36, color: 'var(--mo-ink-dim)' }}>/ 30</span>
            </div>
          </div>
          <div style={{ transform: 'scale(2)', transformOrigin: 'right center' }}>
            <Eq count={10} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, alignContent: 'start', overflow: 'hidden' }}>
          {players.map((p, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <div key={p.pseudo + i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ transform: 'scale(2)' }}>
                  <Avatar initials={(p.pseudo || '?').slice(0, 2).toUpperCase()} color={color} size={44} />
                </div>
                <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 18, color: 'var(--mo-ink)', letterSpacing: '0.06em', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 14 }}>
                  {p.pseudo}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--mo-line)' }}>
          <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 22, letterSpacing: '0.3em', color: 'var(--mo-ink-dim)' }}>
            ⟡ EN ATTENTE DU LANCEMENT PAR L'HÔTE ⟡
          </span>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   ÉTAT 2 — MANCHE EN COURS
   ===================================================================== */
function ScreenPlaying({ remaining, total, roundName, currentRound, songNumber, totalInRound, answers }) {
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const R = 300, C = 2 * Math.PI * R;
  const ringColor = frac > 0.5 ? 'var(--mo-cyan)' : frac > 0.2 ? 'var(--mo-magenta)' : 'var(--mo-gold)';
  const low = frac <= 0.2 && remaining > 0;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Top — round */}
      <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center' }}>
        <Chip live style={{ fontSize: 22, padding: '12px 26px', letterSpacing: '0.2em' }}>
          MANCHE {currentRound} · {(roundName || '').toUpperCase()}
        </Chip>
        <div className="mo-display" style={{ fontSize: 40, color: 'var(--mo-ink)', marginTop: 22, letterSpacing: '0.05em' }}>
          CHANSON <span style={{ color: 'var(--mo-cyan)' }}>{String(songNumber).padStart(2, '0')}</span> <span style={{ color: 'var(--mo-ink-dim)' }}>/ {totalInRound}</span>
        </div>
      </div>

      {/* Center — countdown ring + mystery disc */}
      <div style={{ position: 'relative', width: 720, height: 720, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="720" height="720" viewBox="0 0 720 720" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="360" cy="360" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
          <circle cx="360" cy="360" r={R} fill="none" stroke={ringColor} strokeWidth="20" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            style={{ filter: `drop-shadow(0 0 14px ${ringColor})`, transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }} />
        </svg>

        <div style={{ position: 'relative', width: 460, height: 460 }}>
          <Vinyl size={460} labelColor="var(--mo-violet)" />
          <div className="mo-display mo-neon" style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 230, color: low ? 'var(--mo-gold)' : 'var(--mo-ink)', lineHeight: 1,
            animation: low ? 'mo-pulse 0.5s ease-in-out infinite' : 'none',
            textShadow: '0 0 30px rgba(7,2,26,0.9), 0 0 60px rgba(7,2,26,0.9)',
          }}>
            {Math.ceil(remaining)}
          </div>
        </div>
      </div>

      {/* Bottom — listening + answers */}
      <div style={{ position: 'absolute', bottom: 80, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ transform: 'scale(1.6)' }}><Eq count={16} /></div>
          <div className="mo-display mo-neon" style={{ fontSize: 56, color: 'var(--mo-magenta)' }}>ÇA JOUE…</div>
          <div style={{ transform: 'scale(1.6)' }}><Eq count={16} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 26, color: 'var(--mo-ink-dim)', letterSpacing: '0.15em' }}>RÉPONSES REÇUES</div>
          <div className="mo-display mo-neon" style={{ fontSize: 46, color: 'var(--mo-cyan)' }}>{answers.count}</div>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 26, color: 'var(--mo-ink-dim)' }}>/ {answers.total}</div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   ÉTAT 3 — RÉVÉLATION
   ===================================================================== */
function ScreenReveal({ info }) {
  if (!info) return null;
  const stats = info.stats
    ? [
        { l: 'PARFAIT', v: info.stats.parfait, c: 'var(--mo-gold)' },
        { l: 'BIEN', v: info.stats.bien, c: 'var(--mo-cyan)' },
        { l: 'RATÉ', v: info.stats.rate, c: 'var(--mo-magenta)' },
        { l: 'SANS', v: info.stats.sans, c: 'var(--mo-ink-dim)' },
      ]
    : [];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '80px 100px', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 26, letterSpacing: '0.5em', color: 'var(--mo-gold)' }}>━━━━━ LA RÉPONSE ÉTAIT ━━━━━</span>
      </div>

      {/* Cover + title */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
        <Vinyl size={360} labelColor="var(--mo-gold)" labelText={(info.title || '?').slice(0, 1).toUpperCase()} />

        <div style={{ textAlign: 'left' }}>
          <div className="mo-display mo-neon" style={{ fontSize: 110, color: 'var(--mo-magenta)', lineHeight: 0.95, wordBreak: 'break-word', maxWidth: 1000 }}>
            {(info.title || '').toUpperCase()}
          </div>
          <div className="mo-display" style={{ fontSize: 56, color: 'var(--mo-cyan)', marginTop: 26, letterSpacing: '0.04em' }}>
            {(info.artist || '').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Bottom — stats */}
      {stats.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Panel style={{ padding: 30, width: '70%', maxWidth: 820 }}>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 22, letterSpacing: '0.3em', color: 'var(--mo-ink-dim)', marginBottom: 20, textAlign: 'center' }}>SUR CETTE CHANSON</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {stats.map(s => (
                <div key={s.l} style={{ textAlign: 'center', padding: '14px 0', borderRadius: 14, border: '1px solid var(--mo-line)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="mo-display" style={{ fontSize: 60, color: s.c, textShadow: s.c !== 'var(--mo-ink-dim)' ? `0 0 12px ${s.c}` : 'none' }}>{s.v}</div>
                  <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 18, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)', marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   ÉTAT 4 — CLASSEMENT INTERMÉDIAIRE
   ===================================================================== */
function ScreenStandings({ ranking, round }) {
  const max = ranking.length > 0 ? Math.max(...ranking.map(r => r.score || 0), 1) : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '80px 120px', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 24, letterSpacing: '0.5em', color: 'var(--mo-cyan)' }}>══ APRÈS LA MANCHE {round} ══</span>
        <h1 className="mo-display mo-neon" style={{ fontSize: 92, color: 'var(--mo-gold)', margin: '18px 0 0' }}>CLASSEMENT</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', overflow: 'hidden' }}>
        {ranking.slice(0, 8).map((r, i) => {
          const rank = i + 1;
          const top = rank <= 3;
          const color = rank === 1 ? 'var(--mo-gold)' : rank === 2 ? 'var(--mo-cyan)' : rank === 3 ? 'var(--mo-magenta)' : 'var(--mo-ink)';
          const w = ((r.score || 0) / max) * 100;
          return (
            <div key={r.pseudo + i} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 200px', alignItems: 'center', gap: 28,
              padding: '14px 28px', borderRadius: 18,
              background: top ? `linear-gradient(90deg, ${color}22, transparent 70%)` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${top ? color + '55' : 'var(--mo-line)'}`,
            }}>
              <div className="mo-display" style={{ fontSize: top ? 56 : 44, color, textShadow: top ? `0 0 14px ${color}` : 'none' }}>#{rank}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ transform: 'scale(1.3)', flex: '0 0 auto' }}>
                  <Avatar initials={(r.pseudo || '?').slice(0, 2).toUpperCase()} color={color} size={44} />
                </div>
                <div style={{ flex: 1, marginLeft: 14 }}>
                  <div className="mo-display" style={{ fontSize: 30 }}>{r.pseudo}</div>
                  <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 10px ${color}`, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
              <div className="mo-display mo-neon" style={{ fontSize: 44, color: top ? color : 'var(--mo-ink)', textAlign: 'right' }}>
                {(r.score || 0).toLocaleString('fr-FR')} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   ÉTAT 5 — PODIUM FINAL
   ===================================================================== */
function PodiumStep({ rank, name, pts, h, color, big }) {
  const darken = color === 'var(--mo-gold)' ? '#c89900' : color === 'var(--mo-cyan)' ? '#007a85' : '#7a1648';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 340 }}>
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <div style={{
          width: big ? 150 : 116, height: big ? 150 : 116, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 25%, ${color}, ${darken})`,
          border: `3px solid ${color}`, boxShadow: `0 0 36px ${color}, inset 0 0 16px rgba(0,0,0,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mo-font-display)', color: 'var(--mo-bg-0)', fontSize: big ? 42 : 32,
        }}>{(name || '?').slice(0, 2).toUpperCase()}</div>
        <div style={{
          position: 'absolute', top: -10, right: -10, width: 48, height: 48, borderRadius: '50%',
          background: 'var(--mo-bg-0)', border: `3px solid ${color}`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mo-font-display)', fontSize: 22, boxShadow: `0 0 14px ${color}`,
        }}>{rank}</div>
      </div>
      <div className="mo-display mo-neon" style={{ color, fontSize: big ? 40 : 32, textAlign: 'center', wordBreak: 'break-word' }}>{name || '?'}</div>
      <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 24, color: 'var(--mo-ink-dim)', marginTop: 8 }}>{(pts || 0).toLocaleString('fr-FR')} pts</div>
      <div style={{
        marginTop: 22, width: '100%', height: h,
        background: `linear-gradient(180deg, ${color} 0%, transparent 100%)`,
        border: `1.5px solid ${color}`, borderBottom: 'none', borderRadius: '16px 16px 0 0',
        boxShadow: `0 0 30px ${color}, inset 0 0 30px rgba(0,0,0,0.3)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="mo-display" style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', fontSize: big ? 130 : 100, color: 'var(--mo-bg-0)', textShadow: `0 0 18px ${color}` }}>{rank}</div>
      </div>
    </div>
  );
}

function ScreenPodium({ ranking }) {
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3, 8);
  const slots = [
    { player: top3[1], rank: 2, color: 'var(--mo-cyan)', h: 280 },
    { player: top3[0], rank: 1, color: 'var(--mo-gold)', h: 380, big: true },
    { player: top3[2], rank: 3, color: 'var(--mo-magenta)', h: 210 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', top: -160, left: '50%', transform: 'translateX(-50%)', width: 1200, height: 900,
        background: 'radial-gradient(ellipse at top, rgba(255,214,10,0.25), rgba(255,45,149,0.12) 35%, transparent 65%)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center' }}>
        <h1 className="mo-display mo-neon" style={{ fontSize: 130, color: 'var(--mo-gold)', margin: 0 }}>PODIUM</h1>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 120, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 44 }}>
        {slots.map(s => (
          <PodiumStep key={s.rank} rank={s.rank} name={s.player?.pseudo} pts={s.player?.score} h={s.h} color={s.color} big={s.big} />
        ))}
      </div>

      {rest.length > 0 && (
        <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 56 }}>
          {rest.map((r, i) => (
            <div key={r.pseudo + i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 18, letterSpacing: '0.25em', color: 'var(--mo-ink-dim)' }}>#{i + 4}</div>
              <div className="mo-display" style={{ fontSize: 26, color: 'var(--mo-ink)', marginTop: 6 }}>{r.pseudo} · {(r.score || 0)} pts</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
