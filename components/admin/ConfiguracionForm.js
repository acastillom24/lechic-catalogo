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
  ["marcas", "Marcas"],
  ["pestanasweb", "Pestañas de la web"],
  ["equipo", "Equipo"],
  ["integraciones", "Integraciones"],
  ["ventas", "Ventas"],
  ["inventario", "Inventario"],
];
const GRUPO_SECCION = {
  "Identidad y contacto": "general",
  "Horario de atención": "general",
  "Formas de entrega": "tienda",
  "Cómo comprar": "tienda",
  Envíos: "tienda",
  "Políticas de compra": "tienda",
  "Bienvenida (portada)": "portada",
  "SEO (Google y redes)": "portada",
};

const sepSeccion = { borderTop: "1px solid var(--linea)", paddingTop: 12 };

export default function ConfiguracionForm({ inicial, extras = {} }) {
  const [estado, accion, enviando] = useActionState(guardarConfiguracion, {});
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
  const esSitio = !["marcas", "pestanasweb", "equipo", "integraciones", "ventas", "inventario"].includes(pestana);
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

      <section className="admin-card form-grid" hidden={pestana !== "general"}>
        <h2>Identidad y contacto</h2>
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
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "general"}>
        <h2>Datos legales y Libro de Reclamaciones</h2>
        <small style={{ color: "var(--gris)" }}>
          Aparecen en la hoja de reclamación que ve y recibe el cliente. El correo recibe el aviso de cada reclamo nuevo.
        </small>
        {campo("Razón social", c.empresa?.razonSocial, (v) => upd((n) => ((n.empresa ||= {}).razonSocial = v)))}
        {campo("RUC", c.empresa?.ruc, (v) => upd((n) => ((n.empresa ||= {}).ruc = v)), { ayuda: "11 dígitos." })}
        {campo("Domicilio del proveedor", c.empresa?.direccion, (v) => upd((n) => ((n.empresa ||= {}).direccion = v)))}
        {campo("Correo para recibir reclamos", c.empresa?.email, (v) => upd((n) => ((n.empresa ||= {}).email = v)), {
          tipo: "email",
          ayuda: "Si lo dejas vacío, se usa la variable RECLAMOS_EMAIL_TO.",
        })}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "general"}>
        <h2>Horario de atención</h2>
        {campo("Horario", c.horario.texto, (v) => upd((n) => (n.horario.texto = v)))}
        {campo("Nota", c.horario.nota, (v) => upd((n) => (n.horario.nota = v)), { area: true })}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "tienda"}>
        <h2>Formas de entrega</h2>
        {c.entregas.map((e, i) => (
          <div key={e.id + i} className="form-grid" style={sepSeccion}>
            {campo("Nombre", e.nombre, (v) => upd((n) => (n.entregas[i].nombre = v)))}
            {campo("Embalaje (monto)", e.embalaje, (v) => upd((n) => (n.entregas[i].embalaje = v)), {
              tipo: "number",
              ayuda: "Se suma al total del cliente; 0 si no cobra embalaje.",
            })}
            {campo("Nota para el cliente", e.nota, (v) => upd((n) => (n.entregas[i].nota = v)), {
              area: true,
            })}
            {c.entregas.length > 1 && (
              <button
                type="button"
                className="btn-admin peligro"
                onClick={() => upd((n) => n.entregas.splice(i, 1))}
              >
                Quitar esta entrega
              </button>
            )}
          </div>
        ))}
        {c.entregas.length < 6 && (
          <button
            type="button"
            className="btn-admin"
            onClick={() => upd((n) => n.entregas.push({ id: "", nombre: "", embalaje: 0, nota: "" }))}
          >
            + Agregar forma de entrega
          </button>
        )}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "tienda"}>
        <h2>Cómo comprar</h2>
        {campo("Pasos de la dinámica de compra", c.dinamicaCompra, (v) => upd((n) => (n.dinamicaCompra = v)), {
          area: true,
          ayuda: "Un paso por línea.",
        })}
        <h3>Métodos de pago</h3>
        {c.metodosPago.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="campo" style={{ flex: 1, minWidth: 160 }}>
              <input
                type="text"
                value={m.nombre}
                onChange={(e) => upd((n) => (n.metodosPago[i].nombre = e.target.value))}
              />
            </div>
            <div className="campo">
              <select
                value={m.icono}
                onChange={(e) => upd((n) => (n.metodosPago[i].icono = e.target.value))}
              >
                {ICONOS.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-admin peligro"
              onClick={() => upd((n) => n.metodosPago.splice(i, 1))}
            >
              Quitar
            </button>
          </div>
        ))}
        {c.metodosPago.length < 10 && (
          <button
            type="button"
            className="btn-admin"
            onClick={() => upd((n) => n.metodosPago.push({ nombre: "", icono: "tarjeta" }))}
          >
            + Agregar método de pago
          </button>
        )}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "tienda"}>
        <h2>Envíos</h2>
        {campo("Lima", c.envios.lima, (v) => upd((n) => (n.envios.lima = v)), {
          area: true,
          ayuda: "Un ítem por línea.",
        })}
        {campo("Provincias", c.envios.provincias, (v) => upd((n) => (n.envios.provincias = v)), {
          area: true,
          ayuda: "Un ítem por línea.",
        })}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "tienda"}>
        <h2>Políticas de compra</h2>
        {c.politicas.map((p, i) => (
          <div key={i} className="form-grid" style={sepSeccion}>
            {campo("Título", p.titulo, (v) => upd((n) => (n.politicas[i].titulo = v)))}
            {campo("Puntos", p.puntos, (v) => upd((n) => (n.politicas[i].puntos = v)), {
              area: true,
              ayuda: "Un punto por línea.",
            })}
            <button
              type="button"
              className="btn-admin peligro"
              onClick={() => upd((n) => n.politicas.splice(i, 1))}
            >
              Quitar esta política
            </button>
          </div>
        ))}
        {c.politicas.length < 12 && (
          <button
            type="button"
            className="btn-admin"
            onClick={() => upd((n) => n.politicas.push({ titulo: "", puntos: "" }))}
          >
            + Agregar política
          </button>
        )}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "portada"}>
        <h2>Bienvenida (portada)</h2>
        {campo("Título", c.bienvenida.titulo, (v) => upd((n) => (n.bienvenida.titulo = v)), {
          area: true,
        })}
        {campo("Subtítulo", c.bienvenida.subtitulo, (v) => upd((n) => (n.bienvenida.subtitulo = v)))}
        {campo("Introducción", c.bienvenida.intro, (v) => upd((n) => (n.bienvenida.intro = v)), {
          area: true,
        })}
        {c.bienvenida.valores.map((val, i) => (
          <div key={i} className="form-grid" style={sepSeccion}>
            {campo("Valor: título", val.titulo, (v) => upd((n) => (n.bienvenida.valores[i].titulo = v)))}
            {campo("Valor: texto", val.texto, (v) => upd((n) => (n.bienvenida.valores[i].texto = v)), {
              area: true,
            })}
            <button
              type="button"
              className="btn-admin peligro"
              onClick={() => upd((n) => n.bienvenida.valores.splice(i, 1))}
            >
              Quitar este valor
            </button>
          </div>
        ))}
        {c.bienvenida.valores.length < 6 && (
          <button
            type="button"
            className="btn-admin"
            onClick={() => upd((n) => n.bienvenida.valores.push({ titulo: "", texto: "" }))}
          >
            + Agregar valor
          </button>
        )}
        {campo("Cierre", c.bienvenida.cierre, (v) => upd((n) => (n.bienvenida.cierre = v)), {
          area: true,
        })}
      </section>

      <section className="admin-card form-grid" hidden={pestana !== "portada"}>
        <h2>SEO (Google y redes)</h2>
        {campo("Título del sitio", c.seo.titulo, (v) => upd((n) => (n.seo.titulo = v)))}
        {campo("Descripción", c.seo.descripcion, (v) => upd((n) => (n.seo.descripcion = v)), {
          area: true,
        })}
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

    <div className="form-grid" hidden={pestana !== "marcas"}>{extras.marcas}</div>
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
