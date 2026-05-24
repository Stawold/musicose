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
export function Btn({ variant = 'magenta', className = '', children, ...rest }) {
  const cls = ['mo-btn', variant !== 'magenta' && `mo-btn--${variant}`, className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

/* ----- Panel -------------------------------------------- */
export function Panel({ className = '', children, ...rest }) {
  return <div className={`mo-panel ${className}`} {...rest}>{children}</div>;
}

/* ----- Input -------------------------------------------- */
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

/* ----- Eyebrow (mono uppercase label) ------------------- */
export function Eyebrow({ children, color, style }) {
  return (
    <div className="mo-eyebrow" style={{ color, ...style }}>{children}</div>
  );
}

/* ----- Background layers -------------------------------- */
export function Stars()     { return <div className="mo-stars" />; }
export function GridFloor() { return <div className="mo-grid-floor" />; }
