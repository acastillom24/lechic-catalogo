"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import MovimientoForm from "../admin/MovimientoForm";
import { IconoEditar, IconoStock } from "../admin/Iconos";
import { registrarMovimientoVentas } from "../../app/(sales)/operaciones/actions";

const vacio = <span style={{ color: "var(--gris)" }}>—</span>;

/** Tabla de productos de /operaciones: edición y movimientos de stock (sin eliminar ni costos). */
export default function TablaProductosVentas({ filas }) {
  const [abierta, setAbierta] = useState(null);

  return (
    <div className="admin-card" style={{ padding: 0, overflowX: "auto" }}>
      <table className="admin-tabla">
        <thead>
          <tr>
            <th></th>
            <th>Producto</th>
            <th>Variante</th>
            <th>SKU</th>
            <th>Marca</th>
            <th>Stock</th>
            <th>Mín.</th>
            <th>Precio</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((v) => {
            const controlada = v.stock_actual !== null;
            const bajo = controlada && v.stock_actual <= v.stock_minimo;
            const p = v.precio_oferta ?? v.precio;
            return (
              <Fragment key={v.id}>
                <tr>
                  <td>
                    {v.imagen ? <img src={v.imagen} alt="" className="admin-miniatura" /> : <div className="admin-miniatura" />}
                  </td>
                  <td className="celda-producto">{v.producto}</td>
                  <td>
                    {v.variante}
                    {!v.activo && (
                      <>
                        {" "}
                        <span className="pill">Inactiva</span>
                      </>
                    )}
                  </td>
                  <td>{v.sku || vacio}</td>
                  <td>
                    {v.marca}
                    {v.pestana && v.pestana !== v.marca ? <small style={{ color: "var(--gris)" }}> → {v.pestana}</small> : null}
                  </td>
                  <td>
                    {controlada ? (
                      <strong>
                        {v.stock_actual}{" "}
                        {v.stock_actual <= 0 ? (
                          <span className="pill agotado">Agotado</span>
                        ) : (
                          bajo && <span className="pill agotado">Bajo</span>
                        )}
                      </strong>
                    ) : v.stock ? (
                      <span style={{ color: "var(--gris)" }}>Disponible (sin control)</span>
                    ) : (
                      <span className="pill agotado">Agotado</span>
                    )}
                  </td>
                  <td>{controlada ? v.stock_minimo : vacio}</td>
                  <td>{p === null ? vacio : `S/ ${p}`}</td>
                  <td>
                    <div className="acciones-fila">
                      <button
                        type="button"
                        className={abierta === v.id ? "btn-ico activo" : "btn-ico"}
                        onClick={() => setAbierta((a) => (a === v.id ? null : v.id))}
                        aria-expanded={abierta === v.id}
                        title="Registrar movimiento de stock"
                        aria-label="Registrar movimiento de stock"
                      >
                        <IconoStock />
                      </button>
                      <Link
                        href={`/operaciones/productos/${encodeURIComponent(v.producto_id)}`}
                        className="btn-ico"
                        title="Editar producto"
                        aria-label="Editar producto"
                      >
                        <IconoEditar />
                      </Link>
                    </div>
                  </td>
                </tr>
                {abierta === v.id && (
                  <tr>
                    <td colSpan={9}>
                      <MovimientoForm varianteId={v.id} accionMovimiento={registrarMovimientoVentas} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {filas.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--gris)" }}>
                No hay productos que coincidan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
