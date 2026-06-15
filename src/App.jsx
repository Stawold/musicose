import React, { useState, useEffect } from "react";
import { Btn, Chip, Eyebrow, Stars, GridFloor, Eq } from "./components/MoUI";
import Host from "./host";
import Player from "./player";
import GrandEcran from "./grandEcran";
import "./styles/tokens.css";

function RoleCard({ title, description, buttonLabel, variant, label, icon, onClick }) {
  const color = variant === 'cyan' ? 'var(--mo-cyan)' : 'var(--mo-magenta)';
  const glowRgba = variant === 'cyan'
    ? 'rgba(0,229,255,0.5)'
    : 'rgba(255,45,149,0.5)';
  const glowInner = variant === 'cyan'
    ? 'rgba(0,229,255,0.2)'
    : 'rgba(255,45,149,0.2)';

  return (
    <div
      className="mo-panel"
      style={{
        width: 300,
        padding: 28,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner chip */}
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <Chip>{label}</Chip>
      </div>

      {/* Icon circle */}
      <div style={{
        width: 80,
        height: 80,
        margin: '12px auto 20px',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 24px ${glowRgba}, inset 0 0 16px ${glowInner}`,
      }}>
        {icon}
      </div>

      {/* Title */}
      <div
        className="mo-display"
        style={{ fontSize: 28, color }}
      >
        {title}
      </div>

      {/* Description */}
      <p style={{
        fontSize: 14,
        color: 'var(--mo-ink-dim)',
        margin: '12px 0 24px',
      }}>
        {description}
      </p>

      {/* Button */}
      <Btn variant={variant} style={{ width: '100%' }} onClick={onClick}>
        {buttonLabel}
      </Btn>
    </div>
  );
}

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

  if (new URLSearchParams(window.location.search).get("screen") === "grand-ecran") {
    return <GrandEcran />;
  }

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
            padding: "0.5rem 1.2rem",
            fontSize: "0.85rem",
            fontFamily: "var(--mo-font-display)",
            background: "var(--mo-gold)",
            color: "var(--mo-bg-0)",
            border: "none",
            borderRadius: "var(--mo-r-pill)",
            cursor: "pointer",
            zIndex: 1000,
            letterSpacing: "0.05em",
          }}
        >
          CHANGER DE MODE
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
            padding: "0.5rem 1.2rem",
            fontSize: "0.85rem",
            fontFamily: "var(--mo-font-display)",
            background: "var(--mo-gold)",
            color: "var(--mo-bg-0)",
            border: "none",
            borderRadius: "var(--mo-r-pill)",
            cursor: "pointer",
            zIndex: 1000,
            letterSpacing: "0.05em",
          }}
        >
          CHANGER DE MODE
        </button>
      </div>
    );
  }

  // --- HOME SCREEN ---
  return (
    <div
      className="mo-app"
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Background layers */}
      <Stars />
      <GridFloor />

      {/* Top-left chips */}
      <div style={{ position: 'absolute', top: 28, left: 32, display: 'flex', gap: 10, zIndex: 2 }}>
        <Chip live={true}>LIVE BLIND TEST</Chip>
        <Chip style={{ fontFamily: 'var(--mo-font-mono)' }}>v. 2.0 · NEON</Chip>
      </div>

      {/* Top-right equalizer */}
      <div style={{ position: 'absolute', top: 28, right: 32, zIndex: 2 }}>
        <Eq count={7} />
      </div>

      {/* Center stack */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
      }}>
        {/* Title */}
        <h1
          className="mo-display mo-neon"
          style={{
            margin: 0,
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            color: 'var(--mo-magenta)',
          }}
        >
          MUSIC<span style={{ color: 'var(--mo-gold)' }}>'</span>OSE
        </h1>

        {/* Subtitle */}
        <div style={{
          fontFamily: 'var(--mo-font-mono)',
          fontSize: 13,
          letterSpacing: '0.4em',
          color: 'var(--mo-ink-dim)',
          textTransform: 'uppercase',
        }}>
          ── Le blind test qui ose ──
        </div>

        {/* Role cards */}
        <div style={{ display: 'flex', gap: 28, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          <RoleCard
            title="HÔTE"
            description="Lance la partie, gère la playlist, valide les réponses."
            buttonLabel="OUVRIR LA RÉGIE"
            variant="cyan"
            label="CONSOLE"
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--mo-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 3px var(--mo-cyan)) drop-shadow(0 0 10px var(--mo-cyan))' }}>
                {/* Vinyl record */}
                <circle cx="11" cy="15" r="8" />
                <circle cx="11" cy="15" r="5" />
                <circle cx="11" cy="15" r="2" fill="var(--mo-cyan)" stroke="none" />
                {/* Tonearm pivot */}
                <circle cx="21" cy="5" r="1.5" fill="var(--mo-cyan)" stroke="none" />
                {/* Tonearm */}
                <line x1="21" y1="5" x2="15" y2="11" strokeWidth="2" />
                {/* Needle */}
                <line x1="15" y1="11" x2="13" y2="13.5" />
              </svg>
            }
            onClick={() => handleModeSelect("host")}
          />
          <RoleCard
            title="JOUEUR·SE"
            description="Entre le code, devine titre et artiste, buzze tes potes."
            buttonLabel="REJOINDRE"
            variant="magenta"
            label="SCÈNE"
            icon={
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--mo-magenta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 3px var(--mo-magenta)) drop-shadow(0 0 10px var(--mo-magenta))' }}>
                {/* Mic capsule */}
                <rect x="8" y="1" width="8" height="12" rx="4" />
                {/* Grille lines */}
                <line x1="9.5" y1="5" x2="14.5" y2="5" />
                <line x1="9.5" y1="9" x2="14.5" y2="9" />
                {/* Suspension */}
                <path d="M6 13 Q6 18 12 18 Q18 18 18 13" />
                {/* Stand pole */}
                <line x1="12" y1="18" x2="12" y2="22" />
                {/* Base */}
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
            }
            onClick={() => handleModeSelect("player")}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: 'var(--mo-font-mono)',
        fontSize: 11,
        letterSpacing: '0.25em',
        color: 'rgba(255,255,255,0.3)',
      }}>
        ░░ STAGE READY — ENCEINTES À FOND ░░
      </div>
    </div>
  );
}
