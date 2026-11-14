"use client";

import { useState } from "react";
import { consultarMarcasSaga } from "../../app/(admin)/admin/actions";

const norm = (t) => String(t || "").trim().toLowerCase();

/**
 * Integraciones → SAGA → Marcas: lista las marcas de la web y, para cada una, la marca de SAGA con la que coincide (nombre exacto).
 * Una marca de SAGA solo puede usarse una vez: si ya la tiene otra marca de la web, no se ofrece. «Buscar en SAGA» consulta el catálogo
 * de marcas de SAGA solo como referencia; el emparejamiento se guarda con «Guardar». Las marcas de la web se crean en Pestañas de la web.
 */
export default function MarcasSaga({ marcas }) {
  const [filas, setFilas] = useState(() => marcas.map((m) => ({ slug: m.slug, nombre: m.nombre, saga: m.nombreSaga || "" })));
  const [editando, setEditando] = useState(() => new Set());
  const [busq, setBusq] = useState({}); // por marca: { texto, resultados, error, cargando }

  const poner = (slug, saga) => setFilas((p) => p.map((f) => (f.slug === slug ? { ...f, saga } : f)));
  const abrir = (slug, v) =>
    setEditando((p) => {
      const sig = new Set(p);
      if (v) sig.add(slug); else sig.delete(slug);
      return sig;
    });
  // ¿Qué marca de la web ya usa esa marca de SAGA?
  const usadaPor = (saga, slugActual) => (saga ? filas.find((f) => f.slug !== slugActual && norm(f.saga) === norm(saga)) : null);
  const setB = (slug, parche) => setBusq((p) => ({ ...p, [slug]: { ...p[slug], ...parche } }));

  async function buscar(slug, texto) {
    setB(slug, { cargando: true, error: "" });
    const r = await consultarMarcasSaga(texto);
    setB(slug, { cargando: false, error: r?.error || "", resultados: r?.error ? null : r.marcas, total: r?.total || 0 });
  }

  const sinEmparejar = filas.filter((f) => !f.saga.trim()).length;

  return (
    <div className="pf-panel-bloque">
      <strong>Marcas</strong>
      <input type="hidden" name="marcasSagaMarca" value="1" />
      <small style={{ color: "var(--gris)" }}>
        Las marcas de la web y su marca equivalente en SAGA (el nombre exacto: mayúsculas, tildes y espacios). Una marca de SAGA solo se
        puede usar una vez. Una marca sin equivalente no se puede enviar a SAGA. Las marcas de la web se crean en Configuración →
        Pestañas de la web.
        {sinEmparejar > 0 && <strong style={{ color: "#b26a00" }}> Sin emparejar: {sinEmparejar}.</strong>}
      </small>
      <div className="admin-tabla-wrap">
        <table className="admin-tabla cg-tabla-eq">
          <thead>
            <tr>
              <th>Marca de la web</th>
              <th>Marca en SAGA</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const abierto = editando.has(f.slug) || !f.saga.trim();
              const conflicto = usadaPor(f.saga, f.slug);
              const b = busq[f.slug] || {};
              return (
                <tr key={f.slug}>
                  <td>
                    {f.nombre}
                    <code className="cg-slug">{f.slug}</code>
                  </td>
                  <td>
                    <input type="hidden" name={`marcaSaga_${f.slug}`} value={f.saga} />
                    {abierto ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input
                            value={f.saga}
                            maxLength={100}
                            onChange={(e) => poner(f.slug, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(f.slug, f.saga || f.nombre); } }}
                            placeholder="Nombre exacto en SAGA"
                            aria-label={`Marca de SAGA para ${f.nombre}`}
                            style={{ flex: 1, minWidth: 180 }}
                          />
                          <button type="button" className="btn-admin" disabled={b.cargando} onClick={() => buscar(f.slug, f.saga || f.nombre)}>
                            {b.cargando ? "Consultando…" : "Buscar en SAGA"}
                          </button>
                        </div>
                        {conflicto && <small style={{ color: "#b3261e" }}>⚠ «{f.saga}» ya la usa «{conflicto.nombre}»: elige otra.</small>}
                        {b.error && <small style={{ color: "#b3261e" }}>{b.error}</small>}
                        {b.resultados && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {b.resultados.length === 0 && <small style={{ color: "var(--gris)" }}>SAGA no tiene marcas que coincidan.</small>}
                            {b.resultados.map((n) => {
                              const dueno = usadaPor(n, f.slug);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  className="btn-admin"
                                  disabled={Boolean(dueno)}
                                  title={dueno ? `Ya la usa «${dueno.nombre}»` : "Usar esta marca"}
                                  onClick={() => poner(f.slug, n)}
                                >
                                  {n}
                                </button>
                              );
                            })}
                            {b.total > b.resultados.length && <small style={{ color: "var(--gris)" }}>y {b.total - b.resultados.length} más: escribe para afinar.</small>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="pf-eq-fija">🔒 {f.saga}</span>
                    )}
                  </td>
                  <td className="cg-acc">
                    {abierto ? (
                      f.saga.trim() && !conflicto && <button type="button" className="btn-admin" onClick={() => abrir(f.slug, false)} title="Listo (se guarda con el botón Guardar)">✓ Listo</button>
                    ) : (
                      <button type="button" className="btn-admin cg-ico" onClick={() => abrir(f.slug, true)} aria-label={`Editar la marca de SAGA de ${f.nombre}`} title="Elegir otra marca de SAGA">✎</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
