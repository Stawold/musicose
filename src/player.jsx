import React, { useState, useEffect } from "react";
import { Peer } from "peerjs";
import { Btn, Input, Panel, Eyebrow } from "./components/MoUI";
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

const roundNames = ["Chansons en rafale", "Le Focus", "Fast and Musicous", "Le battle Royal d'Ose"];

export default function Player() {
  const [joinStep, setJoinStep] = useState("pseudo"); // "pseudo" | "code" | "joined"
  const [pseudoInput, setPseudoInput] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
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

  const KVDB_BASE = "https://kvdb.io/GVkYCf2Kfn44jq3EYGweRj/";

  const resolveShortCode = async (shortCode) => {
    try {
      const res = await fetch(`${KVDB_BASE}${encodeURIComponent(shortCode)}`);
      if (!res.ok) throw new Error("Code introuvable");
      return res.text().then(text => text.trim());
    } catch (e) {
      console.warn("Erreur résolution shortCode:", e);
      return null;
    }
  };

  const handleJoinGame = async () => {
    if (joinStep === "pseudo") {
      if (!pseudoInput.trim()) {
        alert("Entre un pseudo !");
        return;
      }
      setPseudo(pseudoInput);
      setJoinStep("code");
      return;
    }

    if (joinStep === "code") {
      if (!codeInput.trim()) {
        alert("Entre un code !");
        return;
      }

      const newPeer = new Peer();
      setPeer(newPeer);

      newPeer.on("open", async () => {
        let realHostId = codeInput.trim();
        if (codeInput.toUpperCase().startsWith("OSE-")) {
          const resolved = await resolveShortCode(codeInput.toUpperCase());
          if (!resolved) {
            alert("❌ Code introuvable. Vérifie le code ou demande à l'hôte.");
            return;
          }
          realHostId = resolved;
        }

        const connection = newPeer.connect(realHostId);
        setConn(connection);

        connection.on("open", () => {
          connection.send({ type: "newPlayer", pseudo: pseudoInput });
          setJoinStep("joined");
        });

        connection.on("data", (data) => {
          if (data.type === "startTimer") {
            setCorrectAnswer(null);
            setSecondsLeft(data.seconds);
            setCanPlay(true);
            setCurrentSongIndex(typeof data.songIndex === "number" ? data.songIndex : null);
            if (typeof data.round === "number") setCurrentRound(data.round);
            setRoundStartTime(Date.now());
          } else if (data.type === "eliminatedRound4") {
            setActiveRound4(false);
          } else if (data.type === "revealAnswer") {
            setCorrectAnswer({ title: data.title || "", artist: data.artist || "" });
            setCanPlay(false);
          } else if (data.type === "showRanking") {
            setRankingData(data.ranking || []);
            setShowRanking(true);
            setCanPlay(false);
          } else if (data.type === "showFinalRanking") {
            setRankingData(data.ranking || []);
            setShowRanking(true);
            setCanPlay(false);
            alert("🎊 Fin du jeu ! Voici le classement final !");
          }
        });
      });
    }
  };

  // Timer
  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (secondsLeft === 0 && canPlay) {
      setCanPlay(false);
    }
  }, [secondsLeft, canPlay]);

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
    conn.send({ type: "playerResponse", response });
    setTitle("");
    setArtist("");
    setCanPlay(false);
  };

  const handleRankingContinue = () => {
    if (conn) conn.send({ type: "rankingAcknowledged" });
    setShowRanking(false);
  };

  const containerStyle = {
    background: "linear-gradient(135deg, var(--mo-bg-0) 0%, var(--mo-bg-1) 100%)",
    color: "var(--mo-ink)",
    fontFamily: "var(--mo-font-body)",
    textAlign: "center",
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: "2rem",
    paddingBottom: "2rem",
    overflow: "hidden",
    position: "relative",
  };

  // ÉCRAN D'INSCRIPTION
  if (joinStep !== "joined") {
    return (
      <div style={containerStyle}>
        <h1 style={{ fontSize: "2.5rem", color: "var(--mo-magenta)", marginBottom: "2rem" }}>
          Music'Ose
        </h1>

        <Panel style={{ maxWidth: "350px", width: "90%" }}>
          {joinStep === "pseudo" && (
            <>
              <Eyebrow>Étape 1</Eyebrow>
              <p style={{ marginTop: "1rem", marginBottom: "1.5rem", color: "var(--mo-ink-dim)" }}>
                Quel est ton pseudo ?
              </p>
              <Input
                color="magenta"
                type="text"
                value={pseudoInput}
                onChange={(e) => setPseudoInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
                placeholder="Ton pseudo"
                autoComplete="off"
                spellCheck="false"
                style={{ marginBottom: "1rem", WebkitUserSelect: "text" }}
              />
              <Btn variant="magenta" onClick={handleJoinGame} style={{ width: "100%" }}>
                Continuer
              </Btn>
            </>
          )}

          {joinStep === "code" && (
            <>
              <Eyebrow>Étape 2</Eyebrow>
              <p style={{ marginTop: "1rem", marginBottom: "1.5rem", color: "var(--mo-ink-dim)" }}>
                Code de la partie (OSE-XXXX ou ID complet)
              </p>
              <Input
                color="cyan"
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
                placeholder="Code"
                autoComplete="off"
                spellCheck="false"
                style={{ marginBottom: "1rem", WebkitUserSelect: "text" }}
              />
              <Btn variant="cyan" onClick={handleJoinGame} style={{ width: "100%" }}>
                Rejoindre
              </Btn>
            </>
          )}
        </Panel>
      </div>
    );
  }

  // ÉCRAN DE JEU
  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", color: "var(--mo-magenta)", marginBottom: "0.5rem" }}>
        Music'Ose
      </h1>

      {secondsLeft > 0 && (
        <div
          style={{
            fontSize: "3.5rem",
            color: "var(--mo-cyan)",
            fontWeight: "bold",
            marginBottom: "1rem",
            textShadow: "0 0 15px var(--mo-cyan)",
          }}
        >
          {secondsLeft}s
        </div>
      )}

      <h2
        style={{
          fontSize: "1.8rem",
          color: "var(--mo-magenta)",
          marginBottom: "0.5rem",
          fontFamily: "var(--mo-font-display)",
          textShadow: "0 0 10px var(--mo-magenta)",
        }}
      >
        {pseudo}
      </h2>

      <h3
        style={{
          fontSize: "1.5rem",
          color: "var(--mo-gold)",
          marginBottom: "1.5rem",
          fontFamily: "var(--mo-font-display)",
        }}
      >
        {roundNames[currentRound - 1] || `Manche ${currentRound}`}
      </h3>

      {correctAnswer ? (
        <Panel style={{ maxWidth: "350px", marginBottom: "2rem" }}>
          <Eyebrow style={{ color: "var(--mo-gold)" }}>Réponse</Eyebrow>
          <p style={{ fontSize: "1.3rem", fontWeight: "bold", marginTop: "0.5rem" }}>
            {correctAnswer.title}
          </p>
          <p style={{ fontSize: "1rem", opacity: 0.9 }}>— {correctAnswer.artist}</p>
          <p style={{ fontSize: "0.9rem", marginTop: "1rem", opacity: 0.7 }}>
            Attends que l'hôte passe à la chanson suivante
          </p>
        </Panel>
      ) : (
        <div style={{ width: "100%", maxWidth: "350px", marginBottom: "2rem" }}>
          <Input
            color="magenta"
            type="text"
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canPlay || (currentRound === 4 && !activeRound4)}
            autoComplete="off"
            spellCheck="false"
            style={{ marginBottom: "1rem", WebkitUserSelect: "text" }}
          />
          {currentRound !== 2 && (
            <Input
              color="magenta"
              type="text"
              placeholder="Artiste"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={!canPlay || (currentRound === 4 && !activeRound4)}
              autoComplete="off"
              spellCheck="false"
              style={{ marginBottom: "1rem", WebkitUserSelect: "text" }}
            />
          )}
          {!activeRound4 && currentRound === 4 && (
            <p style={{ color: "var(--mo-magenta)", marginTop: "1rem" }}>
              ❌ Tu ne peux plus jouer sur cette manche.
            </p>
          )}
          <Btn
            variant="magenta"
            onClick={handleSubmit}
            disabled={!canPlay || (currentRound === 4 && !activeRound4)}
            style={{ width: "100%", fontSize: "1.3rem", padding: "1rem" }}
          >
            ✅ VALIDER
          </Btn>
        </div>
      )}

      {showRanking && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <Panel style={{ maxWidth: "400px", width: "90%", textAlign: "center" }}>
            <h2 style={{ color: "var(--mo-gold)", marginBottom: "1.5rem", fontSize: "2rem" }}>
              🏆 Classement
            </h2>
            {rankingData.map((player, index) => (
              <div key={index} style={{ fontSize: "1.2rem", margin: "0.5rem 0" }}>
                <strong style={{ color: index === 0 ? "var(--mo-gold)" : "var(--mo-ink)" }}>
                  {index + 1}. {player.pseudo || player.name}
                </strong>{" "}
                — {player.score} pts
              </div>
            ))}
            <Btn variant="cyan" onClick={handleRankingContinue} style={{ marginTop: "2rem", width: "100%" }}>
              Continuer ▶️
            </Btn>
          </Panel>
        </div>
      )}
    </div>
  );
}
