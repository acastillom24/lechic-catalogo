"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reintentarStockSaga, reintentarTodoStockSaga, actualizarEstadoSaga } from "../../app/(admin)/admin/actions";

const fechaHora = (x) =>
  x
    ? new Date(x).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

/**
 * Lista de variantes × cuenta con su estado de sincronización en SAGA.
 * En "error" permite reintentar el aviso de stock (una fila o todas); en "pendiente",
 * consultar a SAGA si ya terminó de procesar los envíos.
 */
export default function TablaSincronizacionesSaga({ filas, estado }) {
  const [ocupado, setOcupado] = useState(null); // clave de la fila (o "todas") que se está procesando
  const [, iniciar] = useTransition();

  function ejecutar(clave, accion) {
    setOcupado(clave);
    iniciar(async () => {
      try {
        await accion();
      } finally {
        setOcupado(null);
      }
    });
  }

  const esError = estado === "error";

  return (
    <div className="form-grid">
      <div className="admin-barra">
        <small style={{ color: "var(--gris)" }}>
          {esError
            ? "Los avisos de stock se reintentan solos (1, 2, 4, 8, 16 min y luego cada 30). Aquí puedes forzarlos ahora."
            : "Envíos aceptados por SAGA que aún no confirmaron si se procesaron bien."}
        </small>
        <div className="admin-barra-der">
          {esError ? (
            <button
              type="button"
              className="btn-ico-texto primario"
              disabled={ocupado !== null || filas.length === 0}
              onClick={() => ejecutar("todas", () => reintentarTodoStockSaga())}
            >
              {ocupado === "todas" ? "Reintentando…" : "Reintentar todos"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-ico-texto primario"
              disabled={ocupado !== null || filas.length === 0}
              onClick={() => ejecutar("todas", () => actualizarEstadoSaga())}
            >
              {ocupado === "todas" ? "Consultando…" : "Actualizar estado SAGA"}
            </button>
          )}
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="admin-card">
          <p style={{ margin: 0, color: "var(--gris)" }}>
            {esError ? "No hay errores de sincronización." : "No hay envíos pendientes."}
          </p>
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="admin-tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Cuenta</th>
                <th>Detalle</th>
                <th>Stock web → SAGA</th>
                {esError && <th>Intentos</th>}
                <th>{esError ? "Próximo intento" : "Último envío"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const clave = `${f.variante_id}|${f.cuenta_alias}`;
                return (
                  <tr key={clave}>
                    <td>
                      <strong>{f.producto}</strong>
                      <br />
                      <small style={{ color: "var(--gris)" }}>{f.variante}</small>
                    </td>
                    <td>{f.sku || "—"}</td>
                    <td>{f.cuenta}</td>
                    <td style={{ maxWidth: 360 }}>
                      {esError && (
                        <span className={f.stock_pendiente ? "chip-saga aviso" : "chip-saga"}>
                          {f.stock_pendiente ? "Stock (reintento automático)" : "Datos del producto"}
                        </span>
                      )}
                      {f.error && <div style={{ fontSize: ".82rem", marginTop: 4, wordBreak: "break-word" }}>{f.error}</div>}
                    </td>
                    <td>
                      {f.stock_actual === null ? (f.stock ? "hay" : "sin stock") : f.stock_actual} → <strong>{f.stock_saga}</strong>
                    </td>
                    {esError && <td>{f.stock_pendiente ? f.intentos : "—"}</td>}
                    <td>{fechaHora(esError ? (f.stock_pendiente ? f.proximo_intento : null) : f.ultimo_sync)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {esError && (
                        <button
                          type="button"
                          className="btn-ico-texto"
                          disabled={ocupado !== null}
                          onClick={() => ejecutar(clave, () => reintentarStockSaga(f.variante_id, f.cuenta_alias))}
                        >
                          {ocupado === clave ? "Reintentando…" : "Reintentar stock"}
                        </button>
                      )}{" "}
                      <Link href={`/admin/productos/${f.producto_id}`} className="btn-ico-texto">
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
