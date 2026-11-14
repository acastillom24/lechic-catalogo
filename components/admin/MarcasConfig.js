"use client";

import { useActionState, useEffect, useState } from "react";
import { guardarMarcasConfig, renombrarIdentificador } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";

/**
 * Marcas del producto = las que se envían a SAGA. Independientes de la pestaña donde se muestra el producto en la web: cada marca solo
 * sugiere una pestaña por defecto (editable en cada producto). Con qué marca de cada plataforma coincide se define en esa plataforma.
 * `oculto` lo maneja el panel con pestañas (el formulario sigue montado). `onConteo` avisa cuántas marcas hay.
 */
export default function MarcasConfig({ marcas, pestanas, oculto = false, onConteo }) {
  const [estado, accion, enviando] = useActionState(guardarMarcasConfig, {});
  const [filas, setFilas] = useState(() => marcas.map((m) => ({ ...m, existente: true })));
  const [abiertas, setAbiertas] = useState(() => new Set());
  const abrir = (i, v) =>
    setAbiertas((p) => {
      const sig = new Set(p);
      if (v) sig.add(i); else sig.delete(i);
      return sig;
    });

  useEffect(() => {
    onConteo?.({ marcas: filas.length });
  }, [filas.length, onConteo]);

  const cambiar = (i, parche) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...parche } : x)));
  const agregar = () => {
    abrir(filas.length, true);
    setFilas((f) => [...f, { slug: "", nombre: "", pestanaDefault: pestanas[0]?.slug || "", existente: false }]);
  };
  const quitar = (i) => {
    setAbiertas(new Set());
    setFilas((f) => f.filter((_, j) => j !== i));
  };
  const mover = (i, d) => {
    setAbiertas(new Set());
    setFilas((f) => {
      const j = i + d;
      if (j < 0 || j >= f.length) return f;
      const n = f.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  const [aviso, setAviso] = useState(null);
  async function cambiarIdentificador(i) {
    const viejo = filas[i].slug;
    const nuevo = (window.prompt(`Nuevo identificador para "${viejo}" (minúsculas, números y guiones):`, viejo) || "").trim();
    if (!nuevo || nuevo === viejo) return;
    if (!window.confirm(`Se cambiará "${viejo}" por "${nuevo}" y se migrarán los productos de esta marca. ¿Continuar?`)) return;
    const r = await renombrarIdentificador("marca", viejo, nuevo);
    if (r.ok) cambiar(i, { slug: nuevo });
    setAviso(r);
  }

  const envio = filas.map(({ slug, nombre, pestanaDefault }) => ({ slug, nombre, pestanaDefault }));
  const nombrePestana = (slug) => pestanas.find((p) => p.slug === slug)?.nombre || slug;

  return (
    <form action={accion} className="form-grid" hidden={oculto}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      {aviso?.error && <div className="mensaje-error">{aviso.error}</div>}
      {aviso?.ok && <div className="mensaje-ok">{aviso.ok}</div>}
      <input type="hidden" name="marcasJson" value={JSON.stringify(envio)} />

      <div className="pf-panel-bloque">
        <strong>Marcas de la web</strong>
        <small style={{ color: "var(--gris)" }}>
          Cada marca puede mostrarse en la pestaña que quieras: la <strong>pestaña por defecto</strong> se autoselecciona al elegir la marca en
          un producto, pero se puede cambiar. Con qué marca de cada plataforma coincide se define en esa plataforma (Integraciones → SAGA →
          Marcas).
        </small>
        <div className="admin-tabla-wrap">
          <table className="admin-tabla cg-tabla-pest">
            <thead>
              <tr>
                <th aria-label="Orden" />
                <th>Marca</th>
                <th>Pestaña por defecto</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filas.flatMap((m, i) => {
                const ab = abiertas.has(i) || !m.nombre;
                return [
                  <tr key={i}>
                    <td className="cg-orden">
                      <button type="button" className="btn-admin cg-ico" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" title="Subir">↑</button>
                      <button type="button" className="btn-admin cg-ico" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label="Bajar" title="Bajar">↓</button>
                    </td>
                    <td>
                      {m.nombre || <small style={{ color: "var(--gris)" }}>(nueva marca)</small>}
                      {m.slug && <code className="cg-slug">{m.slug}</code>}
                    </td>
                    <td>{nombrePestana(m.pestanaDefault)}</td>
                    <td className="cg-acc">
                      {ab ? (
                        m.nombre && <button type="button" className="btn-admin" onClick={() => abrir(i, false)} title="Listo (se guarda con el botón Guardar)">✓ Listo</button>
                      ) : (
                        <button type="button" className="btn-admin cg-ico" onClick={() => abrir(i, true)} aria-label={`Editar ${m.nombre}`} title="Editar">✎</button>
                      )}
                      <button type="button" className="btn-admin cg-ico peligro" onClick={() => quitar(i)} aria-label={`Quitar ${m.nombre || "la marca"}`} title="Quitar la marca">✕</button>
                    </td>
                  </tr>,
                  ab && (
                    <tr key={`${i}-e`} className="pf-eq-propio-extra">
                      <td colSpan={4}>
                        <div className="cg-listas">
                          <div className="campo">
                            <label>Nombre</label>
                            <input value={m.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value, ...(m.existente ? {} : { slug: slugify(e.target.value) }) })} />
                          </div>
                          <div className="campo">
                            <label>Identificador</label>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input value={m.slug} readOnly={m.existente} onChange={(e) => cambiar(i, { slug: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                              {m.existente && (
                                <button type="button" className="btn-admin cg-ico" onClick={() => cambiarIdentificador(i)} title="Cambiar identificador" aria-label="Cambiar identificador">✎</button>
                              )}
                            </div>
                          </div>
                          <div className="campo">
                            <label>Pestaña por defecto</label>
                            <select value={m.pestanaDefault} onChange={(e) => cambiar(i, { pestanaDefault: e.target.value })}>
                              {pestanas.map((p) => (
                                <option key={p.slug} value={p.slug}>{p.nombre}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
        <div>
          <button type="button" className="btn-admin cg-mas" onClick={agregar}>+ Agregar marca</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar marcas"}
        </button>
      </div>
    </form>
  );
}
