"use client";

import { eliminarProducto } from "../../app/(admin)/admin/actions";
import { IconoPapelera } from "./Iconos";

export default function EliminarProductoBoton({ id, nombre }) {
  const accion = eliminarProducto.bind(null, id);

  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn-ico-texto peligro">
        <IconoPapelera /> Eliminar producto
      </button>
    </form>
  );
}
