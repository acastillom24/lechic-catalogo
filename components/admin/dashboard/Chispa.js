"use client";

import { Area, ComposedChart, Line, ResponsiveContainer } from "recharts";
import { COLOR_ACTUAL, COLOR_PREVIO } from "./tema";

/**
 * Minigráfico de tendencia para las tarjetas KPI (sin ejes ni etiquetas; el número va en la tarjeta). `previos`, si se
 * da, dibuja además una línea punteada del periodo anterior para los mismos días transcurridos.
 */
export default function Chispa({ valores, previos, id }) {
  if (!valores || valores.length < 3 || valores.every((v) => v === 0)) return null;
  const datos = valores.map((v, i) => ({ i, v, p: previos ? previos[i] ?? null : null }));
  return (
    <div className="kpi-chispa" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" style={{ position: "absolute", top: 8, left: 0, height: "calc(100% - 8px)" }} initialDimension={{ width: 120, height: 60 }}>
        <ComposedChart data={datos} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`chispa-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_ACTUAL} stopOpacity={0.3} />
              <stop offset="100%" stopColor={COLOR_ACTUAL} stopOpacity={0} />
            </linearGradient>
          </defs>
          {previos && <Line type="monotone" dataKey="p" stroke={COLOR_PREVIO} strokeWidth={1.25} strokeDasharray="3 3" dot={false} isAnimationActive={false} />}
          <Area type="monotone" dataKey="v" stroke={COLOR_ACTUAL} strokeWidth={1.5} fill={`url(#chispa-${id})`} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
