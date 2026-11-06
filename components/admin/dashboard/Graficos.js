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
        <div
          className="barra-fila"
          key={d.nombre}
          tabIndex={0}
          data-tip={`${d.nombre}: ${formato(d.monto)}${mostrarPorcentaje ? ` · ${Math.round((d.monto / total) * 100)}%` : ""}${d.n ? ` · ${d.n} ventas` : ""}`}
        >
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

export function formatoClave(clave) {
  // "2026-11-06" -> "06/11" ; "2026-11" -> "nov 2026"
  if (clave.length === 10) return clave.split("-").reverse().slice(0, 2).join("/");
  const [a, m] = clave.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[Number(m) - 1]} ${a}`;
}
