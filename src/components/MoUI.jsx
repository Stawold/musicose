// ============================================================
// MUSIC'OSE — Reusable React components (DA "Néon Discothèque")
// ============================================================

import React from 'react';

/* ----- Chip --------------------------------------------- */
export function Chip({ live = false, children, ...rest }) {
  return (
    <span className="mo-chip" {...rest}>
      {live && <span className="mo-chip__dot" />}
      {children}
    </span>
  );
}

/* ----- Button ------------------------------------------- */
// variant: 'magenta' (default) | 'cyan' | 'gold' | 'ghost'
export function Btn({ variant = 'magenta', className = '', children, ...rest }) {
  const cls = ['mo-btn', variant !== 'magenta' && `mo-btn--${variant}`, className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/* ----- Panel -------------------------------------------- */
export function Panel({ className = '', children, ...rest }) {
  return <div className={`mo-panel ${className}`} {...rest}>{children}</div>;
}

/* ----- Input -------------------------------------------- */
// color: 'cyan' (default) | 'magenta'
export const Input = React.forwardRef(function Input({ color = 'cyan', className = '', ...rest }, ref) {
  const cls = ['mo-input', color === 'magenta' && 'mo-input--magenta', className].filter(Boolean).join(' ');
  return <input ref={ref} className={cls} {...rest} />;
});

Input.displayName = 'Input';

/* ----- Eq (animated equalizer) -------------------------- */
export function Eq({ count = 9 }) {
  return (
    <div className="mo-eq" aria-hidden>
      {Array.from({ length: count }, (_, i) => <i key={i} />)}
    </div>
  );
}

/* ----- Neon note (decorative SVG) ----------------------- */
export function NeonNote({ size = 40, color = 'var(--mo-magenta)', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ color, ...style }} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
         style={{ filter: 'drop-shadow(0 0 4px currentColor) drop-shadow(0 0 10px currentColor)' }}>
        <path d="M14 28V8l16-4v20" />
        <circle cx="11" cy="29" r="4" fill="currentColor" />
        <circle cx="27" cy="25" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

/* ----- Eyebrow (mono uppercase label) ------------------- */
export function Eyebrow({ children, color, style }) {
  return (
    <div className="mo-eyebrow" style={{ color, ...style }}>{children}</div>
  );
}

/* ----- Background layers -------------------------------- */
export function Stars()     { return <div className="mo-stars" />; }
export function GridFloor() { return <div className="mo-grid-floor" />; }

/* ----- Vinyl (spinning record) -------------------------- */
export function Vinyl({ size = 220, labelColor = 'var(--mo-magenta)', labelText, glow = true }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'repeating-radial-gradient(circle at center, #0a0212 0 2px, #1a0828 2px 4px)',
        animation: 'mo-rotate 8s linear infinite',
        boxShadow: glow
          ? '0 0 0 8px rgba(255,255,255,0.04), 0 0 40px rgba(255,45,149,0.5)'
          : '0 0 0 8px rgba(255,255,255,0.04)',
      }} />
      <div style={{
        position: 'absolute', inset: '38%', borderRadius: '50%',
        background: `radial-gradient(circle, ${labelColor}, var(--mo-violet))`,
        animation: 'mo-rotate 8s linear infinite',
        boxShadow: `0 0 20px ${labelColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--mo-font-display)', color: 'var(--mo-bg-0)', fontSize: 14,
      }}>{labelText}</div>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', width: 12, height: 12,
        background: 'var(--mo-bg-0)', borderRadius: '50%',
        transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 2px var(--mo-gold)',
      }} />
    </div>
  );
}

/* ----- Player avatar ------------------------------------ */
// color: any CSS color (use design tokens for consistency)
export function Avatar({ initials, color = 'var(--mo-magenta)', size = 42, selected = false, online = false }) {
  return (
    <div style={{
      position: 'relative', width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${color}, rgba(0,0,0,0.3))`,
      border: selected ? `2px solid ${color}` : '1px solid var(--mo-line)',
      boxShadow: selected ? `0 0 12px ${color}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--mo-font-display)',
      fontSize: Math.round(size * 0.30), color: 'var(--mo-bg-0)',
    }}>
      {initials}
      {online && (
        <span style={{
          position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
          borderRadius: '50%', background: 'var(--mo-cyan)',
          border: '2px solid var(--mo-bg-0)', boxShadow: '0 0 6px var(--mo-cyan)',
        }} />
      )}
    </div>
  );
}

/* ----- Waveform (static progress display) --------------- */
export function Waveform({ progress = 0.35, bars = 80 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.7) * 50) + Math.abs(Math.cos(i * 1.3) * 25);
        const active = i / bars < progress;
        return (
          <span key={i} style={{
            flex: 1, height: `${Math.min(h, 100)}%`,
            background: active
              ? 'linear-gradient(180deg, var(--mo-cyan), var(--mo-magenta))'
              : 'rgba(255,255,255,0.12)',
            borderRadius: 1,
            boxShadow: active ? '0 0 6px var(--mo-magenta)' : 'none',
          }} />
        );
      })}
    </div>
  );
}
