"use client";

import Link from "next/link";
import { IconoBuscar, IconoFiltro, IconoCerrar, IconoCampana, IconoMas } from "../admin/Iconos";

export const ETIQUETAS_VISTA = {
  hoy: "Mis ventas de hoy",
  pendientes: "Pendientes",
  todas: "Todas (últimas 100)",
};

/**
 * Barra de búsqueda y filtro de /sales (mismo estilo que la de Productos en
 * /admin): buscador con filtro, chip del filtro activo, campana de
 * pendientes y botón principal para registrar.
 */
export default function SalesBarra({ q, vista, pendientes, hrefNueva, hrefHoy, hrefPendientes }) {
  return (
    <div className="admin-barra">
      <form method="get" action="/sales" className="admin-barra-buscar">
        <IconoBuscar size={18} />
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por teléfono o referencia..." />
        <span className="admin-barra-sep" aria-hidden="true" />
        <label className="admin-filtro" title="Filtrar">
          <IconoFiltro size={16} />
          <select
            name="vista"
            defaultValue={vista}
            aria-label="Filtrar"
            onChange={(e) => e.currentTarget.form.requestSubmit()}
          >
            {Object.entries(ETIQUETAS_VISTA).map(([k, etiqueta]) => (
              <option key={k} value={k}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
      </form>

      {vista !== "hoy" && (
        <Link href={hrefHoy} className="chip-filtro" title="Quitar filtro">
          {ETIQUETAS_VISTA[vista]} <IconoCerrar size={14} />
        </Link>
      )}

      {pendientes > 0 && vista !== "pendientes" && (
        <Link
          href={hrefPendientes}
          className="btn-campana"
          title={`${pendientes} venta(s) pendiente(s) de cobro`}
          aria-label={`${pendientes} ventas pendientes de cobro`}
        >
          <IconoCampana size={20} />
          <span className="badge-campana">{pendientes}</span>
        </Link>
      )}

      <div className="admin-barra-der">
        <Link href="/sales/productos/nuevo" className="btn-ico-texto primario">
          <IconoMas /> Agregar producto
        </Link>
        <Link href={hrefNueva} className="btn-ico-texto primario">
          <IconoMas /> Registrar venta
        </Link>
      </div>
    </div>
  );
}
