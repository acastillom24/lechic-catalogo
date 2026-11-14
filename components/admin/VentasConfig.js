"use client";

import { useActionState, useState } from "react";
import { guardarOpcionesVentas, restablecerOpcionesVentas } from "../../app/(admin)/admin/actions";

const aTexto = (arr) => (arr || []).join("\n");
const contar = (t) => new Set(String(t).split("\n").map((x) => x.trim()).filter(Boolean)).size;

// Una pestaña por lista: nombre del campo en el formulario de ventas, etiqueta y ayuda.
const LISTAS = [
  { nombre: "categorias", etiqueta: "Categoría" },
  { nombre: "destinos", etiqueta: "Entrega", ayuda: "Se usa también en las pestañas Lima / Provincia / Recojo de Pendientes." },
  { nombre: "couriers", etiqueta: "Courier" },
  { nombre: "tiposCliente", etiqueta: "Tipo de cliente" },
  { nombre: "metodosPago", etiqueta: "Método de pago" },
];

/**
 * Listas de los campos desplegables de ventas (formulario de /operaciones, filtros del reporte y dashboard), una pestaña por lista.
 * Una opción por línea; se guardan en mayúsculas. Quitar una opción no cambia las ventas ya registradas.
 */
export default function VentasConfig({ opciones }) {
  const [estado, accion, enviando] = useActionState(guardarOpcionesVentas, {});
  const [vista, setVista] = useState(LISTAS[0].nombre);
  const [valores, setValores] = useState(() => Object.fromEntries(LISTAS.map((l) => [l.nombre, aTexto(opciones[l.nombre])])));

  return (
    <form action={accion} className="form-grid cg admin-card" key={estado?.n || 0}>
      {estado?.error && <div className="mensaje-error">{estado.error}</div>}
      {estado?.ok && <div className="mensaje-ok">{estado.ok}</div>}

      <div className="pf-pestanas" role="tablist" aria-label="Listas de ventas">
        {LISTAS.map((l) => (
          <button key={l.nombre} type="button" role="tab" aria-selected={l.nombre === vista} className="pf-pestana" onClick={() => setVista(l.nombre)}>
            {l.etiqueta}
            <span className="pf-pestana-n" title="Opciones">{contar(valores[l.nombre])}</span>
          </button>
        ))}
      </div>
      <small style={{ color: "var(--gris)" }}>
        Una opción por línea (se guardan en MAYÚSCULAS). Estas listas llenan los desplegables de <strong>/operaciones</strong> y los filtros del
        reporte de ventas y del dashboard. Quitar una opción no modifica las ventas ya registradas.
      </small>

      {LISTAS.map((l) => (
        <div key={l.nombre} hidden={l.nombre !== vista} className="form-grid">
          <div className="pf-panel-bloque">
            <strong>{l.etiqueta}</strong>
            <div className="campo">
              <textarea
                id={`ventas-${l.nombre}`}
                name={l.nombre}
                rows={10}
                value={valores[l.nombre]}
                onChange={(e) => setValores((p) => ({ ...p, [l.nombre]: e.target.value }))}
                aria-label={`Opciones de ${l.etiqueta}`}
              />
              {l.ayuda && <small style={{ color: "var(--gris)" }}>{l.ayuda}</small>}
            </div>
          </div>
        </div>
      ))}

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
