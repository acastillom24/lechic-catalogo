"use client";

import { useActionState } from "react";
import { guardarOpcionesVentas, restablecerOpcionesVentas } from "../../app/(admin)/admin/actions";

const aTexto = (arr) => (arr || []).join("\n");

function Lista({ nombre, etiqueta, ayuda, valores, filas = 5 }) {
  return (
    <div className="campo">
      <label htmlFor={`ventas-${nombre}`}>{etiqueta}</label>
      <textarea id={`ventas-${nombre}`} name={nombre} rows={filas} defaultValue={aTexto(valores)} />
      {ayuda && <small style={{ color: "var(--gris)" }}>{ayuda}</small>}
    </div>
  );
}

/**
 * Listas de los campos desplegables de ventas (formulario de /sales, filtros del reporte y dashboard).
 * Una opción por línea; se guardan en mayúsculas. Quitar una opción no cambia las ventas ya registradas.
 */
export default function VentasConfig({ opciones }) {
  const [estado, accion, enviando] = useActionState(guardarOpcionesVentas, {});

  return (
    <form action={accion} className="form-grid" key={estado?.n || 0}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}

      <section className="admin-card form-grid">
        <h2>Listas de ventas</h2>
        <small style={{ color: "var(--gris)" }}>
          Una opción por línea (se guardan en MAYÚSCULAS). Estas listas llenan los desplegables de <strong>/sales</strong> y los
          filtros del reporte de ventas y del dashboard. Quitar una opción no modifica las ventas ya registradas.
        </small>
        <Lista nombre="categorias" etiqueta="Categoría" valores={opciones.categorias} />
        <Lista
          nombre="destinos"
          etiqueta="Entrega"
          valores={opciones.destinos}
          ayuda="Se usa también en las pestañas Lima / Provincia / Recojo de Pendientes."
        />
        <Lista nombre="couriers" etiqueta="Courier" valores={opciones.couriers} />
        <Lista nombre="tiposCliente" etiqueta="Tipo de cliente" valores={opciones.tiposCliente} />
        <Lista nombre="metodosPago" etiqueta="Método de pago" valores={opciones.metodosPago} />
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-admin solido" disabled={enviando}>
          {enviando ? "Guardando..." : "Guardar listas de ventas"}
        </button>
        <button
          type="submit"
          className="btn-admin peligro"
          formAction={restablecerOpcionesVentas}
          onClick={(e) => {
            if (!confirm("¿Volver a las listas originales de ventas? Se perderán los cambios guardados.")) e.preventDefault();
          }}
        >
          Restablecer valores originales
        </button>
      </div>
    </form>
  );
}
