import Papa from "papaparse";
import writeExcelFile from "write-excel-file/node";
import { getVentasParaExportar } from "../../../../../lib/ventas";
import { fechaISO } from "../../../../../lib/ventas-core";
import { leerFiltrosVentas } from "../../../../../lib/filtros-ventas";
import { getOpcionesVentas } from "../../../../../lib/ventas-opciones";

/**
 * Exporta el reporte de ventas con los mismos filtros de la pantalla: CSV (por defecto) o Excel
 * (?formato=xlsx). Protegido por proxy.js (/admin/:path*). El CSV lleva BOM para que Excel respete tildes.
 */
export const dynamic = "force-dynamic";

const ENCABEZADOS = [
  "fecha", "telefono", "nombre_cliente", "distrito", "cliente_ref", "categoria", "monto", "adelanto", "saldo",
  "estado", "destino", "courier", "tipo_cliente", "metodo_pago", "comprobante",
  "notas", "registrado_por", "origen",
];

const fila = (v) => [
  fechaISO(v.fecha),
  v.telefono,
  v.cliente_nombre || "",
  v.distrito || "",
  v.cliente_ref || "",
  v.categoria,
  Number(v.monto),
  Number(v.adelanto),
  Number(v.monto) - Number(v.adelanto),
  v.estado,
  v.destino || "",
  v.courier || "",
  v.tipo_cliente || "",
  v.metodo_pago || "",
  v.comprobante || "",
  v.notas || "",
  v.registrado_por_nombre || "",
  v.origen,
];

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request) {
  const url = new URL(request.url);
  const filtros = leerFiltrosVentas(url.searchParams, await getOpcionesVentas());
  const filas = (await getVentasParaExportar(filtros)).map(fila);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const cabeceras = { "Cache-Control": "no-store" };

  if (url.searchParams.get("formato") === "xlsx") {
    const NEGRITA = { fontWeight: "bold", backgroundColor: "#F3E6E8" };
    const dinero = (n) => ({ value: n, type: Number, format: "#,##0.00" });
    const datos = [
      ENCABEZADOS.map((h) => ({ value: h, ...NEGRITA })),
      ...filas.map((f) => [
        { value: new Date(`${f[0]}T00:00:00Z`), type: Date, format: "dd/mm/yyyy" },
        { value: f[1], type: String },
        ...f.slice(2, 6).map((x) => ({ value: x, type: String })),
        dinero(f[6]),
        dinero(f[7]),
        dinero(f[8]),
        ...f.slice(9).map((x) => ({ value: x, type: String })),
      ]),
    ];
    const buffer = await writeExcelFile(datos, {
      columns: ENCABEZADOS.map((h) => ({ width: ["notas", "nombre_cliente", "cliente_ref"].includes(h) ? 28 : h === "fecha" ? 12 : 16 })),
      sheet: "Ventas",
    }).toBuffer();
    return new Response(buffer, {
      headers: {
        ...cabeceras,
        "Content-Type": MIME_XLSX,
        "Content-Disposition": `attachment; filename="ventas-${hoy}.xlsx"`,
      },
    });
  }

  // CSV: montos con 2 decimales como texto.
  const data = filas.map((f) => f.map((x, i) => ([6, 7, 8].includes(i) ? x.toFixed(2) : x)));
  const texto = "\ufeff" + Papa.unparse({ fields: ENCABEZADOS, data }, { newline: "\r\n" }) + "\r\n";
  return new Response(texto, {
    headers: {
      ...cabeceras,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-${hoy}.csv"`,
    },
  });
}
