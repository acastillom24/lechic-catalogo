"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  consultarEstadoSagaSeleccion, cambiarAccionSagaSeleccion,
} from "../../app/(admin)/admin/actions";
import { CATEGORIAS_REVISION } from "../../lib/saga-revision";

const fechaHora = (x) =>
  x
    ? new Date(x).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

const nombreCategoria = (clave) => CATEGORIAS_REVISION.find(([k]) => k === clave)?.[1] || "Configuración Seller Center";

/**
 * Lista de variantes × cuenta con su estado de sincronización en SAGA.
 *  - error:      con las filas elegidas se consulta su estado en SAGA: si el producto ya existe pasa a Sin publicar o
 *                Sincronizados (los avisos de stock fallidos se reintentan solos);
 *  - pendiente:  reporte del último estado guardado, con los motivos de la revisión de SAGA; con las filas
 *                elegidas se consulta su estado;
 *  - publicado:  con las filas elegidas se cambia el tipo de vinculación (y, si se quiere, se envía ya).
 * El panel /operaciones pasa en `acciones` sus propias versiones, limitadas a las filas del usuario.
 * `opcionesAccion` = acciones de vinculación configuradas ({ id, nombre }).
 */
export default function TablaSincronizacionesSaga({
  filas, estado, rutaProducto = "/admin/productos", acciones = {}, opcionesAccion = [], mostrarUsuario = false,
}) {
  const consultar = acciones.consultar || consultarEstadoSagaSeleccion;
  const cambiarTipo = acciones.cambiarTipo || cambiarAccionSagaSeleccion;
  const [ocupado, setOcupado] = useState(null); // clave de la fila (o "todas" / "lote") que se está procesando
  const [, iniciar] = useTransition();
  const [elegidas, setElegidas] = useState(() => new Set());
  const [modo, setModo] = useState(opcionesAccion[0]?.id || "");
  const [enviarAhora, setEnviarAhora] = useState(false);
  const [avisos, setAvisos] = useState([]); // alertas flotantes: { id, texto, tipo, minimizado }
  const idAviso = useRef(0);
  const temporizadores = useRef(new Map());

  const cerrarAviso = (id) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setAvisos((a) => a.filter((x) => x.id !== id));
  };
  const minimizarAviso = (id, minimizado) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setAvisos((a) => a.map((x) => (x.id === id ? { ...x, minimizado } : x)));
  };
  function mostrarAviso(texto) {
    const id = ++idAviso.current;
    const tipo = /error|no se pudo|fall|rechaz/i.test(texto) ? "error" : "ok";
    setAvisos((a) => [...a.slice(-3), { id, texto, tipo, minimizado: false }]);
    // Los avisos correctos se pliegan solos a los 8 s; los de error se quedan hasta que se cierren.
    if (tipo === "ok") temporizadores.current.set(id, setTimeout(() => minimizarAviso(id, true), 8000));
  }
  useEffect(() => {
    const t = temporizadores.current;
    return () => t.forEach(clearTimeout);
  }, []);

  function ejecutar(clave, accion) {
    setOcupado(clave);
    iniciar(async () => {
      try {
        const r = await accion();
        if (r?.mensaje) mostrarAviso(r.mensaje);
        setElegidas(new Set());
      } finally {
        setOcupado(null);
      }
    });
  }

  const esError = estado === "error";
  const esPendiente = estado === "pendiente";
  const esSinPublicar = estado === "sin_publicar";
  const esSincronizado = estado === "publicado";
  const conSeleccion = true;
  const claveDe = (f) => `${f.variante_id}|${f.cuenta_alias}`;
  const claves = filas.map(claveDe);
  const todas = claves.length > 0 && claves.every((c) => elegidas.has(c));
  const lista = [...elegidas];
  const nombreAccion = (id) => opcionesAccion.find((a) => a.id === id)?.nombre || (id === "crear" ? "Creado desde la web" : id || "—");

  const alternar = (c) =>
    setElegidas((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const selectorAccion = (
    <select value={modo} onChange={(e) => setModo(e.target.value)} aria-label="Acción de vinculación" disabled={ocupado !== null}>
      {opcionesAccion.length === 0 && <option value="">Sin acciones configuradas</option>}
      {opcionesAccion.map((a) => (
        <option key={a.id} value={a.id}>{a.nombre}</option>
      ))}
    </select>
  );

  return (
    <div className="form-grid">
      <details className="saga-ayuda">
        <summary>¿Qué muestra esta pestaña?</summary>
        <p>
          {esError
            ? "Envíos que SAGA no llegó a recibir o no pudo procesar (datos inválidos, configuración de la cuenta, error del envío). Elige filas y consulta su estado: si SAGA ya tiene el producto, pasa a Pendientes o Sin publicar según lo que SAGA indique. Los avisos de stock se reintentan solos."
            : esPendiente
              ? "Productos que SAGA tiene en Pendientes (en revisión o con contenido, imágenes o compliance por corregir). Último estado guardado: no consulta a SAGA al abrir. Elige filas para consultar su estado."
              : esSinPublicar
                ? "Productos ya aprobados por SAGA (parte del catálogo) que todavía no están publicados en SAGA (casilla «Publicado»). Elige filas y consulta el estado para ver qué falta; si no falta ningún requisito, solo queda publicarlos en Seller Center. Al quedar publicados pasan a Sincronizados."
                : "Productos vinculados con SAGA. «Consultar estado» revisa su situación actual en SAGA: Pendientes si siguen en revisión, Sin publicar si están aprobados pero sin la casilla «Publicado» activa. Con las filas elegidas también puedes cambiar su tipo de vinculación."}
        </p>
      </details>

      {conSeleccion && filas.length > 0 && (
        <div className="admin-barra" style={{ flexWrap: "wrap", gap: 10 }}>
          <small style={{ color: "var(--gris)" }}>
            {lista.length ? `${lista.length} fila(s) elegida(s)` : "Marca las filas con las casillas"}
          </small>
          <div className="admin-barra-der" style={{ flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn-ico-texto primario"
              disabled={ocupado !== null || !lista.length}
              onClick={() => ejecutar("lote", () => consultar(lista))}
            >
              {ocupado === "lote" ? "Consultando…" : "Consultar estado"}
            </button>
            {/* El tipo de vinculación solo se cambia en Sincronizados. */}
            {esSincronizado && (
              <>
                {selectorAccion}
                <label className="campo-check" style={{ margin: 0 }}>
                  <input type="checkbox" checked={enviarAhora} onChange={(e) => setEnviarAhora(e.target.checked)} />
                  Enviar a SAGA ahora
                </label>
                <button
                  type="button"
                  className="btn-ico-texto"
                  disabled={ocupado !== null || !lista.length || !modo}
                  onClick={() => ejecutar("lote", () => cambiarTipo(lista, modo, enviarAhora))}
                >
                  {ocupado === "lote" ? "Aplicando…" : "Cambiar tipo de vinculación"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {filas.length === 0 ? (
        <div className="admin-card">
          <p style={{ margin: 0, color: "var(--gris)" }}>
            {esError
              ? "No hay errores de sincronización."
              : esPendiente
                ? "No hay envíos pendientes."
                : esSinPublicar
                  ? "No hay productos sin publicar. Los productos aparecen aquí al usar «Consultar estado» en Sincronizados y detectar que SAGA aún no los deja vender."
                  : "Aún no hay productos sincronizados."}
          </p>
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="admin-tabla">
            <thead>
              <tr>
                {conSeleccion && (
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      aria-label="Elegir todas"
                      checked={todas}
                      onChange={() => setElegidas(todas ? new Set() : new Set(claves))}
                    />
                  </th>
                )}
                <th>Producto</th>
                <th>SKU</th>
                <th>Cuenta</th>
                {mostrarUsuario && <th>Usuario</th>}
                {esSincronizado ? <th>Vinculación</th> : <th>Detalle</th>}
                {!esSincronizado && !esSinPublicar && <th>Stock web → SAGA</th>}
                <th>Último envío</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const clave = claveDe(f);
                const motivos = Array.isArray(f.revision_motivos) ? f.revision_motivos : [];
                return (
                  <tr key={clave}>
                    {conSeleccion && (
                      <td>
                        <input type="checkbox" aria-label="Elegir fila" checked={elegidas.has(clave)} onChange={() => alternar(clave)} />
                      </td>
                    )}
                    <td>
                      <strong>{f.producto}</strong>
                      <br />
                      <small style={{ color: "var(--gris)" }}>{f.variante}</small>
                    </td>
                    <td>{f.sku || "—"}</td>
                    <td>{f.cuenta}</td>
                    {mostrarUsuario && <td>{f.usuario_panel || "Admin / automático"}</td>}
                    {esSincronizado ? (
                      <td>
                        {nombreAccion(f.accion)}
                        {f.venta_ok && f.venta_fecha && (
                          <div><small style={{ color: "var(--gris)" }}>Publicado en SAGA · revisado {fechaHora(f.venta_fecha)}</small></div>
                        )}
                      </td>
                    ) : esSinPublicar ? (
                      <td style={{ maxWidth: 380 }}>
                        {(() => {
                          const its = (f.venta_detalle?.items || []).filter((it) => it.estado !== "sin_dato" && it.clave !== "publicacion");
                          return its.length > 0 && its.every((it) => it.estado === "listo") ? (
                            <div style={{ marginBottom: 4 }}>
                              <span className="chip-saga">Listo, falta publicar en SAGA</span>
                            </div>
                          ) : (
                            <div style={{ marginBottom: 4 }}>
                              <span className="chip-saga aviso">Falta cumplir requisitos</span>
                            </div>
                          );
                        })()}
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: ".82rem", wordBreak: "break-word" }}>
                          {(f.venta_detalle?.items || []).filter((it) => it.estado !== "sin_dato").map((it) => (
                            <li key={it.clave}>
                              <span className={it.estado === "pendiente" ? "chip-saga aviso" : "chip-saga"}>
                                {it.estado === "listo" ? "Listo" : "Pendiente"}
                              </span>{" "}
                              <strong>{it.etiqueta}</strong>
                              {it.detalle && <span style={{ color: "var(--gris)" }}> · {it.detalle}</span>}
                            </li>
                          ))}
                        </ul>
                        {(f.venta_detalle?.motivos || []).length > 0 && (
                          <div style={{ fontSize: ".82rem", marginTop: 4, wordBreak: "break-word" }}>
                            <strong>Motivo de SAGA:</strong> {f.venta_detalle.motivos.join(" · ")}
                          </div>
                        )}
                        {f.venta_fecha && <small style={{ color: "var(--gris)" }}>Revisado {fechaHora(f.venta_fecha)}</small>}
                      </td>
                    ) : (
                      <td style={{ maxWidth: 380 }}>
                        {esError && (
                          <span className={f.stock_pendiente ? "chip-saga aviso" : "chip-saga"}>
                            {f.stock_pendiente ? "Stock (reintento automático)" : "Datos del producto"}
                          </span>
                        )}
                        {esPendiente && f.cola_modo && (
                          <div style={{ marginBottom: 4 }}>
                            <span className="chip-saga aviso">
                              En cola · intento {f.cola_intentos || 0} · próximo envío {fechaHora(f.proximo_envio)}
                            </span>
                          </div>
                        )}
                        {esPendiente && f.imagen_pendiente && (
                          <div style={{ marginBottom: 4 }}>
                            <span className="chip-saga aviso" title="SAGA solo acepta las imágenes cuando el producto ya existe y con 2 minutos entre envíos. Se envían solas; «Consultar estado» las envía al momento.">
                              Imágenes por enviar{f.imagenes_web ? ` (${f.imagenes_web} en la web)` : ""}
                            </span>
                          </div>
                        )}
                        {esPendiente && !f.imagen_pendiente && f.imagen_feed_id && !f.revision_fecha && (
                          <div style={{ marginBottom: 4 }}>
                            <span className="chip-saga">Imágenes enviadas · esperando a SAGA</span>
                          </div>
                        )}
                        {esPendiente && (f.revision_categoria || f.revision_puntaje !== null) && (
                          <div style={{ marginBottom: 4 }}>
                            {f.revision_categoria && <span className="chip-saga aviso">{nombreCategoria(f.revision_categoria)}</span>}{" "}
                            {f.revision_puntaje !== null && f.revision_puntaje !== undefined && (
                              <span className="chip-saga">Puntaje {f.revision_puntaje}</span>
                            )}
                          </div>
                        )}
                        {esPendiente && motivos.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: ".82rem", wordBreak: "break-word" }}>
                            {motivos.map((m) => (
                              <li key={m.texto}>
                                <strong>{nombreCategoria(m.categoria)}:</strong> {m.texto}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          f.error && <div style={{ fontSize: ".82rem", marginTop: 4, wordBreak: "break-word" }}>{f.error}</div>
                        )}
                        {esPendiente && f.revision_fecha && (
                          <small style={{ color: "var(--gris)" }}>Revisado {fechaHora(f.revision_fecha)}</small>
                        )}
                      </td>
                    )}
                    {!esSincronizado && !esSinPublicar && (
                      <td>
                        {f.stock_actual === null ? (f.stock ? "hay" : "sin stock") : f.stock_actual} → <strong>{f.stock_saga}</strong>
                      </td>
                    )}
                    <td>{fechaHora(f.ultimo_sync)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={`${rutaProducto}/${f.producto_id}`} className="btn-ico-texto">
                        Editar producto
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {avisos.length > 0 && (
        <div className="saga-avisos" aria-live="polite">
          {avisos.map((a) =>
            a.minimizado ? (
              <button
                key={a.id}
                type="button"
                className={`saga-aviso-mini ${a.tipo}`}
                title={a.texto}
                aria-label="Mostrar aviso"
                onClick={() => minimizarAviso(a.id, false)}
              >
                {a.tipo === "error" ? "!" : "✓"}
              </button>
            ) : (
              <div key={a.id} className={`saga-aviso ${a.tipo}`} role={a.tipo === "error" ? "alert" : "status"}>
                <span className="saga-aviso-ico" aria-hidden="true">{a.tipo === "error" ? "!" : "✓"}</span>
                <p>{a.texto}</p>
                <div className="saga-aviso-acc">
                  <button type="button" onClick={() => minimizarAviso(a.id, true)} aria-label="Minimizar aviso" title="Minimizar">–</button>
                  <button type="button" onClick={() => cerrarAviso(a.id)} aria-label="Cerrar aviso" title="Cerrar">×</button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
