"use client";

import Link from "next/link";
import { useRef } from "react";
import { IconoFiltro, IconoCerrar, IconoExportar, IconoCalendario } from "./Iconos";
import { CATEGORIAS, DESTINOS } from "../../lib/ventas-core";

/**
 * Filtros del dashboard (mismo estilo que la barra de Productos):
 * atajos de periodo, rango personalizado, categoría y entrega.
 * Todos los enlaces llegan calculados desde el servidor (solo texto).
 */
export default function DashboardFiltros({
  tab,
  periodo,
  desde,
  hasta,
  hoy,
  categoria,
  destino,
  atajos,
  chips,
  hrefExportar,
  mostrarPeriodo = true,
}) {
  const formRef = useRef(null);
  const periodoRef = useRef(null);

  const enviar = () => formRef.current?.requestSubmit();
  const enviarRango = () => {
    if (periodoRef.current) periodoRef.current.value = "custom";
    enviar();
  };

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <form ref={formRef} method="get" action="/admin/dashboard" className="admin-barra">
        <input type="hidden" name="tab" value={tab} />
        <input ref={periodoRef} type="hidden" name="periodo" value={periodo} />

        {mostrarPeriodo && (
          <div className="chips-periodo">
            {atajos.map((a) => (
              <Link key={a.clave} href={a.href} className={periodo === a.clave ? "chip-per activo" : "chip-per"}>
                {a.etiqueta}
              </Link>
            ))}
            <span className="admin-rango" title="Rango personalizado">
              <IconoCalendario size={16} />
              <input type="date" name="desde" defaultValue={desde} max={hoy} onChange={enviarRango} aria-label="Desde" />
              <span>a</span>
              <input type="date" name="hasta" defaultValue={hasta} max={hoy} onChange={enviarRango} aria-label="Hasta" />
            </span>
          </div>
        )}

        <div className="admin-barra-buscar" style={{ flex: "0 1 auto", minWidth: 0 }}>
          <label className="admin-filtro" title="Categoría">
            <IconoFiltro size={16} />
            <select name="categoria" defaultValue={categoria || ""} aria-label="Categoría" onChange={enviar}>
              <option value="">Categoría: todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <span className="admin-barra-sep" aria-hidden="true" />
          <label className="admin-filtro" title="Entrega">
            <IconoFiltro size={16} />
            <select name="destino" defaultValue={destino || ""} aria-label="Entrega" onChange={enviar}>
              <option value="">Entrega: todas</option>
              {DESTINOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        {hrefExportar && (
          <div className="admin-barra-der">
            <a href={hrefExportar} className="btn-ico-texto">
              <IconoExportar /> Exportar CSV
            </a>
          </div>
        )}
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
