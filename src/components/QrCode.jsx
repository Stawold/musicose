import React, { useMemo } from "react";
import qrcode from "qrcode-generator";

// QR code en SVG (généré localement, aucun service externe).
export default function QrCode({ text, size = 200, dark = "#0A0A0D", light = "#FFFFFF" }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [text]);
  const box = count + 8; // marge blanche de 4 modules exigée par les lecteurs
  return (
    <svg
      role="img" aria-label="QR code pour rejoindre la partie" data-url={text}
      width={size} height={size} viewBox={`0 0 ${box} ${box}`} shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      <rect width={box} height={box} fill={light} />
      <path d={path} fill={dark} />
    </svg>
  );
}
