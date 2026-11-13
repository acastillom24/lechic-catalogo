"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { guardarIntegracionWeb } from "../../app/(admin)/admin/actions";
import { idDeEtiqueta } from "../../lib/atributos-categoria";
import { permiteVariantesWeb } from "../../lib/equivalencias";
import { GRUPOS, CAMPOS_WEB, CATEGORIAS_PERFUME } from "../../lib/campos-web";
import SelectMulti from "./SelectMulti";
import ConsultaSagaAtributo from "./ConsultaSagaAtributo";

const TIPOS = [
  ["multi", "Varias opciones"],
  ["lista", "Una opción"],
  ["texto", "Texto libre"],
  ["numero", "Número"],
];
const FORM_ID = "form-integracion-web";
// Avisa al botón «Guardar» de la barra de pestañas (ConfiguracionForm) del estado del guardado. El resultado se emite desde la
// propia acción porque, al guardar, este componente se vuelve a montar con los datos nuevos y perdería su propio estado.
const emitir = (detalle) => window.dispatchEvent(new CustomEvent("integracion-estado", { detail: { formId: FORM_ID, ...detalle } }));
async function guardarYAvisar(prev, formData) {
  emitir({ enviando: true });
  try {
    const r = await guardarIntegracionWeb(prev, formData);
    emitir({ enviando: false, resultado: r });
    return r;
  } catch {
    const r = { error: "No se pudo guardar. Inténtalo de nuevo." };
    emitir({ enviando: false, resultado: r });
    return r;
  }
}
const ETIQUETA_TIPO = Object.fromEntries(TIPOS.map(([v, t]) => [v, t.toLowerCase()]));
const sinOpciones = (t) => t === "texto" || t === "numero";
const nuevoTmp = () => `nuevo_${Math.random().toString(36).slice(2, 8)}`;
const clave = (a) => a.id || a.tmp;
const idDe = (a) => a.id || idDeEtiqueta(a.etiqueta);

/**
 * Integraciones → Web. La web es la fuente de todo:
 *  1. Por categoría de la web: si permite variantes y con qué categorías de cada plataforma equivale (varias).
 *  2. Atributos de la web agrupados como en el formulario de producto (Identificación, Precio y stock, Imágenes, Clasificación,
 *     Perfil, Detalles, Paquete). Los principales son fijos; en los apartados que lo admiten se pueden crear atributos y cambiar su
 *     etiqueta, pero no borrarlos (afectaría a los productos ya guardados).
 *  3. Por categoría de la web: cuáles de esos atributos se ven. Las equivalencias con SAGA se eligen en Integraciones → SAGA
 *     solo entre los atributos visibles de la categoría; allí se avisa de lo que falta.
 */
export default function IntegracionWeb({ categoriasWeb = [], plataformas = [], categoriasSaga = [], equivalencias, catalogo = [], porCategoria = {} }) {
  const [estado, accion, enviando] = useActionState(guardarYAvisar, {});
  const [cats, setCats] = useState(() => structuredClone(equivalencias?.categorias || {}));
  const [config, setConfig] = useState(() => structuredClone(equivalencias?.configCategorias || {}));
  // Los campos generales son fijos: se reenvía tal cual lo que hubiera guardado (compatibilidad).
  const fijos = equivalencias?.fijos || {};
  const [datos, setDatos] = useState(() => catalogo.map((a) => ({ ...a, tipoInicial: a.tipo, min: a.min ? String(a.min) : "", max: a.max ? String(a.max) : "", opcionesTexto: (a.opciones || []).join("\n") })));
  // Atributos visibles por categoría web: { slug: [clave del atributo] }.
  const [activos, setActivos] = useState(() => Object.fromEntries(Object.entries(porCategoria).map(([s, l]) => [s, l.map((a) => a.id)])));
  const [slug, setSlug] = useState(categoriasWeb[0]?.slug || "");
  const eqVivo = useMemo(() => ({ categorias: cats, configCategorias: config }), [cats, config]);
  const esPerfume = (cats[slug]?.saga || []).includes("1735") || (!(cats[slug]?.saga || []).length && CATEGORIAS_PERFUME.includes(slug));

  const opcionesDe = (plat) => (plat === "saga" ? categoriasSaga.map((c) => ({ id: String(c.id), etiqueta: `${c.id} — ${c.nombre}` })) : []);
  const ponerCategorias = (web, plat, ids) =>
    setCats((p) => {
      const sig = structuredClone(p);
      if (ids.length) (sig[web] ||= {})[plat] = ids;
      else if (sig[web]) {
        delete sig[web][plat];
        if (!Object.keys(sig[web]).length) delete sig[web];
      }
      return sig;
    });
  const variantesDe = (web) => permiteVariantesWeb(eqVivo, categoriasSaga, web);
  const ponerVariantes = (web, v) => setConfig((p) => ({ ...p, [web]: { variantes: v } }));

  // Campos de SAGA enlazados (guardados) a un atributo web en una categoría web: ["1735 · Acabado", ...].
  const enlacesDe = (web, id) =>
    Object.entries(equivalencias?.atributos?.[web]?.saga || {}).flatMap(([cat, campos]) =>
      Object.entries(campos).filter(([, attr]) => attr === id).map(([campo]) => `${cat} · ${campo}`)
    );
  const visibleEn = (web, a) => (activos[web] || []).includes(clave(a));

  const cambiar = (k, cambios) => setDatos((p) => p.map((a) => (clave(a) === k ? { ...a, ...cambios } : a)));
  const mostrar = (web, k, marcar) =>
    setActivos((p) => {
      const resto = (p[web] || []).filter((x) => x !== k);
      return { ...p, [web]: marcar ? [...resto, k] : resto };
    });
  const alternar = (a, marcar) => {
    const en = marcar ? [] : enlacesDe(slug, a.id);
    if (en.length && !window.confirm(`«${a.etiqueta || "Atributo"}» está enlazado con SAGA en esta categoría (${en.join("; ")}). Al ocultarlo, esos campos dejan de usarse. ¿Ocultarlo?`)) return;
    mostrar(slug, clave(a), marcar);
  };
  // Atributo nuevo en un apartado: no queda visible en ninguna categoría (se marca después donde haga falta). Solo los aún no guardados se pueden quitar.
  const agregar = (grupo) => {
    const nuevo = { id: "", tmp: nuevoTmp(), etiqueta: "", tipo: "texto", opciones: [], opcionesTexto: "", min: "", max: "", grupo };
    setDatos((p) => [...p, nuevo]);
  };
  const quitarNuevo = (a) => {
    setDatos((p) => p.filter((x) => clave(x) !== clave(a)));
    setActivos((p) => Object.fromEntries(Object.entries(p).map(([s, l]) => [s, l.filter((k) => k !== clave(a))])));
  };

  const json = JSON.stringify({
    catalogo: datos.map((a) => ({
      id: idDe(a),
      etiqueta: a.etiqueta,
      tipo: a.tipo,
      grupo: a.grupo,
      min: a.tipo === "texto" ? a.min : "",
      max: a.tipo === "texto" ? a.max : "",
      opciones: sinOpciones(a.tipo) ? [] : a.opcionesTexto.split("\n").map((x) => x.trim()).filter(Boolean),
    })),
    activos: Object.fromEntries(Object.entries(activos).map(([s, ks]) => [s, datos.filter((a) => ks.includes(clave(a))).map(idDe)])),
  });

  // Cambios sin guardar: tras guardar la página se vuelve a montar con lo guardado, así que basta comparar con el primer estado.
  const base = useRef(null);
  if (base.current === null) base.current = json;
  const sinGuardar = json !== base.current;
  useEffect(() => {
    emitir({ sinGuardar });
  }, [sinGuardar]);

  const principales = (g) => CAMPOS_WEB.filter((c) => c.grupo === g.id);
  const propios = (g) => datos.filter((a) => a.grupo === g.id);

  return (
    <form action={accion} className="form-grid" id={FORM_ID}>
      <input type="hidden" name="atributosJson" value={json} />
      <input type="hidden" name="categoriasJson" value={JSON.stringify(cats)} />
      <input type="hidden" name="enlacesJson" value={JSON.stringify(equivalencias?.atributos || {})} />
      <input type="hidden" name="fijosJson" value={JSON.stringify(fijos)} />
      <input type="hidden" name="configCategoriasJson" value={JSON.stringify(config)} />

      <details className="admin-card saga-seccion pf-sub">
        <summary>
          Categorías de la web
          <em>{categoriasWeb.length} categorías</em>
        </summary>
        <div className="saga-cuerpo form-grid">
        <small style={{ color: "var(--gris)" }}>
          La web manda. Aquí decides, por categoría, si permite <strong>variantes</strong> y con qué categorías de cada plataforma
          equivale (pueden ser varias). Al crear un producto, la categoría de la plataforma solo ofrece estas equivalentes.
        </small>
        <div className="admin-tabla-wrap">
          <table className="admin-tabla pf-eq-tabla">
            <thead>
              <tr>
                <th>Categoría de la web</th>
                <th>Variantes</th>
                {plataformas.map((p) => <th key={p.id}>Equivale en {p.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {categoriasWeb.map((c) => (
                <tr key={c.slug}>
                  <td><strong>{c.nombre}</strong><small style={{ display: "block", color: "var(--gris)" }}>{c.slug}</small></td>
                  <td>
                    <label className="campo-check" title="Si la categoría permite agregar variantes a sus productos">
                      <input type="checkbox" checked={variantesDe(c.slug)} onChange={(e) => ponerVariantes(c.slug, e.target.checked)} />
                      Permitir
                    </label>
                  </td>
                  {plataformas.map((p) => {
                    const ids = cats[c.slug]?.[p.id] || [];
                    const opciones = opcionesDe(p.id);
                    return (
                      <td key={p.id}>
                        <SelectMulti
                          libre={p.id !== "saga"}
                          valor={ids}
                          opciones={opciones.map((o) => o.id)}
                          formato={p.id === "saga" ? (id) => opciones.find((o) => o.id === id)?.etiqueta || id : undefined}
                          onChange={(v) => ponerCategorias(c.slug, p.id, v)}
                          placeholder={p.id === "saga" ? "Elegir categorías…" : "Escribir códigos…"}
                          buscar={p.id === "saga" ? "Buscar por código o nombre…" : "Escribe un código y presiona Enter…"}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </details>

      <details className="admin-card saga-seccion pf-sub">
        <summary>
          Atributos de la web
          <em>{CAMPOS_WEB.length} principales · {datos.length} adicionales</em>
        </summary>
        <div className="saga-cuerpo form-grid">
        <small style={{ color: "var(--gris)" }}>
          Están agrupados como en el formulario de producto. Los <strong>principales</strong> vienen con la web y no se modifican. En
          «Clasificación», «Perfil del producto», «Detalles» y «Paquete» puedes <strong>crear atributos</strong> y cambiar su nombre;
          no se pueden borrar porque los productos ya guardados los usan. Qué atributos se ven en cada categoría se elige más abajo.
        </small>
        {GRUPOS.map((g) => {
          const fijosG = principales(g);
          const propiosG = g.atributos ? propios(g) : [];
          return (
            <details className="saga-seccion pf-sub" key={g.id}>
              <summary>
                {g.nombre}
                <em>{fijosG.length} principales{g.atributos ? ` · ${propiosG.length} adicionales` : ""}</em>
              </summary>
              <div className="saga-cuerpo form-grid">
                <div className="admin-tabla-wrap">
                  <table className="admin-tabla pf-eq-tabla-web">
                    <thead>
                      <tr>
                        <th>Atributo</th>
                        <th>Tipo</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fijosG.map((def) => (
                        <tr key={def.id}>
                          <td>{def.etiqueta}</td>
                          <td>{ETIQUETA_TIPO[def.tipo] || def.tipo}</td>
                          <td><small style={{ color: "var(--gris)" }}>🔒 principal{def.soloPerfume ? " · solo perfumes" : ""}</small></td>
                        </tr>
                      ))}
                      {propiosG.flatMap((a) => {
                        const k = clave(a);
                        const nuevo = !a.id; // aún sin guardar: tipo y opciones se definen ahora; después solo cambia la etiqueta
                        return [
                          <tr key={k} className="pf-eq-propio">
                            <td>
                              <input value={a.etiqueta} maxLength={60} onChange={(e) => cambiar(k, { etiqueta: e.target.value })} placeholder="Nombre en la web (ej. Acabado)" aria-label="Nombre del atributo" />
                            </td>
                            <td>
                              <select value={a.tipo} onChange={(e) => cambiar(k, { tipo: e.target.value })} aria-label="Tipo">
                                {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                              </select>
                              {!nuevo && a.tipo !== a.tipoInicial && (
                                <small style={{ display: "block", color: "#b26a00" }}>
                                  ⚠ Era «{ETIQUETA_TIPO[a.tipoInicial]}». Los valores de productos que no encajen con el nuevo tipo se ignorarán
                                  {enlacesDe(slug, a.id).length ? "; está enlazado con SAGA, revisa Integraciones → SAGA" : ""}.
                                </small>
                              )}
                            </td>
                            <td>
                              {nuevo ? (
                                <button type="button" className="btn-admin peligro" onClick={() => quitarNuevo(a)}>Quitar</button>
                              ) : (
                                <small style={{ color: "var(--gris)" }}>adicional</small>
                              )}
                            </td>
                          </tr>,
                          <tr key={`${k}-op`} className="pf-eq-propio-extra">
                            <td colSpan={3}>
                              <div className="form-grid">
                                {a.tipo === "texto" && (
                                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    <div className="campo">
                                      <label>Largo mínimo <em>caracteres, opcional</em></label>
                                      <input type="number" min={1} max={1000} value={a.min} onChange={(e) => cambiar(k, { min: e.target.value })} style={{ maxWidth: 140 }} />
                                    </div>
                                    <div className="campo">
                                      <label>Largo máximo <em>caracteres, opcional</em></label>
                                      <input type="number" min={1} max={1000} value={a.max} onChange={(e) => cambiar(k, { max: e.target.value })} style={{ maxWidth: 140 }} />
                                    </div>
                                  </div>
                                )}
                                {!sinOpciones(a.tipo) && (
                                  <div className="campo">
                                    <label>Opciones de «{a.etiqueta || "atributo"}» <em>una por línea</em></label>
                                    <textarea rows={3} value={a.opcionesTexto} onChange={(e) => cambiar(k, { opcionesTexto: e.target.value })} />
                                    <small style={{ color: "var(--gris)" }}>Si agregas una línea con «…», la lista queda abierta: en el producto también se podrá escribir otro valor (SAGA lo acepta).</small>
                                  </div>
                                )}
                                <ConsultaSagaAtributo
                                  categoriasSaga={categoriasSaga}
                                  etiquetaActual={a.etiqueta}
                                  onAplicar={({ opciones, etiqueta, ...resto }) =>
                                    cambiar(k, { ...resto, opcionesTexto: opciones.join("\n"), ...(etiqueta ? { etiqueta: etiqueta.slice(0, 60) } : {}) })
                                  }
                                />
                              </div>
                            </td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
                {g.atributos && (
                  <div>
                    <button type="button" className="btn-admin" onClick={() => agregar(g.id)}>+ Agregar atributo en «{g.nombre}»</button>
                  </div>
                )}
              </div>
            </details>
          );
        })}
        </div>
      </details>

      <details className="admin-card saga-seccion pf-sub">
        <summary>
          Atributos visibles por categoría
          <em>{categoriasWeb.find((c) => c.slug === slug)?.nombre || ""}</em>
        </summary>
        <div className="saga-cuerpo form-grid">
        <small style={{ color: "var(--gris)" }}>
          Elige una categoría y marca los atributos de la web que se ven en sus productos. Los principales vienen fijos. Si un atributo
          no está visible aquí, no podrás elegirlo como equivalencia en <strong>Integraciones → SAGA</strong>.
        </small>
        <div className="campo">
          <label htmlFor="attr-categoria">Categoría de la web</label>
          <select id="attr-categoria" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {categoriasWeb.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}{activos[c.slug]?.length ? ` (${activos[c.slug].length} visibles)` : ""}
              </option>
            ))}
          </select>
        </div>
        {GRUPOS.map((g) => {
          const fijosG = principales(g).filter((c) => !c.soloPerfume || esPerfume);
          const lista = g.atributos ? propios(g) : [];
          if (!fijosG.length && !lista.length) return null;
          return (
            <details className="saga-seccion pf-sub" key={g.id}>
              <summary>
                {g.nombre}
                <em>{fijosG.length + lista.filter((a) => visibleEn(slug, a)).length} visibles</em>
              </summary>
              <div className="saga-cuerpo form-grid">
                {fijosG.map((def) => (
                  <label key={def.id} className="campo-check" title="Atributo principal: siempre visible">
                    <input type="checkbox" checked disabled readOnly />
                    {def.etiqueta} <small style={{ color: "var(--gris)" }}>· principal</small>
                  </label>
                ))}
                {lista.map((a) => {
                  const enlaces = enlacesDe(slug, a.id);
                  return (
                    <label key={clave(a)} className="campo-check">
                      <input type="checkbox" checked={visibleEn(slug, a)} onChange={(e) => alternar(a, e.target.checked)} />
                      {a.etiqueta || "(sin nombre)"}
                      {enlaces.length > 0 && <small style={{ color: "var(--gris)" }}> · enlazado con SAGA: {enlaces.join("; ")}</small>}
                    </label>
                  );
                })}
                {g.atributos && !lista.length && <small style={{ color: "var(--gris)" }}>Aún no hay atributos adicionales en este apartado. Créalos arriba.</small>}
              </div>
            </details>
          );
        })}
        </div>
      </details>

    </form>
  );
}
