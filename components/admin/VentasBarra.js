"use client";

import Link from "next/link";
import { useRef } from "react";
import { IconoBuscar, IconoFiltro, IconoCerrar, IconoExportar, IconoCalendario } from "./Iconos";
import { ESTADOS } from "../../lib/ventas-core";

/**
 * Barra del reporte de ventas, con el mismo estilo que la de Productos:
 * atajos de periodo (hoy, ayer, 7 días, este mes, mes anterior), buscador, filtros por estado,
 * categoría, entrega y cliente, distrito, día específico o rango de fechas, chips de filtros
 * activos y exportación a CSV / Excel. Los enlaces llegan calculados (solo texto); las listas
 * (`opciones`) vienen de Configuración → Ventas.
 */
export default function VentasBarra({ filtros, chips, opciones, presets, hrefCsv, hrefExcel, hoy }) {
  const formRef = useRef(null);
  const fechaRef = useRef(null);
  const desdeRef = useRef(null);
  const hastaRef = useRef(null);
  const enviar = () => formRef.current?.requestSubmit();
  // Un día específico y un rango se excluyen: al elegir uno se limpia el otro.
  const elegirDia = () => {
    if (desdeRef.current) desdeRef.current.value = "";
    if (hastaRef.current) hastaRef.current.value = "";
    enviar();
  };
  const elegirRango = () => {
    if (fechaRef.current) fechaRef.current.value = "";
    enviar();
  };

  const selector = (nombre, etiqueta, lista, valor, formatear = (o) => o) => (
    <label className="admin-filtro" title={etiqueta}>
      <IconoFiltro size={16} />
      <select name={nombre} defaultValue={valor || ""} aria-label={etiqueta} onChange={enviar}>
        <option value="">{etiqueta}: todos</option>
        {lista.map((o) => (
          <option key={o} value={o}>
            {formatear(o)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <div className="chips-periodo">
        {presets.map((p) => (
          <Link key={p.clave} href={p.href} className={p.activo ? "chip-per activo" : "chip-per"}>
            {p.texto}
          </Link>
        ))}
      </div>

      <form ref={formRef} method="get" action="/admin/ventas" className="admin-barra">
        <div className="admin-barra-buscar">
          <IconoBuscar size={18} />
          <input type="search" name="q" defaultValue={filtros.q || ""} placeholder="Buscar por teléfono, nombre o referencia..." />
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("estado", "Estado", ESTADOS, filtros.estado, (e) => (e === "pendiente" ? "Pendiente" : "Cerrada"))}
        </div>

        <div className="admin-barra-buscar" style={{ flex: "0 1 auto", minWidth: 0 }}>
          {selector("categoria", "Categoría", opciones.categorias, filtros.categoria)}
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("destino", "Entrega", opciones.destinos, filtros.destino)}
          <span className="admin-barra-sep" aria-hidden="true" />
          {selector("tipo", "Cliente", opciones.tiposCliente, filtros.tipo)}
        </div>

        <div className="admin-barra-buscar" style={{ flex: "0 1 auto", minWidth: 0 }}>
          <input
            type="search"
            name="distrito"
            defaultValue={filtros.distrito || ""}
            placeholder="Distrito..."
            aria-label="Distrito"
            style={{ width: 140 }}
          />
        </div>

        <span className="admin-rango" title="Un día específico">
          <IconoCalendario size={16} />
          <span>Día</span>
          <input ref={fechaRef} type="date" name="fecha" defaultValue={filtros.fecha || ""} max={hoy} onChange={elegirDia} aria-label="Fecha específica" />
        </span>

        <span className="admin-rango" title="Rango de fechas">
          <IconoCalendario size={16} />
          <input
            ref={desdeRef}
            type="date"
            name="desde"
            defaultValue={filtros.periodo || filtros.fecha ? "" : filtros.desde || ""}
            max={hoy}
            onChange={elegirRango}
            aria-label="Desde"
          />
          <span>a</span>
          <input
            ref={hastaRef}
            type="date"
            name="hasta"
            defaultValue={filtros.periodo || filtros.fecha ? "" : filtros.hasta || ""}
            max={hoy}
            onChange={elegirRango}
            aria-label="Hasta"
          />
        </span>

        <div className="admin-barra-der">
          <a href={hrefCsv} className="btn-ico-texto">
            <IconoExportar /> CSV
          </a>
          <a href={hrefExcel} className="btn-ico-texto">
            <IconoExportar /> Excel
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
