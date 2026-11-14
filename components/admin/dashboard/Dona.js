"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { FORMATOS } from "./Graficos";
import { agruparTop } from "./tema";

/**
 * Dona con la suma al centro y la leyenda al lado (nombre, valor y %). Hasta 5 categorías con color fijo;
 * el resto se agrupa en «Otros». `datos`: [{ nombre, monto, n?, color? }]. Con `color` propio no se reagrupa.
 */
export default function Dona({ datos, formato: nombreFormato = "soles", centro = "Total", vacio = "Sin datos en este periodo.", porcentaje = true, colores = {} }) {
  const formato = FORMATOS[nombreFormato] || FORMATOS.soles;
  const lista = datos.filter((d) => d.monto > 0);
  if (!lista.length) return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  const filas = lista.every((d) => d.color) ? lista : agruparTop(lista, 5, colores);
  const total = filas.reduce((s, d) => s + d.monto, 0) || 1;

  function Etiqueta({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="dash-tip" role="status">
        <strong>{d.nombre}</strong>
        <div>
          <strong>{formato(d.monto)}</strong>
          {porcentaje && ` · ${Math.round((d.monto / total) * 100)}%`}
          {d.n ? ` · ${d.n} ventas` : ""}
        </div>
        {d.previo > 0 && (
          <div className="nota-periodo">Periodo anterior: {formato(d.previo)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="dash-dona">
      <div className="dash-dona-grafico" role="img" aria-label={`${centro}: ${formato(total)}. ${filas.map((d) => `${d.nombre} ${formato(d.monto)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 150, height: 150 }}>
          <PieChart>
            <Pie data={filas} dataKey="monto" nameKey="nombre" innerRadius="64%" outerRadius="100%" paddingAngle={filas.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {filas.map((d) => (
                <Cell key={d.nombre} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Etiqueta />} wrapperStyle={{ zIndex: 30, outline: "none" }} allowEscapeViewBox={{ x: true, y: true }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dash-dona-centro">
          <strong>{formato(total)}</strong>
          <span>{centro}</span>
        </div>
      </div>
      <ul className="dash-dona-leyenda">
        {filas.map((d) => (
          <li key={d.nombre}>
            <i style={{ background: d.color }} />
            <span className="nombre" title={d.nombre}>{d.nombre}</span>
            <span className="valor">
              {formato(d.monto)}
              {porcentaje && <small>{Math.round((d.monto / total) * 100)}%</small>}
              {d.previo > 0 && (
                <small className={d.monto >= d.previo ? "delta-pos" : "delta-neg"} title="Frente al periodo anterior">
                  {d.monto >= d.previo ? "▲" : "▼"} {Math.abs(((d.monto - d.previo) / d.previo) * 100).toFixed(0)}%
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
