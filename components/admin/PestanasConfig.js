"use client";

import { useActionState, useState } from "react";
import { guardarPestanasConfig, restablecerMarcasPestanas } from "../../app/(admin)/admin/actions";
import { slugify } from "../../lib/slug";

/**
 * Pestañas de la web (menú y catálogos) y catálogo global de categorías.
 * Cada pestaña muestra solo las categorías que se activan con un click.
 */
export default function PestanasConfig({ pestanas, categorias }) {
  const [estado, accion, enviando] = useActionState(guardarPestanasConfig, {});
  const [cats, setCats] = useState(() => categorias.map((c) => ({ ...c, existente: true })));
  const [tabs, setTabs] = useState(() => pestanas.map((p) => ({ ...p, existente: true })));
  const [nuevaCat, setNuevaCat] = useState("");

  const cambiarTab = (i, parche) => setTabs((t) => t.map((x, j) => (j === i ? { ...x, ...parche } : x)));
  const alternar = (i, slug) =>
    setTabs((t) =>
      t.map((x, j) =>
        j !== i ? x : { ...x, categorias: x.categorias.includes(slug) ? x.categorias.filter((s) => s !== slug) : [...x.categorias, slug] }
      )
    );
  const agregarTab = () =>
    setTabs((t) => [...t, { slug: "", nombre: "", descripcion: "", color: "#f06595", categorias: [], existente: false }]);
  const quitarTab = (i) => setTabs((t) => t.filter((_, j) => j !== i));
  const moverTab = (i, d) =>
    setTabs((t) => {
      const j = i + d;
      if (j < 0 || j >= t.length) return t;
      const n = t.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

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

  return (
    <form action={accion} className="form-grid">
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      <input type="hidden" name="categoriasJson" value={categoriasJson} />
      <input type="hidden" name="pestanasJson" value={pestanasJson} />

      <section className="admin-card form-grid">
        <h2>Categorías disponibles</h2>
        <small style={{ color: "var(--gris)" }}>
          Catálogo general de categorías. Cada pestaña elige cuáles muestra. Las de perfumería (<code>feminine</code>,{" "}
          <code>masculine</code>, <code>couples</code>) determinan el formulario de perfume y el género en SAGA: no las quites.
        </small>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {cats.map((c) => (
            <span key={c.slug} className="chip-per" title={c.slug}>
              {c.nombre}
              <button
                type="button"
                aria-label={`Quitar ${c.nombre}`}
                onClick={() => quitarCategoria(c.slug)}
                style={{ background: "none", border: 0, cursor: "pointer", marginLeft: 6, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="form-fila" style={{ alignItems: "end" }}>
          <div className="campo">
            <label htmlFor="nueva-categoria">Nueva categoría</label>
            <input
              id="nueva-categoria"
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarCategoria();
                }
              }}
              placeholder="Ej: Fragancias hogar"
            />
          </div>
          <div>
            <button type="button" className="btn-admin" onClick={agregarCategoria}>+ Agregar categoría</button>
          </div>
        </div>
      </section>

      <section className="admin-card form-grid">
        <h2>Pestañas de la web</h2>
        <small style={{ color: "var(--gris)" }}>
          Cada pestaña aparece en el menú y tiene su propio catálogo. Haz click en una categoría para activarla o desactivarla en esa
          pestaña. No puedes quitar una pestaña o categoría que tenga productos.
        </small>

        {tabs.map((t, i) => (
          <details key={i} className="saga-seccion" open={!t.existente}>
            <summary>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, background: t.color, marginRight: 8 }} />
              {t.nombre || "(nueva pestaña)"}
              <em>{t.categorias.length} categorías activas</em>
            </summary>
            <div className="saga-cuerpo form-grid">
              <div className="form-fila">
                <div className="campo">
                  <label>Nombre</label>
                  <input
                    value={t.nombre}
                    onChange={(e) => cambiarTab(i, { nombre: e.target.value, ...(t.existente ? {} : { slug: slugify(e.target.value) }) })}
                  />
                </div>
                <div className="campo">
                  <label>Identificador (URL: /marca/…)</label>
                  <input value={t.slug} readOnly={t.existente} onChange={(e) => cambiarTab(i, { slug: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Color</label>
                  <input type="color" value={t.color} onChange={(e) => cambiarTab(i, { color: e.target.value })} />
                </div>
              </div>
              <div className="campo">
                <label>Descripción</label>
                <input value={t.descripcion} onChange={(e) => cambiarTab(i, { descripcion: e.target.value })} />
              </div>
              <div className="campo">
                <label>Categorías que se muestran</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn-admin" onClick={() => moverTab(i, -1)} disabled={i === 0}>↑ Subir</button>
                <button type="button" className="btn-admin" onClick={() => moverTab(i, 1)} disabled={i === tabs.length - 1}>↓ Bajar</button>
                <button type="button" className="btn-admin peligro" onClick={() => quitarTab(i)}>Quitar pestaña</button>
              </div>
            </div>
          </details>
        ))}

        <div>
          <button type="button" className="btn-admin" onClick={agregarTab}>+ Agregar pestaña</button>
        </div>
      </section>

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
