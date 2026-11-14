"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  guardarConfiguracion,
  restablecerConfiguracion,
  agregarPlataforma,
} from "../../app/(admin)/admin/actions";

const ICONOS = [
  ["tarjeta", "Tarjeta"],
  ["transferencia", "Transferencia"],
  ["movil", "Móvil (Yape/Plin)"],
  ["efectivo", "Efectivo"],
];

const aTexto = (arr) => (arr || []).join("\n");
const aLineas = (t) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Las listas de textos se editan como un textarea (una línea por ítem).
function prepararInicial(c) {
  return {
    ...c,
    dinamicaCompra: aTexto(c.dinamicaCompra),
    envios: { lima: aTexto(c.envios.lima), provincias: aTexto(c.envios.provincias) },
    politicas: c.politicas.map((p) => ({ ...p, puntos: aTexto(p.puntos) })),
  };
}

function aEnvio(c) {
  return {
    ...c,
    dinamicaCompra: aLineas(c.dinamicaCompra),
    envios: { lima: aLineas(c.envios.lima), provincias: aLineas(c.envios.provincias) },
    politicas: c.politicas.map((p) => ({ ...p, puntos: aLineas(p.puntos) })),
  };
}

// Pestañas: cada sección del formulario del sitio pertenece a una; "equipo" y "saga"
// llegan ya armadas desde la página (`extras`) porque son formularios aparte.
const PESTANAS = [
  ["general", "General"],
  ["tienda", "Tienda"],
  ["portada", "Portada y SEO"],
  ["pestanasweb", "Pestañas de la web"],
  ["equipo", "Equipo"],
  ["integraciones", "Integraciones"],
  ["ventas", "Ventas"],
  ["inventario", "Inventario"],
];
export default function ConfiguracionForm({ inicial, extras = {} }) {
  const [estado, accion, enviando] = useActionState(guardarConfiguracion, {});
  const [subGeneral, setSubGeneral] = useState("identidad");
  const [subTienda, setSubTienda] = useState("entrega");
  const [subPortada, setSubPortada] = useState("bienvenida");
  // Filas de las tablas (entregas, pagos, políticas, valores) abiertas en edición; las demás se ven como texto.
  const [abiertos, setAbiertos] = useState(() => new Set());
  const abrir = (k, v) =>
    setAbiertos((p) => {
      const sig = new Set(p);
      if (v) sig.add(k); else sig.delete(k);
      return sig;
    });
  const botonesFila = (k, onQuitar, puedeQuitar = true) => (
    <td className="cg-acc">
      {abiertos.has(k) ? (
        <button type="button" className="btn-admin" onClick={() => abrir(k, false)} title="Listo (se guarda con el botón Guardar)">✓ Listo</button>
      ) : (
        <button type="button" className="btn-admin cg-ico" onClick={() => abrir(k, true)} aria-label="Editar" title="Editar">✎</button>
      )}
      {puedeQuitar && (
        <button type="button" className="btn-admin cg-ico peligro" onClick={() => { setAbiertos(new Set()); onQuitar(); }} aria-label="Quitar" title="Quitar">✕</button>
      )}
    </td>
  );
  const [c, setC] = useState(() => prepararInicial(inicial));
  const [pestana, setPestana] = useState("general");
  const pestanasRef = useRef(null);
  // Alto de la barra de pestañas: la barra de subpestañas se apila justo debajo al hacer scroll.
  useEffect(() => {
    const el = pestanasRef.current;
    if (!el) return undefined;
    const publicar = () => document.documentElement.style.setProperty("--cfg-pestanas-h", `${el.offsetHeight}px`);
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--cfg-pestanas-h");
    };
  }, []);

  // La pestaña activa se recuerda en la URL (#saga) para poder recargar o compartir el enlace.
  useEffect(() => {
    const partes = window.location.hash.split("#").filter(Boolean);
    // El enlace antiguo #saga ahora vive en Integraciones → SAGA.
    if (partes[0] === "saga") {
      setPestana("integraciones");
      setSub("saga");
      return;
    }
    if (PESTANAS.some(([id]) => id === partes[0])) setPestana(partes[0]);
    if (partes[0] === "integraciones" && partes[1]) setSub(partes[1]);
  }, []);
  const elegir = (id) => {
    setPestana(id);
    window.history.replaceState(null, "", id === "integraciones" ? `#integraciones#${sub}` : `#${id}`);
  };
  const esSitio = !["pestanasweb", "equipo", "integraciones", "ventas", "inventario"].includes(pestana);
  // Integraciones: subpestañas Web, SAGA y las plataformas que se agreguen (hash #integraciones#saga).
  const subs = extras.integraciones || [];
  const [sub, setSub] = useState("web");
  const [avisoPlat, setAvisoPlat] = useState(null);
  // Estado de guardado de cada integración (lo emite su formulario): { [formId]: { enviando, sinGuardar } } y aviso flotante.
  const [guardado, setGuardado] = useState({});
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const alRecibir = (e) => {
      const { formId, resultado, ...resto } = e.detail || {};
      setGuardado((p) => ({ ...p, [formId]: { ...p[formId], ...resto } }));
      if (resultado?.ok || resultado?.error) setToast(resultado);
    };
    window.addEventListener("integracion-estado", alRecibir);
    return () => window.removeEventListener("integracion-estado", alRecibir);
  }, []);
  useEffect(() => {
    if (!toast?.ok) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const elegirSub = (id) => {
    setSub(id);
    window.history.replaceState(null, "", `#integraciones#${id}`);
  };
  async function nuevaPlataforma() {
    const nombre = (window.prompt("Nombre de la plataforma (ej. Intercorp):") || "").trim();
    if (!nombre) return;
    setAvisoPlat(await agregarPlataforma(nombre));
  }

  const upd = (fn) =>
    setC((prev) => {
      const n = structuredClone(prev);
      fn(n);
      return n;
    });

  const campo = (etiqueta, valor, onChange, { ayuda, tipo = "text", area = false } = {}) => (
    <div className="campo">
      <label>{etiqueta}</label>
      {area ? (
        <textarea rows={3} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={tipo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
      {ayuda && <small style={{ color: "var(--gris)" }}>{ayuda}</small>}
    </div>
  );

  return (
    <div className="form-grid">
    <nav className="pestanas" role="tablist" aria-label="Secciones de configuración" ref={pestanasRef}>
      {PESTANAS.map(([id, nombre]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={pestana === id}
          className={`pestana${pestana === id ? " activa" : ""}`}
          onClick={() => elegir(id)}
        >
          {nombre}
        </button>
      ))}
    </nav>

    <form action={accion} className="form-grid" hidden={!esSitio}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}

      <input type="hidden" name="configJson" value={JSON.stringify(aEnvio(c))} />

      <section className="admin-card form-grid cg" hidden={pestana !== "general"}>
        <div className="pf-pestanas" role="tablist" aria-label="Datos generales">
          {[
            ["identidad", "Identidad y contacto", 10],
            ["legal", "Datos legales y Libro de Reclamaciones", 4],
            ["horario", "Horario de atención", 2],
          ].map(([id, nombre, n]) => (
            <button key={id} type="button" role="tab" aria-selected={subGeneral === id} className="pf-pestana" onClick={() => setSubGeneral(id)}>
              <IconoGeneral id={id} />
              {nombre}
              <span className="pf-pestana-n">{n}</span>
            </button>
          ))}
        </div>

        <div hidden={subGeneral !== "identidad"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Identidad y contacto</strong>
            <div className="cg-listas">
                {campo("Nombre de la marca", c.marca, (v) => upd((n) => (n.marca = v)))}
                {campo("Instagram (usuario)", c.instagram, (v) => upd((n) => (n.instagram = v)), {
                  ayuda: "Ej: @lechic_ofertas",
                })}
                {campo("Instagram (URL)", c.instagramUrl, (v) => upd((n) => (n.instagramUrl = v)), {
                  ayuda: "Debe empezar con https://",
                })}
                {campo("TikTok (usuario)", c.tiktok, (v) => upd((n) => (n.tiktok = v)))}
                {campo("TikTok (URL)", c.tiktokUrl, (v) => upd((n) => (n.tiktokUrl = v)))}
                {campo("Facebook (URL, opcional)", c.facebookUrl, (v) => upd((n) => (n.facebookUrl = v)), {
                  ayuda: "Si lo dejas vacío, no se muestra en el pie de página.",
                })}
                {campo("Teléfono (como se muestra)", c.telefono, (v) => upd((n) => (n.telefono = v)))}
                {campo(
                  "WhatsApp (solo números, con código de país)",
                  c.whatsapp,
                  (v) => upd((n) => (n.whatsapp = v)),
                  { ayuda: "Ej: 51985219626. Se usa para el enlace de WhatsApp." }
                )}
                {campo("Moneda", c.moneda, (v) => upd((n) => (n.moneda = v)))}
            </div>
          </div>
        </div>

        <div hidden={subGeneral !== "legal"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Datos legales y Libro de Reclamaciones</strong>
            <small style={{ color: "var(--gris)" }}>
              Aparecen en la hoja de reclamación que ve y recibe el cliente. El correo recibe el aviso de cada reclamo nuevo.
            </small>
            <div className="cg-listas">
                {campo("Razón social", c.empresa?.razonSocial, (v) => upd((n) => ((n.empresa ||= {}).razonSocial = v)))}
                {campo("RUC", c.empresa?.ruc, (v) => upd((n) => ((n.empresa ||= {}).ruc = v)), { ayuda: "11 dígitos." })}
                {campo("Domicilio del proveedor", c.empresa?.direccion, (v) => upd((n) => ((n.empresa ||= {}).direccion = v)))}
                {campo("Correo para recibir reclamos", c.empresa?.email, (v) => upd((n) => ((n.empresa ||= {}).email = v)), {
                  tipo: "email",
                  ayuda: "Si lo dejas vacío, se usa la variable RECLAMOS_EMAIL_TO.",
                })}
            </div>
          </div>
        </div>

        <div hidden={subGeneral !== "horario"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Horario de atención</strong>
            <div className="cg-listas">
                {campo("Horario", c.horario.texto, (v) => upd((n) => (n.horario.texto = v)))}
                {campo("Nota", c.horario.nota, (v) => upd((n) => (n.horario.nota = v)), { area: true })}
            </div>
          </div>
        </div>
      </section>

      <section className="admin-card form-grid cg" hidden={pestana !== "tienda"}>
        <div className="pf-pestanas" role="tablist" aria-label="Tienda">
          {[
            ["entrega", "Formas de entrega", c.entregas.length],
            ["comprar", "Cómo comprar", c.metodosPago.length],
            ["envios", "Envíos", 2],
            ["politicas", "Políticas de compra", c.politicas.length],
          ].map(([id, nombre, n]) => (
            <button key={id} type="button" role="tab" aria-selected={subTienda === id} className="pf-pestana" onClick={() => setSubTienda(id)}>
              <IconoTienda id={id} />
              {nombre}
              <span className="pf-pestana-n">{n}</span>
            </button>
          ))}
        </div>

        <div hidden={subTienda !== "entrega"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Formas de entrega</strong>
            <div className="admin-tabla-wrap">
              <table className="admin-tabla cg-tabla-lista">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Embalaje</th>
                    <th>Nota para el cliente</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {c.entregas.flatMap((e, i) => {
                    const k = `ent-${i}`;
                    return [
                      <tr key={k}>
                        <td>{e.nombre || <small style={{ color: "var(--gris)" }}>(sin nombre)</small>}</td>
                        <td>{Number(e.embalaje) > 0 ? `${c.moneda || "S/"} ${e.embalaje}` : "—"}</td>
                        <td className="cg-trunc" title={e.nota}>{e.nota || "—"}</td>
                        {botonesFila(k, () => upd((n) => n.entregas.splice(i, 1)), c.entregas.length > 1)}
                      </tr>,
                      abiertos.has(k) && (
                        <tr key={`${k}-e`} className="pf-eq-propio-extra">
                          <td colSpan={4}>
                            <div className="cg-listas">
                              {campo("Nombre", e.nombre, (v) => upd((n) => (n.entregas[i].nombre = v)))}
                              {campo("Embalaje (monto)", e.embalaje, (v) => upd((n) => (n.entregas[i].embalaje = v)), {
                                tipo: "number",
                                ayuda: "Se suma al total del cliente; 0 si no cobra embalaje.",
                              })}
                              {campo("Nota para el cliente", e.nota, (v) => upd((n) => (n.entregas[i].nota = v)), { area: true })}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            {c.entregas.length < 6 && (
              <div>
                <button
                  type="button"
                  className="btn-admin cg-mas"
                  onClick={() => {
                    abrir(`ent-${c.entregas.length}`, true);
                    upd((n) => n.entregas.push({ id: "", nombre: "", embalaje: 0, nota: "" }));
                  }}
                >
                  + Agregar forma de entrega
                </button>
              </div>
            )}
          </div>
        </div>

        <div hidden={subTienda !== "comprar"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Pasos de la dinámica de compra</strong>
            {campo("Pasos", c.dinamicaCompra, (v) => upd((n) => (n.dinamicaCompra = v)), { area: true, ayuda: "Un paso por línea." })}
          </div>
          <div className="pf-panel-bloque">
            <strong>Métodos de pago</strong>
            <div className="admin-tabla-wrap">
              <table className="admin-tabla cg-tabla-lista">
                <thead>
                  <tr>
                    <th>Método</th>
                    <th>Icono</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {c.metodosPago.flatMap((m, i) => {
                    const k = `pago-${i}`;
                    return [
                      <tr key={k}>
                        <td>{m.nombre || <small style={{ color: "var(--gris)" }}>(sin nombre)</small>}</td>
                        <td>{(ICONOS.find(([v]) => v === m.icono) || [m.icono, m.icono])[1]}</td>
                        {botonesFila(k, () => upd((n) => n.metodosPago.splice(i, 1)))}
                      </tr>,
                      abiertos.has(k) && (
                        <tr key={`${k}-e`} className="pf-eq-propio-extra">
                          <td colSpan={3}>
                            <div className="cg-listas">
                              {campo("Nombre del método", m.nombre, (v) => upd((n) => (n.metodosPago[i].nombre = v)))}
                              <div className="campo">
                                <label>Icono</label>
                                <select value={m.icono} onChange={(e) => upd((n) => (n.metodosPago[i].icono = e.target.value))}>
                                  {ICONOS.map(([v, t]) => (
                                    <option key={v} value={v}>{t}</option>
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
            {c.metodosPago.length < 10 && (
              <div>
                <button
                  type="button"
                  className="btn-admin cg-mas"
                  onClick={() => {
                    abrir(`pago-${c.metodosPago.length}`, true);
                    upd((n) => n.metodosPago.push({ nombre: "", icono: "tarjeta" }));
                  }}
                >
                  + Agregar método de pago
                </button>
              </div>
            )}
          </div>
        </div>

        <div hidden={subTienda !== "envios"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Envíos</strong>
            <div className="cg-listas">
              {campo("Lima", c.envios.lima, (v) => upd((n) => (n.envios.lima = v)), {
                area: true,
                ayuda: "Un ítem por línea.",
              })}
              {campo("Provincias", c.envios.provincias, (v) => upd((n) => (n.envios.provincias = v)), {
                area: true,
                ayuda: "Un ítem por línea.",
              })}
            </div>
          </div>
        </div>

        <div hidden={subTienda !== "politicas"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Políticas de compra</strong>
            <div className="admin-tabla-wrap">
              <table className="admin-tabla cg-tabla-lista">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Puntos</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {c.politicas.flatMap((p, i) => {
                    const k = `pol-${i}`;
                    const puntos = String(p.puntos || "").split("\n").filter((x) => x.trim());
                    return [
                      <tr key={k}>
                        <td>{p.titulo || <small style={{ color: "var(--gris)" }}>(sin título)</small>}</td>
                        <td className="cg-trunc" title={puntos.join(" · ")}>{puntos.length ? `${puntos.length} punto${puntos.length === 1 ? "" : "s"}: ${puntos[0]}` : "—"}</td>
                        {botonesFila(k, () => upd((n) => n.politicas.splice(i, 1)))}
                      </tr>,
                      abiertos.has(k) && (
                        <tr key={`${k}-e`} className="pf-eq-propio-extra">
                          <td colSpan={3}>
                            <div className="cg-listas">
                              {campo("Título", p.titulo, (v) => upd((n) => (n.politicas[i].titulo = v)))}
                              {campo("Puntos", p.puntos, (v) => upd((n) => (n.politicas[i].puntos = v)), { area: true, ayuda: "Un punto por línea." })}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            {c.politicas.length < 12 && (
              <div>
                <button
                  type="button"
                  className="btn-admin cg-mas"
                  onClick={() => {
                    abrir(`pol-${c.politicas.length}`, true);
                    upd((n) => n.politicas.push({ titulo: "", puntos: "" }));
                  }}
                >
                  + Agregar política
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="admin-card form-grid cg" hidden={pestana !== "portada"}>
        <div className="pf-pestanas" role="tablist" aria-label="Portada y SEO">
          {[
            ["bienvenida", "Bienvenida (portada)", c.bienvenida.valores.length, "Valores de la bienvenida"],
            ["seo", "SEO (Google y redes)", 2, "Campos"],
          ].map(([id, nombre, n, titulo]) => (
            <button key={id} type="button" role="tab" aria-selected={subPortada === id} className="pf-pestana" onClick={() => setSubPortada(id)}>
              <IconoPortada id={id} />
              {nombre}
              <span className="pf-pestana-n" title={titulo}>{n}</span>
            </button>
          ))}
        </div>

        <div hidden={subPortada !== "bienvenida"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>Textos</strong>
            <div className="cg-listas">
              {campo("Título", c.bienvenida.titulo, (v) => upd((n) => (n.bienvenida.titulo = v)), {
                area: true,
              })}
              {campo("Subtítulo", c.bienvenida.subtitulo, (v) => upd((n) => (n.bienvenida.subtitulo = v)))}
              {campo("Introducción", c.bienvenida.intro, (v) => upd((n) => (n.bienvenida.intro = v)), {
                area: true,
              })}
            </div>
          </div>
          <div className="pf-panel-bloque">
            <strong>Valores</strong>
            <div className="admin-tabla-wrap">
              <table className="admin-tabla cg-tabla-lista">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Texto</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {c.bienvenida.valores.flatMap((val, i) => {
                    const k = `val-${i}`;
                    return [
                      <tr key={k}>
                        <td>{val.titulo || <small style={{ color: "var(--gris)" }}>(sin título)</small>}</td>
                        <td className="cg-trunc" title={val.texto}>{val.texto || "—"}</td>
                        {botonesFila(k, () => upd((n) => n.bienvenida.valores.splice(i, 1)))}
                      </tr>,
                      abiertos.has(k) && (
                        <tr key={`${k}-e`} className="pf-eq-propio-extra">
                          <td colSpan={3}>
                            <div className="cg-listas">
                              {campo("Valor: título", val.titulo, (v) => upd((n) => (n.bienvenida.valores[i].titulo = v)))}
                              {campo("Valor: texto", val.texto, (v) => upd((n) => (n.bienvenida.valores[i].texto = v)), { area: true })}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            {c.bienvenida.valores.length < 6 && (
              <div>
                <button
                  type="button"
                  className="btn-admin cg-mas"
                  onClick={() => {
                    abrir(`val-${c.bienvenida.valores.length}`, true);
                    upd((n) => n.bienvenida.valores.push({ titulo: "", texto: "" }));
                  }}
                >
                  + Agregar valor
                </button>
              </div>
            )}
          </div>
          <div className="pf-panel-bloque">
            <strong>Cierre</strong>
            {campo("Cierre", c.bienvenida.cierre, (v) => upd((n) => (n.bienvenida.cierre = v)), {
              area: true,
            })}
          </div>
        </div>

        <div hidden={subPortada !== "seo"} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>SEO (Google y redes)</strong>
            <div className="cg-listas">
              {campo("Título del sitio", c.seo.titulo, (v) => upd((n) => (n.seo.titulo = v)))}
              {campo("Descripción", c.seo.descripcion, (v) => upd((n) => (n.seo.descripcion = v)), {
                area: true,
              })}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar configuración"}
        </button>
        <button
          type="submit"
          className="btn-admin peligro"
          formAction={restablecerConfiguracion}
          onClick={(e) => {
            if (!confirm("¿Volver a los valores originales? Se perderán los cambios guardados.")) {
              e.preventDefault();
            }
          }}
        >
          Restablecer valores originales
        </button>
      </div>
    </form>

    <div className="form-grid" hidden={pestana !== "pestanasweb"}>{extras.pestanasweb}</div>
    <div className="form-grid" hidden={pestana !== "equipo"}>{extras.equipo}</div>
    <div className="form-grid" hidden={pestana !== "inventario"}>{extras.inventario}</div>
    <div className="form-grid" hidden={pestana !== "integraciones"}>
      <nav className="pestanas pestanas-sub" role="tablist" aria-label="Integraciones">
        {subs.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sub === s.id}
            className={`pestana${sub === s.id ? " activa" : ""}`}
            onClick={() => elegirSub(s.id)}
          >
            {s.nombre}
          </button>
        ))}
        <button type="button" className="pestana pestana-agregar" onClick={nuevaPlataforma} title="Agregar otra plataforma (ej. Intercorp)">
          + Plataforma
        </button>
        {subs.find((x) => x.id === sub)?.formId && (
          <button
            type="submit"
            form={subs.find((x) => x.id === sub).formId}
            className="btn-admin solido pestana-guardar"
            title="Guardar los cambios de esta pestaña"
            disabled={!!guardado[subs.find((x) => x.id === sub).formId]?.enviando}
          >
            {guardado[subs.find((x) => x.id === sub).formId]?.enviando
              ? "Guardando…"
              : guardado[subs.find((x) => x.id === sub).formId]?.sinGuardar
                ? "Guardar ●"
                : "Guardar"}
          </button>
        )}
      </nav>
      {toast && (
        <div className={`toast-integracion ${toast.ok ? "ok" : "error"}`} role={toast.ok ? "status" : "alert"}>
          <span>{toast.ok || toast.error}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      {avisoPlat?.error && <div className="mensaje-error">{avisoPlat.error}</div>}
      {avisoPlat?.ok && <div className="mensaje-ok">{avisoPlat.ok}</div>}
      {subs.map((s) => (
        <div key={s.id} className="form-grid" hidden={sub !== s.id}>
          {s.contenido}
        </div>
      ))}
    </div>
    <div className="form-grid" hidden={pestana !== "ventas"}>{extras.ventas}</div>
    </div>
  );
}

/** Iconos de línea de las pestañas de General. */
function IconoGeneral({ id }) {
  const trazos = {
    identidad: <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a8 8 0 0 1 16 0" />,
    legal: <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6" />,
    horario: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}

/** Iconos de línea de las pestañas de Tienda. */
function IconoTienda({ id }) {
  const trazos = {
    entrega: <path d="M3 7h11v9H3V7Zm11 3h4l3 3v3h-7v-6ZM7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01" />,
    comprar: <path d="M3 6h2l2 10h11l2-7H7M10 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01" />,
    envios: <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
    politicas: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-3 9l2 2 4-4" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}

/** Iconos de línea de las pestañas de Portada y SEO. */
function IconoPortada({ id }) {
  const trazos = {
    bienvenida: <path d="M3 5h18v14H3V5Zm0 4h18M7 14h6" />,
    seo: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5-5" />,
  };
  return (
    <svg className="pf-pestana-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}
