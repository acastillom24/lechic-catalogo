"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconoBuscar, IconoCerrar, IconoExportar } from "./Iconos";

/**
 * Barra del reporte de ventas, simple:
 *  - el buscador y «Exportar» (CSV / Excel);
 *  - las etiquetas de los filtros activos, con ✕ para quitarlos.
 * Los filtros están en el encabezado de cada columna de la tabla (icono de filtro, como en Excel); los atajos de periodo, dentro de «Fecha».
 * `ocultos` = el resto de filtros activos, para que buscar no los pierda.
 */
export default function VentasBarra({ ocultos = {}, q, chips, hrefCsv, hrefExcel, accion = "/admin/ventas" }) {
  const menu = useRef(null);

  // El menú Exportar se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    const fuera = (e) => {
      if (menu.current?.open && !menu.current.contains(e.target)) menu.current.removeAttribute("open");
    };
    const tecla = (e) => e.key === "Escape" && menu.current?.removeAttribute("open");
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, []);

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <form method="get" action={accion} className="admin-barra ventas-barra">
        {Object.entries(ocultos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="admin-barra-buscar ancha">
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={q || ""} placeholder="Buscar por teléfono o nombre..." />
        </div>

        <details className="admin-menu admin-barra-der" ref={menu}>
          <summary className="btn-ico-texto">
            <IconoExportar /> Exportar
          </summary>
          <div className="admin-menu-lista">
            <a href={hrefCsv}>CSV</a>
            <a href={hrefExcel}>Excel</a>
          </div>
        </details>
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
