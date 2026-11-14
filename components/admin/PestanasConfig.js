"use client";

import { useActionState, useEffect, useState } from "react";
import { guardarPestanasConfig, restablecerMarcasPestanas, renombrarIdentificador } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";

/**
 * Pestañas de la web (menú y catálogos) y catálogo global de categorías, como tablas. Cada pestaña muestra solo las categorías que se
 * activan con un click. `vista` = "categorias" | "pestanas" | "marcas" (la comparte el panel con pestañas; en «marcas» el formulario se
 * oculta pero sigue montado). `onConteo` avisa al panel de cuántas categorías y pestañas hay.
 */
export default function PestanasConfig({ pestanas, categorias, vista = "pestanas", onConteo }) {
  const [estado, accion, enviando] = useActionState(guardarPestanasConfig, {});
  const [cats, setCats] = useState(() => categorias.map((c) => ({ ...c, existente: true })));
  const [tabs, setTabs] = useState(() => pestanas.map((p) => ({ ...p, existente: true })));
  const [nuevaCat, setNuevaCat] = useState("");
  const [abiertas, setAbiertas] = useState(() => new Set());
  const abrir = (i, v) =>
    setAbiertas((p) => {
      const sig = new Set(p);
      if (v) sig.add(i); else sig.delete(i);
      return sig;
    });

  useEffect(() => {
    onConteo?.({ categorias: cats.length, pestanas: tabs.length });
  }, [cats.length, tabs.length, onConteo]);

  const cambiarTab = (i, parche) => setTabs((t) => t.map((x, j) => (j === i ? { ...x, ...parche } : x)));
  const alternar = (i, slug) =>
    setTabs((t) =>
      t.map((x, j) =>
        j !== i ? x : { ...x, categorias: x.categorias.includes(slug) ? x.categorias.filter((s) => s !== slug) : [...x.categorias, slug] }
      )
    );
  const agregarTab = () => {
    abrir(tabs.length, true);
    setTabs((t) => [...t, { slug: "", nombre: "", descripcion: "", color: "#f06595", categorias: [], existente: false }]);
  };
  const [aviso, setAviso] = useState(null);
  async function cambiarIdentificador(i) {
    const viejo = tabs[i].slug;
    const nuevo = (window.prompt(`Nuevo identificador para "${viejo}" (minúsculas, números y guiones):`, viejo) || "").trim();
    if (!nuevo || nuevo === viejo) return;
    if (!window.confirm(`Se cambiará "${viejo}" por "${nuevo}": cambia la URL /marca/${viejo} y se migrarán los productos de esta pestaña. ¿Continuar?`)) return;
    const r = await renombrarIdentificador("pestana", viejo, nuevo);
    if (r.ok) cambiarTab(i, { slug: nuevo });
    setAviso(r);
  }
  const quitarTab = (i) => {
    setAbiertas(new Set());
    setTabs((t) => t.filter((_, j) => j !== i));
  };
  const moverTab = (i, d) => {
    setAbiertas(new Set());
    setTabs((t) => {
      const j = i + d;
      if (j < 0 || j >= t.length) return t;
      const n = t.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  function agregarCategoria() {
    const nombre = nuevaCat.trim();
    const slug = slugify(nombre);
    if (!nombre || !slug || cats.some((c) => c.slug === slug)) return;
    setCats((c) => [...c, { slug, nombre, existente: false }]);
    setNuevaCat("");
  }
  const quitarCategoria = (slug) => {
    setCats((c) => c.filter((x) => x.slug !== slug));
    setTabs((t) => t.map((x) => ({ ...x, categorias: x.categorias.filter((s) => s !== slug) })));
  };

  const categoriasJson = JSON.stringify(cats.map(({ slug, nombre }) => ({ slug, nombre })));
  const pestanasJson = JSON.stringify(
    tabs.map(({ slug, nombre, descripcion, color, categorias: activas }) => ({ slug, nombre, descripcion, color, categorias: activas }))
  );
  const nombreCat = (slug) => cats.find((c) => c.slug === slug)?.nombre || slug;

  return (
    <form action={accion} className="form-grid" hidden={vista === "marcas"}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      {aviso?.error && <div className="mensaje-error">{aviso.error}</div>}
      {aviso?.ok && <div className="mensaje-ok">{aviso.ok}</div>}
      <input type="hidden" name="categoriasJson" value={categoriasJson} />
      <input type="hidden" name="pestanasJson" value={pestanasJson} />

      {/* ---------- Categorías disponibles ---------- */}
      <div hidden={vista !== "categorias"} className="form-grid">
        <div className="pf-panel-bloque">
          <strong>Categorías disponibles</strong>
          <small style={{ color: "var(--gris)" }}>
            Catálogo general de categorías. Cada pestaña elige cuáles muestra. Las de perfumería (<code>feminine</code>, <code>masculine</code>,{" "}
            <code>couples</code>) determinan el formulario de perfume y el género en SAGA: no las quites.
          </small>
          <div className="admin-tabla-wrap">
            <table className="admin-tabla cg-tabla-lista">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Identificador</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.slug}>
                    <td>{c.nombre}</td>
                    <td><code>{c.slug}</code></td>
                    <td className="cg-acc">
                      <button type="button" className="btn-admin cg-ico peligro" onClick={() => quitarCategoria(c.slug)} aria-label={`Quitar ${c.nombre}`} title="Quitar la categoría">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarCategoria();
                }
              }}
              placeholder="Nueva categoría (ej. Fragancias hogar)"
              aria-label="Nueva categoría"
              style={{ minWidth: 240 }}
            />
            <button type="button" className="btn-admin cg-mas" onClick={agregarCategoria}>+ Agregar categoría</button>
          </div>
        </div>
      </div>

      {/* ---------- Pestañas ---------- */}
      <div hidden={vista !== "pestanas"} className="form-grid">
        <div className="pf-panel-bloque">
          <strong>Pestañas de la web</strong>
          <small style={{ color: "var(--gris)" }}>
            Cada pestaña aparece en el menú y tiene su propio catálogo. Con ✎ eliges qué categorías muestra. No puedes quitar una pestaña o
            categoría que tenga productos.
          </small>
          <div className="admin-tabla-wrap">
            <table className="admin-tabla cg-tabla-pest">
              <thead>
                <tr>
                  <th aria-label="Orden" />
                  <th>Pestaña</th>
                  <th>Categorías que muestra</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {tabs.flatMap((t, i) => {
                  const ab = abiertas.has(i) || !t.nombre;
                  return [
                    <tr key={i}>
                      <td className="cg-orden">
                        <button type="button" className="btn-admin cg-ico" onClick={() => moverTab(i, -1)} disabled={i === 0} aria-label="Subir" title="Subir">↑</button>
                        <button type="button" className="btn-admin cg-ico" onClick={() => moverTab(i, 1)} disabled={i === tabs.length - 1} aria-label="Bajar" title="Bajar">↓</button>
                      </td>
                      <td>
                        <span className="cg-punto" style={{ background: t.color }} />
                        {t.nombre || <small style={{ color: "var(--gris)" }}>(nueva pestaña)</small>}
                        {t.slug && <code className="cg-slug">{t.slug}</code>}
                      </td>
                      <td className="cg-trunc" title={t.categorias.map(nombreCat).join(", ")}>
                        {t.categorias.length ? `${t.categorias.length}: ${t.categorias.map(nombreCat).join(", ")}` : "—"}
                      </td>
                      <td className="cg-acc">
                        {ab ? (
                          t.nombre && <button type="button" className="btn-admin" onClick={() => abrir(i, false)} title="Listo (se guarda con el botón Guardar)">✓ Listo</button>
                        ) : (
                          <button type="button" className="btn-admin cg-ico" onClick={() => abrir(i, true)} aria-label={`Editar ${t.nombre}`} title="Editar">✎</button>
                        )}
                        <button type="button" className="btn-admin cg-ico peligro" onClick={() => quitarTab(i)} aria-label={`Quitar ${t.nombre || "la pestaña"}`} title="Quitar la pestaña">✕</button>
                      </td>
                    </tr>,
                    ab && (
                      <tr key={`${i}-e`} className="pf-eq-propio-extra">
                        <td colSpan={4}>
                          <div className="form-grid">
                            <div className="cg-listas">
                              <div className="campo">
                                <label>Nombre</label>
                                <input value={t.nombre} onChange={(e) => cambiarTab(i, { nombre: e.target.value, ...(t.existente ? {} : { slug: slugify(e.target.value) }) })} />
                              </div>
                              <div className="campo">
                                <label>Identificador (URL: /marca/…)</label>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input value={t.slug} readOnly={t.existente} onChange={(e) => cambiarTab(i, { slug: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                                  {t.existente && (
                                    <button type="button" className="btn-admin cg-ico" onClick={() => cambiarIdentificador(i)} title="Cambiar identificador" aria-label="Cambiar identificador">✎</button>
                                  )}
                                </div>
                              </div>
                              <div className="campo">
                                <label>Color</label>
                                <input type="color" value={t.color} onChange={(e) => cambiarTab(i, { color: e.target.value })} style={{ height: 32, padding: 2 }} />
                              </div>
                            </div>
                            <div className="campo">
                              <label>Descripción</label>
                              <input value={t.descripcion} onChange={(e) => cambiarTab(i, { descripcion: e.target.value })} />
                            </div>
                            <div className="campo">
                              <label>Categorías que se muestran <em>clic para activar o desactivar</em></label>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {cats.map((c) => {
                                  const activa = t.categorias.includes(c.slug);
                                  return (
                                    <button
                                      type="button"
                                      key={c.slug}
                                      className={`chip-per${activa ? " activo" : ""}`}
                                      aria-pressed={activa}
                                      onClick={() => alternar(i, c.slug)}
                                      style={{ border: 0, cursor: "pointer" }}
                                    >
                                      {activa ? "✓ " : ""}
                                      {c.nombre}
                                    </button>
                                  );
                                })}
                              </div>
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
            <button type="button" className="btn-admin cg-mas" onClick={agregarTab}>+ Agregar pestaña</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar pestañas y categorías"}
        </button>
        <button
          type="submit"
          className="btn-admin peligro"
          formAction={restablecerMarcasPestanas}
          onClick={(e) => {
            if (!confirm("¿Volver a las marcas, pestañas y categorías originales? Se perderán los cambios guardados.")) e.preventDefault();
          }}
        >
          Restablecer marcas y pestañas originales
        </button>
      </div>
    </form>
  );
}
