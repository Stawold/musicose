import React from 'react';

// Micro néon d'une couleur donnée (manche 1 : un micro = une proposition)
export default function MicIcon({ color = 'var(--mo-magenta)', size = 64, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 10px ${color})`, ...style }}>
      <rect x="8.5" y="2" width="7" height="12" rx="3.5" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8.5" y1="22" x2="15.5" y2="22" />
    </svg>
  );
}
