import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Btn, Panel, Chip, Eq, Eyebrow, Stars, Vinyl, Waveform } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import "./styles/tokens.css";

import {
  ROUND_NAMES as roundNames, ROUND_CONFIG, TOTAL_SONGS, MIC_CHOICES,
  roundForIndex, isEndOfRound, isCorrect, isArtistCorrect,
  scoreTextAnswer, round3BonusForPosition, scoreChoiceRound,
  buildOptions, themeFor, adjustedScores, POINTS,
} from "./gameLogic";
import MicIcon from "./components/MicIcon";

export default function Host() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [connections, setConnections] = useState([]);
  const [peer, setPeer] = useState(null);
  const [responses, setResponses] = useState([]);
  const [fastest, setFastest] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [players, setPlayers] = useState({});
  const [selectedPlaylist, setSelectedPlaylist] = useState("playlist1");
  const [playlist, setPlaylist] = useState(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [bonusWinnerId, setBonusWinnerId] = useState(null);
  const [shortCode, setShortCode] = useState(null);
  const [peerStatus, setPeerStatus] = useState("idle");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rankingSent, setRankingSent] = useState(false);
  const [finalSent, setFinalSent] = useState(false);
  const [geConnections, setGeConnections] = useState([]);
  const [roundOptions, setRoundOptions] = useState(null); // manche 1 : { options, correctIndex }
  const [audioCut, setAudioCut] = useState(false);        // manche 4 : musique coupée après 30 s

  const bonusOrderRef = useRef({});
  const fastestRef = useRef(null);
  const audioRef = useRef(null);
  const playlistRef = useRef(playlist);
  const currentSongIndexRef = useRef(currentSongIndex);
  const currentRoundRef = useRef(currentRound);
  const playersRef = useRef({});
  const shortCodeRef = useRef(null);
  const peerToSession = useRef({});
  const responsesRef = useRef([]);
  const secondsLeftRef = useRef(0);
  const isCountingRef = useRef(false);
  const roundOptionsRef = useRef(null);
  const choicesRef = useRef({});          // manche 1 : { sessionId: { index, time } }
  const answeredRef = useRef({});         // manches 2-4 : une seule réponse par joueur et par chanson
  const finalizedRef = useRef(-1);        // index de la chanson dont la manche 1 a été notée
  const acceptUntilRef = useRef(0);       // petite marge après 0 s pour les choix en transit
  const finalizeTimerRef = useRef(null);
  const songPayloadRef = useRef({});      // infos à renvoyer aux joueurs qui (re)joignent en cours de chanson
  const connBySessionRef = useRef({});
  const geConnectionsRef = useRef([]);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { secondsLeftRef.current = secondsLeft; }, [secondsLeft]);
  useEffect(() => { isCountingRef.current = isCounting; }, [isCounting]);
  useEffect(() => { shortCodeRef.current = shortCode; }, [shortCode]);
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { roundOptionsRef.current = roundOptions; }, [roundOptions]);
  useEffect(() => { geConnectionsRef.current = geConnections; }, [geConnections]);

  // Broadcast lobby state (code + player list) to grand écran(s)
  useEffect(() => {
    if (geConnections.length === 0) return;
    const playerList = Object.values(players).map(p => ({ pseudo: p.pseudo, totalScore: p.totalScore || 0 }));
    geConnections.forEach(conn => {
      try { conn.send({ type: "lobbyState", shortCode: shortCodeRef.current, players: playerList }); } catch (e) { /* ignore */ }
    });
  }, [players, geConnections]);

  const HOST_PASSWORD = "melbose";
  const KVDB_BASE = "https://kvdb.io/GVkYCf2Kfn44jq3EYGweRj/";

  const handleAuthSubmit = () => {
    if (passwordInput === HOST_PASSWORD) {
      setAuthenticated(true);
    } else {
      alert("❌ Mot de passe incorrect !");
      setPasswordInput("");
    }
  };

  const sendShortCodeToKvdb = async (sc, hId) => {
    try {
      const res = await fetch(`${KVDB_BASE}${encodeURIComponent(sc)}`, {
        method: "PUT",
        body: hId,
      });
      if (!res.ok) console.warn("Erreur écriture kvdb", res.status);
    } catch (e) {
      console.error("Erreur kvdb PUT", e);
    }
  };

  const saveScoreToKvdb = async (sessionId, scoreData) => {
    const sc = shortCodeRef.current;
    if (!sc) return;
    try {
      await fetch(`${KVDB_BASE}score-${sc}-${sessionId}`, {
        method: "PUT",
        body: JSON.stringify(scoreData),
      });
    } catch (e) {
      console.warn("Erreur sauvegarde score kvdb:", e);
    }
  };

  const fetchScoreFromKvdb = async (sessionId) => {
    const sc = shortCodeRef.current;
    if (!sc) return null;
    try {
      const res = await fetch(`${KVDB_BASE}score-${sc}-${sessionId}`);
      if (!res.ok) return null;
      return JSON.parse(await res.text());
    } catch (e) {
      return null;
    }
  };

  const sendRankingToPlayers = () => {
    const ranking = Object.values(playersRef.current)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map(p => ({ pseudo: p.pseudo, score: p.totalScore }));
    connections.forEach(conn => {
      try { conn.send({ type: "showRanking", ranking }); } catch (e) { /* ignore */ }
    });
    geConnections.forEach(conn => {
      try { conn.send({ type: "showRanking", ranking, round: currentRoundRef.current }); } catch (e) { /* ignore */ }
    });
  };

  useEffect(() => {
    fetch(`/playlists/${selectedPlaylist}/data.json`)
      .then(res => res.json())
      .then(data => {
        setPlaylist(data);
        setCurrentSongIndex(0);
        setCurrentRound(1);
      })
      .catch(err => console.error("Erreur chargement playlist :", err));
  }, [selectedPlaylist]);

  // ── Scores ─────────────────────────────────────────────────
  // Applique un delta au joueur (jamais sous 0), met à jour l'état, la sauvegarde KVDB et renvoie le joueur mis à jour.
  const applyPoints = (sessionId, round, delta) => {
    const cur = playersRef.current[sessionId];
    if (!cur) return null;
    const adj = adjustedScores(cur, round, delta);
    if (!adj) return cur;
    const updated = { ...cur, scorePerRound: adj.scorePerRound, totalScore: adj.totalScore };
    playersRef.current = { ...playersRef.current, [sessionId]: updated };
    setPlayers(prev => prev[sessionId] ? { ...prev, [sessionId]: { ...prev[sessionId], scorePerRound: adj.scorePerRound, totalScore: adj.totalScore } } : prev);
    saveScoreToKvdb(sessionId, { pseudo: cur.pseudo, scorePerRound: adj.scorePerRound, totalScore: adj.totalScore });
    return updated;
  };

  const sendToSession = (sessionId, message) => {
    const c = connBySessionRef.current[sessionId];
    if (!c) return;
    try { c.send(message); } catch (e) { /* ignore */ }
  };

  // Outil de régulation : +1 / -1 manuel (bug, erreur de saisie, geste de l'animateur…)
  const adjustScore = (sessionId, delta) => {
    const updated = applyPoints(sessionId, currentRoundRef.current, delta);
    if (updated) sendToSession(sessionId, { type: "scoreUpdate", totalScore: updated.totalScore });
  };

  const sendAnswersCount = (count) => {
    // via ref : appelé depuis le gestionnaire PeerJS créé au premier rendu
    geConnectionsRef.current.forEach(c => {
      try { c.send({ type: "answersUpdate", count, total: Object.keys(playersRef.current).length }); } catch (e) { /* ignore */ }
    });
  };

  // Manche 1 : notation à la fin du temps (les joueurs peuvent changer d'avis jusqu'au bout). Idempotent.
  const finalizeRound1 = () => {
    const idx = currentSongIndexRef.current;
    const opts = roundOptionsRef.current;
    if (currentRoundRef.current !== 1 || !opts || finalizedRef.current === idx) return;
    finalizedRef.current = idx;
    clearTimeout(finalizeTimerRef.current);

    const results = scoreChoiceRound(choicesRef.current, opts.correctIndex);
    Object.entries(results).forEach(([sid, r]) => {
      const updated = r.points > 0 ? applyPoints(sid, 1, r.points) : playersRef.current[sid];
      sendToSession(sid, {
        type: "responseAck", points: r.points, fastest: r.fastest, correct: r.correct,
        totalScore: updated ? updated.totalScore : undefined,
      });
      if (r.fastest) setBonusWinnerId(sid);
    });
    setResponses(prev => prev.map(r => {
      const res = results[r.playerId];
      return res ? { ...r, points: res.points, correct: res.correct } : r;
    }));
  };

  const buildRanking = () => {
    return Object.values(playersRef.current)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map(p => ({ pseudo: p.pseudo, score: p.totalScore }));
  };

  const sendFinalRanking = () => {
    const ranking = buildRanking();
    connections.forEach(conn => {
      try { conn.send({ type: "showFinalRanking", ranking }); } catch (e) { /* ignore */ }
    });
    geConnections.forEach(conn => {
      try { conn.send({ type: "showFinalRanking", ranking }); } catch (e) { /* ignore */ }
    });
    setFinalSent(true);
  };

  useEffect(() => {
    if (!authenticated) return;

    const newPeer = new Peer(undefined, peerConfig);
    setPeer(newPeer);
    setPeerStatus("connecting");

    newPeer.on("open", async (id) => {
      setHostId(id);
      try {
        const sc = "OSE-" + id.slice(-4).toUpperCase();
        setShortCode(sc);
        shortCodeRef.current = sc;
        setPeerStatus("ready");
        console.log("ShortCode généré :", sc);
        sendShortCodeToKvdb(sc, id);
      } catch (e) {
        console.warn("Erreur génération shortCode :", e);
      }
    });

    newPeer.on("error", (err) => {
      console.error("Erreur PeerJS :", err);
      setPeerStatus("error");
    });

    newPeer.on("connection", (conn) => {
      setConnections(prev => [...prev, conn]);

      conn.on("close", () => {
        setConnections(prev => prev.filter(c => c !== conn));
        setGeConnections(prev => prev.filter(c => c !== conn));
      });

      conn.on("open", () => conn.send({ type: "welcome", message: "Bienvenue sur Music'Ose !" }));

      conn.on("data", (data) => {
        try {
          if (data.type === "newGrandEcran") {
            setGeConnections(prev => [...prev, conn]);
            return;
          }

          if (data.type === "newPlayer") {
            const sessionId = data.sessionId || conn.peer;
            peerToSession.current[conn.peer] = sessionId;
            connBySessionRef.current[sessionId] = conn;

            // If a song is currently playing, let the (re)joining player jump
            // straight into it with the time remaining, instead of making
            // them wait for the next song.
            const sendCatchUpTimer = (eligible) => {
              if (!eligible) return;
              if (isCountingRef.current && secondsLeftRef.current > 0 && playlistRef.current) {
                conn.send({
                  type: "startTimer",
                  seconds: secondsLeftRef.current,
                  songIndex: currentSongIndexRef.current,
                  round: currentRoundRef.current,
                  ...songPayloadRef.current,
                });
              }
            };

            const existingPlayer = playersRef.current[sessionId];

            if (existingPlayer) {
              setPlayers(prev => ({
                ...prev,
                [sessionId]: { ...prev[sessionId], peerId: conn.peer },
              }));
              conn.send({
                type: "sessionRestored",
                totalScore: existingPlayer.totalScore,
                round: currentRoundRef.current,
              });
              sendCatchUpTimer(currentRoundRef.current !== 4 || existingPlayer.activeRound4 !== false);
            } else {
              fetchScoreFromKvdb(sessionId).then(savedScore => {
                if (savedScore) {
                  setPlayers(prev => ({
                    ...prev,
                    [sessionId]: {
                      pseudo: savedScore.pseudo || data.pseudo,
                      scorePerRound: savedScore.scorePerRound || [0, 0, 0, 0],
                      totalScore: savedScore.totalScore || 0,
                      activeRound4: true,
                      peerId: conn.peer,
                    },
                  }));
                  conn.send({
                    type: "sessionRestored",
                    totalScore: savedScore.totalScore,
                    round: currentRoundRef.current,
                  });
                } else {
                  setPlayers(prev => ({
                    ...prev,
                    [sessionId]: {
                      pseudo: data.pseudo,
                      scorePerRound: [0, 0, 0, 0],
                      totalScore: 0,
                      activeRound4: true,
                      peerId: conn.peer,
                    },
                  }));
                }
                sendCatchUpTimer(true);
              });
            }
            return;
          }

          if (data.type === "playerResponse") {
            const sessionId = peerToSession.current[conn.peer];
            if (!sessionId) return;

            const pl = playlistRef.current;
            const idx = currentSongIndexRef.current;
            const round = currentRoundRef.current;
            if (!pl || !pl.songs || typeof idx !== "number") return;

            const song = pl.songs[idx];
            const resp = data.response || {};
            if (typeof resp.songIndex === "number" && resp.songIndex !== idx) return;
            const responseTime = resp.responseTime ? parseFloat(resp.responseTime) : null;
            resp.responseTime = responseTime;

            // ── Manche 1 : QCM — le dernier choix compte, notation à la fin du temps ──
            if (round === 1) {
              const open = finalizedRef.current !== idx && (isCountingRef.current || Date.now() < acceptUntilRef.current);
              const opts = roundOptionsRef.current;
              const i = resp.choiceIndex;
              if (!open || !opts || !Number.isInteger(i) || i < 0 || i >= opts.options.length) return;
              choicesRef.current[sessionId] = { index: i, time: responseTime };
              const chosen = opts.options[i];
              setResponses(prev => [
                ...prev.filter(r => r.playerId !== sessionId),
                { ...resp, title: chosen.title, artist: chosen.artist, choiceIndex: i, playerId: sessionId },
              ]);
              sendAnswersCount(Object.keys(choicesRef.current).length);
              return;
            }

            // ── Manches 2 à 4 : réponse saisie, une seule par chanson ──
            const round4Active = playersRef.current[sessionId]?.activeRound4 ?? true;
            if (round === 4 && !round4Active) return;
            if (answeredRef.current[sessionId]) return;
            answeredRef.current[sessionId] = true;

            const result = scoreTextAnswer(round, { title: (resp.title || "").trim(), artist: (resp.artist || "").trim() }, song);
            let points = result.points;
            let isFastestBonus = false;
            let round3BonusAmount = 0;

            if (round === 2 && points > 0 && !fastestRef.current) {
              points += POINTS.round2FastestBonus;
              isFastestBonus = true;
              fastestRef.current = { playerId: sessionId, time: responseTime };
              setFastest(fastestRef.current);
              setBonusWinnerId(sessionId);
            }

            if (round === 3 && result.both) {
              const bonusOrder = bonusOrderRef.current[idx] || [];
              bonusOrderRef.current[idx] = [...bonusOrder, sessionId];
              round3BonusAmount = round3BonusForPosition(bonusOrder.length);
              points += round3BonusAmount;
            }

            // Manche 4 : aucune bonne réponse → éliminé
            if (round === 4 && result.points === 0) {
              setPlayers(prev => prev[sessionId]
                ? { ...prev, [sessionId]: { ...prev[sessionId], activeRound4: false } }
                : prev);
              conn.send({ type: "eliminatedRound4" });
            }

            const updated = points > 0 ? applyPoints(sessionId, round, points) : playersRef.current[sessionId];

            resp.points = points;
            setResponses(prev => [...prev, { ...resp, playerId: sessionId }]);
            conn.send({
              type: "responseAck", points, fastest: isFastestBonus, round3Bonus: round3BonusAmount,
              totalScore: updated ? updated.totalScore : undefined,
            });
            sendAnswersCount(responsesRef.current.length + 1);
          }
        } catch (e) {
          console.error("Erreur traitement data :", e);
        }
      });
    });

    return () => {
      if (newPeer) newPeer.destroy();
    };
  }, [authenticated]);

  useEffect(() => {
    if (secondsLeft > 0 && isCounting) {
      const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (secondsLeft === 0 && isCounting) {
      setIsCounting(false);
      if (currentRoundRef.current === 1) {
        // marge pour les derniers choix en transit, puis notation
        acceptUntilRef.current = Date.now() + 1500;
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = setTimeout(finalizeRound1, 1600);
      }
    }
  }, [secondsLeft, isCounting]);

  // Manche 4 : les joueurs ont 45 s pour répondre mais n'entendent la chanson que 30 s
  useEffect(() => {
    if (!isCounting || currentRound !== 4 || audioCut) return;
    if (totalSeconds - secondsLeft >= ROUND_CONFIG[4].audio) {
      setAudioCut(true);
      if (audioRef.current) audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  }, [secondsLeft, isCounting, currentRound, totalSeconds, audioCut]);

  // Remet à zéro l'état d'une chanson (lancement, changement de chanson)
  const resetSongState = () => {
    clearTimeout(finalizeTimerRef.current);
    choicesRef.current = {};
    answeredRef.current = {};
    finalizedRef.current = -1;
    acceptUntilRef.current = 0;
    songPayloadRef.current = {};
    setAudioCut(false);
    setResponses([]);
    setFastest(null);
    fastestRef.current = null;
    setRevealed(false);
    setRankingSent(false);
  };

  const startSong = () => {
    if (!playlist || !playlist.songs) return;
    const song = playlist.songs[currentSongIndex];
    const songFile = song?.file;
    const cfg = ROUND_CONFIG[currentRound];
    const duration = cfg.seconds;

    if (!songFile) {
      alert("Fichier audio manquant pour cette chanson");
      return;
    }

    resetSongState();

    // Infos propres à la manche (les téléphones ne reçoivent jamais les titres des propositions)
    const extra = { audioSeconds: cfg.audio };
    let geExtra = {};
    if (currentRound === 1) {
      const built = buildOptions(playlist.songs, currentSongIndex);
      roundOptionsRef.current = built;
      setRoundOptions(built);
      extra.optionCount = built.options.length;
      geExtra = { options: built.options };
    } else {
      roundOptionsRef.current = null;
      setRoundOptions(null);
      if (currentRound === 2) extra.theme = themeFor(song);
    }
    songPayloadRef.current = extra;

    connections.forEach(conn =>
      conn.send({ type: "startTimer", seconds: duration, songIndex: currentSongIndex, round: currentRound, ...extra })
    );
    geConnections.forEach(conn =>
      conn.send({
        type: "startTimer", seconds: duration, songIndex: currentSongIndex, round: currentRound,
        roundName: roundNames[currentRound - 1] || '',
        songNumber: currentSongIndex - cfg.start + 1,
        totalInRound: cfg.end - cfg.start + 1,
        totalPlayers: Object.keys(playersRef.current).length,
        ...extra, ...geExtra,
      })
    );
    setTotalSeconds(duration);
    setSecondsLeft(duration);
    setIsCounting(true);
    bonusOrderRef.current[currentSongIndex] = [];
    if (audioRef.current) {
      audioRef.current.src = `/playlists/${selectedPlaylist}/${songFile}`;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.warn("Lecture audio bloquée :", err));
      setIsAudioPlaying(true);
    }
  };

  const revealCurrentSong = () => {
    const songToReveal = playlist?.songs?.[currentSongIndex];
    if (!songToReveal) return;
    const totalPlayers = Object.keys(playersRef.current).length;

    let playerExtra = {};
    let geExtra = {};
    let stats;

    if (currentRound === 1 && roundOptionsRef.current) {
      // Notation immédiate (sans attendre la marge de fin de temps)
      acceptUntilRef.current = 0;
      finalizeRound1();
      const { options, correctIndex } = roundOptionsRef.current;
      const votes = options.map(() => 0);
      Object.values(choicesRef.current).forEach(c => { votes[c.index] += 1; });
      const totalVotes = votes.reduce((a, b) => a + b, 0);
      playerExtra = { correctIndex };
      geExtra = { correctIndex, options, votes };
      stats = { parfait: votes[correctIndex], rate: totalVotes - votes[correctIndex], sans: Math.max(0, totalPlayers - totalVotes) };
    } else {
      let parfait = 0, bien = 0, rate = 0;
      responses.forEach(r => {
        const titleOk = isCorrect(r.title || '', songToReveal.title);
        const artistOk = currentRound === 2 ? true : isArtistCorrect(r.artist || '', songToReveal.artist);
        if (titleOk && artistOk) parfait++;
        else if (titleOk || (currentRound !== 2 && artistOk)) bien++;
        else rate++;
      });
      stats = { parfait, bien, rate, sans: Math.max(0, totalPlayers - responses.length) };
    }

    connections.forEach(c => {
      try { c.send({ type: "revealAnswer", title: songToReveal.title, artist: songToReveal.artist, ...playerExtra }); } catch (e) {}
    });
    geConnections.forEach(c => {
      try { c.send({ type: "revealAnswer", title: songToReveal.title, artist: songToReveal.artist, stats, ...geExtra }); } catch (e) { /* ignore */ }
    });

    setRevealed(true);
  };

  const togglePause = () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.warn("Lecture audio bloquée :", err));
      setIsAudioPlaying(true);
    }
  };

  const lastSongIndex = playlist && playlist.songs ? Math.min(playlist.songs.length - 1, ROUND_CONFIG[4].end) : 0;

  const goToSong = (newSongIndex) => {
    setCurrentRound(roundForIndex(newSongIndex));
    setCurrentSongIndex(newSongIndex);
    resetSongState();
    setRoundOptions(null);
    roundOptionsRef.current = null;
    setIsCounting(false);
    setSecondsLeft(0);
    setIsAudioPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

  const nextSong = () => {
    if (!playlist || currentSongIndex >= lastSongIndex) return;
    finalizeRound1();
    const songToReveal = playlist.songs[currentSongIndex];
    if (songToReveal) {
      const correctIndex = currentRound === 1 && roundOptionsRef.current ? { correctIndex: roundOptionsRef.current.correctIndex } : {};
      connections.forEach(c => {
        try { c.send({ type: "revealAnswer", title: songToReveal.title, artist: songToReveal.artist, ...correctIndex }); } catch (e) {}
      });
    }
    goToSong(currentSongIndex + 1);
  };

  const previousSong = () => {
    if (currentSongIndex > 0) {
      finalizeRound1();
      goToSong(currentSongIndex - 1);
    }
  };

  const currentSong = playlist && playlist.songs ? playlist.songs[currentSongIndex] : null;

  // ── AUTH SCREEN ────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="mo-app" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <Stars />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 400, padding: '0 20px' }}>
          <div className="mo-display mo-neon" style={{ fontSize: 40, color: 'var(--mo-cyan)', marginBottom: 32 }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </div>
          <Panel style={{ padding: 32 }}>
            <Eyebrow style={{ color: 'var(--mo-cyan)' }}>Accès Hôte</Eyebrow>
            <p style={{ marginTop: 12, marginBottom: 24, color: 'var(--mo-ink-dim)', fontSize: 14 }}>
              Entre le mot de passe pour accéder à la régie
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAuthSubmit()}
              placeholder="Mot de passe"
              className="mo-input mo-input--magenta"
              style={{ marginBottom: 16, fontFamily: 'var(--mo-font-body)', fontSize: 16 }}
            />
            <Btn variant="cyan" onClick={handleAuthSubmit} style={{ width: '100%' }}>
              Valider
            </Btn>
          </Panel>
        </div>
      </div>
    );
  }

  // ── RÉGIE HÔTE ────────────────────────────────────────────
  const waveformProgress = totalSeconds > 0 ? 1 - (secondsLeft / totalSeconds) : 0;

  const adjustBtnStyle = (color) => ({
    background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 6,
    fontFamily: 'var(--mo-font-mono)', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
  });

  const getResponsePalette = (r) => {
    if (r.choiceIndex !== undefined) {
      const mic = MIC_CHOICES[r.choiceIndex];
      if (r.points === undefined) return { c: mic.color, label: `CHOIX ${mic.letter}` };
      return r.correct ? { c: 'var(--mo-cyan)', label: 'BONNE RÉPONSE' } : { c: 'rgba(255,255,255,0.15)', label: 'RATÉ' };
    }
    if (r.points === undefined) return { c: 'rgba(255,45,149,0.3)', label: 'EN ATTENTE' };
    if (r.points === 0) return { c: 'rgba(255,255,255,0.15)', label: 'RATÉ' };
    const titleOk = isCorrect(r.title || '', currentSong?.title || '');
    const artistOk = isArtistCorrect(r.artist || '', currentSong?.artist || '');
    if (titleOk && artistOk) return { c: 'var(--mo-cyan)', label: 'PARFAIT' };
    return { c: 'var(--mo-gold)', label: 'PARTIEL' };
  };

  return (
    <div className="mo-app" style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
    }}>
      <Stars />

      {/* ── TOP BAR ── */}
      <div style={{
        position: 'relative', zIndex: 10, flex: '0 0 auto', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid var(--mo-line)',
        background: 'rgba(7,2,26,0.85)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="mo-display" style={{ color: 'var(--mo-magenta)', fontSize: 17 }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </span>
          <span style={{ width: 1, height: 20, background: 'var(--mo-line)' }} />
          {peerStatus === "ready" && <Chip live>EN DIRECT</Chip>}
          {peerStatus === "connecting" && <Chip>CONNEXION…</Chip>}
          {peerStatus === "error" && (
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-magenta)' }}>
              ❌ ERREUR PEERJS
            </span>
          )}
          {shortCode && <Chip>CODE · {shortCode}</Chip>}
          <Chip>{Object.keys(players).length} JOUEUR·SES</Chip>
          {playlist && playlist.songs && playlist.songs.length !== TOTAL_SONGS && (
            <span title={`Le jeu attend ${TOTAL_SONGS} chansons (15 + 15 + 25 + 10)`} style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-gold)' }}>
              ⚠ {playlist.songs.length}/{TOTAL_SONGS} CHANSONS
            </span>
          )}
          <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-ink-dim)', letterSpacing: '0.1em' }}>
            MANCHE {currentRound} · CHANSON {currentSongIndex - ROUND_CONFIG[currentRound].start + 1}/{ROUND_CONFIG[currentRound].end - ROUND_CONFIG[currentRound].start + 1}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isCounting && (
            <>
              <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-cyan)' }}>● REC</span>
              <span className="mo-display" style={{ fontSize: 28, color: 'var(--mo-gold)', textShadow: '0 0 12px var(--mo-gold)' }}>
                {secondsLeft}s
              </span>
            </>
          )}
          <Btn
            variant="cyan"
            disabled={!shortCode}
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?screen=grand-ecran&code=${shortCode}`;
              window.open(url, '_blank');
            }}
            style={{ fontSize: 12, padding: '8px 16px' }}
          >
            🖥️ GRAND ÉCRAN
          </Btn>
        </div>
      </div>

      {/* ── 3-COLUMN CONTENT ── */}
      <div style={{
        position: 'relative', zIndex: 1, flex: '1 1 auto', minHeight: 0,
        display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 12, padding: 12,
      }}>

        {/* LEFT — Playlist */}
        <div className="mo-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--mo-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
              PLAYLIST
            </span>
            {playlist && (
              <span className="mo-display" style={{ fontSize: 11, color: 'var(--mo-cyan)' }}>
                {currentSongIndex + 1}/{playlist.songs.length}
              </span>
            )}
          </div>

          <div style={{ padding: '12px 10px' }}>
            <select
              value={selectedPlaylist}
              onChange={(e) => {
                setSelectedPlaylist(e.target.value);
                setPlayers({});
                setResponses([]);
                setCurrentSongIndex(0);
                setFastest(null);
                setIsCounting(false);
                setSecondsLeft(0);
              }}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1.5px solid var(--mo-cyan)', background: 'rgba(0,229,255,0.06)',
                color: 'var(--mo-ink)', fontSize: 13, fontFamily: 'var(--mo-font-display)',
                outline: 'none', marginBottom: 12,
              }}
            >
              <option value="playlist1">Playlist 1</option>
              <option value="playlist2">Playlist 2</option>
              <option value="playlist3">Playlist 3</option>
              <option value="playlist4">Playlist 4</option>
            </select>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {playlist && playlist.songs && playlist.songs.slice(
              Math.max(0, currentSongIndex - 2),
              currentSongIndex + 8
            ).map((song, i) => {
              const idx = Math.max(0, currentSongIndex - 2) + i;
              const isNow = idx === currentSongIndex;
              const isNext = idx === currentSongIndex + 1;
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 8px', borderRadius: 8,
                  background: isNow ? 'linear-gradient(90deg, rgba(255,45,149,0.18), transparent)' : 'transparent',
                  borderLeft: `2px solid ${isNow ? 'var(--mo-magenta)' : isNext ? 'var(--mo-cyan)' : 'transparent'}`,
                  marginBottom: 2,
                }}>
                  <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-ink-dim)', width: 22, flexShrink: 0 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: isNow ? 'var(--mo-magenta)' : 'var(--mo-ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{song.title}</div>
                    <div style={{
                      fontSize: 10, color: 'var(--mo-ink-dim)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{song.artist}</div>
                  </div>
                  {isNow && <Eq count={4} />}
                  {isNext && (
                    <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-cyan)', letterSpacing: '0.1em' }}>
                      NEXT
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER — Now playing */}
        <div className="mo-panel" style={{
          position: 'relative', overflow: 'hidden', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Spotlight cone */}
          <div style={{
            position: 'absolute', top: -60, left: '50%', width: 500, height: 500,
            background: 'radial-gradient(circle at 50% 0%, rgba(255,45,149,0.2), transparent 55%)',
            transform: 'translateX(-50%)', pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <Chip>MANCHE {currentRound}</Chip>
            {isCounting ? <Chip live>LECTURE</Chip> : <Chip>EN ATTENTE</Chip>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'center', position: 'relative' }}>
            <Vinyl size={180} labelColor="var(--mo-magenta)" />

            {currentSong && (
              <div style={{ textAlign: 'center' }}>
                <div className="mo-display mo-neon" style={{ fontSize: 28, color: 'var(--mo-magenta)', marginBottom: 4 }}>
                  {currentSong.title.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 14, color: 'var(--mo-cyan)', letterSpacing: '0.05em' }}>
                  {currentSong.artist.toUpperCase()}
                </div>
                {currentRound === 2 && (
                  <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-gold)', letterSpacing: '0.15em', marginTop: 6 }}>
                    THÈME AFFICHÉ : {themeFor(currentSong).toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {/* Manche 1 : les 4 propositions tirées pour cette chanson */}
            {currentRound === 1 && roundOptions && (
              <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {roundOptions.options.map((o, i) => {
                  const mic = MIC_CHOICES[i];
                  const isRight = i === roundOptions.correctIndex;
                  const votes = responses.filter(r => r.choiceIndex === i).length;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8,
                      border: `1px solid ${isRight ? mic.color : 'var(--mo-line)'}`,
                      background: isRight ? 'rgba(255,255,255,0.05)' : 'transparent',
                    }}>
                      <MicIcon color={mic.color} size={20} />
                      <span className="mo-display" style={{ fontSize: 11, color: mic.color, width: 12 }}>{mic.letter}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.title} <span style={{ color: 'var(--mo-ink-dim)' }}>· {o.artist}</span>
                      </span>
                      {isRight && <span style={{ fontSize: 10, color: 'var(--mo-cyan)' }}>✓ BONNE</span>}
                      <span className="mo-display" style={{ fontSize: 11, color: 'var(--mo-ink-dim)' }}>{votes}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hidden audio element */}
            <audio ref={audioRef} style={{ display: 'none' }} />

            {/* Waveform */}
            <div style={{ width: '100%', maxWidth: 480 }}>
              <Waveform progress={waveformProgress} bars={60} />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-ink-dim)', marginTop: 6,
              }}>
                <span>{totalSeconds - secondsLeft > 0 ? `${totalSeconds - secondsLeft}s` : '0s'}</span>
                {isCounting
                  ? <span style={{ color: 'var(--mo-gold)' }}>{audioCut ? '🔇 MUSIQUE COUPÉE · RÉPONSES OUVERTES' : '● RÉPONSES OUVERTES'}</span>
                  : <span>EN ATTENTE</span>
                }
                <span>{totalSeconds > 0 ? `${totalSeconds}s` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Transport */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn variant="ghost" onClick={previousSong} style={{ width: 48, height: 48, padding: 0, borderRadius: 999, flexShrink: 0 }}>◀◀</Btn>
            <Btn variant="gold" onClick={startSong} style={{ flex: 1, maxWidth: 200 }}>🚨 LANCER</Btn>
            {isAudioPlaying && (
              <Btn variant="ghost" onClick={togglePause} style={{ width: 48, height: 48, padding: 0, borderRadius: 999, flexShrink: 0 }}>⏸</Btn>
            )}
            {!isAudioPlaying && isCounting && !audioCut && (
              <Btn variant="cyan" onClick={togglePause} style={{ width: 48, height: 48, padding: 0, borderRadius: 999, flexShrink: 0 }}>▶</Btn>
            )}
            <Btn variant="ghost" onClick={nextSong} style={{ width: 48, height: 48, padding: 0, borderRadius: 999, flexShrink: 0 }}>▶▶</Btn>
          </div>

          {/* Reveal */}
          <Btn
            variant={revealed ? 'ghost' : 'magenta'}
            onClick={revealCurrentSong}
            disabled={!currentSong}
            style={{ width: '100%' }}
          >
            {revealed ? '✓ RÉPONSE RÉVÉLÉE' : '👁 RÉVÉLER LA RÉPONSE'}
          </Btn>

          {/* Classement intermédiaire — visible uniquement à la fin des manches 1, 2 et 3 */}
          {isEndOfRound(currentSongIndex) && (
            <Btn
              variant={rankingSent ? 'ghost' : 'cyan'}
              onClick={() => { sendRankingToPlayers(); setRankingSent(true); }}
              style={{ width: '100%' }}
            >
              {rankingSent ? '✓ CLASSEMENT ENVOYÉ' : '📊 MONTRER LE CLASSEMENT'}
            </Btn>
          )}

          {playlist && playlist.songs && currentSongIndex === lastSongIndex && (
            <Btn
              variant={finalSent ? 'ghost' : 'gold'}
              onClick={sendFinalRanking}
              style={{ width: '100%' }}
            >
              {finalSent ? '✓ PODIUM ENVOYÉ' : '🏆 AFFICHER LE PODIUM FINAL'}
            </Btn>
          )}
        </div>

        {/* RIGHT — Responses + Scores */}
        <div className="mo-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Responses header */}
          <div style={{
            padding: '12px 14px', borderBottom: '1px solid var(--mo-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
              RÉPONSES LIVE
            </span>
            <span className="mo-display" style={{ fontSize: 11, color: 'var(--mo-magenta)' }}>{responses.length}</span>
          </div>

          {/* Responses list */}
          <div style={{ flex: '0 0 auto', maxHeight: '45%', overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {responses.length === 0 ? (
              <p style={{ color: 'var(--mo-ink-dim)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>En attente…</p>
            ) : (
              responses.map((r, i) => {
                const pal = getResponsePalette(r);
                return (
                  <div key={i} style={{
                    border: '1px solid var(--mo-line)',
                    borderLeft: `3px solid ${pal.c}`,
                    borderRadius: 10, padding: '8px 10px',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--mo-font-display)', fontSize: 11, color: 'var(--mo-ink)' }}>
                        {players[r.playerId]?.pseudo || '?'}
                      </span>
                      <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.1em', color: pal.c }}>
                        {pal.label} {r.points !== undefined ? `· +${r.points}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 8, color: 'var(--mo-ink-dim)', letterSpacing: '0.1em' }}>TITRE</div>
                        <div style={{ fontWeight: 600, color: 'var(--mo-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title || '—'}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 8, color: 'var(--mo-ink-dim)', letterSpacing: '0.1em' }}>ARTISTE</div>
                        <div style={{ fontWeight: 600, color: 'var(--mo-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.artist || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Scores divider */}
          <div style={{
            padding: '10px 14px 8px', borderTop: '1px solid var(--mo-line)', borderBottom: '1px solid var(--mo-line)',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
              SCORES · AJUSTEMENT MANUEL (manche {currentRound})
            </span>
          </div>

          {/* Scores list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {Object.keys(players).length === 0 ? (
              <p style={{ color: 'var(--mo-ink-dim)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                En attente des joueurs…
              </p>
            ) : (
              Object.entries(players)
                .sort(([, a], [, b]) => (b.totalScore || 0) - (a.totalScore || 0))
                .map(([id, p], i) => (
                  <div key={id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 8px', borderBottom: '1px solid var(--mo-line)',
                    background: i === 0 ? 'linear-gradient(90deg, rgba(255,214,10,0.08), transparent)' : 'transparent',
                    borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mo-display" style={{
                        fontSize: 12,
                        color: i === 0 ? 'var(--mo-gold)' : i === 1 ? 'var(--mo-cyan)' : i === 2 ? 'var(--mo-magenta)' : 'var(--mo-ink-dim)',
                      }}>#{i + 1}</span>
                      <span style={{ fontFamily: 'var(--mo-font-display)', fontSize: 12 }}>{p.pseudo}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        title={`Retirer 1 point à ${p.pseudo}`}
                        onClick={() => adjustScore(id, -1)}
                        style={adjustBtnStyle('var(--mo-magenta)')}
                      >−1</button>
                      <span className="mo-display" style={{ fontSize: 14, color: 'var(--mo-gold)', minWidth: 26, textAlign: 'center' }}>{p.totalScore}</span>
                      <button
                        title={`Ajouter 1 point à ${p.pseudo}`}
                        onClick={() => adjustScore(id, 1)}
                        style={adjustBtnStyle('var(--mo-cyan)')}
                      >+1</button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
