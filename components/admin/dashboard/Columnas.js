"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FORMATOS } from "./Graficos";
import { COLOR_ACTUAL, COLOR_PREVIO, LINEA, TICK, solesCorto } from "./tema";

/**
 * Columnas por categoría (p. ej. ventas por día de la semana). Con `previo` en los datos se dibujan dos columnas por
 * categoría (periodo anterior junto al actual); sin él, la mayor se resalta y las demás van más suaves.
 * `datos`: [{ nombre, monto, n?, previo?, nPrevio? }].
 */
export default function Columnas({ datos, formato: nombreFormato = "soles", vacio = "Sin datos en este periodo.", alto = 200, etiquetaActual = "Actual", etiquetaPrevia = "Anterior" }) {
  const formato = FORMATOS[nombreFormato] || FORMATOS.soles;
  if (!datos.length || datos.every((d) => d.monto === 0 && !d.previo)) return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  const comparar = datos.some((d) => d.previo !== undefined);
  const maximo = Math.max(...datos.map((d) => d.monto));
  const ejeY = nombreFormato === "soles" || nombreFormato === "solesDec" ? solesCorto : (n) => Number(n).toLocaleString("es-PE");

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const dif = comparar && d.previo > 0 ? ((d.monto - d.previo) / d.previo) * 100 : null;
    return (
      <div className="dash-tip" role="status">
        <strong>{d.nombre}</strong>
        <div>
          {comparar && <span className="dash-tip-marca" style={{ background: COLOR_ACTUAL }} />}
          {comparar && `${etiquetaActual}: `}
          <strong>{formato(d.monto)}</strong>
          {d.n ? ` · ${d.n} ventas` : ""}
        </div>
        {comparar && (
          <div>
            <span className="dash-tip-marca" style={{ background: COLOR_PREVIO }} />
            {etiquetaPrevia}: <strong>{formato(d.previo)}</strong>
            {d.nPrevio ? ` · ${d.nPrevio} ventas` : ""}
          </div>
        )}
        {dif !== null && (
          <div className={dif >= 0 ? "delta-pos" : "delta-neg"}>
            {dif >= 0 ? "▲" : "▼"} {Math.abs(dif).toFixed(0)}% vs periodo anterior
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {comparar && (
        <div className="dash-leyenda">
          <span><i style={{ background: COLOR_ACTUAL }} />{etiquetaActual}</span>
          <span><i style={{ background: COLOR_PREVIO }} />{etiquetaPrevia}</span>
        </div>
      )}
      <div className="dash-chart" style={{ height: alto }} role="img" aria-label={datos.map((d) => `${d.nombre}: ${formato(d.monto)}${comparar ? ` (anterior ${formato(d.previo)})` : ""}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: alto }}>
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={LINEA} strokeDasharray="3 3" />
            <XAxis dataKey="nombre" tick={TICK} tickLine={false} axisLine={{ stroke: LINEA }} />
            <YAxis tickFormatter={ejeY} tick={TICK} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<Etiqueta />} cursor={{ fill: "#fde4ef", fillOpacity: 0.6 }} />
            {comparar && <Bar dataKey="previo" fill={COLOR_PREVIO} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />}
            <Bar dataKey="monto" radius={[4, 4, 0, 0]} maxBarSize={comparar ? 22 : 26} fill={COLOR_ACTUAL} isAnimationActive={false}>
              {!comparar && datos.map((d) => <Cell key={d.nombre} fill={d.monto === maximo ? COLOR_ACTUAL : "#f4a3c9"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
