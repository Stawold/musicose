import React, { useState, useEffect } from "react";
import { Btn, Eyebrow } from "./components/MoUI";
import Host from "./host";
import Player from "./player";
import "./styles/tokens.css";

export default function App() {
  const [mode, setMode] = useState("");

  useEffect(() => {
    const savedMode = localStorage.getItem("musicose_mode");
    if (savedMode) setMode(savedMode);
  }, []);

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    localStorage.setItem("musicose_mode", selectedMode);
  };

  const handleResetMode = () => {
    setMode("");
    localStorage.removeItem("musicose_mode");
  };

  if (mode === "host") {
    return (
      <div>
        <Host />
        <button
          onClick={handleResetMode}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            background: "var(--mo-gold)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            zIndex: 1000,
          }}
        >
          🔄 Changer de mode
        </button>
      </div>
    );
  }

  if (mode === "player") {
    return (
      <div>
        <Player />
        <button
          onClick={handleResetMode}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            background: "var(--mo-gold)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            zIndex: 1000,
          }}
        >
          🔄 Changer de mode
        </button>
      </div>
    );
  }

  // --- PAGE D'ACCUEIL DESIGN NÉON ---
  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--mo-bg-0) 0%, var(--mo-bg-1) 100%)",
        color: "var(--mo-ink)",
        fontFamily: "var(--mo-font-display)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "2rem",
        width: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Décor fond */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255, 45, 149, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(0, 229, 255, 0.1) 0%, transparent 50%)
          `,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <h1
          style={{
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            fontWeight: "900",
            color: "var(--mo-magenta)",
            textShadow: `
              0 0 20px var(--mo-magenta),
              0 0 40px var(--mo-magenta),
              0 0 60px rgba(255, 45, 149, 0.5)
            `,
            marginBottom: "1rem",
            letterSpacing: "0.05em",
          }}
        >
          Music'Ose
        </h1>

        <Eyebrow
          style={{
            fontSize: "1.2rem",
            marginBottom: "3rem",
            color: "var(--mo-cyan)",
            textShadow: "0 0 10px var(--mo-cyan)",
          }}
        >
          Le jeu musical qui fait vibrer
        </Eyebrow>

        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Btn
            variant="magenta"
            onClick={() => handleModeSelect("host")}
            style={{ fontSize: "1.3rem", padding: "1rem 2.5rem" }}
          >
            🎙️ Mode Hôte
          </Btn>
          <Btn
            variant="cyan"
            onClick={() => handleModeSelect("player")}
            style={{ fontSize: "1.3rem", padding: "1rem 2.5rem" }}
          >
            🎮 Mode Joueur
          </Btn>
        </div>
      </div>
    </div>
  );
}
