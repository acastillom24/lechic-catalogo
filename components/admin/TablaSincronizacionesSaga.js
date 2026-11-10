"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  reintentarStockSaga, reintentarTodoStockSaga,
  consultarEstadoSagaSeleccion, aplicarAccionSagaSeleccion, cambiarAccionSagaSeleccion,
} from "../../app/(admin)/admin/actions";
import { CATEGORIAS_REVISION } from "../../lib/saga-revision";

const fechaHora = (x) =>
  x
    ? new Date(x).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

const nombreCategoria = (clave) => CATEGORIAS_REVISION.find(([k]) => k === clave)?.[1] || "Otros";

/**
 * Lista de variantes × cuenta con su estado de sincronización en SAGA.
 *  - error:      reintentar el aviso de stock (una fila o todas);
 *  - pendiente:  reporte del último estado guardado, con los motivos de la revisión de SAGA; con las filas
 *                elegidas se consulta su estado o se aplica una acción de vinculación;
 *  - publicado:  con las filas elegidas se cambia el tipo de vinculación (y, si se quiere, se envía ya).
 * El panel /operaciones pasa en `acciones` sus propias versiones, limitadas a las filas del usuario.
 * `opcionesAccion` = acciones de vinculación configuradas ({ id, nombre }).
 */
export default function TablaSincronizacionesSaga({
  filas, estado, rutaProducto = "/admin/productos", acciones = {}, opcionesAccion = [], mostrarUsuario = false,
}) {
  const reintentarTodo = acciones.reintentarTodo || reintentarTodoStockSaga;
  const reintentar = acciones.reintentar || reintentarStockSaga;
  const consultar = acciones.consultar || consultarEstadoSagaSeleccion;
  const aplicar = acciones.aplicar || aplicarAccionSagaSeleccion;
  const cambiarTipo = acciones.cambiarTipo || cambiarAccionSagaSeleccion;
  const [ocupado, setOcupado] = useState(null); // clave de la fila (o "todas" / "lote") que se está procesando
  const [, iniciar] = useTransition();
  const [elegidas, setElegidas] = useState(() => new Set());
  const [modo, setModo] = useState(opcionesAccion[0]?.id || "");
  const [enviarAhora, setEnviarAhora] = useState(false);
  const [mensaje, setMensaje] = useState("");

  function ejecutar(clave, accion) {
    setOcupado(clave);
    setMensaje("");
    iniciar(async () => {
      try {
        const r = await accion();
        if (r?.mensaje) setMensaje(r.mensaje);
        setElegidas(new Set());
      } finally {
        setOcupado(null);
      }
    });
  }

  const esError = estado === "error";
  const esPendiente = estado === "pendiente";
  const conSeleccion = !esError;
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
      <div className="admin-barra">
        <small style={{ color: "var(--gris)" }}>
          {esError
            ? `Los avisos de stock se reintentan solos (1, 2, 4, 8, 16 min y luego cada 30). Aquí puedes forzarlos ahora.`
            : esPendiente
              ? "Último estado guardado de cada envío (no consulta a SAGA al abrir). Elige filas para consultar su estado o aplicarles una acción."
              : "Productos ya vinculados con SAGA. Elige filas para cambiar su tipo de vinculación en bloque."}
        </small>
        <div className="admin-barra-der">
          {esError && (
            <button
              type="button"
              className="btn-ico-texto primario"
              disabled={ocupado !== null || filas.length === 0}
              onClick={() => ejecutar("todas", () => reintentarTodo())}
            >
              {ocupado === "todas" ? "Reintentando…" : "Reintentar todos"}
            </button>
          )}
        </div>
      </div>

      {conSeleccion && filas.length > 0 && (
        <div className="admin-barra" style={{ flexWrap: "wrap", gap: 10 }}>
          <small style={{ color: "var(--gris)" }}>
            {lista.length ? `${lista.length} fila(s) elegida(s)` : "Marca las filas con las casillas"}
          </small>
          <div className="admin-barra-der" style={{ flexWrap: "wrap", gap: 8 }}>
            {esPendiente && (
              <button
                type="button"
                className="btn-ico-texto primario"
                disabled={ocupado !== null || !lista.length}
                onClick={() => ejecutar("lote", () => consultar(lista))}
              >
                {ocupado === "lote" ? "Consultando…" : "Consultar estado"}
              </button>
            )}
            {selectorAccion}
            {!esPendiente && (
              <label className="campo-check" style={{ margin: 0 }}>
                <input type="checkbox" checked={enviarAhora} onChange={(e) => setEnviarAhora(e.target.checked)} />
                Enviar a SAGA ahora
              </label>
            )}
            <button
              type="button"
              className="btn-ico-texto"
              disabled={ocupado !== null || !lista.length || !modo}
              onClick={() =>
                ejecutar("lote", () => (esPendiente ? aplicar(lista, modo) : cambiarTipo(lista, modo, enviarAhora)))
              }
            >
              {ocupado === "lote" ? "Aplicando…" : esPendiente ? "Aplicar acción" : "Cambiar tipo de vinculación"}
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="admin-card" role="status" style={{ fontSize: ".9rem" }}>{mensaje}</div>
      )}

      {filas.length === 0 ? (
        <div className="admin-card">
          <p style={{ margin: 0, color: "var(--gris)" }}>
            {esError ? "No hay errores de sincronización." : esPendiente ? "No hay envíos pendientes." : "Aún no hay productos sincronizados."}
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
                {estado === "publicado" ? <th>Vinculación</th> : <th>Detalle</th>}
                {estado !== "publicado" && <th>Stock web → SAGA</th>}
                {esError && <th>Intentos</th>}
                <th>{esError ? "Próximo intento" : "Último envío"}</th>
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
                    {estado === "publicado" ? (
                      <td>{nombreAccion(f.accion)}</td>
                    ) : (
                      <td style={{ maxWidth: 380 }}>
                        {esError && (
                          <span className={f.stock_pendiente ? "chip-saga aviso" : "chip-saga"}>
                            {f.stock_pendiente ? "Stock (reintento automático)" : "Datos del producto"}
                          </span>
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
                    {estado !== "publicado" && (
                      <td>
                        {f.stock_actual === null ? (f.stock ? "hay" : "sin stock") : f.stock_actual} → <strong>{f.stock_saga}</strong>
                      </td>
                    )}
                    {esError && <td>{f.stock_pendiente ? f.intentos : "—"}</td>}
                    <td>{fechaHora(esError ? (f.stock_pendiente ? f.proximo_intento : null) : f.ultimo_sync)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {esError && (
                        <button
                          type="button"
                          className="btn-ico-texto"
                          disabled={ocupado !== null}
                          onClick={() => ejecutar(clave, () => reintentar(f.variante_id, f.cuenta_alias))}
                        >
                          {ocupado === clave ? "Reintentando…" : "Reintentar stock"}
                        </button>
                      )}{" "}
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
    </div>
  );
}
