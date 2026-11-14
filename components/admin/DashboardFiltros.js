"use client";

import Link from "next/link";
import { IconoCerrar, IconoExportar } from "./Iconos";
import FiltroColumna from "./FiltroColumna";

/**
 * Filtros del dashboard, con el mismo estilo que las tablas: tres botones (Periodo, Categoría y Entrega) que abren una ventanita
 * con sus opciones (el periodo con sus atajos y un rango propio), las etiquetas de los filtros activos con ✕ y «Exportar».
 * Todos los enlaces llegan calculados desde el servidor (solo texto).
 */
export default function DashboardFiltros({
  tab,
  periodo,
  etiquetaPeriodo,
  desde,
  hasta,
  hoy,
  categoria,
  destino,
  opciones,
  atajos,
  chips,
  hrefs,
  hrefExportar,
  mostrarPeriodo = true,
}) {
  const ACCION = "/admin/dashboard";
  // Lo que se conserva al enviar cada filtro: la pestaña y los demás filtros.
  const conservar = (excluir) => {
    const o = { tab, periodo, categoria, destino };
    if (periodo === "custom") Object.assign(o, { desde, hasta });
    for (const k of excluir) delete o[k];
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v));
  };

  return (
    <div className="form-grid" style={{ gap: 10 }}>
      <div className="admin-barra dash-barra">
        <div className="dash-filtros">
          {mostrarPeriodo && (
            <FiltroColumna
              etiqueta="Periodo"
              textoBoton={etiquetaPeriodo}
              activo={periodo !== "mes"}
              accion={ACCION}
              ocultos={{ ...conservar(["periodo", "desde", "hasta"]), periodo: "custom" }}
              hrefLimpiar={hrefs.periodo}
              atajos={atajos.map((a) => ({ clave: a.clave, texto: a.etiqueta, href: a.href, activo: periodo === a.clave }))}
              campos={[
                { tipo: "fecha", name: "desde", etiqueta: "Desde", valor: periodo === "custom" ? desde : "", max: hoy },
                { tipo: "fecha", name: "hasta", etiqueta: "Hasta", valor: periodo === "custom" ? hasta : "", max: hoy },
              ]}
            />
          )}
          <FiltroColumna
            etiqueta="Categoría"
            textoBoton={categoria ? `Categoría: ${categoria}` : "Categoría"}
            activo={Boolean(categoria)}
            accion={ACCION}
            ocultos={conservar(["categoria"])}
            hrefLimpiar={hrefs.categoria}
            campos={[{ tipo: "select", name: "categoria", valor: categoria, opciones: opciones.categorias.map((c) => ({ valor: c, texto: c })) }]}
          />
          <FiltroColumna
            etiqueta="Entrega"
            textoBoton={destino ? `Entrega: ${destino}` : "Entrega"}
            activo={Boolean(destino)}
            accion={ACCION}
            ocultos={conservar(["destino"])}
            hrefLimpiar={hrefs.destino}
            campos={[{ tipo: "select", name: "destino", valor: destino, opciones: opciones.destinos.map((d) => ({ valor: d, texto: d })) }]}
          />
        </div>

        {hrefExportar && (
          <div className="admin-barra-der">
            <a href={hrefExportar} className="btn-ico-texto">
              <IconoExportar /> Exportar CSV
            </a>
          </div>
        )}
      </div>

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
