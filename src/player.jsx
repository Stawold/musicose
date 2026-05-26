import React, { useState, useEffect } from "react";
import { Peer } from "peerjs";
import { Btn, Input, Panel, Eyebrow, Chip, Eq, Stars, GridFloor } from "./components/MoUI";
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

const roundNames = ["Chansons en rafale", "Le Focus", "Fast and Musicous", "Le battle Royal d'Ose"];

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

export default function Player() {
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
  const [restoredScore, setRestoredScore] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState(null);
  const [totalScore, setTotalScore] = useState(0);

  const KVDB_BASE = "https://kvdb.io/GVkYCf2Kfn44jq3EYGweRj/";

  useEffect(() => {
    const saved = localStorage.getItem("musicose_session");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.sessionId) setSessionId(data.sessionId);
        if (data.pseudo) {
          setPseudoInput(data.pseudo);
          setPseudo(data.pseudo);
          setJoinStep("code");
        }
        if (data.gameCode) setCodeInput(data.gameCode);
        if (data.avatarColor) setAvatarColor(data.avatarColor);
      } catch (e) {
        localStorage.removeItem("musicose_session");
      }
    }
  }, []);

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
      if (!pseudoInput.trim()) { alert("Entre un pseudo !"); return; }
      const sid = sessionId || generateSessionId();
      setSessionId(sid);
      setPseudo(pseudoInput.trim());
      setJoinStep("code");
      return;
    }

    if (joinStep === "code") {
      if (!codeInput.trim()) { alert("Entre un code !"); return; }

      const finalSessionId = sessionId || generateSessionId();
      const finalPseudo = pseudo || pseudoInput.trim();
      const finalCode = codeInput.trim();

      localStorage.setItem("musicose_session", JSON.stringify({
        sessionId: finalSessionId,
        pseudo: finalPseudo,
        gameCode: finalCode.toUpperCase(),
        avatarColor,
      }));

      const newPeer = new Peer(undefined, peerConfig);
      setPeer(newPeer);

      newPeer.on("open", async () => {
        let realHostId = finalCode;
        if (finalCode.toUpperCase().startsWith("OSE-")) {
          const resolved = await resolveShortCode(finalCode.toUpperCase());
          if (!resolved) {
            alert("❌ Code introuvable. Vérifie le code ou demande à l'hôte.");
            return;
          }
          realHostId = resolved;
        }

        const connection = newPeer.connect(realHostId);
        setConn(connection);

        connection.on("open", () => {
          connection.send({ type: "newPlayer", pseudo: finalPseudo, sessionId: finalSessionId });
          setJoinStep("joined");
        });

        connection.on("data", (data) => {
          if (data.type === "startTimer") {
            setCorrectAnswer(null);
            setSubmittedAnswer(null);
            setTitle("");
            setArtist("");
            setSecondsLeft(data.seconds);
            setTotalSeconds(data.seconds);
            setCanPlay(true);
            setCurrentSongIndex(typeof data.songIndex === "number" ? data.songIndex : null);
            if (typeof data.round === "number") setCurrentRound(data.round);
            setRoundStartTime(Date.now());
          } else if (data.type === "responseAck") {
            if (typeof data.points === "number") {
              setTotalScore(prev => prev + data.points);
            }
          } else if (data.type === "sessionRestored") {
            setRestoredScore(data.totalScore);
            setTotalScore(data.totalScore || 0);
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

  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (secondsLeft === 0 && canPlay) {
      handleSubmit();
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
    setSubmittedAnswer({ title, artist });
    conn.send({ type: "playerResponse", response });
    setTitle("");
    setArtist("");
    setCanPlay(false);
  };

  const handleRankingContinue = () => {
    if (conn) conn.send({ type: "rankingAcknowledged" });
    setShowRanking(false);
  };

  const initials = pseudo ? pseudo.slice(0, 2).toUpperCase() : '?';
  const timerProgress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

  // ── JOIN: PSEUDO ────────────────────────────────────────────
  if (joinStep === "pseudo") {
    return (
      <div className="mo-app" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <Stars />
        <GridFloor />

        <div style={{ position: 'absolute', top: 28, left: 18, right: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          <div className="mo-display" style={{ fontSize: 18, color: 'var(--mo-magenta)' }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </div>
          <Chip live>READY</Chip>
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360, padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.3em', color: avatarColor }}>SCÈNE 01</span>
            <h2 className="mo-display" style={{ fontSize: 36, color: avatarColor, margin: '10px 0 6px', lineHeight: 0.95, textShadow: '0 0 6px currentColor' }}>
              REJOINDRE<br/>UNE PARTIE
            </h2>
            <p style={{ fontSize: 12, color: 'var(--mo-ink-dim)', fontFamily: 'var(--mo-font-mono)' }}>
              Demande le code à l'animateur·rice
            </p>
          </div>

          <Panel style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: avatarColor, boxShadow: `0 0 8px ${avatarColor}`, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: avatarColor }}>TON BLAZE</span>
              </div>
              <Input
                color={getAvatarInputColor(avatarColor)}
                type="text"
                value={pseudoInput}
                onChange={(e) => setPseudoInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
                placeholder="Ton pseudo"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <div>
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-ink-dim)', marginBottom: 10 }}>
                AVATAR
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                {AVATAR_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setAvatarColor(c)}
                    style={{
                      width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
                      background: `radial-gradient(circle at 30% 25%, ${c}, rgba(0,0,0,0.4))`,
                      border: avatarColor === c ? `2.5px solid ${c}` : '1.5px solid rgba(255,255,255,0.1)',
                      boxShadow: avatarColor === c ? `0 0 16px ${c}` : 'none',
                      position: 'relative', transition: 'all 0.15s ease',
                    }}
                  >
                    {avatarColor === c && (
                      <span style={{
                        position: 'absolute', bottom: -4, right: -4, width: 18, height: 18,
                        borderRadius: '50%', background: 'var(--mo-bg-0)',
                        border: `2px solid ${c}`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: c, fontSize: 10,
                      }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Btn variant={getAvatarVariant(avatarColor)} onClick={handleJoinGame} style={{ width: '100%', fontSize: 15, padding: '16px 20px' }}>
              ⚡ ENTRER SUR SCÈNE
            </Btn>
          </Panel>
        </div>
      </div>
    );
  }

  // ── JOIN: CODE ─────────────────────────────────────────────
  if (joinStep === "code") {
    return (
      <div className="mo-app" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <Stars />
        <GridFloor />

        <div style={{ position: 'absolute', top: 28, left: 18, right: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          <div className="mo-display" style={{ fontSize: 18, color: 'var(--mo-magenta)' }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </div>
          <Chip live>READY</Chip>
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360, padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--mo-cyan)' }}>
              {sessionId ? 'REPRENDRE LA PARTIE' : 'ÉTAPE 2'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: `radial-gradient(circle at 30% 25%, ${avatarColor}, rgba(0,0,0,0.3))`,
                border: `2px solid ${avatarColor}`,
                boxShadow: `0 0 12px ${avatarColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mo-font-display)', fontSize: 14, color: 'var(--mo-bg-0)',
              }}>{initials}</div>
              <div className="mo-display" style={{ fontSize: 24, color: avatarColor }}>{pseudo}</div>
            </div>
            {sessionId && (
              <p style={{ fontSize: 11, color: 'var(--mo-cyan)', marginTop: 8, fontFamily: 'var(--mo-font-mono)' }}>
                Session sauvegardée — tu retrouveras tes points
              </p>
            )}
          </div>

          <Panel style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mo-cyan)', boxShadow: '0 0 8px var(--mo-cyan)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-cyan)' }}>CODE DE LA PARTIE</span>
              </div>
              <Input
                color="cyan"
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
                placeholder="OSE-XXXX"
                autoComplete="off"
                spellCheck="false"
              />
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-dim)', marginTop: 6, letterSpacing: '0.2em', textAlign: 'center' }}>
                FORMAT · OSE-XXXX
              </div>
            </div>

            <Btn variant="cyan" onClick={handleJoinGame} style={{ width: '100%', fontSize: 15, padding: '16px 20px' }}>
              ⚡ REJOINDRE
            </Btn>

            <button
              onClick={() => {
                localStorage.removeItem("musicose_session");
                setSessionId("");
                setPseudo("");
                setPseudoInput("");
                setCodeInput("");
                setJoinStep("pseudo");
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--mo-ink-faint)',
                fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline',
                fontFamily: 'var(--mo-font-body)', textAlign: 'center', padding: 0,
              }}
            >
              Changer de joueur
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  // ── JOINED — WAITING ROOM ─────────────────────────────────
  if (joinStep === "joined" && !canPlay && !correctAnswer && !showRanking && submittedAnswer === null) {
    return (
      <div className="mo-app" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}>
        <Stars />

        {/* Top bar */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 18px' }}>
          <div>
            <div className="mo-display" style={{ fontSize: 14, color: 'var(--mo-magenta)' }}>
              MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
            </div>
            {codeInput && (
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
                CODE · {codeInput.toUpperCase()}
              </div>
            )}
          </div>
          <Chip live>CONNECTÉ·E</Chip>
        </div>

        {/* Avatar + pseudo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', position: 'relative', zIndex: 2 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 25%, ${avatarColor}, rgba(0,0,0,0.3))`,
            border: `2px solid ${avatarColor}`, boxShadow: `0 0 10px ${avatarColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mo-font-display)', fontSize: 12, color: 'var(--mo-bg-0)',
          }}>{initials}</div>
          <div>
            <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 16 }}>{pseudo}</div>
            {(restoredScore !== null) && (
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-cyan)', letterSpacing: '0.15em' }}>
                {restoredScore} PTS RESTAURÉS
              </div>
            )}
          </div>
        </div>

        {/* Spinning disc */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative', zIndex: 2 }}>
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent 0deg, var(--mo-cyan) 30deg, transparent 60deg, var(--mo-magenta) 180deg, transparent 240deg, var(--mo-gold) 320deg, transparent 360deg)',
              animation: 'mo-rotate 4s linear infinite',
              filter: 'blur(2px)',
            }} />
            <div style={{
              position: 'absolute', inset: 14, borderRadius: '50%',
              background: 'var(--mo-bg-0)', border: '2px solid var(--mo-magenta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px var(--mo-magenta), inset 0 0 24px rgba(255,45,149,0.3)',
            }}>
              <Eq count={5} />
            </div>
          </div>

          <div className="mo-display mo-neon" style={{ fontSize: 36, color: 'var(--mo-magenta)', lineHeight: 0.95, textAlign: 'center' }}>
            EN ATTENTE
          </div>
        </div>

        {/* Tip */}
        <div style={{ padding: '0 18px 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ padding: 14, borderRadius: 14, border: '1px dashed var(--mo-line)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.3em', color: 'var(--mo-gold)' }}>★ TIP</div>
            <div style={{ fontSize: 12, color: 'var(--mo-ink-dim)', marginTop: 4 }}>
              Plus tu réponds vite, plus tu marques.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── JOINED — WAITING FOR REVEAL (submitted, host hasn't advanced yet) ─────────
  if (joinStep === "joined" && submittedAnswer !== null && !correctAnswer && !canPlay && !showRanking) {
    return (
      <div className="mo-app" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <Stars />
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 300, height: 300, pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(0,229,255,0.18), transparent 60%)',
        }} />

        <div style={{ position: 'absolute', top: 20, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <Chip live>RÉPONSE ENVOYÉE</Chip>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>{pseudo}</div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 20, padding: '80px 24px 24px', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--mo-cyan)',
              borderRightColor: 'var(--mo-magenta)',
              animation: 'mo-rotate 1.2s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 12, borderRadius: '50%',
              background: 'var(--mo-bg-0)', border: '1px solid var(--mo-line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Eq count={4} />
            </div>
          </div>

          <div className="mo-display mo-neon" style={{ fontSize: 34, color: 'var(--mo-cyan)', lineHeight: 0.95 }}>
            RÉPONSE<br/>ENVOYÉE
          </div>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-ink-dim)', letterSpacing: '0.2em' }}>
            EN ATTENTE DE LA RÉVÉLATION…
          </div>

          {(submittedAnswer.title || submittedAnswer.artist) && (
            <Panel style={{ padding: 16, width: '100%' }}>
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)', marginBottom: 8 }}>TA RÉPONSE</div>
              {submittedAnswer.title && (
                <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 16, color: 'var(--mo-ink)' }}>{submittedAnswer.title}</div>
              )}
              {submittedAnswer.artist && currentRound !== 2 && (
                <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 13, color: 'var(--mo-ink-dim)', marginTop: 4 }}>{submittedAnswer.artist}</div>
              )}
            </Panel>
          )}

          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-faint)', letterSpacing: '0.15em' }}>
            L'HÔTE VA RÉVÉLER LA RÉPONSE
          </div>
        </div>
      </div>
    );
  }

  // ── JOINED — REVEAL (correct answer received) ─────────────
  if (joinStep === "joined" && correctAnswer) {
    const titleCorrect = submittedAnswer && isCorrect(submittedAnswer.title, correctAnswer.title);
    const artistCorrect = submittedAnswer && isCorrect(submittedAnswer.artist, correctAnswer.artist);
    const gotPoints = submittedAnswer && (titleCorrect || artistCorrect);

    if (gotPoints) {
      // GOOD feedback
      return (
        <div className="mo-app" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
          <Stars />
          {/* Gold burst */}
          <div style={{
            position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 400, height: 400, pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(255,214,10,0.35), rgba(255,45,149,0.18) 30%, transparent 60%)',
          }} />

          <div style={{ position: 'absolute', top: 20, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <Chip live>RÉPONSE</Chip>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>{pseudo}</div>
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: '80px 24px 24px', textAlign: 'center' }}>
            {/* Gold badge */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'radial-gradient(circle, var(--mo-gold), #cc9c00)',
                boxShadow: '0 0 40px var(--mo-gold), inset 0 0 20px rgba(0,0,0,0.2)',
              }} />
              <svg viewBox="0 0 100 100" width="120" height="120" style={{ position: 'absolute', inset: 0 }}>
                <polygon points="50,18 60,42 86,42 65,58 73,82 50,68 27,82 35,58 14,42 40,42" fill="var(--mo-bg-0)" />
              </svg>
            </div>

            <div className="mo-display mo-neon" style={{ fontSize: 52, color: 'var(--mo-gold)', lineHeight: 0.9 }}>
              {titleCorrect && artistCorrect ? 'PARFAIT !' : 'BRAVO !'}
            </div>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--mo-cyan)' }}>
              {titleCorrect && artistCorrect ? 'TITRE + ARTISTE' : titleCorrect ? 'TITRE ✓' : 'ARTISTE ✓'} · {roundNames[currentRound - 1]}
            </div>

            <Panel style={{ padding: 18, width: '100%' }}>
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-ink-dim)' }}>LA RÉPONSE</div>
              <div className="mo-display" style={{ fontSize: 22, color: 'var(--mo-magenta)', marginTop: 6, lineHeight: 1.1 }}>
                {correctAnswer.title.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 14, color: 'var(--mo-cyan)', marginTop: 4, letterSpacing: '0.04em' }}>
                {correctAnswer.artist.toUpperCase()}
              </div>
            </Panel>

            <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--mo-line)', width: '100%', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Eq count={4} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Prochaine chanson bientôt…</div>
                  <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-ink-dim)', marginTop: 2 }}>L'hôte révèle aux autres joueurs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // BAD feedback
      return (
        <div className="mo-app" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
          <Stars />
          {/* Red wash */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center top, rgba(255,45,149,0.2), transparent 60%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'absolute', top: 20, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <Chip live>RÉPONSE</Chip>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>{pseudo}</div>
          </div>

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px 24px', gap: 16, textAlign: 'center' }}>
            {/* X badge */}
            <div style={{ position: 'relative', width: 110, height: 110 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '3px solid var(--mo-magenta)',
                boxShadow: '0 0 30px rgba(255,45,149,0.5), inset 0 0 16px rgba(255,45,149,0.2)',
                background: 'rgba(255,45,149,0.08)',
              }} />
              <svg viewBox="0 0 100 100" width="110" height="110" style={{ position: 'absolute', inset: 0 }}>
                <line x1="32" y1="32" x2="68" y2="68" stroke="var(--mo-magenta)" strokeWidth="6" strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 6px var(--mo-magenta))' }} />
                <line x1="68" y1="32" x2="32" y2="68" stroke="var(--mo-magenta)" strokeWidth="6" strokeLinecap="round"
                  style={{ filter: 'drop-shadow(0 0 6px var(--mo-magenta))' }} />
              </svg>
            </div>

            <div className="mo-display mo-neon" style={{ fontSize: 48, color: 'var(--mo-magenta)', lineHeight: 0.95 }}>
              {submittedAnswer ? 'RATÉ !' : 'TEMPS !'}
            </div>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-ink-dim)' }}>
              {submittedAnswer ? 'ON SE REFAIT SUR LA PROCHAINE' : 'LE TEMPS EST ÉCOULÉ'}
            </div>

            <Panel style={{ padding: 16, width: '100%', textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-ink-dim)' }}>C'ÉTAIT</div>
              <div className="mo-display" style={{ fontSize: 20, color: 'var(--mo-cyan)', marginTop: 6, lineHeight: 1.1 }}>
                {correctAnswer.title.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 13, color: 'var(--mo-gold)', marginTop: 4, letterSpacing: '0.04em' }}>
                {correctAnswer.artist.toUpperCase()}
              </div>
            </Panel>

            {submittedAnswer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'left' }}>
                {submittedAnswer.title && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,45,149,0.4)', background: 'rgba(255,45,149,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-dim)', letterSpacing: '0.2em' }}>TA RÉPONSE TITRE</div>
                      <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 13, color: 'var(--mo-magenta)', textDecoration: 'line-through' }}>{submittedAnswer.title}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-magenta)' }}>✗ NON</span>
                  </div>
                )}
                {submittedAnswer.artist && currentRound !== 2 && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,45,149,0.4)', background: 'rgba(255,45,149,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-dim)', letterSpacing: '0.2em' }}>TA RÉPONSE ARTISTE</div>
                      <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 13, color: 'var(--mo-magenta)', textDecoration: 'line-through' }}>{submittedAnswer.artist}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-magenta)' }}>✗ NON</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  // ── JOINED — GAME SCREEN ──────────────────────────────────
  return (
    <div className="mo-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <Stars />

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
        <div>
          <div className="mo-display" style={{ color: 'var(--mo-magenta)', fontSize: 13 }}>
            MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
          </div>
          {codeInput && (
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>
              CODE · {codeInput.toUpperCase()}
            </div>
          )}
        </div>
        {canPlay ? <Chip live>LIVE</Chip> : <Chip>EN ATTENTE</Chip>}
      </div>

      {/* Score */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: `radial-gradient(circle at 30% 25%, ${avatarColor}, rgba(0,0,0,0.3))`,
            border: `1.5px solid ${avatarColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mo-font-display)', fontSize: 11, color: 'var(--mo-bg-0)',
          }}>{initials}</div>
          <div>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>JOUEUR</div>
            <div style={{ fontFamily: 'var(--mo-font-display)', fontSize: 14 }}>{pseudo}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--mo-ink-dim)' }}>SCORE</div>
          <div className="mo-display" style={{ fontSize: 24, color: 'var(--mo-gold)', textShadow: '0 0 10px var(--mo-gold)' }}>
            {totalScore}
          </div>
        </div>
      </div>

      {/* Listening panel */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 18px', marginBottom: 16 }}>
        <Panel style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(255,45,149,0.2), transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 9, letterSpacing: '0.3em', color: 'var(--mo-ink-dim)' }}>
              MANCHE {currentRound} · {roundNames[currentRound - 1] || `MANCHE ${currentRound}`}
            </div>
            <div style={{ margin: '12px auto 8px', display: 'flex', justifyContent: 'center' }}>
              <Eq count={10} />
            </div>
            <div className="mo-display mo-neon" style={{ fontSize: 28, color: 'var(--mo-magenta)', margin: '4px 0' }}>
              {canPlay ? 'ÇA JOUE…' : 'EN ATTENTE'}
            </div>
            {canPlay && (
              <>
                <div style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, color: 'var(--mo-cyan)' }}>
                  {secondsLeft}s restantes
                </div>
                <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${timerProgress * 100}%`, height: '100%',
                    background: 'linear-gradient(90deg, var(--mo-cyan), var(--mo-magenta))',
                    boxShadow: '0 0 8px var(--mo-magenta)',
                    transition: 'width 1s linear',
                  }} />
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Inputs */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mo-cyan)', boxShadow: '0 0 8px var(--mo-cyan)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-cyan)' }}>TITRE</span>
          </div>
          <Input
            color="cyan"
            type="text"
            placeholder="Titre de la chanson…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canPlay || (currentRound === 4 && !activeRound4)}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {currentRound !== 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mo-magenta)', boxShadow: '0 0 8px var(--mo-magenta)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--mo-font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--mo-magenta)' }}>ARTISTE</span>
            </div>
            <Input
              color="magenta"
              type="text"
              placeholder="Artiste…"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={!canPlay || (currentRound === 4 && !activeRound4)}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        )}

        {!activeRound4 && currentRound === 4 && (
          <p style={{ color: 'var(--mo-magenta)', fontSize: 13, fontFamily: 'var(--mo-font-mono)', textAlign: 'center', letterSpacing: '0.1em' }}>
            ❌ ÉLIMINÉ·E DE CETTE MANCHE
          </p>
        )}

        <Btn
          variant="gold"
          onClick={handleSubmit}
          disabled={!canPlay || (currentRound === 4 && !activeRound4)}
          style={{ width: '100%', fontSize: 16, padding: '18px 20px' }}
        >
          ⚡ VALIDER MA RÉPONSE
        </Btn>

        {canPlay && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--mo-font-mono)', fontSize: 9, color: 'var(--mo-ink-dim)', letterSpacing: '0.2em' }}>
            PLUS C'EST RAPIDE, PLUS ÇA RAPPORTE
          </div>
        )}
      </div>

      {/* Ranking overlay */}
      {showRanking && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(7,2,26,0.96)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999,
        }}>
          <Stars />
          <Panel style={{ maxWidth: 380, width: '90%', textAlign: 'center', padding: 32, position: 'relative', zIndex: 2 }}>
            <div className="mo-display mo-neon" style={{ fontSize: 40, color: 'var(--mo-gold)', marginBottom: 24 }}>
              CLASSEMENT
            </div>
            {rankingData.map((player, index) => (
              <div key={index} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--mo-line)',
              }}>
                <span className="mo-display" style={{
                  fontSize: 18, width: 36, textAlign: 'left',
                  color: index === 0 ? 'var(--mo-gold)' : index === 1 ? 'var(--mo-cyan)' : index === 2 ? 'var(--mo-magenta)' : 'var(--mo-ink-dim)',
                  textShadow: index < 3 ? '0 0 8px currentColor' : 'none',
                }}>#{index + 1}</span>
                <span style={{ flex: 1, fontFamily: 'var(--mo-font-display)', fontSize: 14, textAlign: 'left' }}>
                  {player.pseudo || player.name}
                </span>
                <span className="mo-display" style={{
                  fontSize: 16,
                  color: index === 0 ? 'var(--mo-gold)' : 'var(--mo-ink)',
                }}>{player.score} pts</span>
              </div>
            ))}
            <Btn variant="cyan" onClick={handleRankingContinue} style={{ marginTop: 24, width: '100%' }}>
              Continuer ▶
            </Btn>
          </Panel>
        </div>
      )}
    </div>
  );
}
