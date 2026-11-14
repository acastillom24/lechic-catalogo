"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FORMATOS } from "./Graficos";
import { COLOR_ACTUAL, TICK } from "./tema";

/**
 * Barras horizontales compactas (una sola serie, un solo matiz): nombre a la izquierda y el valor al final de
 * cada barra. Muestra las `max` mayores y agrupa el resto en «Otros». `datos`: [{ nombre, monto, n? }].
 */
export default function BarrasH({ datos, formato: nombreFormato = "soles", max = 8, vacio = "Sin datos en este periodo.", color = COLOR_ACTUAL }) {
  const formato = FORMATOS[nombreFormato] || FORMATOS.soles;
  const lista = datos.filter((d) => d.monto > 0);
  if (!lista.length) return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  let filas = lista;
  if (lista.length > max) {
    const orden = [...lista].sort((a, b) => b.monto - a.monto);
    const resto = orden.slice(max - 1);
    filas = [
      ...orden.slice(0, max - 1),
      { nombre: `Otros (${resto.length})`, monto: resto.reduce((s, d) => s + d.monto, 0), n: resto.reduce((s, d) => s + (d.n || 0), 0) || undefined },
    ];
  }
  const altura = filas.length * 30 + 8;
  const maximo = Math.max(...filas.map((d) => d.monto));

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="dash-tip" role="status">
        <strong>{d.nombre}</strong>
        <div>
          <strong>{formato(d.monto)}</strong>
          {d.n ? ` · ${d.n} ventas` : ""}
        </div>
      </div>
    );
  }

  return (
    <div className="dash-chart" style={{ height: altura }} role="img" aria-label={filas.map((d) => `${d.nombre}: ${formato(d.monto)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: altura }}>
        <BarChart data={filas} layout="vertical" margin={{ top: 0, right: 74, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, maximo]} />
          <YAxis type="category" dataKey="nombre" width={104} tick={{ ...TICK, fill: "#7a2d57" }} tickLine={false} axisLine={false} interval={0} tickFormatter={(s) => (s.length > 16 ? `${s.slice(0, 15)}…` : s)} />
          <Tooltip content={<Etiqueta />} cursor={{ fill: "#fde4ef", fillOpacity: 0.6 }} />
          <Bar dataKey="monto" radius={[0, 4, 4, 0]} barSize={12} background={{ fill: "#f6ece6", radius: 4 }} isAnimationActive={false}>
            {filas.map((d) => (
              <Cell key={d.nombre} fill={d.nombre.startsWith("Otros (") ? "#b9a5b0" : color} />
            ))}
            <LabelList dataKey="monto" position="right" formatter={formato} style={{ fontSize: 11, fill: "#7a2d57", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
