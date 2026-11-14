"use client";

import { useState } from "react";
import { consultarCategoriasRipley, consultarAtributosRipley, consultarListasRipley } from "../../app/(admin)/admin/actions";

const VISTAS = [
  ["categorias", "Categorías"],
  ["atributos", "Atributos"],
  ["listas", "Listas de valores"],
];

/** Explorador de solo lectura de la instancia Mirakl de Ripley: qué categorías, atributos y valores exige. */
export default function ExploradorRipley({ cuentas = [] }) {
  const [alias, setAlias] = useState(cuentas[0]?.alias || "");
  const [vista, setVista] = useState("categorias");
  const [parametro, setParametro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  if (cuentas.length === 0) {
    return (
      <div className="pf-panel-bloque">
        <strong>Explorador de catálogo</strong>
        <small style={{ color: "var(--gris)" }}>Agrega una cuenta activa con API key para consultar las categorías, atributos y listas de Ripley.</small>
      </div>
    );
  }

  const consultar = async () => {
    setCargando(true);
    setError("");
    setFilas(null);
    const r =
      vista === "categorias"
        ? await consultarCategoriasRipley(alias)
        : vista === "atributos"
          ? await consultarAtributosRipley(alias, parametro)
          : await consultarListasRipley(alias, parametro);
    if (r?.error) setError(r.error);
    else setFilas(r.filas || []);
    setCargando(false);
  };

  const texto = filtro.trim().toLowerCase();
  const visibles = (filas || []).filter((f) => !texto || JSON.stringify(f).toLowerCase().includes(texto));
  const hayParametro = vista !== "categorias";

  return (
    <div className="pf-panel-bloque">
      <strong>Explorador de catálogo</strong>
      <small style={{ color: "var(--gris)" }}>
        Consulta de solo lectura a Mirakl. Úsalo para ver qué categorías y atributos exige Ripley antes de sincronizar productos.
      </small>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <div className="campo">
          <label htmlFor="er-cuenta">Cuenta</label>
          <select id="er-cuenta" value={alias} onChange={(e) => setAlias(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c.alias} value={c.alias}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="er-vista">Consulta</label>
          <select id="er-vista" value={vista} onChange={(e) => { setVista(e.target.value); setFilas(null); setError(""); }}>
            {VISTAS.map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </div>
        {hayParametro && (
          <div className="campo">
            <label htmlFor="er-param">{vista === "atributos" ? "Código de categoría (opcional)" : "Código de lista (opcional)"}</label>
            <input id="er-param" value={parametro} onChange={(e) => setParametro(e.target.value)} maxLength={80} autoComplete="off" />
          </div>
        )}
        <button type="button" className="btn-admin solido" onClick={consultar} disabled={cargando}>
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {error && <div className="mensaje-error">{error}</div>}

      {filas && (
        <>
          <div className="campo">
            <label htmlFor="er-filtro">Filtrar resultados ({visibles.length} de {filas.length})</label>
            <input id="er-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} autoComplete="off" />
          </div>
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                {vista === "categorias" && (
                  <tr><th>Código</th><th>Ruta</th></tr>
                )}
                {vista === "atributos" && (
                  <tr><th>Código</th><th>Etiqueta</th><th>Tipo</th><th>Requerido</th><th>Variante</th><th>Lista</th><th>Categoría</th></tr>
                )}
                {vista === "listas" && (
                  <tr><th>Código</th><th>Etiqueta</th><th>Valores</th></tr>
                )}
              </thead>
              <tbody>
                {visibles.slice(0, 500).map((f, i) => (
                  <tr key={`${f.codigo}-${i}`}>
                    {vista === "categorias" && (<><td><code>{f.codigo}</code></td><td>{f.ruta}</td></>)}
                    {vista === "atributos" && (
                      <>
                        <td><code>{f.codigo}</code></td><td>{f.etiqueta}</td><td>{f.tipo}</td>
                        <td>{f.requerido ? "Sí" : ""}</td><td>{f.variante ? "Sí" : ""}</td>
                        <td>{f.lista || ""}</td><td>{f.jerarquia || "—"}</td>
                      </>
                    )}
                    {vista === "listas" && (
                      <>
                        <td><code>{f.codigo}</code></td><td>{f.etiqueta}</td>
                        <td>{f.valores ? f.valores.join(", ") : f.cantidad ?? "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibles.length > 500 && <small style={{ color: "var(--gris)" }}>Se muestran las primeras 500; usa el filtro para acotar.</small>}
        </>
      )}
    </div>
  );
}
