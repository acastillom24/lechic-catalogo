"use client";

import { useState } from "react";
import { soles, solesDec } from "./Graficos";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Barras = año en curso, línea = año anterior. Cada mes es una zona interactiva (mouse o teclado). */
export default function ComparativoAnual({ anio, meses }) {
  const [sel, setSel] = useState(null);

  if (meses.every((m) => m.actual === 0 && m.previo === 0)) {
    return <p style={{ color: "var(--gris)" }}>Sin ventas en estos años.</p>;
  }
  const W = 640;
  const H = 190;
  const margenIzq = 52;
  const margenSup = 8;
  const max = Math.max(1, ...meses.map((m) => Math.max(m.actual, m.previo)));
  const ancho = (W - margenIzq) / 12;
  const barra = Math.min(30, ancho * 0.6);
  const y = (v) => margenSup + (H - margenSup) * (1 - v / max);
  const cx = (i) => margenIzq + i * ancho + ancho / 2;
  const linea = meses.map((m, i) => `${i ? "L" : "M"}${cx(i)},${y(m.previo)}`).join(" ");

  const m = sel !== null ? meses[sel] : null;
  const dif = m && m.previo > 0 ? ((m.actual - m.previo) / m.previo) * 100 : null;
  // El tooltip se ancla al mes; en los extremos se alinea para no salirse del cuadro.
  const izq = sel !== null ? (cx(sel) / W) * 100 : 0;
  const traslado = sel !== null && sel > 7 ? "-100%" : sel !== null && sel > 3 ? "-50%" : "0";

  return (
    <div style={{ position: "relative" }}>
      <div className="nota-periodo" style={{ display: "flex", gap: 16, marginBottom: 6 }}>
        <span>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "var(--rosa)", marginRight: 6 }} />
          {anio}
        </span>
        <span>
          <span style={{ display: "inline-block", width: 14, height: 0, borderTop: "2px solid var(--gris)", marginRight: 6, verticalAlign: "middle" }} />
          {anio - 1}
        </span>
      </div>

      <svg
        className="dash-svg"
        viewBox={`0 0 ${W} ${H + 22}`}
        role="group"
        aria-label={`Ventas por mes ${anio} frente a ${anio - 1}`}
        onMouseLeave={() => setSel(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={margenIzq} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="var(--linea)" strokeWidth={t === 0 ? 1.5 : 1} strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={margenIzq - 6} y={y(max * t) + 4} fontSize="11" fill="var(--gris)" textAnchor="end">
              {soles(max * t)}
            </text>
          </g>
        ))}

        {sel !== null && <rect x={margenIzq + sel * ancho} y={margenSup} width={ancho} height={H - margenSup} fill="var(--rosa-tenue)" opacity="0.6" />}

        {meses.map((d, i) => {
          const h = Math.max(d.actual > 0 ? 2 : 0, H - y(d.actual));
          return (
            <g key={d.mes}>
              <rect x={cx(i) - barra / 2} y={H - h} width={barra} height={h} rx="3" fill="var(--rosa)" opacity={sel === null || sel === i ? 1 : 0.55} />
              <text x={cx(i)} y={H + 16} fontSize="11" fill={sel === i ? "var(--negro, currentColor)" : "var(--gris)"} fontWeight={sel === i ? 700 : 400} textAnchor="middle">
                {MESES[i]}
              </text>
            </g>
          );
        })}

        <path d={linea} fill="none" stroke="var(--gris)" strokeWidth="2" strokeLinejoin="round" />
        {meses.map((d, i) => (
          <circle key={d.mes} cx={cx(i)} cy={y(d.previo)} r={sel === i ? 5 : 3} fill="var(--gris)" />
        ))}

        {/* Zonas de captura: una columna completa por mes (barra, línea y espacio vacío). */}
        {meses.map((d, i) => (
          <rect
            key={d.mes}
            x={margenIzq + i * ancho}
            y={0}
            width={ancho}
            height={H + 22}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${MESES_LARGO[i]}: ${anio} ${solesDec(d.actual)}, ${anio - 1} ${solesDec(d.previo)}`}
            style={{ cursor: "pointer", outline: "none" }}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onBlur={() => setSel(null)}
          />
        ))}
      </svg>

      {m && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 28,
            left: `${izq}%`,
            transform: `translateX(${traslado})`,
            pointerEvents: "none",
            background: "var(--blanco, #fff)",
            border: "1px solid var(--linea)",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,.12)",
            padding: "8px 12px",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          <strong>{MESES_LARGO[sel]}</strong>
          <div>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--rosa)", marginRight: 6 }} />
            {anio}: <strong>{solesDec(m.actual)}</strong> · {m.nActual} ventas
          </div>
          <div>
            <span style={{ display: "inline-block", width: 9, height: 2, background: "var(--gris)", marginRight: 6, verticalAlign: "middle" }} />
            {anio - 1}: <strong>{solesDec(m.previo)}</strong> · {m.nPrevio} ventas
          </div>
          {dif !== null && (
            <div className={dif >= 0 ? "delta-pos" : "delta-neg"}>
              {dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs {anio - 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
