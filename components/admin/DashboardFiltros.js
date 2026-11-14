"use client";

import Link from "next/link";
import FiltroColumna from "./FiltroColumna";
import FiltroCasillas from "./FiltroCasillas";

/**
 * Filtros del dashboard, en la misma fila que las pestañas y a la derecha: Periodo y Categoría. El Periodo ofrece atajos y un
 * rango propio; Categoría muestra su lista de opciones como casillas que se marcan con un clic (aplica al
 * instante; volver a pulsar la marcada la quita). Se elige una opción por filtro.
 * Los enlaces se calculan aquí a partir de texto simple que llega del servidor.
 */
export default function DashboardFiltros({
  tab,
  periodo,
  etiquetaPeriodo,
  desde,
  hasta,
  hoy,
  categoria,
  opciones,
  atajos,
  hrefs,
  mostrarPeriodo = true,
}) {
  const ACCION = "/admin/dashboard";
  // Lo que se conserva al cambiar un filtro: la pestaña y los demás filtros.
  const conservar = (excluir) => {
    const o = { tab, periodo, categoria };
    if (periodo === "custom") Object.assign(o, { desde, hasta });
    for (const k of excluir) delete o[k];
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v));
  };
  const hrefCon = (clave, valor) => `${ACCION}?${new URLSearchParams({ ...conservar([clave]), [clave]: valor })}`;

  const casillas = (titulo, clave, actual, lista, hrefLimpiar) => (
    <FiltroCasillas
      etiqueta={titulo}
      textoBoton={actual ? `${titulo}: ${actual}` : titulo}
      activo={Boolean(actual)}
      hrefLimpiar={hrefLimpiar}
      opciones={lista.map((valor) => ({ valor, texto: valor, href: hrefCon(clave, valor), marcada: actual === valor }))}
    />
  );

  return (
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
      {casillas("Categoría", "categoria", categoria, opciones.categorias, hrefs.categoria)}
    </div>
  );
}
