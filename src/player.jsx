import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Btn, Input, Panel, Eyebrow, Chip, Eq, Stars, GridFloor } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import "./styles/tokens.css";

import {
  ROUND_NAMES as roundNames, MIC_CHOICES, isCorrect, isArtistCorrect, isGameCode, peerIdFromCode, parseJoinCode, normalizePlayerColor, DEFAULT_PLAYER_COLOR,
} from "./gameLogic";
import MicIcon from "./components/MicIcon";
import { ScreenJoin, ScreenWaiting, ScreenGame, ScreenSent, ScreenReveal, ScreenRanking, ScreenPodium } from "./components/PhoneScreens";
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
  const [avatarColor, setAvatarColor] = useState(DEFAULT_PLAYER_COLOR);   // couleur choisie par le joueur

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
  const [lobbyPlayers, setLobbyPlayers] = useState([]);   // joueurs connectés { pseudo, color } (écran d'attente)
  const [status, setStatus] = useState(null);             // { answered, total, alive } : « 4 ont déjà répondu », « 11/16 en lice »
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
        if (data.avatarColor) setAvatarColor(normalizePlayerColor(data.avatarColor));
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
          connection.send({ type: "newPlayer", pseudo: finalPseudo, sessionId: finalSessionId, color: avatarColor });
          setJoinStep("joined");
        });

        connection.on("data", (data) => {
          if (data.type === "lobbyPlayers") {
            setLobbyPlayers((data.players || []).map(pl => ({ pseudo: pl.pseudo, color: pl.color })));
          } else if (data.type === "statusUpdate") {
            setStatus(data.status || null);
          } else if (data.type === "startTimer") {
            setStatus(data.status || null);
            setLastPoints(0);
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
        color={avatarColor} onColor={setAvatarColor}
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
    return <ScreenRanking round={currentRound} pseudo={pseudo} score={totalScore} ranking={rankingData.map(r => ({ pseudo: r.pseudo || r.name, score: r.score, color: r.color }))} />;
  }

  // ── PODIUM FINAL ────────────────────────────────────────────
  if (showFinalRanking) {
    return <ScreenPodium pseudo={pseudo} ranking={rankingData.map(r => ({ pseudo: r.pseudo || r.name, score: r.score, color: r.color }))} onReplay={handleRankingContinue} />;
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
      label = answered ? 'RATÉ' : 'TEMPS ÉCOULÉ'; sub = answered ? 'Raté pour cette fois' : 'Le temps est écoulé';
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
        round={currentRound} pseudo={pseudo} score={totalScore} outcome={outcome} points={lastPoints} label={label} sub={sub}
        correct={correctAnswer} mine={mine} bonuses={bonuses}
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
