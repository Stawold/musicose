import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Btn, Input, Panel, Eyebrow, Chip, Eq, Stars, GridFloor } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import "./styles/tokens.css";

import {
  ROUND_NAMES as roundNames, MIC_CHOICES, isCorrect, isArtistCorrect, isGameCode, peerIdFromCode, parseJoinCode,
} from "./gameLogic";
import MicIcon from "./components/MicIcon";
import { ScreenJoin, ScreenWaiting, ScreenGame, ScreenSent, ScreenReveal, ScreenRanking } from "./components/PhoneScreens";
import useWakeLock from "./useWakeLock";

const generateSessionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "sid-" + Date.now() + "-" + Math.random().toString(36).slice(2);
};

const AVATAR_COLORS = [
  'var(--mo-magenta)',
  'var(--mo-cyan)',
  'var(--mo-gold)',
  'var(--mo-violet)',
  '#ff7a59',
];

const getAvatarVariant = (color) => {
  if (color === 'var(--mo-cyan)') return 'cyan';
  if (color === 'var(--mo-gold)') return 'gold';
  return 'magenta';
};

const getAvatarInputColor = (color) => {
  return color === 'var(--mo-cyan)' ? 'cyan' : 'magenta';
};

export default function Player({ onResetMode }) {
  const joinFromUrl = useRef(parseJoinCode(window.location.search));
  const [joinStep, setJoinStep] = useState("pseudo");
  const [pseudoInput, setPseudoInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [canPlay, setCanPlay] = useState(false);
  const [peer, setPeer] = useState(null);
  const [conn, setConn] = useState(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(null);
  const [pseudo, setPseudo] = useState("");
  const [currentRound, setCurrentRound] = useState(1);
  const [activeRound4, setActiveRound4] = useState(true);
  const [roundStartTime, setRoundStartTime] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [isFastest, setIsFastest] = useState(false);
  const [round3Bonus, setRound3Bonus] = useState(0);
  const [showFinalRanking, setShowFinalRanking] = useState(false);
  const [restoredScore, setRestoredScore] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [choice, setChoice] = useState(null);           // manche 1 : micro choisi (modifiable jusqu'à la fin)
  const [optionCount, setOptionCount] = useState(4);
  const [theme, setTheme] = useState("");               // manche 2
  const [audioSeconds, setAudioSeconds] = useState(null); // manche 4 : durée d'écoute
  const [lobbyPlayers, setLobbyPlayers] = useState([]);   // pseudos connectés (écran d'attente)
  const [status, setStatus] = useState(null);             // { answered, total, alive } : « 4 ont déjà répondu », « 11/16 en lice »
  const [leaderboard, setLeaderboard] = useState([]);     // classement affiché à la révélation
  const [lastPoints, setLastPoints] = useState(0);        // points gagnés sur la chanson

  // Écran du téléphone maintenu allumé pendant toute la partie (pause, attente, classement…)
  useWakeLock(joinStep === "joined");

  useEffect(() => {
    const saved = localStorage.getItem("musicose_session");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessionId) setSessionId(data.sessionId);
        if (data.pseudo) {
          setPseudoInput(data.pseudo);
          setPseudo(data.pseudo);
        }
        if (data.gameCode) setCodeInput(data.gameCode);
        if (data.avatarColor) setAvatarColor(data.avatarColor);
      } catch (e) {
        localStorage.removeItem("musicose_session");
      }
    }
    // Arrivée par QR code : le code de la partie est déjà connu
    if (joinFromUrl.current) setCodeInput(joinFromUrl.current);
  }, []);

  const handleJoinGame = async () => {
    {
      if (isConnecting) return;
      const finalPseudo = (pseudoInput || pseudo).trim();
      const finalCode = codeInput.trim();
      if (!finalPseudo) { setJoinError("Entre un pseudo !"); return; }
      if (!finalCode) { setJoinError("Entre le code de la partie !"); return; }
      // Même pseudo que la session sauvegardée : on retrouve ses points ; sinon nouveau joueur
      const finalSessionId = (sessionId && (!pseudo || pseudo === finalPseudo)) ? sessionId : generateSessionId();
      setSessionId(finalSessionId);
      setPseudo(finalPseudo);

      localStorage.setItem("musicose_session", JSON.stringify({
        sessionId: finalSessionId,
        pseudo: finalPseudo,
        gameCode: finalCode.toUpperCase(),
        avatarColor,
      }));

      setJoinError("");
      setIsConnecting(true);

      const newPeer = new Peer(undefined, peerConfig);
      setPeer(newPeer);

      let settled = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        setIsConnecting(false);
        setJoinError(message);
        try { newPeer.destroy(); } catch (e) { /* ignore */ }
      };

      const timeoutId = setTimeout(() => {
        fail("⏱️ La connexion prend trop de temps. Vérifie ta connexion internet (Wi-Fi ou 4G/5G) et réessaie.");
      }, 15000);

      newPeer.on("error", (err) => {
        console.error("Erreur PeerJS (joueur) :", err);
        fail(err && err.type === "peer-unavailable"
          ? "❌ Code introuvable. Vérifie le code ou demande à l'hôte."
          : "❌ Connexion impossible. Vérifie ta connexion internet et réessaie.");
      });

      newPeer.on("open", () => {
        // Le code de partie est l'identifiant de la régie (sinon : identifiant brut, comme avant)
        const realHostId = isGameCode(finalCode) ? peerIdFromCode(finalCode) : finalCode;

        const connection = newPeer.connect(realHostId);
        setConn(connection);

        connection.on("error", (err) => {
          console.error("Erreur connexion PeerJS (joueur) :", err);
          fail("❌ Connexion impossible. Vérifie ta connexion internet et réessaie.");
        });

        connection.on("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          setIsConnecting(false);
          connection.send({ type: "newPlayer", pseudo: finalPseudo, sessionId: finalSessionId });
          setJoinStep("joined");
        });

        connection.on("data", (data) => {
          if (data.type === "lobbyPlayers") {
            setLobbyPlayers((data.players || []).map(pl => pl.pseudo));
          } else if (data.type === "statusUpdate") {
            setStatus(data.status || null);
          } else if (data.type === "startTimer") {
            setStatus(data.status || null);
            setLastPoints(0);
            setLeaderboard([]);
            setShowRanking(false);   // une nouvelle chanson ferme le classement resté ouvert
            setCorrectAnswer(null);
            setSubmittedAnswer(null);
            setTitle("");
            setArtist("");
            setChoice(null);
            setOptionCount(typeof data.optionCount === "number" ? data.optionCount : 4);
            setTheme(data.theme || "");
            setAudioSeconds(typeof data.audioSeconds === "number" ? data.audioSeconds : null);
            setIsFastest(false);
            setRound3Bonus(0);
            setSecondsLeft(data.seconds);
            setTotalSeconds(data.seconds);
            setCanPlay(true);
            setCurrentSongIndex(typeof data.songIndex === "number" ? data.songIndex : null);
            if (typeof data.round === "number") setCurrentRound(data.round);
            setRoundStartTime(Date.now());
          } else if (data.type === "responseAck") {
            if (typeof data.points === "number") setLastPoints(data.points);
            if (typeof data.totalScore === "number") {
              setTotalScore(data.totalScore);   // total fait foi côté hôte
            } else if (typeof data.points === "number") {
              setTotalScore(prev => prev + data.points);
            }
            if (data.fastest) setIsFastest(true);
            if (data.round3Bonus > 0) setRound3Bonus(data.round3Bonus);
          } else if (data.type === "scoreUpdate") {
            if (typeof data.totalScore === "number") setTotalScore(data.totalScore);
          } else if (data.type === "sessionRestored") {
            setRestoredScore(data.totalScore);
            setTotalScore(data.totalScore || 0);
          } else if (data.type === "eliminatedRound4") {
            setActiveRound4(false);
          } else if (data.type === "revealAnswer") {
            setCorrectAnswer({ title: data.title || "", artist: data.artist || "", correctIndex: data.correctIndex });
            setLeaderboard(data.leaderboard || []);
            setCanPlay(false);
          } else if (data.type === "showRanking") {
            setRankingData(data.ranking || []);
            setShowRanking(true);
            setCanPlay(false);
          } else if (data.type === "showFinalRanking") {
            setRankingData(data.ranking || []);
            setShowFinalRanking(true);
            setShowRanking(false);
            setCanPlay(false);
          }
        });
      });
    }
  };

  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (secondsLeft === 0 && canPlay) {
      if (currentRound === 1) {
        // QCM : le choix est déjà parti à chaque clic, on fige simplement l'écran
        setSubmittedAnswer({ title: "", artist: "", choiceIndex: choice });
        setCanPlay(false);
      } else {
        handleSubmit();
      }
    }
  }, [secondsLeft, canPlay]);

  // Manche 1 : chaque clic est envoyé, le dernier choix compte
  const handleChoose = (index) => {
    if (!conn || !canPlay || currentRound !== 1) return;
    setChoice(index);
    const responseTime = roundStartTime ? ((Date.now() - roundStartTime) / 1000).toFixed(2) : null;
    conn.send({
      type: "playerResponse",
      response: { choiceIndex: index, timestamp: Date.now(), songIndex: currentSongIndex, pseudo, responseTime },
    });
  };

  const handleSubmit = () => {
    if (!conn || !canPlay || (currentRound === 4 && !activeRound4)) return;
    const responseTime = roundStartTime
      ? ((Date.now() - roundStartTime) / 1000).toFixed(2)
      : null;
    const response = {
      title,
      artist,
      timestamp: Date.now(),
      songIndex: currentSongIndex,
      pseudo,
      responseTime,
    };
    setSubmittedAnswer({ title, artist });
    conn.send({ type: "playerResponse", response });
    setTitle("");
    setArtist("");
    setCanPlay(false);
  };

  const handleRankingContinue = () => {
    if (conn) conn.send({ type: "rankingAcknowledged" });
    setShowRanking(false);
    setShowFinalRanking(false);
    setCorrectAnswer(null);
    setSubmittedAnswer(null);
  };

  const eliminated = currentRound === 4 && !activeRound4;

  // ── CONNEXION (code + pseudo sur le même écran) ─────────────
  if (joinStep !== "joined") {
    return (
      <ScreenJoin
        code={codeInput} onCode={setCodeInput}
        pseudo={pseudoInput} onPseudo={setPseudoInput}
        onSubmit={handleJoinGame} connecting={isConnecting} error={joinError}
        hasSession={Boolean(sessionId && pseudo)}
        onResetMode={onResetMode}
        onReset={() => {
          localStorage.removeItem("musicose_session");
          setSessionId(""); setPseudo(""); setPseudoInput(""); setCodeInput("");
        }}
      />
    );
  }

  // ── CLASSEMENT DE FIN DE MANCHE ─────────────────────────────
  if (showRanking && !showFinalRanking) {
    return <ScreenRanking pseudo={pseudo} ranking={rankingData.map(r => ({ pseudo: r.pseudo || r.name, score: r.score }))} onContinue={handleRankingContinue} />;
  }

  // ── PODIUM FINAL ───────────────────────────────────────────
  if (joinStep === "joined" && showFinalRanking) {
    const top3 = rankingData.slice(0, 3);
    const rest = rankingData.slice(3);
    // Visual order: 2nd (left) – 1st (center) – 3rd (right)
    const podiumSlots = [
      { player: top3[1], rank: 2, color: 'var(--mo-cyan)',    darken: '#007a85', height: 130 },
      { player: top3[0], rank: 1, color: 'var(--mo-gold)',    darken: '#c89900', height: 190 },
      { player: top3[2], rank: 3, color: 'var(--mo-magenta)', darken: '#7a1648', height: 95  },
    ];
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="mo-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <Stars />
        <GridFloor />
        {/* Spotlight */}
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 700, height: 600, background: 'radial-gradient(ellipse at top, rgba(255,214,10,0.22), rgba(255,45,149,0.1) 40%, transparent 65%)', pointerEvents: 'none' }} />

        {/* Title */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '36px 20px 16px' }}>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.4em', color: 'var(--mo-ink-dim)' }}>━━ FIN DE PARTIE ━━</div>
          <h1 className="mo-display mo-neon" style={{ margin: '10px 0 0', fontSize: 'clamp(2.8rem, 14vw, 5.5rem)', color: 'var(--mo-gold)' }}>PODIUM</h1>
        </div>

        {/* Podium steps */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 10, padding: '0 12px', flex: 1 }}>
          {podiumSlots.map(({ player, rank, color, darken, height }, i) => {
            const big = rank === 1;
            const initials = (player?.pseudo || '?').slice(0, 2).toUpperCase();
            return (
              <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 130 }}>
                {/* Avatar */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <div style={{ width: big ? 76 : 60, height: big ? 76 : 60, borderRadius: '50%', background: `radial-gradient(circle at 30% 25%, ${color}, ${darken})`, border: `2px solid ${color}`, boxShadow: `0 0 20px ${color}, inset 0 0 10px rgba(0,0,0,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mo-font-display)', color: 'var(--mo-bg-0)', fontSize: big ? 20 : 16 }}>{initials}</div>
                  <div style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--mo-bg-0)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mo-font-display)', color, fontSize: 10, boxShadow: `0 0 8px ${color}` }}>{rank}</div>
                </div>
                <div className="mo-display" style={{ color, fontSize: big ? 15 : 12, textAlign: 'center', textShadow: `0 0 8px ${color}`, marginBottom: 3, wordBreak: 'break-word', maxWidth: '100%', padding: '0 4px' }}>{player?.pseudo || '?'}</div>
                <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-dim)', marginBottom: 10 }}>{(player?.score || 0)} pts</div>
                {/* Step */}
                <div style={{ width: '100%', height, background: `linear-gradient(180deg, ${color}35 0%, transparent 100%)`, border: `1.5px solid ${color}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', boxShadow: `0 0 14px ${color}40`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: big ? 10 : 6, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--mo-font-display)', fontSize: big ? 52 : 38, color: `${color}30` }}>{rank}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4th and below */}
        {rest.length > 0 && (
          <div style={{ position: 'relative', zIndex: 2, padding: '14px 20px 0', borderTop: '1px solid var(--mo-line)' }}>
            {rest.map((player, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--mo-line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mo-display" style={{ fontSize: 11, color: 'var(--mo-ink-dim)', width: 24 }}>#{i + 4}</span>
                  <span style={{ fontFamily: 'var(--mo-font-display)', fontSize: 13 }}>{player.pseudo}</span>
                </div>
                <span className="mo-display" style={{ fontSize: 13, color: 'var(--mo-ink-dim)' }}>{player.score} pts</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ position: 'relative', zIndex: 2, padding: '18px 20px 36px' }}>
          <Btn variant="gold" onClick={handleRankingContinue} style={{ width: '100%' }}>
            REJOUER UNE PARTIE →
          </Btn>
        </div>
      </div>
    );
  }

  // ── RÉVÉLATION DE LA RÉPONSE ────────────────────────────────
  if (correctAnswer) {
    const myChoice = currentRound === 1 ? (submittedAnswer?.choiceIndex ?? choice) : null;
    const answered = currentRound === 1 ? (myChoice !== null && myChoice !== undefined) : !!submittedAnswer;
    const choiceCorrect = currentRound === 1 && answered && myChoice === correctAnswer.correctIndex;
    const titleCorrect = !!submittedAnswer && isCorrect(submittedAnswer.title, correctAnswer.title);
    const artistCorrect = !!submittedAnswer && currentRound !== 2 && isArtistCorrect(submittedAnswer.artist, correctAnswer.artist);

    let outcome = 'rate';
    if (currentRound === 1) outcome = choiceCorrect ? 'parfait' : 'rate';
    else if (currentRound === 2) outcome = titleCorrect ? 'parfait' : 'rate';
    else outcome = titleCorrect && artistCorrect ? 'parfait' : titleCorrect || artistCorrect ? 'partiel' : 'rate';

    let label = 'PARFAIT'; let sub = 'Titre + artiste';
    if (outcome === 'parfait') {
      if (currentRound === 1) { label = 'BONNE RÉPONSE'; sub = 'Bon micro'; }
      else if (currentRound === 2) sub = 'Titre trouvé';
    } else if (outcome === 'partiel') {
      label = 'PARTIEL'; sub = titleCorrect ? 'Titre seulement' : 'Artiste seulement';
    } else if (eliminated) {
      label = 'ÉLIMINÉ·E'; sub = 'Tu rejoins les spectateurs';
    } else {
      label = answered ? 'RATÉ' : 'TEMPS ÉCOULÉ'; sub = `Réponse : ${correctAnswer.title}`;
    }

    const bonuses = [];
    if (isFastest) bonuses.push('⚡ PLUS RAPIDE · +1 PT BONUS');
    if (round3Bonus > 0) bonuses.push(round3Bonus === 3 ? '🥇 1ER · +3 PTS BONUS' : round3Bonus === 2 ? '🥈 2ÈME · +2 PTS BONUS' : '🥉 3ÈME · +1 PT BONUS');

    let mine = '';
    if (currentRound === 1 && answered) mine = `MICRO ${MIC_CHOICES[myChoice].letter}`;
    else if (submittedAnswer && (submittedAnswer.title || submittedAnswer.artist)) {
      mine = [submittedAnswer.title, currentRound !== 2 ? submittedAnswer.artist : ''].filter(Boolean).join(' · ');
    }

    return (
      <ScreenReveal
        pseudo={pseudo} outcome={outcome} points={lastPoints} label={label} sub={sub}
        correct={correctAnswer} mine={mine} bonuses={bonuses} ranking={leaderboard}
        onContinue={() => { setCorrectAnswer(null); setSubmittedAnswer(null); }}
      />
    );
  }

  // ── RÉPONSE ENVOYÉE, EN ATTENTE DE LA RÉVÉLATION ────────────
  if (submittedAnswer !== null && !canPlay) {
    return <ScreenSent round={currentRound} pseudo={pseudo} score={totalScore} answer={submittedAnswer} choiceIndex={submittedAnswer.choiceIndex} />;
  }

  // ── EN ATTENTE (avant la partie ou entre deux chansons) ─────
  if (!canPlay) {
    return (
      <ScreenWaiting
        pseudo={pseudo} score={totalScore} players={lobbyPlayers} code={codeInput}
        round={currentSongIndex !== null ? currentRound : null} restored={restoredScore}
        title={currentSongIndex !== null ? ['PROCHAINE', 'CHANSON'] : ['EN', 'ATTENTE']}
        message={currentSongIndex !== null ? "Prochaine chanson bientôt… Garde les yeux sur le Grand Écran." : undefined}
      />
    );
  }

  // ── MANCHE EN COURS ─────────────────────────────────────────
  const musicCut = currentRound === 4 && audioSeconds !== null && totalSeconds - secondsLeft >= audioSeconds;
  const statusText = status
    ? (currentRound === 3 ? `${status.answered} ONT DÉJÀ RÉPONDU`
      : currentRound === 4 ? `${status.alive} / ${status.total}` : '')
    : '';
  const hints = { 2: 'LE TITRE SUFFIT', 3: "PLUS C'EST RAPIDE, PLUS ÇA RAPPORTE", 4: 'UNE BONNE RÉPONSE SUFFIT POUR RESTER EN LICE' };
  return (
    <ScreenGame
      round={currentRound} pseudo={pseudo} score={totalScore}
      seconds={secondsLeft} total={totalSeconds} active={canPlay}
      theme={currentRound === 2 ? theme : ''}
      status={statusText} statusLabel={currentRound === 3 ? 'PODIUM' : 'EN LICE'} musicCut={musicCut}
      optionCount={optionCount} choice={choice} onChoose={handleChoose}
      title={title} onTitle={setTitle} artist={artist} onArtist={setArtist} onSubmit={handleSubmit}
      eliminated={eliminated} hint={hints[currentRound] || ''}
    />
  );
}
