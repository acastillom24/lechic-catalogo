"use client";

import { useState, useTransition } from "react";
import { eliminarProducto } from "../../app/(admin)/admin/actions";
import { IconoPapelera } from "./Iconos";
import DialogoEliminar from "./DialogoEliminar";

export default function EliminarProductoBoton({ id, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();

  return (
    <>
      <button type="button" className="btn-ico-texto peligro" onClick={() => setAbierto(true)}>
        <IconoPapelera /> Eliminar producto
      </button>
      <DialogoEliminar
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={`Eliminar «${nombre}»`}
        pendiente={pendiente}
        onConfirmar={(alcance) => empezar(async () => { await eliminarProducto(id, alcance); })}
      />
    </>
  );
}
