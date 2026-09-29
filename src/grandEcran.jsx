import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Stars } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import { isGameCode, peerIdFromCode, progressForIndex, ROUND_CONFIG } from "./gameLogic";
import useWakeLock from "./useWakeLock";
import { ScreenRound, ScreenTransition, ScreenLobby, ScreenHome, ScreenReveal, ScreenStandings, ScreenPodium, TransitionOverlay } from "./components/RoundScreens";
import "./styles/tokens.css";

export default function GrandEcran() {
  const [status, setStatus] = useState("connecting"); // connecting | connected | error
  const [phase, setPhase] = useState("lobby");
  const [shortCode, setShortCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundName, setRoundName] = useState("");
  const [songIndex, setSongIndex] = useState(0);   // chanson en cours (0-64) : sert au « question 3/15 · 18/65 »
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answers, setAnswers] = useState({ count: 0, total: 0 });
  const [revealInfo, setRevealInfo] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [prevRanking, setPrevRanking] = useState(null);   // classement précédent : les lignes glissent de l'un à l'autre
  const [rankingRound, setRankingRound] = useState(1);
  const [scale, setScale] = useState(1);
  const [options, setOptions] = useState(null);   // manche 1 : 4 propositions
  const [theme, setTheme] = useState("");         // manche 2
  const [audioSeconds, setAudioSeconds] = useState(null); // manche 4
  const [fastestList, setFastestList] = useState([]);       // manche 3 : { pseudo, bonus, time }

  const stageRef = useRef(null);
  const playersRef = useRef([]);
  const lastRankingRef = useRef(null);
  const phaseRef = useRef("lobby");
  const rafRef = useRef(null);
  const [overlay, setOverlay] = useState(null);       // effet de passage entre deux écrans { k, p }
  const [nextRound, setNextRound] = useState(1);      // manche mise en avant sur l'accueil
  playersRef.current = players;
  phaseRef.current = phase;

  useWakeLock(true); // le grand écran ne doit jamais s'éteindre

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

  // Effet de manche (rayons, iris, bandes, zone rouge) : l'écran change au milieu de l'animation.
  const runTransition = (round, midFn) => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 500 : 1200;
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    let applied = false;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      if (!applied && p >= 0.5) { applied = true; midFn(); }
      setOverlay(p < 1 ? { k: round - 1, p, reduced } : null);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

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

    peer.on("open", () => {
      const realHostId = isGameCode(code) ? peerIdFromCode(code) : code;

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
          case "announceRound":
            if (typeof data.round === "number") {
              const r = data.round;
              runTransition(r, () => { setPhase("transition"); setCurrentRound(r); setSongIndex(ROUND_CONFIG[r].start); });
            }
            break;
          case "showHome":
            setNextRound(typeof data.next === "number" ? data.next : 1);
            setPhase("home");
            break;
          case "fastestUpdate":
            setFastestList(data.list || []);
            break;
          case "startTimer":
            // après l'annonce de la manche : même effet, qui révèle la première question
            if (phaseRef.current === "transition" && typeof data.round === "number") runTransition(data.round, () => setPhase("playing"));
            else setPhase("playing");
            setFastestList([]);
            setRevealInfo(null);
            if (typeof data.round === "number") setCurrentRound(data.round);
            if (data.roundName) setRoundName(data.roundName);
            if (typeof data.songIndex === "number") setSongIndex(data.songIndex);
            setOptions(data.options || null);
            setTheme(data.theme || "");
            setAudioSeconds(typeof data.audioSeconds === "number" ? data.audioSeconds : null);
            setTotalSeconds(data.seconds);
            setSecondsLeft(data.seconds);
            setAnswers({ count: 0, total: data.totalPlayers || 0 });
            break;
          case "answersUpdate":
            setAnswers({ count: data.count, total: data.total });
            break;
          case "revealAnswer":
            setPhase("reveal");
            if (typeof data.songIndex === "number") setSongIndex(data.songIndex);
            setRevealInfo({
              title: data.title || "", artist: data.artist || "", stats: data.stats || null,
              options: data.options || null, correctIndex: data.correctIndex, votes: data.votes || null,
            });
            break;
          case "showRanking":
            // message identique déjà reçu : on ignore (évite de rejouer l'animation à l'arrivée)
            if (phaseRef.current === "standings" && JSON.stringify(data.ranking || []) === JSON.stringify(lastRankingRef.current)) break;
            setPhase("standings");
            // ancien classement (ou ordre d'arrivée à 0 point la première fois) pour animer le glissement
            setPrevRanking(lastRankingRef.current || playersRef.current.map(p => ({ pseudo: p.pseudo, score: 0 })));
            lastRankingRef.current = data.ranking || [];
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

  const progress = progressForIndex(songIndex);

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
          <div style={{ position: 'absolute', inset: 0 }}>
            {phase === 'lobby' && <ScreenLobby code={shortCode} players={players} />}
            {phase === 'home' && <ScreenHome code={shortCode} next={nextRound} />}
            {phase === 'transition' && <ScreenTransition round={currentRound} code={shortCode} />}
            {phase === 'playing' && (
              <ScreenRound
                code={shortCode}
                round={currentRound}
                remaining={secondsLeft}
                answers={answers}
                players={players}
                progress={progress}
                options={options}
                theme={theme}
                musicCut={audioSeconds !== null && currentRound === 4 && totalSeconds - secondsLeft >= audioSeconds}
                fastestList={fastestList}
              />
            )}
            {phase === 'reveal' && <ScreenReveal round={currentRound} info={revealInfo} code={shortCode} progress={progress} />}
            {phase === 'standings' && <ScreenStandings ranking={ranking} prevRanking={prevRanking} round={rankingRound} code={shortCode} />}
            {phase === 'podium' && <ScreenPodium ranking={ranking} code={shortCode} />}
            {overlay && <TransitionOverlay k={overlay.k} p={overlay.p} reduced={overlay.reduced} />}
          </div>
        </div>
      </div>
    </div>
  );
}
