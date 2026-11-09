"use client";

import { eliminarVentaAccion } from "../../app/(admin)/admin/actions";
import { IconoPapelera } from "./Iconos";

/** Elimina una venta cerrada (pide confirmación; no se puede deshacer). */
export default function EliminarVentaBoton({ id, resumen }) {
  return (
    <form
      action={eliminarVentaAccion.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar la venta ${resumen}? Se borra del reporte y del dashboard y no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-ico" title="Eliminar venta" aria-label="Eliminar venta">
        <IconoPapelera />
      </button>
    </form>
  );
}
