import Papa from "papaparse";
import { getVentasParaExportar } from "../../../../../lib/ventas";
import { fechaISO } from "../../../../../lib/ventas-core";
import { leerFiltrosVentas } from "../../../../../lib/filtros-ventas";

/**
 * Exporta el reporte de ventas a CSV con los mismos filtros de la pantalla.
 * Protegido por proxy.js (/admin/:path*). BOM para que Excel respete tildes.
 */
export const dynamic = "force-dynamic";

const ENCABEZADOS = [
  "fecha", "telefono", "cliente_ref", "categoria", "monto", "adelanto", "saldo",
  "estado", "destino", "courier", "tipo_cliente", "metodo_pago", "comprobante",
  "notas", "registrado_por", "origen",
];

export async function GET(request) {
  const filtros = leerFiltrosVentas(new URL(request.url).searchParams);
  const filas = await getVentasParaExportar(filtros);

  const data = filas.map((v) => [
    fechaISO(v.fecha),
    v.telefono,
    v.cliente_ref || "",
    v.categoria,
    Number(v.monto).toFixed(2),
    Number(v.adelanto).toFixed(2),
    (Number(v.monto) - Number(v.adelanto)).toFixed(2),
    v.estado,
    v.destino || "",
    v.courier || "",
    v.tipo_cliente || "",
    v.metodo_pago || "",
    v.comprobante || "",
    v.notas || "",
    v.registrado_por_nombre || "",
    v.origen,
  ]);

  const texto = "﻿" + Papa.unparse({ fields: ENCABEZADOS, data }, { newline: "\r\n" }) + "\r\n";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  return new Response(texto, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
