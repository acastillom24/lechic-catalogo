"use client";

import { useState } from "react";
import { soles, solesDec, formatoClave } from "./Graficos";

/** Columnas de ventas por día/mes con eje y, línea base y etiqueta flotante (mouse o teclado). */
export default function Tendencia({ datos, vacio = "Sin ventas en este periodo." }) {
  const [sel, setSel] = useState(null);

  if (!datos.length || datos.every((d) => d.monto === 0)) {
    return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  }
  const W = 640;
  const H = 170;
  const margenIzq = 46;
  const margenSup = 8;
  const max = Math.max(...datos.map((d) => d.monto));
  const ancho = (W - margenIzq) / datos.length;
  const barra = Math.max(2, Math.min(28, ancho * 0.7));
  const y = (v) => margenSup + (H - margenSup) * (1 - v / max);
  const cx = (i) => margenIzq + i * ancho + ancho / 2;
  const idxMedio = Math.floor(datos.length / 2);

  const d = sel !== null ? datos[sel] : null;
  const pos = sel !== null ? sel / datos.length : 0;
  const traslado = pos > 0.7 ? "-100%" : pos > 0.3 ? "-50%" : "0";

  return (
    <div style={{ position: "relative" }}>
      <svg className="dash-svg" viewBox={`0 0 ${W} ${H + 22}`} role="group" aria-label="Ventas en el tiempo" onMouseLeave={() => setSel(null)}>
        {[0, 0.5, 1].map((m) => (
          <g key={m}>
            <line x1={margenIzq} x2={W} y1={y(max * m)} y2={y(max * m)} stroke="var(--linea)" strokeWidth={m === 0 ? 1.5 : 1} strokeDasharray={m === 0 ? undefined : "3 3"} />
            <text x={margenIzq - 6} y={y(max * m) + 4} fontSize="11" fill="var(--gris)" textAnchor="end">
              {soles(max * m)}
            </text>
          </g>
        ))}

        {sel !== null && <rect x={margenIzq + sel * ancho} y={margenSup} width={ancho} height={H - margenSup} fill="var(--rosa-tenue)" opacity="0.6" />}

        {datos.map((p, i) => {
          const h = Math.max(p.monto > 0 ? 2 : 0, H - y(p.monto));
          return <rect key={p.clave} x={cx(i) - barra / 2} y={H - h} width={barra} height={h} rx="3" fill="var(--rosa)" opacity={sel === null || sel === i ? 1 : 0.55} />;
        })}

        <text x={margenIzq} y={H + 16} fontSize="11" fill="var(--gris)">{formatoClave(datos[0].clave)}</text>
        {datos.length > 2 && (
          <text x={cx(idxMedio)} y={H + 16} fontSize="11" fill="var(--gris)" textAnchor="middle">{formatoClave(datos[idxMedio].clave)}</text>
        )}
        {datos.length > 1 && (
          <text x={W} y={H + 16} fontSize="11" fill="var(--gris)" textAnchor="end">{formatoClave(datos[datos.length - 1].clave)}</text>
        )}

        {datos.map((p, i) => (
          <rect
            key={p.clave}
            x={margenIzq + i * ancho}
            y={0}
            width={ancho}
            height={H + 22}
            fill="transparent"
            tabIndex={datos.length <= 62 ? 0 : -1}
            role="img"
            aria-label={`${formatoClave(p.clave)}: ${solesDec(p.monto)}, ${p.n} ventas`}
            style={{ cursor: "pointer", outline: "none" }}
            onMouseEnter={() => setSel(i)}
            onFocus={() => setSel(i)}
            onBlur={() => setSel(null)}
          />
        ))}
      </svg>

      {d && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 8,
            left: `${(cx(sel) / W) * 100}%`,
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
          <strong>{formatoClave(d.clave)}</strong>
          <div>
            <strong>{solesDec(d.monto)}</strong> · {d.n} ventas
          </div>
        </div>
      )}
    </div>
  );
}
