"use client";

import { useActionState, useState } from "react";
import { guardarMarcasConfig, renombrarIdentificador } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";

/**
 * Marcas del producto = las que se envían a SAGA. Independientes de la pestaña donde se muestra el
 * producto en la web: cada marca solo sugiere una pestaña por defecto (editable en cada producto).
 */
export default function MarcasConfig({ marcas, pestanas }) {
  const [estado, accion, enviando] = useActionState(guardarMarcasConfig, {});
  const [filas, setFilas] = useState(() => marcas.map((m) => ({ ...m, existente: true })));

  const cambiar = (i, parche) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...parche } : x)));
  const agregar = () =>
    setFilas((f) => [...f, { slug: "", nombre: "", nombreSaga: "", pestanaDefault: pestanas[0]?.slug || "", existente: false }]);
  const quitar = (i) => setFilas((f) => f.filter((_, j) => j !== i));
  const mover = (i, d) =>
    setFilas((f) => {
      const j = i + d;
      if (j < 0 || j >= f.length) return f;
      const n = f.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

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

  const envio = filas.map(({ slug, nombre, nombreSaga, pestanaDefault }) => ({ slug, nombre, nombreSaga, pestanaDefault }));

  return (
    <form action={accion} className="form-grid">
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      {aviso?.error && <div className="mensaje-error">{aviso.error}</div>}
      {aviso?.ok && <div className="mensaje-ok">{aviso.ok}</div>}
      <input type="hidden" name="marcasJson" value={JSON.stringify(envio)} />

      <section className="admin-card form-grid">
        <h2>Marcas</h2>
        <small style={{ color: "var(--gris)" }}>
          La marca es la que se envía a SAGA, y no tiene por qué coincidir con la pestaña donde se muestra el producto. El
          <strong> nombre en SAGA</strong> debe ser exacto (mayúsculas, tildes y espacios); una marca sin nombre en SAGA no se
          puede enviar. Cópialo tal como aparece en SAGA. La <strong>pestaña por defecto</strong>{" "}
          se autoselecciona al elegir la marca en un producto, pero se puede cambiar.
        </small>

        {filas.map((m, i) => (
          <div key={i} className="form-fila" style={{ alignItems: "end", borderTop: "1px solid var(--linea)", paddingTop: 12 }}>
            <div className="campo">
              <label>Nombre</label>
              <input
                value={m.nombre}
                onChange={(e) => cambiar(i, { nombre: e.target.value, ...(m.existente ? {} : { slug: slugify(e.target.value) }) })}
              />
            </div>
            <div className="campo">
              <label>Identificador</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  value={m.slug}
                  readOnly={m.existente}
                  onChange={(e) => cambiar(i, { slug: e.target.value })}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {m.existente && (
                  <button
                    type="button"
                    className="btn-admin"
                    onClick={() => cambiarIdentificador(i)}
                    title="Cambiar identificador"
                    aria-label="Cambiar identificador"
                  >
                    ✏️
                  </button>
                )}
              </div>
            </div>
            <div className="campo">
              <label>Nombre exacto en SAGA</label>
              <input value={m.nombreSaga} onChange={(e) => cambiar(i, { nombreSaga: e.target.value })} placeholder="(sin configurar)" />
            </div>
            <div className="campo">
              <label>Pestaña por defecto</label>
              <select value={m.pestanaDefault} onChange={(e) => cambiar(i, { pestanaDefault: e.target.value })}>
                {pestanas.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn-admin" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
              <button type="button" className="btn-admin" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label="Bajar">↓</button>
              <button type="button" className="btn-admin peligro" onClick={() => quitar(i)}>Quitar</button>
            </div>
          </div>
        ))}

        <div>
          <button type="button" className="btn-admin" onClick={agregar}>+ Agregar marca</button>
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar marcas"}
        </button>
      </div>
    </form>
  );
}
