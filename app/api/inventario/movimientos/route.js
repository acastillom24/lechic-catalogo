import { NextResponse } from "next/server";
import { verificarFirma } from "../../../../lib/firma";
import { aplicarMovimiento } from "../../../../lib/inventario";
import { query } from "../../../../lib/db";

/**
 * Recibe los eventos de facturacion_sunat y mueve el inventario.
 *
 *   evento "emitido" -> salida de stock por cada ítem
 *   evento "anulado" -> devolución, solo si existe la salida del "emitido"
 *   evento "prueba"  -> valida la firma y responde 200 sin tocar stock
 *
 * Cada ítem es idempotente (clave facturacion:empresa:comprobante:evento:codigo),
 * así que reintentar un envío completo es seguro. Contrato y firma: lib/firma.js.
 */
export const dynamic = "force-dynamic";

const EVENTOS = ["emitido", "anulado", "prueba"];
const MAX_ITEMS = 200;
const MAX_CUERPO = 256 * 1024;

function bad(mensaje, status = 400) {
  return NextResponse.json({ ok: false, error: mensaje }, { status });
}

// Valida el cuerpo ya firmado y lo normaliza. Devuelve { error } o { datos }.
function validar(b) {
  if (!b || typeof b !== "object") return { error: "Cuerpo inválido." };
  if (!EVENTOS.includes(b.evento)) return { error: "Evento inválido." };

  const empresa = typeof b.empresa === "string" ? b.empresa.trim() : "";
  if (!empresa || empresa.length > 80) return { error: "Falta la empresa." };

  if (b.evento === "prueba") return { datos: { evento: "prueba", empresa, items: [] } };

  const c = b.comprobante;
  const idComprobante = c && (typeof c.id === "string" || typeof c.id === "number") ? String(c.id) : "";
  if (!idComprobante || idComprobante.length > 80) return { error: "Falta comprobante.id." };
  const serie = typeof c.serie === "string" ? c.serie.trim() : "";
  const correlativo = c.correlativo !== undefined && c.correlativo !== null ? String(c.correlativo).trim() : "";
  if (!serie || !correlativo) return { error: "Faltan serie y correlativo del comprobante." };

  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MAX_ITEMS) {
    return { error: `items debe tener entre 1 y ${MAX_ITEMS} elementos.` };
  }
  // Suma las líneas con el mismo código (una clave de idempotencia por SKU).
  const porCodigo = new Map();
  for (const it of b.items) {
    const codigo = it && typeof it.codigo === "string" ? it.codigo.trim() : "";
    const cantidad = Number(it?.cantidad);
    if (!codigo || codigo.length > 100) return { error: "Cada ítem necesita un codigo." };
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return { error: `Cantidad inválida para "${codigo}": debe ser un entero positivo.` };
    }
    porCodigo.set(codigo, (porCodigo.get(codigo) || 0) + cantidad);
  }

  return {
    datos: {
      evento: b.evento,
      empresa,
      idComprobante,
      referencia: `${serie}-${correlativo}`,
      items: [...porCodigo].map(([codigo, cantidad]) => ({ codigo, cantidad })),
    },
  };
}

const clave = (d, evento, codigo) =>
  `facturacion:${d.empresa}:${d.idComprobante}:${evento}:${codigo}`;

export async function POST(request) {
  const secreto = process.env.INVENTARIO_WEBHOOK_SECRET;
  if (!secreto) {
    console.error("Falta INVENTARIO_WEBHOOK_SECRET: el endpoint de inventario está deshabilitado.");
    return bad("Integración no configurada.", 503);
  }

  const cuerpo = await request.text();
  if (cuerpo.length > MAX_CUERPO) return bad("Cuerpo demasiado grande.", 413);

  const f = await verificarFirma(
    secreto,
    request.headers.get("x-timestamp"),
    request.headers.get("x-signature"),
    cuerpo
  );
  if (!f.ok) return bad("No autorizado.", 401); // no se detalla el motivo al cliente

  let json;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return bad("JSON inválido.");
  }
  const { error, datos } = validar(json);
  if (error) return bad(error);

  if (datos.evento === "prueba") {
    return NextResponse.json({ ok: true, resultados: [] });
  }

  try {
    const resultados = [];
    for (const { codigo, cantidad } of datos.items) {
      if (datos.evento === "emitido") {
        const r = await aplicarMovimiento({
          sku: codigo,
          tipo: "salida",
          cantidad,
          motivo: `Venta ${datos.referencia}`,
          origen: "facturacion",
          referencia: datos.referencia,
          idempotencyKey: clave(datos, "emitido", codigo),
          permitirNegativo: true,
        });
        resultados.push({ codigo, estado: r.estado, ...(r.stock !== undefined ? { stock: r.stock } : {}) });
      } else {
        // anulado: solo se devuelve lo que realmente se descontó.
        const salida = await query(
          "select 1 from movimientos_inventario where idempotency_key = $1",
          [clave(datos, "emitido", codigo)]
        );
        if (!salida.length) {
          resultados.push({ codigo, estado: "sin_salida_previa" });
          continue;
        }
        const r = await aplicarMovimiento({
          sku: codigo,
          tipo: "devolucion",
          cantidad,
          motivo: `Anulación ${datos.referencia}`,
          origen: "facturacion",
          referencia: datos.referencia,
          idempotencyKey: clave(datos, "anulado", codigo),
        });
        resultados.push({ codigo, estado: r.estado, ...(r.stock !== undefined ? { stock: r.stock } : {}) });
      }
    }
    return NextResponse.json({ ok: true, resultados });
  } catch (err) {
    // Error de base de datos: 500 para que facturación reintente (todo es idempotente).
    console.error("inventario/movimientos:", err);
    return bad("Error interno.", 500);
  }
}
