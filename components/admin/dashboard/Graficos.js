/**
 * Piezas comunes del dashboard: formatos, tarjeta de sección y KPI. Los gráficos (Recharts) viven en los
 * demás archivos de esta carpeta; el tema y la paleta, en tema.js.
 */
import Chispa from "./Chispa";

export const soles = (n, dec = 0) =>
  `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
export const solesDec = (n) => soles(n, 2);
export const entero = (n) => Number(n).toLocaleString("es-PE");

/**
 * Formatos por nombre: desde un componente de servidor no se pueden pasar funciones a los gráficos (que son de
 * cliente), así que se pasa el nombre ("soles", "solesDec", "entero", "clientes") y el gráfico lo resuelve.
 */
export const FORMATOS = {
  soles,
  solesDec,
  entero,
  clientes: (n) => `${entero(n)} clientes`,
};

export function Seccion({ titulo, nota, children }) {
  return (
    <section className="admin-card dash-card">
      <h3 className="dash-card-titulo">{titulo}</h3>
      {nota && <p className="nota-periodo dash-card-nota">{nota}</p>}
      {children}
    </section>
  );
}

export function Kpi({ etiqueta, valor, sub, delta, deltaTexto, chispa, chispaPrevia, id, desglose, barra, tono }) {
  return (
    <div className={tono ? `admin-card kpi tono-${tono}` : "admin-card kpi"}>
      <div className="kpi-etiqueta">{etiqueta}</div>
      <div className="kpi-valor">{valor}</div>
      {delta !== undefined && delta !== null && (
        <div className={`kpi-sub ${delta >= 0 ? "delta-pos" : "delta-neg"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% {deltaTexto}
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
      {barra?.some((b) => b.valor > 0) && (
        <div className="kpi-barra" role="img" aria-label={barra.map((b) => `${b.nombre}: ${b.valor}`).join(", ")}>
          {barra.filter((b) => b.valor > 0).map((b) => (
            <i key={b.nombre} style={{ flexGrow: b.valor, background: b.color }} title={b.nombre} />
          ))}
        </div>
      )}
      {desglose?.length > 0 && (
        <ul className="kpi-desglose">
          {desglose.map((d) => (
            <li key={d.nombre}>
              <span>
                {d.color && <i className="kpi-marca" style={{ background: d.color }} />}
                {d.nombre}
              </span>
              <strong>{d.valor}</strong>
            </li>
          ))}
        </ul>
      )}
      {chispa && <Chispa valores={chispa} previos={chispaPrevia} id={id || etiqueta} />}
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
