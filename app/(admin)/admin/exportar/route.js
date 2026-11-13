import { getVariantesParaExportar, leerFiltrosColumnas } from "../../../../lib/inventario";
import { variantesACsv, plantillaCsv } from "../../../../lib/csv";

/**
 * Exporta el catálogo a CSV (mismo formato que acepta "Importar CSV").
 * Protegido por proxy.js (/admin/:path*).
 *
 *   alcance=seleccion  -> solo las variantes en `ids` (separadas por coma)
 *   alcance=filtrados  -> lo que coincide con `q`, `filtro` y los filtros de columna `c_*`
 *   alcance=todo       -> todo el catálogo
 *   alcance=plantilla  -> solo los encabezados
 *
 * Se usa POST para selecciones grandes (la lista de ids no cabe en una URL).
 */
export const dynamic = "force-dynamic";

const FILTROS = ["todas", "alertas", "sin_control"];

function respuestaCsv(texto, nombre) {
  return new Response(texto, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function exportar(datos) {
  const alcance = String(datos.alcance || "todo");
  const hoy = new Date().toISOString().slice(0, 10);

  if (alcance === "plantilla") return respuestaCsv(plantillaCsv(), "plantilla-productos.csv");

  let opciones = {};
  if (alcance === "seleccion") {
    const ids = String(datos.ids || "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return new Response("No hay filas seleccionadas.", { status: 400 });
    opciones = { ids };
  } else if (alcance === "filtrados") {
    const filtro = FILTROS.includes(datos.filtro) ? datos.filtro : "todas";
    opciones = { q: String(datos.q || "").trim(), filtro, columnas: leerFiltrosColumnas(datos) };
  } else if (alcance !== "todo") {
    return new Response("Alcance inválido.", { status: 400 });
  }

  const variantes = await getVariantesParaExportar(opciones);
  return respuestaCsv(variantesACsv(variantes), `productos-${alcance}-${hoy}.csv`);
}

export async function GET(request) {
  return exportar(Object.fromEntries(request.nextUrl.searchParams));
}

export async function POST(request) {
  const form = await request.formData();
  return exportar(Object.fromEntries(form));
}
