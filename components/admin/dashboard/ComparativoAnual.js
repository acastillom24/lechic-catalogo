"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { soles, solesDec } from "./Graficos";
import { COLOR_ACTUAL, COLOR_PREVIO, LINEA, TICK, solesCorto } from "./tema";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Barras agrupadas por mes: año en curso junto al año anterior. */
export default function ComparativoAnual({ anio, meses }) {
  if (meses.every((m) => m.actual === 0 && m.previo === 0)) {
    return <p style={{ color: "var(--gris)" }}>Sin ventas en estos años.</p>;
  }
  const datos = meses.map((m, i) => ({ ...m, etiqueta: MESES[i], largo: MESES_LARGO[i] }));

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const m = payload[0].payload;
    const dif = m.previo > 0 ? ((m.actual - m.previo) / m.previo) * 100 : null;
    return (
      <div className="dash-tip" role="status">
        <strong>{m.largo}</strong>
        <div>
          <span className="dash-tip-marca" style={{ background: COLOR_ACTUAL }} />
          {anio}: <strong>{solesDec(m.actual)}</strong> · {m.nActual} ventas
        </div>
        <div>
          <span className="dash-tip-marca" style={{ background: COLOR_PREVIO }} />
          {anio - 1}: <strong>{solesDec(m.previo)}</strong> · {m.nPrevio} ventas
        </div>
        {dif !== null && (
          <div className={dif >= 0 ? "delta-pos" : "delta-neg"}>
            {dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs {anio - 1}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="dash-leyenda">
        <span><i style={{ background: COLOR_ACTUAL }} />{anio}</span>
        <span><i style={{ background: COLOR_PREVIO }} />{anio - 1}</span>
      </div>
      <div className="dash-chart" style={{ height: 220 }} role="img" aria-label={`Ventas por mes ${anio} frente a ${anio - 1}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={LINEA} strokeDasharray="3 3" />
            <XAxis dataKey="etiqueta" tick={TICK} tickLine={false} axisLine={{ stroke: LINEA }} />
            <YAxis tickFormatter={solesCorto} tick={TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<Etiqueta />} cursor={{ fill: "#fde4ef", fillOpacity: 0.6 }} />
            <Bar dataKey="previo" fill={COLOR_PREVIO} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
            <Bar dataKey="actual" fill={COLOR_ACTUAL} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <table className="solo-lector">
          <caption>Ventas por mes {anio} frente a {anio - 1}</caption>
          <tbody>
            {datos.map((d) => (
              <tr key={d.mes}>
                <th>{d.largo}</th>
                <td>{anio}: {soles(d.actual)}</td>
                <td>{anio - 1}: {soles(d.previo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
