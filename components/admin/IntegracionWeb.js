"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { guardarIntegracionWeb } from "../../app/(admin)/admin/actions";
import { idDeEtiqueta, ubicacionDe } from "../../lib/atributos-categoria";
import { permiteVariantesWeb, campoGeneralActivo } from "../../lib/equivalencias";
import { BLOQUES_GENERALES } from "../../lib/atributos-categoria";
import { CAMPOS_WEB, esLibre, LISTA_DE_CAMPO } from "../../lib/campos-web";
import ConsultaSagaAtributo from "./ConsultaSagaAtributo";
import CamposGeneralesWeb from "./CamposGeneralesWeb";
import RequisitosCampo from "./RequisitosCampo";

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
 *  2. Atributos por categoría: se elige la categoría y, dentro, por apartado del formulario (Identificación, Precio y stock, Imágenes,
 *     Clasificación, Perfil, Detalles, Paquete) qué atributos se ven. Los generales se muestran u ocultan; los propios se crean ahí mismo
 *     (quedan visibles en esa categoría) y se reutilizan en otras marcándolos. Se pueden renombrar, no borrar (los productos ya
 *     guardados los usan). Las equivalencias con SAGA se eligen en Integraciones → SAGA entre los atributos visibles de la categoría.
 */
export default function IntegracionWeb({ categoriasWeb = [], categoriasSaga = [], equivalencias, catalogo = [], porCategoria = {}, listas = {} }) {
  const [, accion] = useActionState(guardarYAvisar, {});
  // Con qué categorías de cada plataforma equivale cada categoría de la web se define desde la plataforma (Integraciones → SAGA).
  const cats = useMemo(() => equivalencias?.categorias || {}, [equivalencias]);
  const [config, setConfig] = useState(() => structuredClone(equivalencias?.configCategorias || {}));
  // Campos generales: nombre editable y campo de SAGA de referencia (se guardan con el resto).
  const [etiquetasGen, setEtiquetasGen] = useState(() => Object.fromEntries(Object.entries(equivalencias?.camposWeb || {}).map(([id, c]) => [id, c.etiqueta])));
  // Requisitos de cada campo (opciones, largo mínimo/máximo, obligatorio): solo se guardan los que se tocan.
  const [reqGen, setReqGen] = useState(() => Object.fromEntries(Object.entries(equivalencias?.camposWeb || {}).map(([id, c]) => { const { etiqueta: _etiqueta, ...r } = c; return [id, r]; })));
  const requisitosDe = (def) => ({
    opciones: reqGen[def.id]?.opciones ?? listas[LISTA_DE_CAMPO[def.id]] ?? [],
    min: reqGen[def.id]?.min,
    max: reqGen[def.id]?.max ?? def.max,
    obligatorio: reqGen[def.id]?.obligatorio,
  });
  const etiq = (def) => etiquetasGen[def.id] || def.etiqueta;
  // Los campos generales con equivalencia fija se reenvían tal cual lo que hubiera guardado (compatibilidad).
  const fijos = equivalencias?.fijos || {};
  const [datos, setDatos] = useState(() => catalogo.map((a) => ({ ...a, ...(a.general ? {} : { ubicacion: ubicacionDe(a, equivalencias) }), tipoInicial: a.tipo, min: a.min ? String(a.min) : "", max: a.max ? String(a.max) : "", opcionesTexto: (a.opciones || []).join("\n") })));
  // Atributos visibles por categoría web: { slug: [clave del atributo] }.
  const [activos, setActivos] = useState(() => Object.fromEntries(Object.entries(porCategoria).filter(([s]) => s !== "_generales").map(([s, l]) => [s, l.map((a) => a.id)])));
  const [slug, setSlug] = useState(categoriasWeb[0]?.slug || "");
  const [pestanaAttr, setPestanaAttr] = useState("");
  const [pestanaWeb, setPestanaWeb] = useState("categorias");
  const eqVivo = useMemo(() => ({ categorias: cats, configCategorias: config, camposCategoria: equivalencias?.camposCategoria || {} }), [cats, config, equivalencias]);

  const variantesDe = (web) => permiteVariantesWeb(eqVivo, categoriasSaga, web);
  const ponerVariantes = (web, v) => setConfig((p) => ({ ...p, [web]: { ...p[web], variantes: v } }));
  // Campos generales libres (Modelo, País, Contenido): activo o no en una categoría de la web. Los que SAGA lista en el catálogo de una
  // categoría (Características, Género…) se activan en Integraciones → SAGA: aquí solo se muestra su estado.
  const generalActivo = (web, def) => campoGeneralActivo(eqVivo, web, def);
  const ponerGeneral = (web, id, v) => setConfig((p) => ({ ...p, [web]: { ...p[web], generales: { ...p[web]?.generales, [id]: v } } }));

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
  // Atributo nuevo en un apartado: queda visible en la categoría elegida (en otras se marca después). Solo los aún no guardados se pueden quitar.
  const agregar = (ubicacion) => {
    const nuevo = { id: "", tmp: nuevoTmp(), etiqueta: "", tipo: "texto", opciones: [], opcionesTexto: "", min: "", max: "", grupo: "detalles", ubicacion };
    setDatos((p) => [...p, nuevo]);
    mostrar(slug, nuevo.tmp, true); // queda visible en la categoría donde se crea
  };
  // Atributo GENERAL nuevo (vale para todas las categorías): se crea en un bloque de Campos generales y no se activa por categoría.
  const agregarGeneral = (bloque) => {
    const nuevo = { id: "", tmp: nuevoTmp(), etiqueta: "", tipo: "texto", opciones: [], opcionesTexto: "", min: "", max: "", grupo: BLOQUES_GENERALES[bloque], general: true, bloque };
    setDatos((p) => [...p, nuevo]);
  };
  // Atributos ya guardados: se muestran bloqueados y se editan solo al pulsar «Editar» (los nuevos siempre están abiertos).
  const [editando, setEditando] = useState(() => new Set());
  const abrirEdicion = (k, abrir) =>
    setEditando((p) => {
      const sig = new Set(p);
      if (abrir) sig.add(k); else sig.delete(k);
      return sig;
    });
  // Un atributo nuevo cuyo nombre genera el mismo id que otro se descartaría al guardar: se avisa antes.
  const repetido = (a) => !a.id && Boolean(idDe(a)) && datos.some((x) => x !== a && idDe(x) === idDe(a));
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
      ...(a.general ? { general: true, bloque: a.bloque } : { ubicacion: a.ubicacion }),
      min: a.tipo === "texto" ? a.min : "",
      max: a.tipo === "texto" ? a.max : "",
      opciones: sinOpciones(a.tipo) ? [] : a.opcionesTexto.split("\n").map((x) => x.trim()).filter(Boolean),
    })),
    activos: Object.fromEntries(Object.entries(activos).map(([s, ks]) => [s, datos.filter((a) => ks.includes(clave(a))).map(idDe)])),
  });

  const camposWebJson = JSON.stringify({
    camposWeb: Object.fromEntries(
      [...new Set([...Object.keys(etiquetasGen), ...Object.keys(reqGen)])]
        .map((id) => [id, { ...(String(etiquetasGen[id] || "").trim() ? { etiqueta: etiquetasGen[id] } : {}), ...reqGen[id] }])
        .filter(([, v]) => Object.keys(v).length)
    ),
  });

  // Cambios sin guardar: tras guardar la página se vuelve a montar con lo guardado, así que basta comparar con el primer estado.
  const estadoForm = json + camposWebJson;
  const base = useRef(null);
  if (base.current === null) base.current = estadoForm;
  const sinGuardar = estadoForm !== base.current;
  useEffect(() => {
    emitir({ sinGuardar });
  }, [sinGuardar]);

  // Por categoría solo van los atributos que SAGA lista según la categoría (Características, Género…); los generales tienen su apartado.
  // Filas de los atributos generales propios de un bloque de Campos generales (Campo | Tipo | Referencia | Origen).
  const filasGenerales = (bloque) =>
    datos
      .filter((a) => a.general && a.bloque === bloque)
      .flatMap((a) => {
        const k = clave(a);
        const nuevo = !a.id;
        const abierto = nuevo || editando.has(k);
        if (!abierto) {
          const nOpciones = sinOpciones(a.tipo) ? 0 : a.opcionesTexto.split("\n").filter((x) => x.trim()).length;
          return [
            <tr key={k} className="pf-eq-propio">
              <td>{a.etiqueta || "(sin nombre)"}</td>
              <td>
                {ETIQUETA_TIPO[a.tipo] || a.tipo}
                {nOpciones > 0 && <small style={{ display: "block", color: "var(--gris)" }}>{nOpciones} opciones</small>}
              </td>
              <td className="cg-acc">
                <button type="button" className="btn-admin cg-ico" onClick={() => abrirEdicion(k, true)} aria-label={`Editar «${a.etiqueta}»`} title="Editar o renombrar este atributo">✎</button>
              </td>
            </tr>,
          ];
        }
        return [
          <tr key={k} className="pf-eq-propio">
            <td>
              <input value={a.etiqueta} maxLength={60} onChange={(e) => cambiar(k, { etiqueta: e.target.value })} placeholder="Nombre en la web (ej. Material)" aria-label="Nombre del atributo" />
              {repetido(a) && <small style={{ display: "block", color: "#b26a00" }}>⚠ Ya existe un atributo con este nombre: se descartaría al guardar. Usa otro nombre.</small>}
            </td>
            <td>
              <select value={a.tipo} onChange={(e) => cambiar(k, { tipo: e.target.value })} aria-label="Tipo">
                {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              {!nuevo && a.tipo !== a.tipoInicial && (
                <small style={{ display: "block", color: "#b26a00" }}>⚠ Era «{ETIQUETA_TIPO[a.tipoInicial]}». Los valores de productos que no encajen con el nuevo tipo se ignorarán.</small>
              )}
            </td>
            <td className="cg-acc">
              {nuevo ? (
                <button type="button" className="btn-admin peligro" onClick={() => quitarNuevo(a)}>Quitar</button>
              ) : (
                <button type="button" className="btn-admin" onClick={() => abrirEdicion(k, false)} title="Volver a bloquear (los cambios se conservan hasta guardar)">✓ Listo</button>
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
      });

  // Dos apartados: «Atributos» (se llenan una vez por producto) y «Variantes» (se llenan en cada variante, como Color o Cantidad). La Cantidad de
  // perfumes (CantidadPerfumesVariant) es una variación: va en Variantes, como todo campo de SAGA cuyo código lleva «Variant».
  const APARTADOS = [
    { id: "atributos", nombre: "Atributos", atributos: true },
    { id: "variantes", nombre: "Variantes", atributos: true },
  ];
  // Ubicación de un campo de SAGA de la web: lo elegido (⇄) o el predeterminado (la Cantidad va en Variantes).
  const ubicDe = (c) => reqGen[c.id]?.ubicacion || (c.id === "volumen" ? "variantes" : "atributos");
  const principales = (g) => CAMPOS_WEB.filter((c) => c.porSaga && esLibre(c) && ubicDe(c) === g.id);
  const propios = (g) => datos.filter((a) => !a.general && a.ubicacion === g.id);

  return (
    <form action={accion} className="form-grid cg admin-card" id={FORM_ID}>
      <input type="hidden" name="atributosJson" value={json} />
      <input type="hidden" name="enlacesJson" value={JSON.stringify(equivalencias?.atributos || {})} />
      <input type="hidden" name="fijosJson" value={JSON.stringify(fijos)} />
      <input type="hidden" name="configCategoriasJson" value={JSON.stringify(config)} />
      <input type="hidden" name="camposWebJson" value={camposWebJson} />

      <div className="pf-pestanas" role="tablist" aria-label="Configuración de la web">
        {[
          { id: "categorias", nombre: "Categorías", n: categoriasWeb.length, icono: "categorias" },
          { id: "generales", nombre: "Campos generales", n: CAMPOS_WEB.filter((c) => c.saga && !c.porSaga).length + datos.filter((a) => a.general).length, icono: "producto" },
          { id: "atributos", nombre: "Atributos por categoría", n: CAMPOS_WEB.filter((c) => c.porSaga && esLibre(c)).length + datos.filter((a) => !a.general).length, icono: "atributos" },
        ].map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === pestanaWeb} className="pf-pestana" onClick={() => setPestanaWeb(p.id)}>
            <IconoWeb id={p.icono} />
            {p.nombre}
            <span className="pf-pestana-n">{p.n}</span>
          </button>
        ))}
      </div>

      <div hidden={pestanaWeb !== "categorias"} className="form-grid">
        <div className="form-grid">
          <small style={{ color: "var(--gris)" }}>
            Las categorías con las que trabaja la web y si cada una permite <strong>variantes</strong>. Con qué categoría de una plataforma
            equivale cada una se define desde esa plataforma (en <strong>Integraciones → SAGA</strong>, cada categoría de SAGA elige las de la web).
          </small>
          <div className="pf-panel-bloque">
            <div className="admin-tabla-wrap">
              <table className="admin-tabla cg-tabla-cat">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Variantes</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasWeb.map((c) => (
                    <tr key={c.slug}>
                      <td>
                        {c.nombre}
                        <code className="cg-slug">{c.slug}</code>
                      </td>
                      <td>
                        <label className="campo-check" title="Si la categoría permite agregar variantes a sus productos">
                          <input type="checkbox" checked={variantesDe(c.slug)} onChange={(e) => ponerVariantes(c.slug, e.target.checked)} />
                          Permitir
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div hidden={pestanaWeb !== "generales"} className="form-grid">
        <div className="form-grid">
          <small style={{ color: "var(--gris)" }}>
            Los campos propios de la web que valen para <strong>todas</strong> las categorías, con la estructura de SAGA como guía:
            <strong> Producto y garantía</strong> (Principal; Garantía y envío), <strong>Atributos</strong> y <strong>Variantes</strong>, cada
            campo en su orden. Con <strong>✎</strong> cambias su nombre en la web, y con <strong>+ Agregar atributo</strong> creas uno nuevo
            (tipo, opciones y largos). En «Garantía y envío», la casilla muestra solo los obligatorios (o todos). Con qué campo de cada
            plataforma se corresponde cada uno se define en <strong>Integraciones → SAGA</strong>. Lo que cambia según la categoría está en
            «Atributos por categoría».
          </small>
          <CamposGeneralesWeb etiquetas={etiquetasGen} setEtiquetas={setEtiquetasGen} requisitos={reqGen} setRequisitos={setReqGen} listas={listas} categoriasSaga={categoriasSaga} filasPropias={filasGenerales} onAgregar={agregarGeneral} cuentaPropias={(bloque) => datos.filter((a) => a.general && a.bloque === bloque).length} />
        </div>
      </div>

      <div hidden={pestanaWeb !== "atributos"} className="form-grid">
        <div className="form-grid">
          <small style={{ color: "var(--gris)" }}>
            Lo que cambia según la categoría, en dos apartados: <strong>Atributos</strong> (se llenan una vez por producto y se muestran en la
            pestaña «Atributos» del formulario) y <strong>Variantes</strong> (se llenan en cada variante, como Color, y se muestran en la pestaña
            «Variantes»). Los campos de SAGA cuyo código lleva «Variant» (ColorVariant, CantidadPerfumesVariant…) son variaciones: van en
            Variantes. Con <strong>⇄</strong> mueves un atributo de un apartado al otro, y con <strong>+ Agregar atributo</strong> creas uno
            nuevo. Elige la <strong>categoría de la web</strong> y marca cuáles se ven en sus productos. Renombrar o editar un atributo lo cambia
            en todas las categorías donde se usa. Los campos generales (nombre, modelo, país, garantía, paquete…) están en su propio apartado,
            y las equivalencias con SAGA en <strong>Integraciones → SAGA</strong>.
          </small>
          <div className="cg-cat">
            <label htmlFor="attr-categoria">Categoría de la web</label>
            <select id="attr-categoria" value={slug} onChange={(e) => setSlug(e.target.value)}>
              {categoriasWeb.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}{activos[c.slug]?.length ? ` (${activos[c.slug].length} propios)` : ""}
                </option>
              ))}
            </select>
          </div>
          {(() => {
            // Apartados con contenido: los que traen atributos de SAGA o admiten atributos propios.
            const apartados = APARTADOS;
            const g = apartados.find((x) => x.id === pestanaAttr) || apartados[0];
            if (!g) return null;
            const cuenta = (x) =>
              principales(x).filter((c) => generalActivo(slug, c)).length + propios(x).filter((a) => visibleEn(slug, a)).length;
            const fijosG = principales(g);
            // Los nuevos (sin guardar) primero; luego los visibles en esta categoría; el orden guardado no cambia dentro de cada bloque.
            const rango = (a) => (!a.id ? 0 : visibleEn(slug, a) ? 1 : 2);
            const propiosG = g.atributos ? [...propios(g)].sort((x, y) => rango(x) - rango(y)) : [];
            return (
              <>
                <div className="pf-pestanas" role="tablist" aria-label="Apartados de atributos">
                  {apartados.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      role="tab"
                      aria-selected={x.id === g.id}
                      className="pf-pestana"
                      onClick={() => setPestanaAttr(x.id)}
                    >
                      {x.nombre}
                      <span className="pf-pestana-n" title="Visibles en esta categoría">{cuenta(x)}</span>
                    </button>
                  ))}
                </div>
                <div role="tabpanel" className="pf-panel-bloque">
                  <strong>{g.nombre}</strong>
                <div className="admin-tabla-wrap">
                  <table className="admin-tabla pf-eq-tabla-web cg-tabla-attr">
                    <thead>
                      <tr>
                        <th>Ver</th>
                        <th>Atributo</th>
                        <th>Tipo</th>
                        <th aria-label="Acciones" />
                      </tr>
                    </thead>
                    <tbody>
                      {fijosG.flatMap((def) => [
                        <tr key={def.id}>
                          <td>
                            {esLibre(def) ? (
                              <input
                                type="checkbox"
                                checked={generalActivo(slug, def)}
                                onChange={(e) => ponerGeneral(slug, def.id, e.target.checked)}
                                aria-label={`Ver «${etiq(def)}» en esta categoría`}
                              />
                            ) : (
                              <input type="checkbox" checked disabled readOnly aria-label={`«${etiq(def)}» siempre se ve`} />
                            )}
                          </td>
                          <td>{etiq(def)}</td>
                          <td>{ETIQUETA_TIPO[def.tipo] || def.tipo}</td>
                          <td className="cg-acc">
                            <button
                              type="button"
                              className="btn-admin cg-ico"
                              onClick={() => setReqGen((p) => ({ ...p, [def.id]: { ...p[def.id], ubicacion: ubicDe(def) === "variantes" ? "atributos" : "variantes" } }))}
                              aria-label={`Mover «${etiq(def)}» a ${ubicDe(def) === "variantes" ? "Atributos" : "Variantes"}`}
                              title={`Mover a ${ubicDe(def) === "variantes" ? "Atributos" : "Variantes"}`}
                            >
                              ⇄
                            </button>
                            <button
                              type="button"
                              className={editando.has(`def:${def.id}`) ? "btn-admin" : "btn-admin cg-ico"}
                              onClick={() => abrirEdicion(`def:${def.id}`, !editando.has(`def:${def.id}`))}
                              aria-label={`Editar «${etiq(def)}»`}
                              title="Cambiar el nombre de este atributo en la web"
                            >
                              {editando.has(`def:${def.id}`) ? "✓ Listo" : "✎"}
                            </button>
                          </td>
                        </tr>,
                        editando.has(`def:${def.id}`) && (
                          <tr key={`${def.id}-nom`} className="pf-eq-propio-extra">
                            <td colSpan={4}>
                              <div className="campo">
                                <label>Nombre en la web <em>vale para todas las categorías; se usa en el formulario y para hacer la equivalencia con SAGA</em></label>
                                <input
                                  value={etiquetasGen[def.id] ?? def.etiqueta}
                                  maxLength={60}
                                  onChange={(e) => setEtiquetasGen((p) => ({ ...p, [def.id]: e.target.value }))}
                                  onBlur={(e) => { if (!e.target.value.trim()) setEtiquetasGen((p) => { const n = { ...p }; delete n[def.id]; return n; }); }}
                                  aria-label="Nombre del atributo"
                                  style={{ maxWidth: 360 }}
                                />
                                {def.etiqueta !== etiq(def) && <small style={{ color: "var(--gris)" }}>Predeterminado: {def.etiqueta}</small>}
                              </div>
                              <RequisitosCampo
                                def={def}
                                valor={requisitosDe(def)}
                                onChange={(c) => setReqGen((p) => ({ ...p, [def.id]: { ...p[def.id], ...c } }))}
                                categoriasSaga={categoriasSaga}
                              />
                            </td>
                          </tr>
                        ),
                      ])}
                      {propiosG.flatMap((a) => {
                        const k = clave(a);
                        const nuevo = !a.id; // aún sin guardar: tipo y opciones se definen ahora; después solo cambia la etiqueta
                        const abierto = nuevo || editando.has(k); // los guardados se muestran bloqueados hasta pulsar «Editar»
                        const enOtras = categoriasWeb.filter((c) => c.slug !== slug && visibleEn(c.slug, a)).map((c) => c.nombre);
                        const casilla = (
                          <input type="checkbox" checked={visibleEn(slug, a)} onChange={(e) => alternar(a, e.target.checked)} aria-label={`Ver «${a.etiqueta || "atributo"}» en esta categoría`} />
                        );
                        if (!abierto) {
                          const nOpciones = sinOpciones(a.tipo) ? 0 : a.opcionesTexto.split("\n").filter((x) => x.trim()).length;
                          const enlaces = enlacesDe(slug, a.id);
                          return [
                            <tr key={k} className="pf-eq-propio" style={visibleEn(slug, a) ? undefined : { opacity: 0.7 }}>
                              <td>{casilla}</td>
                              <td>
                                {a.etiqueta || "(sin nombre)"}
                                {enlaces.length > 0 && <small style={{ display: "block", color: "var(--gris)" }}>enlazado con SAGA: {enlaces.join("; ")}</small>}
                                {enOtras.length > 0 && <small style={{ display: "block", color: "var(--gris)" }}>también en: {enOtras.join(", ")}</small>}
                              </td>
                              <td>
                                {ETIQUETA_TIPO[a.tipo] || a.tipo}
                                {nOpciones > 0 && <small style={{ display: "block", color: "var(--gris)" }}>{nOpciones} opciones</small>}
                              </td>
                              <td className="cg-acc">
                                <button type="button" className="btn-admin cg-ico" onClick={() => cambiar(k, { ubicacion: a.ubicacion === "variantes" ? "atributos" : "variantes" })} aria-label={`Mover «${a.etiqueta}» a ${a.ubicacion === "variantes" ? "Atributos" : "Variantes"}`} title={`Mover a ${a.ubicacion === "variantes" ? "Atributos" : "Variantes"}`}>⇄</button>
                                <button type="button" className="btn-admin cg-ico" onClick={() => abrirEdicion(k, true)} aria-label={`Editar «${a.etiqueta}»`} title="Editar o renombrar este atributo (en todas las categorías donde se usa)">✎</button>
                              </td>
                            </tr>,
                          ];
                        }
                        return [
                          <tr key={k} className="pf-eq-propio">
                            <td>{casilla}</td>
                            <td>
                              <input value={a.etiqueta} maxLength={60} onChange={(e) => cambiar(k, { etiqueta: e.target.value })} placeholder="Nombre en la web (ej. Acabado)" aria-label="Nombre del atributo" />
                              {repetido(a) && (
                                <small style={{ display: "block", color: "#b26a00" }}>
                                  ⚠ Ya existe un atributo con este nombre: se descartaría al guardar. Usa otro nombre.
                                </small>
                              )}
                              {!nuevo && enOtras.length > 0 && (
                                <small style={{ display: "block", color: "var(--gris)" }}>También se usa en: {enOtras.join(", ")}. El cambio de nombre vale para todas.</small>
                              )}
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
                            <td className="cg-acc">
                              {nuevo ? (
                                <button type="button" className="btn-admin peligro" onClick={() => quitarNuevo(a)}>Quitar</button>
                              ) : (
                                <button type="button" className="btn-admin" onClick={() => abrirEdicion(k, false)} title="Volver a bloquear (los cambios se conservan hasta guardar)">✓ Listo</button>
                              )}
                            </td>
                          </tr>,
                          <tr key={`${k}-op`} className="pf-eq-propio-extra">
                            <td colSpan={4}>
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
                      <button type="button" className="btn-admin cg-mas" title={`Crea un atributo en «${g.nombre}» visible en ${categoriasWeb.find((c) => c.slug === slug)?.nombre}`} onClick={() => agregar(g.id)}>+ Agregar atributo</button>
                    </div>
                  )}
                  {g.atributos && !propiosG.length && !fijosG.length && <small style={{ color: "var(--gris)" }}>Aún no hay atributos en este apartado. Crea el primero con «+ Agregar atributo».</small>}
                </div>
              </>
            );
          })()}
        </div>
      </div>

    </form>
  );
}

/** Iconos de línea de las pestañas. */
function IconoWeb({ id }) {
  const trazos = {
    categorias: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 3.5h7M16.5 13v7" />,
    producto: <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12m9-4.5L12 12m0 9v-9" />,
    atributos: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id] || trazos.atributos}
    </svg>
  );
}
