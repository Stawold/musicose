import React, { useState, useEffect, useRef } from "react";
import { Peer } from "peerjs";
import { Btn, Panel, Chip, Eq, Eyebrow } from "./components/MoUI";
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

const isCorrect = (answer, correct) => {
  if (!answer || !correct) return false;
  const dist = levenshtein(answer.trim().toLowerCase(), correct.trim().toLowerCase());
  const maxDist = Math.max(1, Math.floor(correct.length * 0.15));
  return dist <= maxDist;
};

export default function Host() {
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

  const bonusOrderRef = useRef({});
  const audioRef = useRef(null);
  const playlistRef = useRef(playlist);
  const currentSongIndexRef = useRef(currentSongIndex);
  const currentRoundRef = useRef(currentRound);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentSongIndexRef.current = currentSongIndex; }, [currentSongIndex]);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);

  const HOST_PASSWORD = "melbose";

  // Authentification hôte
  useEffect(() => {
    const enteredPassword = prompt("Veuillez entrer le mot de passe pour accéder à l'espace Hôte :");
    if (enteredPassword !== HOST_PASSWORD) {
      alert("Mot de passe incorrect. Redirection vers l'accueil.");
      window.location.href = "/";
    }
  }, []);

  // Envoi classement (manches)
  const sendRankingToPlayers = () => {
    const ranking = Object.values(players)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map(p => ({ pseudo: p.pseudo, score: p.totalScore }));
    connections.forEach(conn => {
      try { conn.send({ type: "showRanking", ranking }); } catch (e) { /* ignore */ }
    });
  };

  const isEndOfRound = (songIndex) => {
    return [29, 39, 69, 84].includes(songIndex);
  };

  // ====== KVDB (stockage serveur) ======
  const KVDB_BASE = "https://kvdb.io/GVkYCf2Kfn44jq3EYGweRj/";

  const sendShortCodeToKvdb = async (shortCode, hostId) => {
    try {
      const res = await fetch(`${KVDB_BASE}${encodeURIComponent(shortCode)}`, {
        method: "PUT",
        body: hostId,
      });
      if (!res.ok) console.warn("Erreur écriture kvdb", res.status);
    } catch (e) {
      console.error("Erreur kvdb PUT", e);
    }
  };

  // Charger playlist
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

  // Helper: préparer classement trié
  const buildRanking = () => {
    return Object.values(players)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map(p => ({ pseudo: p.pseudo, score: p.totalScore }));
  };

  // Fonction pour envoyer classement final
  const sendFinalRanking = () => {
    const ranking = buildRanking();
    connections.forEach(conn => {
      try { conn.send({ type: "showFinalRanking", ranking, wow: true }); } catch (e) { /* ignore */ }
    });
    alert("Classement final envoyé aux joueurs !");
  };

  // PeerJS
  useEffect(() => {
    const newPeer = new Peer();
    setPeer(newPeer);

    newPeer.on("open", async (id) => {
      setHostId(id);
      try {
        const sc = "OSE-" + id.slice(-4).toUpperCase();
        setShortCode(sc);
        console.log("ShortCode généré :", sc);
        sendShortCodeToKvdb(sc, id);
      } catch (e) {
        console.warn("Erreur génération shortCode :", e);
      }
    });

    newPeer.on("connection", (conn) => {
      setConnections(prev => [...prev, conn]);
      conn.on("open", () => conn.send({ type: "welcome", message: "Bienvenue sur Music'Ose !" }));

      conn.on("data", (data) => {
        try {
          if (data.type === "newPlayer") {
            setPlayers(prev => ({
              ...prev,
              [conn.peer]: {
                pseudo: data.pseudo,
                scorePerRound: [0, 0, 0, 0],
                totalScore: 0,
                activeRound4: true
              }
            }));
            return;
          }

          if (data.type === "playerResponse") {
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
            const round4Active = players[conn.peer]?.activeRound4 ?? true;
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
                      setBonusWinnerId(conn.peer);
                      return { playerId: conn.peer, time: responseTime };
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
              setPlayers(prev => {
                const updated = { ...prev };
                if (updated[conn.peer]) {
                  updated[conn.peer].scorePerRound[round - 1] += points;
                  updated[conn.peer].totalScore += points;
                }
                return updated;
              });
            }

            resp.points = points;
            setResponses(prev => [...prev, { ...resp, playerId: conn.peer }]);
            conn.send({ type: "revealAnswer", title: correctTitle, artist: correctArtist });
          }
        } catch (e) {
          console.error("Erreur traitement data :", e);
        }
      });
    });

    return () => {
      if (newPeer) newPeer.destroy();
    };
  }, []);

  // Timer
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
    const duration = currentRound === 1 ? 8 : currentRound === 2 ? 10 : currentRound === 3 ? 12 : 15;

    if (!songFile) {
      alert("Fichier audio manquant pour cette chanson");
      return;
    }

    connections.forEach(conn =>
      conn.send({ type: "startTimer", seconds: duration, songIndex: currentSongIndex, round: currentRound })
    );
    setSecondsLeft(duration);
    setIsCounting(true);
    setFastest(null);
    setResponses([]);
    bonusOrderRef.current[currentSongIndex] = [];
    if (audioRef.current) {
      audioRef.current.src = `/playlists/${selectedPlaylist}/${songFile}`;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.warn("Lecture audio bloquée :", err));
    }
  };

  const nextSong = () => {
    if (!playlist) return;
    if (currentSongIndex < playlist.songs.length - 1) {
      if (isEndOfRound(currentSongIndex)) sendRankingToPlayers();
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
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }
  };

  const currentSong = playlist && playlist.songs ? playlist.songs[currentSongIndex] : null;

  // Styles
  const containerStyle = {
    background: "linear-gradient(135deg, var(--mo-bg-0) 0%, var(--mo-bg-1) 100%)",
    color: "var(--mo-ink)",
    fontFamily: "var(--mo-font-display)",
    textAlign: "center",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: "2rem",
    overflowY: "auto",
    position: "relative",
  };

  const titleStyle = {
    fontSize: "clamp(2rem, 4vw, 3rem)",
    fontWeight: "900",
    color: "var(--mo-cyan)",
    textShadow: "0 0 20px var(--mo-cyan), 0 0 40px rgba(0, 229, 255, 0.3)",
    marginBottom: "0.5rem",
  };

  const subtitleStyle = {
    fontSize: "clamp(1rem, 2vw, 1.3rem)",
    color: "var(--mo-ink-dim)",
    marginBottom: "2rem",
  };

  return (
    <div style={containerStyle}>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "1200px", paddingX: "2rem" }}>
        <h1 style={titleStyle}>Music'Ose</h1>
        <h2 style={subtitleStyle}>Régie Hôte</h2>

        {hostId && (
          <Panel style={{ marginBottom: "1rem" }}>
            <Eyebrow style={{ color: "var(--mo-cyan)" }}>Code de connexion</Eyebrow>
            <p style={{ fontSize: "1.8rem", color: "var(--mo-cyan)", fontWeight: "bold", margin: "0.5rem 0" }}>
              {shortCode || hostId}
            </p>
          </Panel>
        )}

        <Panel style={{ marginBottom: "1.5rem" }}>
          <Eyebrow>Playlist</Eyebrow>
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
              fontSize: "1rem",
              padding: "0.5rem",
              borderRadius: "8px",
              border: "2px solid var(--mo-cyan)",
              background: "var(--mo-bg-2)",
              color: "var(--mo-ink)",
              marginTop: "0.5rem",
            }}
          >
            <option value="playlist1">Playlist 1</option>
            <option value="playlist2">Playlist 2</option>
            <option value="playlist3">Playlist 3</option>
          </select>
        </Panel>

        {currentSong && (
          <Panel style={{ marginBottom: "1.5rem" }}>
            <Eyebrow style={{ color: "var(--mo-gold)" }}>Chanson actuelle</Eyebrow>
            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: "0.5rem 0" }}>
              {currentSongIndex + 1} / {playlist.songs.length} — Manche {currentRound}
            </p>
            <audio
              ref={audioRef}
              controls
              style={{
                marginTop: "1rem",
                width: "100%",
                maxWidth: "500px",
              }}
            />
            <div style={{ marginTop: "0.5rem", fontSize: "1rem" }}>
              <strong>{currentSong.title}</strong> — {currentSong.artist}
            </div>
          </Panel>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={previousSong}>⏮️ Précédente</Btn>
          <Btn variant="gold" onClick={startSong}>🚨 Lancer</Btn>
          <Btn variant="ghost" onClick={nextSong}>⏭️ Suivante</Btn>
        </div>

        {playlist && playlist.songs && currentSongIndex === playlist.songs.length - 1 && (
          <Btn variant="magenta" onClick={sendFinalRanking} style={{ marginBottom: "1.5rem" }}>
            🎉 Classement final
          </Btn>
        )}

        {isCounting && (
          <div
            style={{
              fontSize: "3rem",
              color: "var(--mo-gold)",
              fontWeight: "bold",
              marginBottom: "1.5rem",
              textShadow: "0 0 20px var(--mo-gold)",
            }}
          >
            ⏱️ {secondsLeft}s
          </div>
        )}

        <Panel style={{ marginBottom: "1.5rem" }}>
          <Eyebrow>Réponses</Eyebrow>
          {responses.length === 0 ? (
            <p>En attente...</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, textAlign: "left" }}>
              {responses.map((r, i) => (
                <li key={i} style={{ fontSize: "0.9rem", padding: "0.5rem", borderBottom: "1px solid var(--mo-line)" }}>
                  <strong>{players[r.playerId]?.pseudo || "?"}</strong> → {r.title} / {r.artist} —{" "}
                  <span style={{ color: "var(--mo-gold)" }}>{r.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <Eyebrow>Scores</Eyebrow>
          {Object.keys(players).length === 0 ? (
            <p>En attente des joueurs...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--mo-cyan)" }}>
                  <th style={{ padding: "0.5rem" }}>Pseudo</th>
                  <th style={{ padding: "0.5rem" }}>M1</th>
                  <th style={{ padding: "0.5rem" }}>M2</th>
                  <th style={{ padding: "0.5rem" }}>M3</th>
                  <th style={{ padding: "0.5rem" }}>M4</th>
                  <th style={{ padding: "0.5rem" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(players).map(([id, p], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--mo-line)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: "bold" }}>{p.pseudo}</td>
                    {p.scorePerRound.map((s, idx) => (
                      <td key={idx} style={{ padding: "0.5rem" }}>
                        {s}
                      </td>
                    ))}
                    <td style={{ padding: "0.5rem", color: "var(--mo-gold)", fontWeight: "bold" }}>
                      {p.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
