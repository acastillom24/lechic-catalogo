"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TICK } from "./tema";

/**
 * Barras horizontales apiladas en dos tramos (p. ej. variantes con stock + agotadas por marca). El total va al final
 * de cada barra. `datos`: [{ nombre, a, b }]; `etiquetas` = [nombreA, nombreB]; `colores` = [colorA, colorB].
 */
export default function BarrasApiladas({ datos, etiquetas = ["Con stock", "Agotadas"], colores = ["#e8267f", "#c62828"], vacio = "Sin datos." }) {
  const filas = datos.map((d) => ({ ...d, total: d.a + d.b }));
  if (!filas.length || filas.every((d) => d.total === 0)) return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  const altura = filas.length * 30 + 8;
  const maximo = Math.max(...filas.map((d) => d.total));

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="dash-tip" role="status">
        <strong>{d.nombre}</strong>
        <div><span className="dash-tip-marca" style={{ background: colores[0] }} />{etiquetas[0]}: <strong>{d.a}</strong></div>
        <div><span className="dash-tip-marca" style={{ background: colores[1] }} />{etiquetas[1]}: <strong>{d.b}</strong></div>
        <div className="nota-periodo">Total: {d.total}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="dash-leyenda">
        <span><i style={{ background: colores[0] }} />{etiquetas[0]}</span>
        <span><i style={{ background: colores[1] }} />{etiquetas[1]}</span>
      </div>
      <div className="dash-chart" style={{ height: altura }} role="img" aria-label={filas.map((d) => `${d.nombre}: ${d.a} ${etiquetas[0]}, ${d.b} ${etiquetas[1]}`).join("; ")}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: altura }}>
          <BarChart data={filas} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, maximo]} />
            <YAxis type="category" dataKey="nombre" width={96} tick={{ ...TICK, fill: "#7a2d57" }} tickLine={false} axisLine={false} interval={0} tickFormatter={(s) => (s.length > 14 ? `${s.slice(0, 13)}…` : s)} />
            <Tooltip content={<Etiqueta />} cursor={{ fill: "#fde4ef", fillOpacity: 0.6 }} wrapperStyle={{ zIndex: 30 }} />
            <Bar dataKey="a" stackId="m" fill={colores[0]} barSize={12} isAnimationActive={false} />
            <Bar dataKey="b" stackId="m" fill={colores[1]} radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
              <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "#7a2d57", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
