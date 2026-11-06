/**
 * Piezas visuales del dashboard (componentes de servidor, SVG/CSS sin librerías).
 * Reglas: marcas finas con extremo redondeado sobre la línea base, cuadrícula
 * recesiva, valores en texto (nunca solo color), tooltip nativo en cada marca y
 * el detalle numérico siempre visible junto al gráfico.
 */

export const soles = (n, dec = 0) =>
  `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
export const solesDec = (n) => soles(n, 2);
export const entero = (n) => Number(n).toLocaleString("es-PE");

export function Seccion({ titulo, nota, children }) {
  return (
    <section className="admin-card">
      <h3 style={{ fontSize: "1rem", marginBottom: 4 }}>{titulo}</h3>
      {nota && <p className="nota-periodo" style={{ marginBottom: 10 }}>{nota}</p>}
      {!nota && <div style={{ height: 10 }} />}
      {children}
    </section>
  );
}

export function Kpi({ etiqueta, valor, sub, delta, deltaTexto }) {
  return (
    <div className="admin-card kpi">
      <div className="kpi-etiqueta">{etiqueta}</div>
      <div className="kpi-valor">{valor}</div>
      {delta !== undefined && delta !== null && (
        <div className={`kpi-sub ${delta >= 0 ? "delta-pos" : "delta-neg"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% {deltaTexto}
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/** Barras horizontales: nombre, barra y valor (con % del total). */
export function Barras({ datos, formato = soles, mostrarPorcentaje = true, vacio = "Sin datos en este periodo." }) {
  if (!datos.length) return <p style={{ color: "var(--gris)" }}>{vacio}</p>;
  const max = Math.max(1, ...datos.map((d) => d.monto));
  const total = datos.reduce((s, d) => s + d.monto, 0) || 1;
  return (
    <div className="barras">
      {datos.map((d) => (
        <div className="barra-fila" key={d.nombre} title={`${d.nombre}: ${formato(d.monto)}${d.n ? ` (${d.n} ventas)` : ""}`}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</span>
          <div className="barra-pista">
            <div className="barra-relleno" style={{ width: `${(d.monto / max) * 100}%` }} />
          </div>
          <span>
            {formato(d.monto)}
            {mostrarPorcentaje && (
              <span style={{ color: "var(--gris)", marginLeft: 6 }}>{Math.round((d.monto / total) * 100)}%</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Columnas con eje y (máximo y mitad), línea base y etiquetas de inicio/medio/fin. */
export function Tendencia({ datos, etiqueta, vacio = "Sin ventas en este periodo." }) {
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
  const marcas = [0, 0.5, 1];
  const idxMedio = Math.floor(datos.length / 2);

  return (
    <svg className="dash-svg" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label="Ventas en el tiempo">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={margenIzq} x2={W} y1={y(max * m)} y2={y(max * m)} stroke="var(--linea)" strokeWidth={m === 0 ? 1.5 : 1} strokeDasharray={m === 0 ? undefined : "3 3"} />
          <text x={margenIzq - 6} y={y(max * m) + 4} fontSize="11" fill="var(--gris)" textAnchor="end">
            {soles(max * m)}
          </text>
        </g>
      ))}
      {datos.map((d, i) => {
        const h = Math.max(d.monto > 0 ? 2 : 0, H - y(d.monto));
        const cx = margenIzq + i * ancho + ancho / 2;
        return (
          <rect key={d.clave} x={cx - barra / 2} y={H - h} width={barra} height={h} rx="3" fill="var(--rosa)">
            <title>{`${etiqueta(d.clave)}: ${solesDec(d.monto)} (${d.n} ventas)`}</title>
          </rect>
        );
      })}
      <text x={margenIzq} y={H + 16} fontSize="11" fill="var(--gris)">{etiqueta(datos[0].clave)}</text>
      {datos.length > 2 && (
        <text x={margenIzq + idxMedio * ancho + ancho / 2} y={H + 16} fontSize="11" fill="var(--gris)" textAnchor="middle">
          {etiqueta(datos[idxMedio].clave)}
        </text>
      )}
      {datos.length > 1 && (
        <text x={W} y={H + 16} fontSize="11" fill="var(--gris)" textAnchor="end">{etiqueta(datos[datos.length - 1].clave)}</text>
      )}
    </svg>
  );
}

export function formatoClave(clave) {
  // "2026-11-06" -> "06/11" ; "2026-11" -> "nov 2026"
  if (clave.length === 10) return clave.split("-").reverse().slice(0, 2).join("/");
  const [a, m] = clave.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[Number(m) - 1]} ${a}`;
}
