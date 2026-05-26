import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Btn, Panel, Chip, Eq, Eyebrow, Stars, Vinyl, Waveform } from "./components/MoUI";
import { peerConfig } from "./peerConfig";
import "./styles/tokens.css";

// Distance de Levenshtein
const levenshtein = (a, b) => {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1].toLowerCase() === a[j - 1].toLowerCase())
        matrix[i][j] = matrix[i - 1][j - 1];
      else
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
    }
  }
  return matrix[b.length][a.length];
};

const normalize = (s) => {
  if (!s) return '';
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[(\[{][^)\]{}]*[)\]{}]/g, ' ')
    .replace(/[-''''.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|les|le|la|l|un|une|a|an|des)\s+/i, '')
    .trim();
};

const isCorrect = (answer, correct) => {
  if (!answer || !correct) return false;
  const a = normalize(answer);
  const c = normalize(correct);
  const dist = levenshtein(a, c);
  const maxDist = Math.max(1, Math.floor(c.length * 0.15));
  return dist <= maxDist;
};

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

  const bonusOrderRef = useRef({});
  const audioRef = useRef(null);
  const playlistRef = useRef(playlist);
  const currentSongIndexRef = useRef(currentSongIndex);
  const currentRoundRef = useRef(currentRound);
  const playersRef = useRef({});
  const shortCodeRef = useRef(null);
  const peerToSession = useRef({});

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { shortCodeRef.current = shortCode; }, [shortCode]);

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
  };

  const isEndOfRound = (songIndex) => {
    return [29, 39, 69, 84].includes(songIndex);
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

  const buildRanking = () => {
    return Object.values(playersRef.current)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map(p => ({ pseudo: p.pseudo, score: p.totalScore }));
  };

  const sendFinalRanking = () => {
    const ranking = buildRanking();
    connections.forEach(conn => {
      try { conn.send({ type: "showFinalRanking", ranking, wow: true }); } catch (e) { /* ignore */ }
    });
    alert("Classement final envoyé aux joueurs !");
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
      });

      conn.on("open", () => conn.send({ type: "welcome", message: "Bienvenue sur Music'Ose !" }));

      conn.on("data", (data) => {
        try {
          if (data.type === "newPlayer") {
            const sessionId = data.sessionId || conn.peer;
            peerToSession.current[conn.peer] = sessionId;

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
            const resp = data.response;
            if (typeof resp.songIndex === "number" && resp.songIndex !== idx) return;

            const playerTitle = (resp.title || "").trim();
            const playerArtist = (resp.artist || "").trim();
            const correctTitle = song.title;
            const correctArtist = song.artist;
            let points = 0;
            const round4Active = playersRef.current[sessionId]?.activeRound4 ?? true;
            const responseTime = resp.responseTime ? parseFloat(resp.responseTime) : null;
            resp.responseTime = responseTime;

            switch (round) {
              case 1:
                if (isCorrect(playerTitle, correctTitle) && isCorrect(playerArtist, correctArtist)) points = 3;
                else if (isCorrect(playerTitle, correctTitle) || isCorrect(playerArtist, correctArtist)) points = 1;
                if (points === 3 && responseTime !== null) {
                  setFastest(prev => {
                    if (!prev || responseTime < prev.time) {
                      points += 1;
                      setBonusWinnerId(sessionId);
                      return { playerId: sessionId, time: responseTime };
                    }
                    return prev;
                  });
                }
                break;
              case 2:
                if (isCorrect(playerTitle, correctTitle)) points = 2;
                break;
              case 3:
                if (isCorrect(playerTitle, correctTitle) && isCorrect(playerArtist, correctArtist)) points = 3;
                else if (isCorrect(playerTitle, correctTitle) || isCorrect(playerArtist, correctArtist)) points = 1;
                break;
              case 4:
                if (!round4Active) return;
                if (isCorrect(playerTitle, correctTitle) && isCorrect(playerArtist, correctArtist)) points = 5;
                else if (isCorrect(playerTitle, correctTitle) || isCorrect(playerArtist, correctArtist)) points = 2;
                break;
              default:
                points = 0;
            }

            if (points > 0) {
              const currentPlayer = playersRef.current[sessionId];
              if (currentPlayer) {
                const newScorePerRound = [...currentPlayer.scorePerRound];
                newScorePerRound[round - 1] = (newScorePerRound[round - 1] || 0) + points;
                const newTotalScore = (currentPlayer.totalScore || 0) + points;

                setPlayers(prev => {
                  const updated = { ...prev };
                  if (updated[sessionId]) {
                    updated[sessionId] = {
                      ...updated[sessionId],
                      scorePerRound: newScorePerRound,
                      totalScore: newTotalScore,
                    };
                  }
                  return updated;
                });

                saveScoreToKvdb(sessionId, {
                  pseudo: currentPlayer.pseudo,
                  scorePerRound: newScorePerRound,
                  totalScore: newTotalScore,
                });
              }
            }

            resp.points = points;
            setResponses(prev => [...prev, { ...resp, playerId: sessionId }]);
            conn.send({ type: "responseAck", points });
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
    }
  }, [secondsLeft, isCounting]);

  const startSong = () => {
    if (!playlist || !playlist.songs) return;
    const songFile = playlist.songs[currentSongIndex]?.file;
    const duration = currentRound === 1 ? 30 : currentRound === 2 ? 25 : currentRound === 3 ? 20 : 20;

    if (!songFile) {
      alert("Fichier audio manquant pour cette chanson");
      return;
    }

    connections.forEach(conn =>
      conn.send({ type: "startTimer", seconds: duration, songIndex: currentSongIndex, round: currentRound })
    );
    setTotalSeconds(duration);
    setSecondsLeft(duration);
    setIsCounting(true);
    setFastest(null);
    setResponses([]);
    setRevealed(false);
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
    connections.forEach(c => {
      try { c.send({ type: "revealAnswer", title: songToReveal.title, artist: songToReveal.artist }); } catch (e) {}
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

  const nextSong = () => {
    if (!playlist) return;
    if (currentSongIndex < playlist.songs.length - 1) {
      if (isEndOfRound(currentSongIndex)) sendRankingToPlayers();

      const songToReveal = playlist.songs[currentSongIndex];
      if (songToReveal) {
        connections.forEach(c => {
          try { c.send({ type: "revealAnswer", title: songToReveal.title, artist: songToReveal.artist }); } catch (e) {}
        });
      }

      const newSongIndex = currentSongIndex + 1;
      let newRound = currentRound;
      if (newSongIndex === 30) newRound = 2;
      if (newSongIndex === 40) newRound = 3;
      if (newSongIndex === 70) newRound = 4;
      setCurrentRound(newRound);
      setCurrentSongIndex(newSongIndex);
      setResponses([]);
      setIsCounting(false);
      setSecondsLeft(0);
      setFastest(null);
      setRevealed(false);
      setIsAudioPlaying(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }
  };

  const previousSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(i => i - 1);
      setResponses([]);
      setIsCounting(false);
      setSecondsLeft(0);
      setFastest(null);
      setIsAudioPlaying(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
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

  const getResponsePalette = (r) => {
    if (r.points === undefined) return { c: 'rgba(255,45,149,0.3)', label: 'EN ATTENTE' };
    if (r.points === 0) return { c: 'rgba(255,255,255,0.15)', label: 'RATÉ' };
    const titleOk = isCorrect(r.title || '', currentSong?.title || '');
    const artistOk = isCorrect(r.artist || '', currentSong?.artist || '');
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
          <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 11, color: 'var(--mo-ink-dim)', letterSpacing: '0.1em' }}>
            MANCHE {currentRound} · CHANSON {currentSongIndex + 1}{playlist ? `/${playlist.songs.length}` : ''}
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
                  ? <span style={{ color: 'var(--mo-gold)' }}>● RÉPONSES OUVERTES</span>
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
            {!isAudioPlaying && isCounting && (
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

          {playlist && playlist.songs && currentSongIndex === playlist.songs.length - 1 && (
            <Btn variant="magenta" onClick={sendFinalRanking} style={{ width: '100%' }}>
              🎉 Classement final
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
              SCORES
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
                    <span className="mo-display" style={{ fontSize: 14, color: 'var(--mo-gold)' }}>{p.totalScore}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
