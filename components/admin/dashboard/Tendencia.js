"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { soles, solesDec, formatoClave } from "./Graficos";
import { COLOR_ACTUAL, COLOR_PREVIO, LINEA, TICK, solesCorto } from "./tema";

/**
 * Ventas en el tiempo: área del periodo actual y, si hay `previo`, una línea punteada con el periodo anterior alineada
 * por día. `datos`: [{ clave, claveAnterior?, etiqueta, letra?, monto|null, n, previo?|null, nPrevio? }]; un `monto` null
 * es un día aún sin ocurrir (la serie se corta). La letra (L M X J V S D) va bajo cada fecha.
 */
export default function Tendencia({ datos, etiquetaActual = "Actual", etiquetaPrevia = "Anterior", vacio = "Sin ventas en este periodo." }) {
  const hayPrevio = datos.some((d) => d.previo !== undefined && d.previo !== null);
  if (!datos.length || datos.every((d) => !d.monto && !d.previo)) {
    return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  }
  const total = datos.reduce((s, d) => s + (d.monto || 0), 0);
  const conLetra = datos.some((d) => d.letra);
  const todas = datos.length <= 31;
  const fecha = (iso) => (iso ? (iso.length === 10 ? `${iso.slice(8)}/${iso.slice(5, 7)}` : formatoClave(iso)) : "");

  function Tick({ x, y, payload, index }) {
    const d = datos[index ?? payload.index] || {};
    return (
      <g transform={`translate(${x},${y})`}>
        <text y={12} textAnchor="middle" fontSize={datos.length > 24 ? 10 : 11} fill="#8c6f7d">{d.etiqueta}</text>
        {conLetra && d.letra && (
          <text y={25} textAnchor="middle" fontSize={10} fontWeight={600} fill={d.letra === "D" ? "#c62828" : "#b9a5b0"}>{d.letra}</text>
        )}
      </g>
    );
  }

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const dif = d.monto !== null && d.previo > 0 ? ((d.monto - d.previo) / d.previo) * 100 : null;
    return (
      <div className="dash-tip" role="status">
        {d.monto !== null && (
          <div>
            <span className="dash-tip-marca" style={{ background: COLOR_ACTUAL }} />
            {hayPrevio ? `${fecha(d.clave)} (${d.letra || ""}) · ` : `${fecha(d.clave)} · `}
            <strong>{solesDec(d.monto)}</strong> · {d.n} ventas
          </div>
        )}
        {hayPrevio && d.previo !== null && d.previo !== undefined && (
          <div>
            <span className="dash-tip-marca linea" style={{ background: COLOR_PREVIO }} />
            {fecha(d.claveAnterior)} · <strong>{solesDec(d.previo)}</strong> · {d.nPrevio} ventas
          </div>
        )}
        {dif !== null && (
          <div className={dif >= 0 ? "delta-pos" : "delta-neg"}>
            {dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs día anterior comparado
          </div>
        )}
      </div>
    );
  }

  const alto = conLetra ? 240 : 215;
  return (
    <div>
      {hayPrevio && (
        <div className="dash-leyenda">
          <span><i style={{ background: COLOR_ACTUAL }} />{etiquetaActual}</span>
          <span><i className="linea" style={{ background: COLOR_PREVIO }} />{etiquetaPrevia}</span>
        </div>
      )}
      <div className="dash-chart" style={{ height: alto }} role="img" aria-label={`Ventas en el tiempo, total ${soles(total)}${hayPrevio ? `, comparado con ${etiquetaPrevia}` : ""}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: alto }}>
          <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="dash-grad-tend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_ACTUAL} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COLOR_ACTUAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={LINEA} strokeDasharray="3 3" />
            <XAxis dataKey="etiqueta" tick={<Tick />} tickLine={false} axisLine={{ stroke: LINEA }} interval={todas ? 0 : "preserveStartEnd"} minTickGap={todas ? 0 : 28} height={conLetra ? 34 : 22} />
            <YAxis tickFormatter={solesCorto} tick={TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<Etiqueta />} cursor={{ stroke: COLOR_ACTUAL, strokeOpacity: 0.35, strokeDasharray: "3 3" }} />
            {hayPrevio && (
              <Line type="monotone" dataKey="previo" stroke={COLOR_PREVIO} strokeWidth={1.75} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: COLOR_PREVIO, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
            )}
            <Area
              type="monotone"
              dataKey="monto"
              stroke={COLOR_ACTUAL}
              strokeWidth={2}
              fill="url(#dash-grad-tend)"
              dot={datos.length <= 31 ? { r: 2.5, fill: "#fff", stroke: COLOR_ACTUAL, strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, fill: COLOR_ACTUAL, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <table className="solo-lector">
          <caption>Ventas en el tiempo</caption>
          <tbody>
            {datos.map((d, i) => (
              <tr key={d.clave || `p${i}`}>
                <th>{d.etiqueta}</th>
                <td>{d.monto === null ? "—" : solesDec(d.monto)}</td>
                {hayPrevio && <td>{d.previo === null ? "—" : solesDec(d.previo)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
