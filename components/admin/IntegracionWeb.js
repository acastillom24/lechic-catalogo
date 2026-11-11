"use client";

import { useActionState, useMemo, useState } from "react";
import { guardarIntegracionWeb } from "../../app/(admin)/admin/actions";
import { idDeEtiqueta, camposEnlazables, compatible } from "../../lib/atributos-categoria";
import { permiteVariantesWeb } from "../../lib/equivalencias";
import { GRUPOS, GRUPOS_ATRIBUTOS, CAMPOS_WEB, CATEGORIAS_PERFUME } from "../../lib/campos-web";
import SelectMulti from "./SelectMulti";

const TIPOS = [
  ["multi", "Varias opciones"],
  ["lista", "Una opción"],
  ["texto", "Texto libre"],
  ["numero", "Número"],
];
const ETIQUETA_TIPO = { multi: "varias opciones", lista: "una opción", texto: "texto", numero: "número" };
const sinOpciones = (t) => t === "texto" || t === "numero";
const nuevoTmp = () => `nuevo_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Integraciones → Web. La web es la fuente de todo:
 *  1. Por categoría de la web: si permite variantes y con qué categorías de cada plataforma equivale (varias).
 *  2. Por categoría de la web: TODOS sus campos agrupados como en el formulario de producto (Identificación, Precio y stock,
 *     Imágenes, Clasificación, Aromas, Medida, Detalles, Paquete) con su equivalencia en cada plataforma. Los campos propios de
 *     la web ya traen marcada la equivalencia de SAGA (se puede cambiar o quitar); los que agregues aquí van en el apartado que
 *     elijas (por defecto Detalles) y se enlazan al campo de SAGA que signifique lo mismo, con el nombre que quieras en la web.
 */
export default function IntegracionWeb({ categoriasWeb = [], plataformas = [], categoriasSaga = [], equivalencias, catalogo = {} }) {
  const [estado, accion, enviando] = useActionState(guardarIntegracionWeb, {});
  const [cats, setCats] = useState(() => structuredClone(equivalencias?.categorias || {}));
  const [config, setConfig] = useState(() => structuredClone(equivalencias?.configCategorias || {}));
  // Los campos generales son fijos: se reenvía tal cual lo que hubiera guardado (compatibilidad).
  const fijos = equivalencias?.fijos || {};
  const [datos, setDatos] = useState(() =>
    Object.fromEntries(
      Object.entries(catalogo).map(([slug, lista]) => [slug, lista.map((a) => ({ ...a, opcionesTexto: (a.opciones || []).join("\n") }))])
    )
  );
  // Enlaces de atributos web con campos de SAGA, vistos desde el atributo: { web: { atributoId: { categoriaSaga: campo } } }.
  const [vinc, setVinc] = useState(() => {
    const salida = {};
    for (const [web, porPlat] of Object.entries(equivalencias?.atributos || {})) {
      for (const [cat, campos] of Object.entries(porPlat.saga || {})) {
        for (const [campo, attr] of Object.entries(campos)) ((salida[web] ||= {})[attr] ||= {})[cat] = campo;
      }
    }
    return salida;
  });
  const [slug, setSlug] = useState(categoriasWeb[0]?.slug || "");
  const lista = datos[slug] || [];
  const sagaCats = cats[slug]?.saga || [];
  const sagaNombre = (id) => categoriasSaga.find((c) => String(c.id) === String(id))?.nombre || "";
  const esPerfume = sagaCats.includes("1735") || (!sagaCats.length && CATEGORIAS_PERFUME.includes(slug));
  const eqVivo = useMemo(() => ({ categorias: cats, configCategorias: config }), [cats, config]);

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

  // --- atributos propios del slug actual ---
  const poner = (nueva) => setDatos((p) => ({ ...p, [slug]: nueva }));
  const clave = (a) => a.id || a.tmp;
  const cambiar = (k, cambios) => poner(lista.map((a) => (clave(a) === k ? { ...a, ...cambios } : a)));
  const agregar = (grupo) => poner([...lista, { id: "", tmp: nuevoTmp(), etiqueta: "", tipo: "texto", opciones: [], opcionesTexto: "", grupo }]);
  const quitar = (a) => {
    const enlaces = Object.entries(vinc[slug]?.[clave(a)] || {});
    if (enlaces.length && !window.confirm(`«${a.etiqueta || "Atributo"}» está enlazado con SAGA (${enlaces.map(([c, f]) => `${c} · ${f}`).join("; ")}). Al quitarlo, esos campos dejan de usarse. ¿Quitarlo?`)) return;
    poner(lista.filter((x) => clave(x) !== clave(a)));
    setVinc((p) => {
      const sig = structuredClone(p);
      if (sig[slug]) delete sig[slug][clave(a)];
      return sig;
    });
  };
  const mover = (a, d) => {
    const i = lista.findIndex((x) => clave(x) === clave(a));
    const j = i + d;
    if (i < 0 || j < 0 || j >= lista.length) return;
    const copia = [...lista];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    poner(copia);
  };

  // Campo de SAGA elegido para un atributo web en una categoría de SAGA, y campos que aún se pueden elegir.
  const campoDe = (a, cat) => vinc[slug]?.[clave(a)]?.[cat] || "";
  const ponerCampo = (a, cat, campo) =>
    setVinc((p) => {
      const sig = structuredClone(p);
      const mapa = ((sig[slug] ||= {})[clave(a)] ||= {});
      if (campo) mapa[cat] = campo;
      else delete mapa[cat];
      return sig;
    });
  const camposLibres = (a, cat) => {
    const usados = new Set(lista.filter((x) => clave(x) !== clave(a)).map((x) => campoDe(x, cat)).filter(Boolean));
    return camposEnlazables(cat).filter((c) => compatible({ tipo: a.tipo }, c) && !usados.has(c.id));
  };

  const json = JSON.stringify(
    Object.fromEntries(
      Object.entries(datos).map(([s, l]) => [
        s,
        l.map((a) => ({
          id: a.id || idDeEtiqueta(a.etiqueta),
          etiqueta: a.etiqueta,
          tipo: a.tipo,
          grupo: a.grupo,
          opciones: sinOpciones(a.tipo) ? [] : a.opcionesTexto.split("\n").map((x) => x.trim()).filter(Boolean),
        })),
      ])
    )
  );
  // Enlaces a enviar: los de otras plataformas tal cual y los de SAGA reconstruidos desde lo elegido en pantalla.
  const enlaces = (() => {
    const salida = structuredClone(equivalencias?.atributos || {});
    for (const web of Object.keys(datos)) {
      const porAttr = vinc[web] || {};
      const nuevo = {};
      for (const a of datos[web]) {
        const id = a.id || idDeEtiqueta(a.etiqueta);
        for (const [cat, campo] of Object.entries(porAttr[clave(a)] || {})) if (campo) ((nuevo[cat] ||= {})[campo] = id);
      }
      (salida[web] ||= {}).saga = nuevo;
    }
    return salida;
  })();

  // Obligatorios de SAGA (de las categorías que cruzan con esta categoría web) que aún no tienen atributo web: se muestran en rojo.
  const faltantes = sagaCats.flatMap((cat) =>
    camposEnlazables(cat)
      .filter((c) => c.obligatorio && !lista.some((a) => campoDe(a, cat) === c.id))
      .map((c) => ({ cat, campo: c }))
  );
  // «Crear atributo en la web»: reutiliza uno con el mismo nombre que esté libre o crea uno nuevo (apartado Detalles) ya enlazado.
  const crearDesdeFalta = ({ cat, campo }) => {
    const igual = lista.find((a) => idDeEtiqueta(a.etiqueta) === idDeEtiqueta(campo.etiqueta) && compatible(a, campo) && !campoDe(a, cat));
    if (igual) return ponerCampo(igual, cat, campo.id);
    const nuevo = {
      id: "",
      tmp: nuevoTmp(),
      etiqueta: campo.etiqueta,
      tipo: campo.tipo,
      opciones: [...(campo.opciones || [])],
      opcionesTexto: (campo.opciones || []).join("\n"),
      grupo: "detalles",
    };
    poner([...lista, nuevo]);
    ponerCampo(nuevo, cat, campo.id);
  };

  const camposVisibles = (g) => CAMPOS_WEB.filter((c) => c.grupo === g.id && (!c.soloPerfume || esPerfume));

  return (
    <form action={accion} className="form-grid" id="form-integracion-web">
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}
      <input type="hidden" name="atributosJson" value={json} />
      <input type="hidden" name="categoriasJson" value={JSON.stringify(cats)} />
      <input type="hidden" name="enlacesJson" value={JSON.stringify(enlaces)} />
      <input type="hidden" name="fijosJson" value={JSON.stringify(fijos)} />
      <input type="hidden" name="configCategoriasJson" value={JSON.stringify(config)} />

      <section className="admin-card form-grid">
        <h2>Categorías de la web</h2>
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
      </section>

      <section className="admin-card form-grid">
        <h2>Atributos por categoría</h2>
        <small style={{ color: "var(--gris)" }}>
          Elige una categoría de la web y verás todos sus campos agrupados como en el formulario de producto, con su equivalencia en
          cada plataforma. Los campos propios de la web traen marcada la equivalencia de SAGA (cámbiala o quítala); los atributos que
          agregues van en el apartado que elijas (por defecto <strong>Detalles</strong>) y se enlazan al campo de SAGA que signifique lo
          mismo, aunque en la web se llamen distinto.
        </small>

        <div className="campo">
          <label htmlFor="attr-categoria">Categoría de la web</label>
          <select id="attr-categoria" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {categoriasWeb.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}{datos[c.slug]?.length ? ` (${datos[c.slug].length} propios)` : ""}
              </option>
            ))}
          </select>
        </div>

        {faltantes.length > 0 && (
          <div className="pf-eq-alerta" role="alert">
            ⚠ Obligatorios de SAGA sin atributo en la web: {faltantes.map(({ cat, campo }) => `${campo.etiqueta} (${cat})`).join(", ")}. Están en rojo en «Detalles»; créalos para poder publicar.
          </div>
        )}

        <div className="cfg-atributo-enlaces">
          {sagaCats.length ? (
            sagaCats.map((id) => <span className="chip-saga ok" key={id}>SAGA {id}{sagaNombre(id) ? ` — ${sagaNombre(id)}` : ""}</span>)
          ) : (
            <span className="chip-saga aviso">Sin categoría de SAGA: asígnala arriba para enlazar atributos</span>
          )}
          {plataformas.slice(1).map((p) => (
            <span className="chip-saga" key={p.id}>{p.nombre}: sus campos se habilitan al integrarla</span>
          ))}
        </div>

        {GRUPOS.map((g) => {
          const fijosG = camposVisibles(g);
          const propiosG = g.atributos ? lista.filter((a) => a.grupo === g.id) : [];
          if (!fijosG.length && !g.atributos) return null;
          return (
            <details className="saga-seccion pf-sub" key={g.id}>
              <summary>
                {g.nombre}
                <em>{fijosG.length} de la web{propiosG.length ? ` · ${propiosG.length} propio${propiosG.length === 1 ? "" : "s"}` : ""}</em>
                {g.id === "detalles" && faltantes.length > 0 && <span className="chip-saga aviso" style={{ background: "#fde8e8", color: "#b3261e" }}>{faltantes.length} sin atributo</span>}
              </summary>
              <div className="saga-cuerpo form-grid">
                <div className="admin-tabla-wrap">
                  <table className="admin-tabla pf-eq-tabla-web">
                    <thead>
                      <tr>
                        <th>Atributo de la web</th>
                        <th>Tipo</th>
                        <th>Equivale en SAGA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fijosG.map((def) => (
                        <tr key={def.id}>
                          <td>
                            {def.etiqueta}
                            <small style={{ display: "block", color: "var(--gris)" }}>campo de la web{def.obligatorioSaga ? " · obligatorio en SAGA" : ""}</small>
                          </td>
                          <td>{ETIQUETA_TIPO[def.tipo] || def.tipo}</td>
                          <td>
                            {def.equivSoloPerfume && !esPerfume ? (
                              <small style={{ color: "var(--gris)" }}>— solo en la web (SAGA la recibe solo en perfumes)</small>
                            ) : (
                              <span className="pf-eq-fija" title="Campo general de SAGA: no se puede cambiar">
                                <code>{def.saga}</code> <small>fija</small>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {propiosG.flatMap((a) => {
                        const k = clave(a);
                        const filas = [
                          <tr key={k} className="pf-eq-propio">
                            <td>
                              <input value={a.etiqueta} maxLength={60} onChange={(e) => cambiar(k, { etiqueta: e.target.value })} placeholder="Nombre en la web (ej. Acabado)" aria-label="Nombre del atributo" />
                              <small style={{ display: "block" }}>
                                {a.virtual && <span className="chip-saga aviso">Nuevo desde SAGA: se guarda al presionar Guardar</span>}
                              </small>
                            </td>
                            <td>
                              <select value={a.tipo} onChange={(e) => cambiar(k, { tipo: e.target.value })} aria-label="Tipo">
                                {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                              </select>
                            </td>
                            <td>
                              {sagaCats.length === 0 ? (
                                <small>Asigna una categoría de SAGA arriba</small>
                              ) : (
                                <div className="pf-eq-celdas">
                                  {sagaCats.map((cat) => {
                                    const actual = campoDe(a, cat);
                                    const libres = camposLibres(a, cat);
                                    const actualDef = camposEnlazables(cat).find((c) => c.id === actual);
                                    return (
                                      <label key={cat} className="pf-eq-celda">
                                        <span>{cat}</span>
                                        <select value={actual} onChange={(e) => ponerCampo(a, cat, e.target.value)} aria-label={`Campo de SAGA ${cat} para ${a.etiqueta || "este atributo"}`}>
                                          <option value="">— No usar —</option>
                                          {actualDef && !libres.some((c) => c.id === actual) && <option value={actual}>{actualDef.etiqueta} ({actual})</option>}
                                          {libres.map((c) => <option key={c.id} value={c.id}>{c.etiqueta} ({c.id}){c.obligatorio ? " · obligatorio" : ""}</option>)}
                                        </select>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>,
                        ];
                        filas.push(
                          <tr key={`${k}-extra`} className="pf-eq-propio-extra">
                            <td colSpan={3}>
                              <div className="pf-eq-extra">
                                {!sinOpciones(a.tipo) && (
                                  <div className="campo" style={{ flex: "1 1 280px" }}>
                                    <label>Opciones <em>una por línea</em></label>
                                    <textarea rows={3} value={a.opcionesTexto} onChange={(e) => cambiar(k, { opcionesTexto: e.target.value })} />
                                  </div>
                                )}
                                <div className="campo">
                                  <label>Apartado del formulario</label>
                                  <select value={a.grupo} onChange={(e) => cambiar(k, { grupo: e.target.value })}>
                                    {GRUPOS_ATRIBUTOS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                                  </select>
                                </div>
                                <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
                                  <button type="button" className="btn-admin" onClick={() => mover(a, -1)} aria-label="Subir">↑</button>
                                  <button type="button" className="btn-admin" onClick={() => mover(a, 1)} aria-label="Bajar">↓</button>
                                  <button type="button" className="btn-admin peligro" onClick={() => quitar(a)}>Quitar</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                        return filas;
                      })}
                      {g.id === "detalles" &&
                        faltantes.map((f) => (
                          <tr key={`${f.cat}-${f.campo.id}`} className="pf-eq-falta">
                            <td colSpan={2}>
                              Obligatorio en SAGA {f.cat}: <strong>{f.campo.etiqueta}</strong>
                              <small style={{ display: "block" }}>{f.campo.id} · sin atributo en la web</small>
                            </td>
                            <td>
                              <button type="button" className="btn-admin" onClick={() => crearDesdeFalta(f)}>Crear atributo en la web</button>
                            </td>
                          </tr>
                        ))}
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
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>{enviando ? "Guardando..." : "Guardar integración con la web"}</button>
      </div>
    </form>
  );
}
