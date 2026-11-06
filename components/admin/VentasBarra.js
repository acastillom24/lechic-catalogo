"use client";

import Link from "next/link";
import { useRef } from "react";
import { IconoBuscar, IconoFiltro, IconoCerrar, IconoExportar, IconoCalendario } from "./Iconos";
import { CATEGORIAS, DESTINOS, TIPOS_CLIENTE, ESTADOS } from "../../lib/ventas-core";

/**
 * Barra del reporte de ventas, con el mismo estilo que la de Productos:
 * buscador + filtro de estado, filtros adicionales, rango de fechas, chips de
 * filtros activos y botón Exportar. Los enlaces llegan calculados (solo texto).
 */
export default function VentasBarra({ filtros, chips, hrefExportar }) {
  const formRef = useRef(null);
  const enviar = () => formRef.current?.requestSubmit();

  const selector = (nombre, etiqueta, opciones, valor, formatear = (o) => o) => (
    <label className="admin-filtro" title={etiqueta}>
      <IconoFiltro size={16} />
      <select name={nombre} defaultValue={valor || ""} aria-label={etiqueta} onChange={enviar}>
        <option value="">{etiqueta}: todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {formatear(o)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <form ref={formRef} method="get" action="/admin/ventas" className="admin-barra">
        <div className="admin-barra-buscar">
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={filtros.q || ""} placeholder="Buscar por teléfono o referencia..." />
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("estado", "Estado", ESTADOS, filtros.estado, (e) => (e === "pendiente" ? "Pendiente" : "Cerrada"))}
        </div>

        <div className="admin-barra-buscar" style={{ flex: "0 1 auto", minWidth: 0 }}>
          {selector("categoria", "Categoría", CATEGORIAS, filtros.categoria)}
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("destino", "Entrega", DESTINOS, filtros.destino)}
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("tipo", "Cliente", TIPOS_CLIENTE, filtros.tipo)}
        </div>

        <span className="admin-rango" title="Rango de fechas">
          <IconoCalendario size={16} />
          <input type="date" name="desde" defaultValue={filtros.desde || ""} onChange={enviar} aria-label="Desde" />
          <span>a</span>
          <input type="date" name="hasta" defaultValue={filtros.hasta || ""} onChange={enviar} aria-label="Hasta" />
        </span>

        <div className="admin-barra-der">
          <a href={hrefExportar} className="btn-ico-texto">
            <IconoExportar /> Exportar CSV
          </a>
        </div>
      </form>

      {chips.length > 0 && (
        <div className="chips-periodo">
          {chips.map((c) => (
            <Link key={c.texto} href={c.href} className="chip-filtro" title="Quitar filtro">
              {c.texto} <IconoCerrar size={14} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
