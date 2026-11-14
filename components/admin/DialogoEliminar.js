"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ventana para eliminar productos: se elige si se quitan solo de la web o también de las plataformas (SAGA y las que se
 * agreguen). `onConfirmar(alcance)` recibe "web" o "todas".
 */
export default function DialogoEliminar({ abierto, onCerrar, titulo, onConfirmar, pendiente = false }) {
  const ref = useRef(null);
  const [alcance, setAlcance] = useState("web");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      setAlcance("web");
      d.showModal();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog ref={ref} className="dialogo-eliminar" onClose={onCerrar} onCancel={onCerrar}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirmar(alcance);
        }}
      >
        <h3>{titulo}</h3>
        <p>¿Dónde quieres eliminarlo?</p>
        <label className={alcance === "web" ? "dialogo-opcion activa" : "dialogo-opcion"}>
          <input type="radio" name="alcance" value="web" checked={alcance === "web"} onChange={() => setAlcance("web")} />
          <span>
            <strong>Solo de la web</strong>
            <small>Se borra de este catálogo. En las plataformas sigue publicado y queda con stock 0.</small>
          </span>
        </label>
        <label className={alcance === "todas" ? "dialogo-opcion activa peligro" : "dialogo-opcion"}>
          <input type="radio" name="alcance" value="todas" checked={alcance === "todas"} onChange={() => setAlcance("todas")} />
          <span>
            <strong>De la web y de todas las plataformas</strong>
            <small>Además se quita de SAGA en las cuentas donde está enlazado. No se puede deshacer. Si una plataforma no lo quita, no se borra nada.</small>
          </span>
        </label>
        <div className="dialogo-acciones">
          <button type="button" className="btn-admin" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </button>
          <button type="submit" className="btn-admin peligro" disabled={pendiente}>
            {pendiente ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
